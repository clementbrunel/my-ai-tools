// One search over a tab's stream (the archives loaded with the file, the rolled files, the live one):
// scans each file in slices on the worker pool, oldest first, keeps the offsets of the matching lines
// per file, extends itself when the stream grows and answers "next / previous match" across files.
import { randomUUID } from "node:crypto";
import { availableParallelism } from "node:os";
import type { Encoding, SearchError, SearchHit, SearchQuery, TabEvent } from "@cbl-log/shared";
import type { LineIndex } from "../index/line-index.js";
import { SearchRun, type Slice } from "./search-host.js";

/** One readable file of the stream (a tailer segment). */
export interface SearchTarget {
  /** Stable across rollings: the results of a file are kept while it stays in the stream. */
  id: number;
  path: string;
  encoding: Encoding;
  /** Global row of the first line of this file. */
  startRow: number;
  index: LineIndex;
}

/** Runs `fn` on the index of file `id` with its file open; undefined when it is no longer readable. */
export type IndexAccess = <T>(id: number, fn: (index: LineIndex) => Promise<T>) => Promise<T | undefined>;

export interface SearchSessionOptions {
  /** Target size of a slice (default 16 MiB; boundaries are line starts taken from the checkpoints). */
  sliceBytes?: number;
  maxWorkers?: number;
  stallMs?: number;
  chunkSize?: number;
}

export type QueryEvent = Extract<TabEvent, { type: "query" }>;

export const DEFAULT_SLICE_BYTES = 16 * 1024 * 1024;
const EVENT_THROTTLE_MS = 100;

interface SliceState {
  chunks: Float64Array[];
}

/** Results for one file of the stream; offsets are positions in that file. */
interface Part {
  slices: SliceState[];
  /** Everything before this offset has been searched (-1: nothing yet). */
  scannedTo: number;
  count: number;
}

/** Line-start offsets in [from, limit) at which to cut slices of about `sliceBytes`. */
export function planSlices(checkpoints: ArrayLike<number>, from: number, limit: number, sliceBytes: number): Slice[] {
  const slices: Slice[] = [];
  let start = from;
  for (let i = 0; i < checkpoints.length && start < limit; i++) {
    const offset = checkpoints[i]!;
    if (offset > start && offset < limit && offset - start >= sliceBytes) {
      slices.push({ start, end: offset });
      start = offset;
    }
  }
  if (start < limit) slices.push({ start, end: limit });
  return slices;
}

/** Index of the first element > value. */
function upperBound(values: Float64Array, value: number): number {
  let low = 0;
  let high = values.length;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (values[mid]! <= value) low = mid + 1;
    else high = mid;
  }
  return low;
}

/** Index of the first element >= value. */
function lowerBound(values: Float64Array, value: number): number {
  let low = 0;
  let high = values.length;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (values[mid]! < value) low = mid + 1;
    else high = mid;
  }
  return low;
}

export class SearchSession {
  readonly id = randomUUID();
  private parts = new Map<number, Part>();
  private run: { search: SearchRun; part: Part; base: number } | undefined;
  private error: SearchError | undefined;
  private dirty = false;
  private disposed = false;
  /** The live file (last of the stream) at the last scan. */
  private liveId: number | undefined;
  private lastEmit = 0;
  private emitTimer: NodeJS.Timeout | undefined;

  constructor(
    readonly query: SearchQuery,
    private readonly getTargets: () => readonly SearchTarget[],
    private readonly useIndex: IndexAccess,
    private readonly emit: (event: QueryEvent) => void,
    private readonly options: SearchSessionOptions = {},
  ) {}

  get matches(): number {
    let n = 0;
    for (const part of this.parts.values()) n += part.count;
    return n;
  }

  get done(): boolean {
    return !this.run && !this.dirty;
  }

  start(): void {
    this.scan();
  }

  /** The stream grew: search the new part (queued if a scan is running). */
  extend(): void {
    if (this.disposed || this.error) return;
    this.scan();
  }

