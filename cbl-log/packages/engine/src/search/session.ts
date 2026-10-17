// One search over a tab's current file: scans it in slices on the worker pool, keeps the offsets of
// the matching lines, extends itself when the file grows and answers "next / previous match".
import { randomUUID } from "node:crypto";
import { availableParallelism } from "node:os";
import type { Encoding, SearchError, SearchHit, SearchQuery, TabEvent } from "@cbl-log/shared";
import type { LineIndex } from "../index/line-index.js";
import { SearchRun, type Slice } from "./search-host.js";

export interface SearchTarget {
  path: string;
  encoding: Encoding;
  /** Global row of the first line of this file. */
  startRow: number;
  index: LineIndex;
}

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
  private slices: SliceState[] = [];
  private run: SearchRun | undefined;
  private scannedTo = -1;
  private matchCount = 0;
  private error: SearchError | undefined;
  private dirty = false;
  private disposed = false;
  private lastEmit = 0;
  private emitTimer: NodeJS.Timeout | undefined;

  constructor(
    readonly query: SearchQuery,
    private readonly getTarget: () => SearchTarget | undefined,
    private readonly emit: (event: QueryEvent) => void,
    private readonly options: SearchSessionOptions = {},
  ) {}

  get matches(): number {
    return this.matchCount;
  }

  get done(): boolean {
    return !this.run && !this.dirty;
  }

  start(): void {
    this.scan();
  }

  /** The file grew: scan the new part (queued if a scan is running). */
  extend(): void {
    if (this.disposed || this.error) return;
    this.scan();
  }

  /** The file was rolled or truncated: forget the results and search the new file. */
  restart(): void {
    if (this.disposed) return;
    this.run?.cancel();
    this.run = undefined;
    this.slices = [];
    this.matchCount = 0;
    this.scannedTo = -1;
    this.error = undefined;
    this.dirty = false;
    this.scan();
  }

  dispose(): void {
    this.disposed = true;
    this.run?.cancel();
    this.run = undefined;
    clearTimeout(this.emitTimer);
  }

  async next(fromRow: number, dir: "next" | "prev"): Promise<SearchHit> {
    const target = this.getTarget();
    const done = this.done;
    const none: SearchHit = { row: null, ordinal: null, matches: this.matchCount, done, wrapped: false };
    if (!target || this.matchCount === 0) return none;

    const rel = fromRow - target.startRow;
    let fromOffset: number;
    if (rel < 0) fromOffset = -1;
    else if (rel >= target.index.lineCount) fromOffset = Number.POSITIVE_INFINITY;
    else fromOffset = await target.index.offsetOf(rel);

    let offset = dir === "next" ? this.findAfter(fromOffset) : this.findBefore(fromOffset);
    let wrapped = false;
    if (offset === undefined && done) {
      wrapped = true;
      offset = dir === "next" ? this.findAfter(-1) : this.findBefore(Number.POSITIVE_INFINITY);
    }
    if (offset === undefined) return none;
    const line = await target.index.lineAtOffset(offset);
    return { row: target.startRow + line, ordinal: this.rank(offset), matches: this.matchCount, done, wrapped };
  }

  // ---------------------------------------------------------------------------------------------

  private scan(): void {
    if (this.run) {
      this.dirty = true;
      return;
    }
    const target = this.getTarget();
    if (!target) {
      this.emitNow();
      return;
    }
    const checkpoints = target.index.checkpoints;
    const offsets = new Float64Array(checkpoints.buffer, 0, checkpoints.count);
    const limit = target.index.indexedBytes;
    const from = this.scannedTo >= 0 ? this.scannedTo : (offsets[0] ?? 0);
    const slices = planSlices(offsets, from, limit, this.options.sliceBytes ?? DEFAULT_SLICE_BYTES);
    if (slices.length === 0) {
      this.scannedTo = Math.max(this.scannedTo, from);
      this.emitNow();
      return;
    }

    const base = this.slices.length;
    for (let i = 0; i < slices.length; i++) this.slices.push({ chunks: [] });
    this.run = new SearchRun({
      path: target.path,
      encoding: target.encoding,
      query: this.query,
      slices,
      maxWorkers: this.options.maxWorkers ?? Math.max(1, Math.min(4, availableParallelism() - 1)),
      ...(this.options.stallMs !== undefined ? { stallMs: this.options.stallMs } : {}),
      ...(this.options.chunkSize !== undefined ? { chunkSize: this.options.chunkSize } : {}),
      onMatches: (sliceIndex, found) => {
        this.slices[base + sliceIndex]!.chunks.push(found);
        this.matchCount += found.length;
        this.emitThrottled();
      },
      onSliceDone: () => {},
      onFinished: (error) => {
        this.run = undefined;
        if (this.disposed) return;
        if (error) {
          this.error = error;
          this.dirty = false;
        } else {
          this.scannedTo = limit;
        }
        if (this.dirty && !error) {
          this.dirty = false;
          this.scan();
        } else {
          this.emitNow();
        }
      },
    });
  }

  private emitNow(): void {
    clearTimeout(this.emitTimer);
    this.emitTimer = undefined;
    this.lastEmit = Date.now();
    if (this.disposed) return;
    this.emit({
      type: "query",
      id: this.id,
      matches: this.matchCount,
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

  private findAfter(value: number): number | undefined {
    for (const slice of this.slices) {
      for (const chunk of slice.chunks) {
        if (chunk.length > 0 && chunk[chunk.length - 1]! > value) return chunk[upperBound(chunk, value)];
      }
    }
    return undefined;
  }

  private findBefore(value: number): number | undefined {
    for (let s = this.slices.length - 1; s >= 0; s--) {
      const chunks = this.slices[s]!.chunks;
      for (let c = chunks.length - 1; c >= 0; c--) {
        const chunk = chunks[c]!;
        if (chunk.length > 0 && chunk[0]! < value) return chunk[lowerBound(chunk, value) - 1];
      }
    }
    return undefined;
  }

  /** 1-based rank of `offset` among the matches found so far. */
  private rank(offset: number): number {
    let count = 0;
    for (const slice of this.slices) for (const chunk of slice.chunks) count += upperBound(chunk, offset);
    return count;
  }
}
