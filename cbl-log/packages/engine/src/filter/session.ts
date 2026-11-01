// The line filter of a tab (S-02, S-03): scans each file of the stream (archives loaded with the file,
// rolled files, the live one) in slices on the worker pool, oldest first, keeps the number and level of
// each retained line per file, extends itself when the stream grows and serves the filtered view
// (`rows`). Same lifecycle as a SearchSession.
import { randomUUID } from "node:crypto";
import { availableParallelism } from "node:os";
import {
  FILTER_LOOKBACK_LINES,
  levelFromCode,
  type Encoding,
  type FilterLocation,
  type LineFilter,
  type LogFormat,
  type Row,
  type SearchError,
  type TabEvent,
} from "@cbl-log/shared";
import { CHECKPOINT_INTERVAL } from "../index/scan.js";
import type { LineIndex } from "../index/line-index.js";
import type { NumberedLine } from "../index/lines.js";
import { planSlices, DEFAULT_SLICE_BYTES, type SearchTarget } from "../search/session.js";
import { FilterRun, type FilterSlice } from "./filter-host.js";

/** One readable file of the stream (a tailer segment), as for the search. */
export type FilterTarget = SearchTarget;

export interface FilterSessionOptions {
  /** Target size of a slice (default 16 MiB; boundaries are line starts taken from the checkpoints). */
  sliceBytes?: number;
  maxWorkers?: number;
  stallMs?: number;
  chunkSize?: number;
}

export type FilterEvent = Extract<TabEvent, { type: "filter" }>;

const EVENT_THROTTLE_MS = 100;
/** Checkpoints read before a slice to learn the level of its first record. */
const WARMUP_CHECKPOINTS = Math.ceil(FILTER_LOOKBACK_LINES / CHECKPOINT_INTERVAL);

interface SliceState {
  lines: Uint32Array[];
  levels: Uint8Array[];
  /** Continuation lines hidden under each retained line (all zero without folding). */
  folds: Uint32Array[];
  count: number;
  done: boolean;
  /** The last retained record of the slice runs up to the end of what was indexed: it may still grow. */
  tail?: { line: number; offset: number };
}

/** Results for one file of the stream; line numbers are those of that file. */
interface Part {
  slices: SliceState[];
  /** Everything before this offset / line has been filtered. */
  scannedTo: number;
  scannedLine: number;
}

/** Index of the checkpoint holding exactly `offset`, or -1. */
function checkpointAt(offsets: Float64Array, offset: number): number {
  let low = 0;
  let high = offsets.length - 1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    const value = offsets[mid]!;
    if (value === offset) return mid;
    if (value < offset) low = mid + 1;
    else high = mid - 1;
  }
  return -1;
}

export class FilterSession {
  readonly id = randomUUID();
  private parts = new Map<number, Part>();
  private run: { filter: FilterRun; part: Part; base: number } | undefined;
  private error: SearchError | undefined;
  private dirty = false;
  private disposed = false;
  /** The live file (last of the stream) at the last scan. */
  private liveId: number | undefined;
  private lastEmit = 0;
  private emitTimer: NodeJS.Timeout | undefined;

  constructor(
    readonly filter: LineFilter,
    private readonly format: LogFormat | null,
    private readonly getTargets: () => readonly FilterTarget[],
    private readonly readLines: (first: number, count: number) => Promise<NumberedLine[]>,
    private readonly emit: (event: FilterEvent) => void,
    private readonly options: FilterSessionOptions = {},
  ) {}

  /**
   * Lines available in the filtered view: the finished slices, file after file, then what the first
   * unfinished one has found so far (its results only grow at the end, so positions never move). Once
   * the scan is done, this is the number of retained lines.
   */
  get available(): number {
    let n = 0;
    for (const target of this.sync()) {
      for (const slice of this.parts.get(target.id)?.slices ?? []) {
        n += slice.count;
        if (!slice.done) return n;
      }
    }
    return n;
  }

  get done(): boolean {
    return !this.run && !this.dirty;
  }

  start(): void {
    this.scan();
  }

  /** The stream grew: filter the new part (queued if a scan is running). */
  extend(): void {
    if (this.disposed || this.error) return;
    this.scan();
  }

