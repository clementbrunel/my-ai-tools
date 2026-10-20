import type { TextDecoder } from "node:util";
import { createDecoder, unitSize, type Encoding } from "../source/encoding.js";
import { SourceError } from "../source/source.js";
import type { Source } from "../source/source.js";
import { CheckpointStore } from "./checkpoint-store.js";
import { decodeLine, MAX_LINE_BYTES, type NumberedLine } from "./lines.js";
import {
  CHECKPOINT_INTERVAL,
  checkpointCountOf,
  IndexBuilder,
  initialIndexState,
  lineCountOf,
  scanChunk,
  type IndexState,
  type ScanCarry,
} from "./scan.js";
import { indexInWorker, type IndexBatch, type IndexProgress } from "./worker-host.js";

export const DEFAULT_CHUNK_SIZE = 1024 * 1024;
// offsetOf() only reads a small window: 63 lines of ~150 bytes fit in ~10 KB
const OFFSET_WINDOW = 16 * 1024;
const GET_LINES_WINDOW = 256 * 1024;

export interface LineIndexOptions {
  /** Size of indexing reads (default 1 MiB). Tests shrink it to cross chunk boundaries. */
  chunkSize?: number;
}

export interface AppendResult {
  appendedBytes: number;
  /** The source is smaller than what was already indexed: the caller must reset() (truncation / rolling). */
  truncated: boolean;
}

/** Sparse index: one checkpoint every 64 lines, the exact line is found with a small scan. */
export class LineIndex {
  private source: Source;
  readonly encoding: Encoding;
  private readonly decoder: TextDecoder;
  private readonly chunkSize: number;
  private readonly store = new CheckpointStore();
  private state: IndexState | null = null;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(source: Source, encoding: Encoding, options: LineIndexOptions = {}) {
    this.source = source;
    this.encoding = encoding;
    this.decoder = createDecoder(encoding);
    const unit = unitSize(encoding);
    // multiple of the unit to stay aligned in UTF-16
    this.chunkSize = Math.max(unit, Math.floor((options.chunkSize ?? DEFAULT_CHUNK_SIZE) / unit) * unit);
  }

  get lineCount(): number {
    return this.state ? lineCountOf(this.state) : 0;
  }

  /** Offset up to which all lines are terminated (= start of the open line, or end of file). */
  get indexedBytes(): number {
    return this.state?.lineStart ?? 0;
  }

  /** Offset up to which the file has been read (where appendFrom resumes). */
  get scannedBytes(): number {
    return this.state?.scanned ?? 0;
  }

  /** The last line has no terminator (yet): it will be re-emitted if it grows. */
  get isLastLineOpen(): boolean {
    return !!this.state && this.state.scanned > this.state.lineStart;
  }

  /** Shareable checkpoint buffer (read-only for other threads). */
  get checkpoints(): { buffer: SharedArrayBuffer; count: number; byteLength: number } {
    return { buffer: this.store.buffer, count: this.store.count, byteLength: this.store.byteLength };
  }

  reset(): void {
    this.state = null;
    this.store.clear();
  }

  /**
   * Copy of the indexing state, to undo an `appendFrom` whose bytes turned out to belong to another
   * generation of the file (truncated and regrown while we read). Checkpoints written after the
   * snapshot are simply overwritten by the next scan.
   */
  snapshot(): IndexState | null {
    return this.state ? { ...this.state } : null;
  }

  restore(snapshot: IndexState | null): void {
    this.state = snapshot ? { ...snapshot } : null;
  }

  /** Switches source (rolling) without touching the index: combine with reset() if it is another file. */
  setSource(source: Source): void {
    this.source = source;
  }

  /** Incremental tail indexing: reads from scannedBytes up to the current size. */
  appendFrom(source: Source = this.source): Promise<AppendResult> {
    return this.serialize(async () => {
      this.source = source;
      const size = await source.size();
      if (!this.state) {
        const sample = await source.readAt(0, Math.min(size, 4), { cache: false });
        const initial = initialIndexState(this.encoding, sample);
        if (!initial) return { appendedBytes: 0, truncated: false };
        this.state = initial;
        this.store.set(0, initial.bomLength);
      }
      const state = this.state;
      if (size < state.scanned) return { appendedBytes: 0, truncated: true };

      const startScanned = state.scanned;
      const builder = new IndexBuilder(this.encoding, state, (i, off) => this.store.set(i, off));
      while (state.scanned < size) {
        // direct read: sweeping a 10 GB file must not flush the block cache
        const buf = await source.readAt(state.scanned, Math.min(this.chunkSize, size - state.scanned), { cache: false });
        if (buf.length === 0 || builder.feed(buf) === 0) break;
      }
      return { appendedBytes: state.scanned - startScanned, truncated: false };
    });
  }

  /**
   * Indexing by a worker_thread (see worker-host.ts). The index fills up batch by batch:
   * lineCount grows while it runs. Resumes at scannedBytes if the index is already under way.
   */
  indexWithWorker(options: { onProgress?: (p: IndexProgress) => void; signal?: AbortSignal; chunkSize?: number } = {}): Promise<void> {
    return this.serialize(async () => {
      const applyBatch = (batch: IndexBatch): void => {
        this.store.setMany(batch.firstCheckpoint, batch.checkpoints);
        this.state = batch.state;
      };
      await indexInWorker(this.source.path, this.encoding, {
        start: this.state ?? undefined,
        chunkSize: options.chunkSize ?? this.chunkSize,
        signal: options.signal,
        onBatch: applyBatch,
        onProgress: options.onProgress,
      });
    });
  }