  /**
   * A rolling or a truncation: the results of the files still in the stream are kept, those of a
   * vanished one are dropped. The file that was live until now is searched again in full from its new
   * path: between the writer's rename and the tailer noticing it, a worker opening the live path may
   * have read the new file at the old file's offsets.
   */
  rolled(): void {
    if (this.disposed || this.error) return;
    this.cancelRun();
    if (this.liveId !== undefined) this.parts.delete(this.liveId);
    this.dirty = false;
    this.scan();
  }

  /** The stream was rebuilt from scratch: forget everything and search again. */
  restart(): void {
    if (this.disposed) return;
    this.cancelRun();
    this.parts.clear();
    this.error = undefined;
    this.dirty = false;
    this.scan();
  }

  dispose(): void {
    this.disposed = true;
    this.cancelRun();
    clearTimeout(this.emitTimer);
  }

  async next(fromRow: number, dir: "next" | "prev"): Promise<SearchHit> {
    const targets = this.sync();
    const done = this.done;
    const matches = this.matches;
    const none: SearchHit = { row: null, ordinal: null, matches, done, wrapped: false };
    if (targets.length === 0 || matches === 0) return none;

    // the file holding the reference row, and the offset of that row in it
    let k = -1;
    for (let i = 0; i < targets.length && targets[i]!.startRow <= fromRow; i++) k = i;
    let fromOffset = -1;
    if (k >= 0) {
      const target = targets[k]!;
      const rel = fromRow - target.startRow;
      fromOffset =
        rel >= target.index.lineCount
          ? Number.POSITIVE_INFINITY
          : ((await this.useIndex(target.id, (index) => index.offsetOf(rel))) ?? Number.POSITIVE_INFINITY);
    }

    let found: { at: number; offset: number } | undefined;
    if (dir === "next") found = this.findNext(targets, Math.max(0, k), fromOffset);
    else if (k >= 0) found = this.findPrev(targets, k, fromOffset);
    let wrapped = false;
    if (!found && done) {
      wrapped = true;
      found = dir === "next" ? this.findNext(targets, 0, -1) : this.findPrev(targets, targets.length - 1, Number.POSITIVE_INFINITY);
    }
    if (!found) return none;
    const target = targets[found.at]!;
    const offset = found.offset;
    const line = await this.useIndex(target.id, (index) => index.lineAtOffset(offset));
    if (line === undefined) return none;
    let ordinal = 0;
    for (let i = 0; i < found.at; i++) ordinal += this.parts.get(targets[i]!.id)?.count ?? 0;
    ordinal += rank(this.parts.get(target.id)!, offset);
    return { row: target.startRow + line, ordinal, matches, done, wrapped };
  }

  // ---------------------------------------------------------------------------------------------

  /** The files of the stream, oldest first; drops the results of the files that left it. */
  private sync(): readonly SearchTarget[] {
    const targets = this.getTargets();
    const ids = new Set(targets.map((t) => t.id));
    for (const id of [...this.parts.keys()]) {
      if (ids.has(id)) continue;
      if (this.run && this.parts.get(id) === this.run.part) this.cancelRun();
      this.parts.delete(id);
    }
    return targets;
  }

  private partOf(id: number): Part {
    let part = this.parts.get(id);
    if (!part) this.parts.set(id, (part = { slices: [], scannedTo: -1, count: 0 }));
    return part;
  }

  /** First match after `offset` in file `at`, else the first one of the next files. */
  private findNext(targets: readonly SearchTarget[], at: number, offset: number): { at: number; offset: number } | undefined {
    for (let i = at; i < targets.length; i++) {
      const part = this.parts.get(targets[i]!.id);
      const found = part && findAfter(part, i === at ? offset : -1);
      if (found !== undefined) return { at: i, offset: found };
    }
    return undefined;
  }

  /** Last match before `offset` in file `at`, else the last one of the previous files. */
  private findPrev(targets: readonly SearchTarget[], at: number, offset: number): { at: number; offset: number } | undefined {
    for (let i = at; i >= 0; i--) {
      const part = this.parts.get(targets[i]!.id);
      const found = part && findBefore(part, i === at ? offset : Number.POSITIVE_INFINITY);
      if (found !== undefined) return { at: i, offset: found };
    }
    return undefined;
  }