  /**
   * A rolling or a truncation: the results of the files still in the stream are kept, those of a
   * vanished one are dropped. The file that was live until now is filtered again in full from its new
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

  /** The stream was rebuilt from scratch: forget everything and filter again. */
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

  /** Rows [first, first+count) of the filtered view, with the numbers (and levels) of the stream. */
  async rows(first: number, count: number): Promise<{ rows: Row[]; total: number }> {
    const total = this.available;
    const start = Math.max(0, first);
    const n = Math.min(count, total - start);
    if (n <= 0) return { rows: [], total };

    const picked = this.pick(start, n);
    const fold = !!this.filter.foldContinuation;
    // fetch each run of consecutive lines with one read
    const byLine = new Map<number, NumberedLine>();
    for (let i = 0; i < picked.rows.length; ) {
      let j = i + 1;
      while (j < picked.rows.length && picked.rows[j] === picked.rows[j - 1]! + 1) j++;
      for (const line of await this.readLines(picked.rows[i]!, j - i)) byLine.set(line.lineNo, line);
      i = j;
    }
    const rows: Row[] = [];
    for (let i = 0; i < picked.rows.length; i++) {
      const line = byLine.get(picked.rows[i]!);
      // a line that could not be read (file truncated meanwhile) ends the page: positions must not shift
      if (!line) break;
      const level = levelFromCode(picked.levels[i]!);
      const folded = picked.folds[i]!;
      rows.push({ lineNo: line.lineNo, text: line.text, truncated: line.truncated, ...(level ? { level } : {}), ...(fold && folded > 0 ? { folded } : {}) });
    }
    return { rows, total };
  }

  /**
   * Where global row `row` falls in the filtered view: the number of retained lines before it.
   * `covered` tells whether the scan went far enough for the answer to be final.
   */
  locate(row: number): FilterLocation {
    let before = 0;
    for (const target of this.sync()) {
      if (row < target.startRow) return { position: before, exact: false, covered: true };
      const fileLine = row - target.startRow;
      for (const slice of this.parts.get(target.id)?.slices ?? []) {
        for (const chunk of slice.lines) {
          if (chunk.length === 0) continue;
          if (chunk[chunk.length - 1]! < fileLine) {
            before += chunk.length;
            continue;
          }
          let low = 0;
          let high = chunk.length - 1;
          while (low < high) {
            const mid = (low + high) >> 1;
            if (chunk[mid]! < fileLine) low = mid + 1;
            else high = mid;
          }
          return { position: before + low, exact: chunk[low] === fileLine, covered: true };
        }
        if (!slice.done) return { position: before, exact: false, covered: false };
      }
      if (fileLine < target.index.lineCount) return { position: before, exact: false, covered: this.done };
    }
    return { position: before, exact: false, covered: this.done };
  }

  // ---------------------------------------------------------------------------------------------

  /** The files of the stream, oldest first; drops the results of the files that left it. */
  private sync(): readonly FilterTarget[] {
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
    if (!part) this.parts.set(id, (part = { slices: [], scannedTo: 0, scannedLine: 0 }));
    return part;
  }

  /** Global rows and level codes at positions [start, start+n) of the view. */
  private pick(start: number, n: number): { rows: number[]; levels: number[]; folds: number[] } {
    const rows: number[] = [];
    const levels: number[] = [];
    const folds: number[] = [];
    let skipped = 0;
    for (const target of this.sync()) {
      for (const slice of this.parts.get(target.id)?.slices ?? []) {
        for (let c = 0; c < slice.lines.length && rows.length < n; c++) {
          const chunk = slice.lines[c]!;
          if (skipped + chunk.length <= start) {
            skipped += chunk.length;
            continue;
          }
          for (let k = Math.max(0, start - skipped); k < chunk.length && rows.length < n; k++) {
            rows.push(target.startRow + chunk[k]!);
            levels.push(slice.levels[c]![k]!);
            folds.push(slice.folds[c]![k]!);
          }
          skipped += chunk.length;
        }
        if (rows.length >= n || !slice.done) return { rows, levels, folds };
      }
    }
    return { rows, levels, folds };
  }

