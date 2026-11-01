// Search and filter of the "All" tab (M-01d). They read the merged rows in order, a chunk at a time, and
// keep the rows that pass: the sources are different files, so the slices-on-workers machinery of the
// single-file sessions does not apply. Same lifecycle as them: `extend` when the view grew, `rebind` when
// the sources changed (the id, known to the renderer, stays), `dispose`.
import { randomUUID } from "node:crypto";
import type { MergedView } from "./merged-view.js";

/** Decides on one line: -1 = rejected, 0.. = kept (with a level code for a filter). */
export type RowTest = (source: number, text: string) => number;

export interface MergedScanOptions {
  chunkRows?: number;
  throttleMs?: number;
}

export interface MergedScanEvent {
  id: string;
  matches: number;
  done: boolean;
}

const DEFAULT_CHUNK_ROWS = 2000;
const DEFAULT_THROTTLE_MS = 100;

export class MergedScan {
  readonly id: string;
  private view: MergedView;
  private rows = new Uint32Array(1024);
  private levels = new Uint8Array(1024);
  private count = 0;
  private scanned = 0;
  private running = false;
  private again = false;
  private disposed = false;
  private generation = 0;
  /** Kept between extensions: it carries the state of the records being read. */
  private test: RowTest | undefined;
  private lastEmit = 0;
  private timer: NodeJS.Timeout | undefined;

  /** `makeTest` is called again on `rebind`: tests may carry state (the level of the record being read). */
  constructor(
    view: MergedView,
    private readonly makeTest: () => RowTest,
    private readonly emit: (event: MergedScanEvent) => void,
    private readonly options: MergedScanOptions = {},
    id: string = randomUUID(),
  ) {
    this.id = id;
    this.view = view;
  }

  get matches(): number {
    return this.count;
  }

  get done(): boolean {
    return !this.running && !this.again && this.scanned >= this.view.rowCount;
  }

  /** Merged rows scanned so far: what is known to be final. */
  get scannedRows(): number {
    return this.scanned;
  }

  start(): void {
    void this.run();
  }

  /** The view gained rows: scan them. */
  extend(): void {
    if (this.disposed) return;
    if (this.running) this.again = true;
    else void this.run();
  }

  /** The sources changed: forget the results and scan the new view. */
  rebind(view: MergedView): void {
    if (this.disposed) return;
    this.generation++;
    this.view = view;
    this.test = undefined;
    this.count = 0;
    this.scanned = 0;
    this.again = false;
    if (!this.running) void this.run();
    else this.again = true;
  }

  dispose(): void {
    this.disposed = true;
    this.generation++;
    clearTimeout(this.timer);
  }

  /** Merged row of the `index`-th result. */
  rowAt(index: number): number {
    return this.rows[index]!;
  }

  levelAt(index: number): number {
    return this.levels[index]!;
  }

  /** Index of the first result at or after merged row `row` (= `matches` when there is none). */
  lowerBound(row: number): number {
    let low = 0;
    let high = this.count;
    while (low < high) {
      const mid = (low + high) >> 1;
      if (this.rows[mid]! < row) low = mid + 1;
      else high = mid;
    }
    return low;
  }

  // ---------------------------------------------------------------------------------------------

  private async run(): Promise<void> {
    this.running = true;
    const generation = this.generation;
    const test = (this.test ??= this.makeTest());
    let from = this.scanned;
    try {
      for (;;) {
        while (from < this.view.rowCount) {
          const chunk = await this.view.rows(from, this.options.chunkRows ?? DEFAULT_CHUNK_ROWS);
          if (this.disposed || generation !== this.generation) return;
          for (const r of chunk) {
            const verdict = test(r.source, r.text);
            if (verdict >= 0) this.push(r.row, verdict);
          }
          from += chunk.length;
          this.scanned = from;
          if (chunk.length === 0) break;
          this.emitThrottled();
        }
        if (!this.again) break;
        this.again = false;
      }
    } finally {
      if (generation === this.generation) {
        this.running = false;
        this.emitNow();
      } else if (!this.disposed) {
        // rebound while reading: start over on the new view
        this.running = false;
        this.again = false;
        void this.run();
      }
    }
  }

  private push(row: number, level: number): void {
    if (this.count === this.rows.length) {
      const rows = new Uint32Array(this.count * 2);
      rows.set(this.rows);
      this.rows = rows;
      const levels = new Uint8Array(this.count * 2);
      levels.set(this.levels);
      this.levels = levels;
    }
    this.rows[this.count] = row;
    this.levels[this.count] = level;
    this.count++;
  }

  private emitNow(): void {
    clearTimeout(this.timer);
    this.timer = undefined;
    this.lastEmit = Date.now();
    if (!this.disposed) this.emit({ id: this.id, matches: this.count, done: this.done });
  }

  private emitThrottled(): void {
    if (this.timer) return;
    const wait = this.lastEmit + (this.options.throttleMs ?? DEFAULT_THROTTLE_MS) - Date.now();
    if (wait <= 0) this.emitNow();
    else this.timer = setTimeout(() => this.emitNow(), wait);
  }
}