  /** Offset of the start of line `line` (0-based): checkpoint + at most 63 line ends to skip. */
  async offsetOf(line: number): Promise<number> {
    const state = this.requireLine(line);
    const block = Math.floor(line / CHECKPOINT_INTERVAL);
    let pos = this.store.get(block);
    let skip = line - block * CHECKPOINT_INTERVAL;
    if (skip === 0) return pos;

    const carry: ScanCarry = { pendingCR: false };
    let found: number | undefined;
    while (found === undefined && pos < state.scanned) {
      const buf = await this.source.readAt(pos, Math.min(OFFSET_WINDOW, state.scanned - pos));
      const consumed = scanChunk(buf, pos, this.encoding, carry, (next) => {
        if (--skip === 0) {
          found = next;
          return true;
        }
      });
      if (consumed === 0) break;
      pos += consumed;
    }
    if (found === undefined) throw this.inconsistent();
    return found;
  }

  /**
   * 0-based number of the line containing byte `offset` (checkpoint binary search + at most 63 line
   * ends to skip). Offsets past the scanned part belong to the last line.
   */
  async lineAtOffset(offset: number): Promise<number> {
    const state = this.state;
    if (!state) throw new RangeError("Empty index");
    if (checkpointCountOf(state) > this.store.count) throw this.inconsistent();
    let low = 0;
    let high = checkpointCountOf(state) - 1;
    while (low < high) {
      const mid = (low + high + 1) >> 1;
      if (this.store.get(mid) <= offset) low = mid;
      else high = mid - 1;
    }
    let line = low * CHECKPOINT_INTERVAL;
    let pos = this.store.get(low);
    const carry: ScanCarry = { pendingCR: false };
    let found = false;
    while (!found && pos < state.scanned) {
      const buf = await this.source.readAt(pos, Math.min(OFFSET_WINDOW, state.scanned - pos));
      const consumed = scanChunk(buf, pos, this.encoding, carry, (next) => {
        if (next > offset) {
          found = true;
          return true;
        }
        line++;
      });
      if (consumed === 0) break;
      pos += consumed;
    }
    return Math.min(line, lineCountOf(state) - 1);
  }

  /** Decoded lines [first, first+count); each capped at 64 KB for display. */
  async getLines(first: number, count: number): Promise<NumberedLine[]> {
    const state = this.state;
    if (!state || first < 0 || count <= 0 || first >= lineCountOf(state)) return [];
    count = Math.min(count, lineCountOf(state) - first);

    const unit = unitSize(this.encoding);
    const limit = state.scanned;
    const readSize = Math.min(GET_LINES_WINDOW, this.chunkSize);
    const out: NumberedLine[] = [];
    const carry: ScanCarry = { pendingCR: false };
    let lineStart = await this.offsetOf(first);
    let pos = lineStart;

    const push = async (end: number, win: { buf: Buffer; base: number }): Promise<void> => {
      const length = end - lineStart;
      const wanted = Math.min(length, MAX_LINE_BYTES);
      const inWindow = lineStart >= win.base && lineStart + wanted <= win.base + win.buf.length;
      const content = inWindow
        ? win.buf.subarray(lineStart - win.base, lineStart - win.base + wanted)
        : await this.source.readAt(lineStart, wanted);
      out.push({ lineNo: first + out.length, ...decodeLine(this.decoder, content, length) });
    };

    while (out.length < count && pos < limit) {
      const buf = await this.source.readAt(pos, Math.min(readSize, limit - pos));
      if (buf.length === 0) break;
      const base = pos;
      const ends: { next: number; end: number }[] = [];
      const consumed = scanChunk(buf, base, this.encoding, carry, (next, term) => {
        ends.push({ next, end: next - term });
        return out.length + ends.length >= count;
      });
      // a chunk's lines are decoded before reading the next one (the buffer is local)
      for (const e of ends) {
        await push(e.end, { buf, base });
        lineStart = e.next;
      }
      if (consumed === 0) break;
      pos += consumed;
    }
    if (out.length < count && lineStart < limit) {
      // open line: a trailing \r is a pending terminator, not text
      await push(carry.pendingCR ? limit - unit : limit, { buf: Buffer.alloc(0), base: 0 });
    }
    return out;
  }

  private requireLine(line: number): IndexState {
    const state = this.state;
    if (!state || !Number.isInteger(line) || line < 0 || line >= lineCountOf(state)) {
      throw new RangeError(`Line ${line} outside [0, ${this.lineCount})`);
    }
    if (checkpointCountOf(state) > this.store.count) throw this.inconsistent();
    return state;
  }

  private inconsistent(): SourceError {
    return new SourceError("UNKNOWN", this.source.path, "Index inconsistent with the file (modified?): reset() required");
  }

  private serialize<T>(task: () => Promise<T>): Promise<T> {
    const run = this.queue.then(task, task);
    this.queue = run.catch(() => {});
    return run;
  }
}