  /**
   * With folding, a record still being written when the last scan of a file stopped has an incomplete
   * count: take its head out of the results and scan again from it.
   */
  private rewindUnfinishedRecord(part: Part): void {
    for (let s = part.slices.length - 1; s >= 0; s--) {
      const slice = part.slices[s]!;
      if (slice.count === 0) continue;
      if (!slice.tail) return; // the last retained record was complete
      const chunk = slice.lines.length - 1;
      slice.lines[chunk] = slice.lines[chunk]!.subarray(0, -1);
      slice.levels[chunk] = slice.levels[chunk]!.subarray(0, -1);
      slice.folds[chunk] = slice.folds[chunk]!.subarray(0, -1);
      slice.count--;
      part.scannedTo = slice.tail.offset;
      part.scannedLine = slice.tail.line;
      slice.tail = undefined;
      return;
    }
  }

  private cancelRun(): void {
    const run = this.run;
    if (!run) return;
    this.run = undefined;
    run.filter.cancel();
    run.part.slices.length = run.base;
  }

  /** Filters the first file with unfiltered lines (oldest first); emits once there is none left. */
  private scan(): void {
    if (this.run) {
      this.dirty = true;
      return;
    }
    const targets = this.sync();
    this.liveId = targets.at(-1)?.id;
    for (const target of targets) {
      const index = target.index;
      const part = this.partOf(target.id);
      // read together: the index may grow between two ticks, never within one
      const limit = index.indexedBytes;
      if (limit <= part.scannedTo) continue;
      if (this.filter.foldContinuation) this.rewindUnfinishedRecord(part);
      const checkpoints = index.checkpoints;
      const offsets = new Float64Array(checkpoints.buffer, 0, checkpoints.count);
      const limitLine = index.lineCount - (index.isLastLineOpen ? 1 : 0);
      const plan = planSlices(offsets, part.scannedTo, limit, this.options.sliceBytes ?? DEFAULT_SLICE_BYTES);
      if (plan.length === 0) continue;
      const work: FilterSlice[] = plan.map((slice, i) => {
        const startLine = i === 0 ? part.scannedLine : checkpointAt(offsets, slice.start) * CHECKPOINT_INTERVAL;
        const warmupCheckpoint = Math.max(0, Math.floor(startLine / CHECKPOINT_INTERVAL) - WARMUP_CHECKPOINTS);
        return {
          warmupOffset: offsets[warmupCheckpoint] ?? 0,
          warmupLine: warmupCheckpoint * CHECKPOINT_INTERVAL,
          start: slice.start,
          end: slice.end,
        };
      });
      this.startRun(target, part, work, limit, limitLine);
      return;
    }
    this.emitNow();
  }

  private startRun(target: FilterTarget, part: Part, work: FilterSlice[], limit: number, limitLine: number): void {
    const base = part.slices.length;
    for (let i = 0; i < work.length; i++) part.slices.push({ lines: [], levels: [], folds: [], count: 0, done: false });
    const run: { filter: FilterRun; part: Part; base: number } = {
      part,
      base,
      filter: new FilterRun({
        path: target.path,
        encoding: target.encoding,
        filter: this.filter,
        format: this.format,
        slices: work,
        limit,
        maxWorkers: this.options.maxWorkers ?? Math.max(1, Math.min(4, availableParallelism() - 1)),
        stallMs: this.options.stallMs,
        chunkSize: this.options.chunkSize,
        onTail: (sliceIndex, line, offset) => {
          if (this.run === run) part.slices[base + sliceIndex]!.tail = { line, offset };
        },
        onLines: (sliceIndex, lines, levels, folds) => {
          if (this.run !== run) return;
          const slice = part.slices[base + sliceIndex]!;
          slice.lines.push(lines);
          slice.levels.push(levels);
          slice.folds.push(folds);
          slice.count += lines.length;
          this.emitThrottled();
        },
        onSliceDone: (sliceIndex) => {
          if (this.run !== run) return;
          part.slices[base + sliceIndex]!.done = true;
          this.emitThrottled();
        },
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
          part.scannedLine = limitLine;
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
      type: "filter",
      id: this.id,
      matches: this.available,
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