  private cancelRun(): void {
    const run = this.run;
    if (!run) return;
    this.run = undefined;
    run.search.cancel();
    run.part.slices.length = run.base;
    run.part.count = run.part.slices.reduce((n, slice) => n + slice.chunks.reduce((m, c) => m + c.length, 0), 0);
  }

  /** Searches the first file with unsearched lines (oldest first); emits once there is none left. */
  private scan(): void {
    if (this.run) {
      this.dirty = true;
      return;
    }
    const targets = this.sync();
    this.liveId = targets.at(-1)?.id;
    for (const target of targets) {
      const part = this.partOf(target.id);
      const checkpoints = target.index.checkpoints;
      const offsets = new Float64Array(checkpoints.buffer, 0, checkpoints.count);
      const limit = target.index.indexedBytes;
      const from = part.scannedTo >= 0 ? part.scannedTo : (offsets[0] ?? 0);
      const slices = planSlices(offsets, from, limit, this.options.sliceBytes ?? DEFAULT_SLICE_BYTES);
      if (slices.length === 0) {
        part.scannedTo = Math.max(part.scannedTo, from);
        continue;
      }
      this.startRun(target, part, slices, limit);
      return;
    }
    this.emitNow();
  }

  private startRun(target: SearchTarget, part: Part, slices: Slice[], limit: number): void {
    const base = part.slices.length;
    for (let i = 0; i < slices.length; i++) part.slices.push({ chunks: [] });
    const run: { search: SearchRun; part: Part; base: number } = {
      part,
      base,
      search: new SearchRun({
        path: target.path,
        encoding: target.encoding,
        query: this.query,
        slices,
        maxWorkers: this.options.maxWorkers ?? Math.max(1, Math.min(4, availableParallelism() - 1)),
        ...(this.options.stallMs !== undefined ? { stallMs: this.options.stallMs } : {}),
        ...(this.options.chunkSize !== undefined ? { chunkSize: this.options.chunkSize } : {}),
        onMatches: (sliceIndex, found) => {
          if (this.run !== run) return;
          part.slices[base + sliceIndex]!.chunks.push(found);
          part.count += found.length;
          this.emitThrottled();
        },
        onSliceDone: () => {},
        onFinished: (error) => {
          if (this.run !== run) return;
          this.run = undefined;
          if (this.disposed) return;
          if (error) {
            this.error = error;
            this.dirty = false;
            this.emitNow();
            return;
          }
          part.scannedTo = limit;
          this.dirty = false;
          this.scan(); // the next file, or what arrived meanwhile
        },
      }),
    };
    this.run = run;
  }

  private emitNow(): void {
    clearTimeout(this.emitTimer);
    this.emitTimer = undefined;
    this.lastEmit = Date.now();
    if (this.disposed) return;
    this.emit({
      type: "query",
      id: this.id,
      matches: this.matches,
      done: this.done,
      ...(this.error ? { error: this.error } : {}),
    });
  }

  private emitThrottled(): void {
    if (this.emitTimer) return;
    const wait = this.lastEmit + EVENT_THROTTLE_MS - Date.now();
    if (wait <= 0) this.emitNow();
    else this.emitTimer = setTimeout(() => this.emitNow(), wait);
  }
}

function findAfter(part: Part, value: number): number | undefined {
  for (const slice of part.slices) {
    for (const chunk of slice.chunks) {
      if (chunk.length > 0 && chunk[chunk.length - 1]! > value) return chunk[upperBound(chunk, value)];
    }
  }
  return undefined;
}

function findBefore(part: Part, value: number): number | undefined {
  for (let s = part.slices.length - 1; s >= 0; s--) {
    const chunks = part.slices[s]!.chunks;
    for (let c = chunks.length - 1; c >= 0; c--) {
      const chunk = chunks[c]!;
      if (chunk.length > 0 && chunk[0]! < value) return chunk[lowerBound(chunk, value) - 1];
    }
  }
  return undefined;
}

/** 1-based rank of `offset` among the matches of the file found so far. */
function rank(part: Part, offset: number): number {
  let count = 0;
  for (const slice of part.slices) for (const chunk of slice.chunks) count += upperBound(chunk, offset);
  return count;
}
