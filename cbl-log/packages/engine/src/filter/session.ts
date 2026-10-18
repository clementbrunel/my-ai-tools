// The line filter of a tab (S-02, S-03): scans the current file in slices on the worker pool, keeps the
// number and level of each retained line, extends itself when the file grows and serves the filtered
// view (`rows`). Same lifecycle as a SearchSession.
import { randomUUID } from "node:crypto";
import { availableParallelism } from "node:os";
import {
  FILTER_LOOKBACK_LINES,
  levelFromCode,
  type Encoding,
  type LineFilter,
  type LogFormat,
  type Row,
  type SearchError,
  type TabEvent,
} from "@cbl-log/shared";
import { CHECKPOINT_INTERVAL } from "../index/scan.js";
import type { LineIndex } from "../index/line-index.js";
import type { NumberedLine } from "../index/lines.js";
import { planSlices, DEFAULT_SLICE_BYTES } from "../search/session.js";
import { FilterRun, type FilterSlice } from "./filter-host.js";

export interface FilterTarget {
  path: string;
  encoding: Encoding;
  /** Global row of the first line of this file. */
  startRow: number;
  index: LineIndex;
}

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
  count: number;
  done: boolean;
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
  private slices: SliceState[] = [];
  private run: FilterRun | undefined;
  /** Everything before this offset / line has been filtered. */
  private scannedTo = 0;
  private scannedLine = 0;
  private error: SearchError | undefined;
  private dirty = false;
  private disposed = false;
  private lastEmit = 0;
  private emitTimer: NodeJS.Timeout | undefined;

  constructor(
    readonly filter: LineFilter,
    private readonly format: LogFormat | null,
    private readonly getTarget: () => FilterTarget | undefined,
    private readonly readLines: (first: number, count: number) => Promise<NumberedLine[]>,
    private readonly emit: (event: FilterEvent) => void,
    private readonly options: FilterSessionOptions = {},
  ) {}

  /**
   * Lines available in the filtered view: the finished slices, then what the first unfinished one has
   * found so far (its results only grow at the end, so positions never move). Once the scan is done,
   * this is the number of retained lines.
   */
  get available(): number {
    let n = 0;
    for (const slice of this.slices) {
      n += slice.count;
      if (!slice.done) break;
    }
    return n;
  }

  get done(): boolean {
    return !this.run && !this.dirty;
  }

  start(): void {
    this.scan();
  }

  /** The file grew: filter the new part (queued if a scan is running). */
  extend(): void {
    if (this.disposed || this.error) return;
    this.scan();
  }

  /** The file was rolled or truncated: forget the results and filter the new file. */
  restart(): void {
    if (this.disposed) return;
    this.run?.cancel();
    this.run = undefined;
    this.slices = [];
    this.scannedTo = 0;
    this.scannedLine = 0;
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

  /** Rows [first, first+count) of the filtered view, with the numbers (and levels) of the file. */
  async rows(first: number, count: number): Promise<{ rows: Row[]; total: number }> {
    const total = this.available;
    const target = this.getTarget();
    const start = Math.max(0, first);
    const n = Math.min(count, total - start);
    if (!target || n <= 0) return { rows: [], total };

    const picked = this.pick(start, n);
    // fetch each run of consecutive lines of the file with one read
    const byLine = new Map<number, NumberedLine>();
    for (let i = 0; i < picked.lines.length; ) {
      let j = i + 1;
      while (j < picked.lines.length && picked.lines[j] === picked.lines[j - 1]! + 1) j++;
      for (const line of await this.readLines(target.startRow + picked.lines[i]!, j - i)) byLine.set(line.lineNo, line);
      i = j;
    }
    const rows: Row[] = [];
    for (let i = 0; i < picked.lines.length; i++) {
      const line = byLine.get(target.startRow + picked.lines[i]!);
      // a line that could not be read (file truncated meanwhile) ends the page: positions must not shift
      if (!line) break;
      const level = levelFromCode(picked.levels[i]!);
      rows.push({ lineNo: line.lineNo, text: line.text, truncated: line.truncated, ...(level ? { level } : {}) });
    }
    return { rows, total };
  }

  // ---------------------------------------------------------------------------------------------

  /** File line numbers and level codes at positions [start, start+n) of the view. */
  private pick(start: number, n: number): { lines: number[]; levels: number[] } {
    const lines: number[] = [];
    const levels: number[] = [];
    let skipped = 0;
    for (const slice of this.slices) {
      for (let c = 0; c < slice.lines.length && lines.length < n; c++) {
        const chunk = slice.lines[c]!;
        if (skipped + chunk.length <= start) {
          skipped += chunk.length;
          continue;
        }
        for (let k = Math.max(0, start - skipped); k < chunk.length && lines.length < n; k++) {
          lines.push(chunk[k]!);
          levels.push(slice.levels[c]![k]!);
        }
        skipped += chunk.length;
      }
      if (lines.length >= n || !slice.done) break;
    }
    return { lines, levels };
  }

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
    const index = target.index;
    // read together: the index may grow between two ticks, never within one
    const checkpoints = index.checkpoints;
    const offsets = new Float64Array(checkpoints.buffer, 0, checkpoints.count);
    const limit = index.indexedBytes;
    const limitLine = index.lineCount - (index.isLastLineOpen ? 1 : 0);

    const plan = planSlices(offsets, this.scannedTo, limit, this.options.sliceBytes ?? DEFAULT_SLICE_BYTES);
    if (plan.length === 0) {
      this.emitNow();
      return;
    }
    const work: FilterSlice[] = plan.map((slice, i) => {
      const startLine = i === 0 ? this.scannedLine : checkpointAt(offsets, slice.start) * CHECKPOINT_INTERVAL;
      const warmupCheckpoint = Math.max(0, Math.floor(startLine / CHECKPOINT_INTERVAL) - WARMUP_CHECKPOINTS);
      return {
        warmupOffset: offsets[warmupCheckpoint] ?? 0,
        warmupLine: warmupCheckpoint * CHECKPOINT_INTERVAL,
        start: slice.start,
        end: slice.end,
      };
    });

    const base = this.slices.length;
    for (let i = 0; i < work.length; i++) this.slices.push({ lines: [], levels: [], count: 0, done: false });
    this.run = new FilterRun({
      path: target.path,
      encoding: target.encoding,
      filter: this.filter,
      format: this.format,
      slices: work,
      maxWorkers: this.options.maxWorkers ?? Math.max(1, Math.min(4, availableParallelism() - 1)),
      stallMs: this.options.stallMs,
      chunkSize: this.options.chunkSize,
      onLines: (sliceIndex, lines, levels) => {
        const slice = this.slices[base + sliceIndex]!;
        slice.lines.push(lines);
        slice.levels.push(levels);
        slice.count += lines.length;
        this.emitThrottled();
      },
      onSliceDone: (sliceIndex) => {
        this.slices[base + sliceIndex]!.done = true;
        this.emitThrottled();
      },
      onFinished: (error) => {
        this.run = undefined;
        if (this.disposed) return;
        if (error) {
          this.error = error;
          this.dirty = false;
        } else {
          this.scannedTo = limit;
          this.scannedLine = limitLine;
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
