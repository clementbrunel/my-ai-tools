// The "All" tab (M-01): the lines of several sources interleaved by timestamp, without copying them.
// A MergedView only keeps, for each merged row, the source it comes from (one byte) plus a counter
// checkpoint every CHECKPOINT_ROWS rows, so that row -> (source, line) costs a few steps and the memory
// stays at ~1 byte per row. Records (a head line and its continuation lines) are never split.
import { parseLine, parseTimestamp, type CompiledFormat } from "@cbl-log/shared";

/** One file of the merge. Its lines are read through `read`, the view itself never holds them. */
export interface MergeSource {
  label: string;
  /** Needs a `timestamp` pattern: a source without one cannot be merged. */
  format: CompiledFormat;
  /** First line taken into account (rows cleared or before the archives loaded); default 0. */
  startLine?: number;
  /** Lines currently available in the source. */
  lineCount(): number;
  /** Texts of lines [first, first+count). */
  read(first: number, count: number): Promise<string[]>;
  /** Day/month order and zone table for the timestamps of this source. */
  timestampOptions?: Parameters<typeof parseTimestamp>[2];
}

export interface MergedViewOptions {
  /** Records of the live sources wait this long for an older one to arrive (default 2 000 ms). */
  windowMs?: number;
  /** Lines read from a source at a time (default 2 000). */
  chunkLines?: number;
  now?: () => number;
}

export const CHECKPOINT_ROWS = 64;
const DEFAULT_WINDOW_MS = 2_000;
const DEFAULT_CHUNK_LINES = 2_000;
const MAX_SOURCES = 255;

/** A record read from a source, waiting to be merged. */
interface Pending {
  ts: number;
  lines: number;
  /** When its head line was read: it is merged once older than the re-ordering window. */
  arrival: number;
}

interface SourceState {
  source: MergeSource;
  /** Next line to read. */
  next: number;
  queue: Pending[];
  /** Record being read: closed by the next head line, or once the window has passed. */
  open: Pending | undefined;
  lastTs: number;
  /** Lines of the source already merged. */
  merged: number;
}

export class MergedView {
  private readonly states: SourceState[];
  private readonly windowMs: number;
  private readonly chunk: number;
  private readonly now: () => number;
  private srcOf = new Uint8Array(1 << 16);
  private length = 0;
  /** `sources` counters before each checkpoint: counts[c * k + s] = lines of s among rows [0, c * 64). */
  private counts: Uint32Array;
  private checkpoints = 0;

  constructor(sources: readonly MergeSource[], options: MergedViewOptions = {}) {
    if (sources.length === 0 || sources.length > MAX_SOURCES) throw new RangeError(`a merge takes 1 to ${MAX_SOURCES} sources`);
    for (const source of sources) if (!source.format.format.timestamp) throw new Error(`${source.label}: its format has no timestamp`);
    this.states = sources.map((source) => ({ source, next: source.startLine ?? 0, queue: [], open: undefined, lastTs: Number.NEGATIVE_INFINITY, merged: 0 }));
    this.windowMs = options.windowMs ?? DEFAULT_WINDOW_MS;
    this.chunk = options.chunkLines ?? DEFAULT_CHUNK_LINES;
    this.now = options.now ?? Date.now;
    this.counts = new Uint32Array(1024 * sources.length);
    this.pushCheckpoint();
  }

  /** Rows of the merged view. */
  get rowCount(): number {
    return this.length;
  }

  get sourceCount(): number {
    return this.states.length;
  }

  /**
   * Reads what the sources gained since the last call and merges every record that has passed the
   * re-ordering window (`settle`: all of them, for the first build of a view over files at rest).
   * Returns the number of rows added.
   */
  async update(settle = false): Promise<number> {
    const before = this.length;
    for (let s = 0; s < this.states.length; s++) await this.ingest(s);
    this.merge(settle);
    return this.length - before;
  }

  /** Records read but not merged yet: `update()` has more to do once the window has passed. */
  get hasPending(): boolean {
    return this.states.some((st) => st.queue.length > 0 || st.open !== undefined);
  }

  /** (source, line of the source) shown at merged row `row`; undefined past the end. */
  locate(row: number): { source: number; line: number } | undefined {
    if (row < 0 || row >= this.length) return undefined;
    const k = this.states.length;
    const c = Math.floor(row / CHECKPOINT_ROWS);
    const source = this.srcOf[row]!;
    let line = this.counts[c * k + source]!;
    for (let r = c * CHECKPOINT_ROWS; r < row; r++) if (this.srcOf[r] === source) line++;
    return { source, line: line + (this.states[source]!.source.startLine ?? 0) };
  }

  /** Merged row showing line `line` of `source`, undefined when that line is not merged (yet). */
  rowOf(source: number, line: number): number | undefined {
    const state = this.states[source];
    if (!state) return undefined;
    const rel = line - (state.source.startLine ?? 0);
    if (rel < 0 || rel >= state.merged) return undefined;
    const k = this.states.length;
    // last checkpoint whose counter of `source` is <= rel
    let low = 0;
    let high = this.checkpoints - 1;
    while (low < high) {
      const mid = (low + high + 1) >> 1;
      if (this.counts[mid * k + source]! <= rel) low = mid;
      else high = mid - 1;
    }
    let seen = this.counts[low * k + source]!;
    for (let r = low * CHECKPOINT_ROWS; r < this.length; r++) {
      if (this.srcOf[r] !== source) continue;
      if (seen === rel) return r;
      seen++;
    }
    return undefined;
  }

  /** Rows [first, first+count) with their texts; consecutive lines of one source are read together. */
  async rows(first: number, count: number): Promise<{ row: number; source: number; line: number; text: string }[]> {
    const end = Math.min(this.length, first + count);
    const out: { row: number; source: number; line: number; text: string }[] = [];
    for (let row = Math.max(0, first); row < end; ) {
      const at = this.locate(row)!;
      let n = 1;
      while (row + n < end && this.srcOf[row + n] === at.source) n++;
      const texts = await this.states[at.source]!.source.read(at.line, n);
      for (let i = 0; i < n; i++) out.push({ row: row + i, source: at.source, line: at.line + i, text: texts[i] ?? "" });
      row += n;
    }
    return out;
  }

  /** Takes the rows of a source out of the view (truncated file): one linear pass over the source bytes. */
  drop(source: number): void {
    const state = this.states[source];
    if (!state) return;
    const kept = this.srcOf.subarray(0, this.length).filter((s) => s !== source);
    this.srcOf = new Uint8Array(Math.max(1 << 16, kept.length * 2));
    this.srcOf.set(kept);
    this.length = 0;
    this.checkpoints = 0;
    this.counts.fill(0);
    state.queue = [];
    state.open = undefined;
    state.merged = 0;
    state.lastTs = Number.NEGATIVE_INFINITY;
    // what the source holds now is read again from its start by the next update
    state.next = state.source.startLine ?? 0;
    // the counters were built with the dropped source: rebuild them over the kept rows
    this.pushCheckpoint();
    for (const st of this.states) st.merged = 0;
    for (let i = 0; i < kept.length; i++) {
      this.append(kept[i]!, 1);
      this.states[kept[i]!]!.merged++;
    }
  }

  // ---------------------------------------------------------------------------------------------

  private async ingest(s: number): Promise<void> {
    const state = this.states[s]!;
    const { source } = state;
    const pattern = source.format.format.timestamp!;
    const inherits = source.format.format.continuation === "not-line";
    const total = source.lineCount();
    while (state.next < total) {
      const count = Math.min(this.chunk, total - state.next);
      const texts = await source.read(state.next, count);
      const arrival = this.now();
      for (const text of texts) {
        const parsed = parseLine(source.format, text);
        if (parsed || !inherits || !state.open) {
          // a head line (or any line without continuation): a new record
          if (state.open) state.queue.push(state.open);
          const ts = parsed?.ts !== undefined ? parseTimestamp(parsed.ts, pattern, source.timestampOptions) : undefined;
          if (ts !== undefined) state.lastTs = ts;
          state.open = { ts: state.lastTs, lines: 1, arrival };
        } else state.open.lines++;
      }
      state.next += texts.length;
      if (texts.length < count) break;
    }
  }

  /** Merges the eligible records of all sources, oldest first (ties: the source order). */
  private merge(settle: boolean): void {
    const limit = this.now() - this.windowMs;
    for (const state of this.states) {
      if (state.open && (settle || state.open.arrival <= limit)) {
        state.queue.push(state.open);
        state.open = undefined;
      }
    }
    for (;;) {
      let best = -1;
      for (let s = 0; s < this.states.length; s++) {
        const head = this.states[s]!.queue[0];
        if (head && (best < 0 || head.ts < this.states[best]!.queue[0]!.ts)) best = s;
      }
      // the oldest known record leaves once it has waited for the window: a slightly older one may still come
      if (best < 0 || (!settle && this.states[best]!.queue[0]!.arrival > limit)) return;
      // same for a record still open elsewhere that is older than the one about to leave
      if (!settle && this.states.some((st) => st.open && st.open.ts < this.states[best]!.queue[0]!.ts)) return;
      const record = this.states[best]!.queue.shift()!;
      this.append(best, record.lines);
      this.states[best]!.merged += record.lines;
    }
  }

  private append(source: number, lines: number): void {
    for (let i = 0; i < lines; i++) {
      if (this.length === this.srcOf.length) {
        const grown = new Uint8Array(this.srcOf.length * 2);
        grown.set(this.srcOf);
        this.srcOf = grown;
      }
      this.srcOf[this.length++] = source;
      if (this.length % CHECKPOINT_ROWS === 0) this.pushCheckpoint();
    }
  }

  /** Opens the checkpoint that starts at the current end: the counters are those of the rows before it. */
  private pushCheckpoint(): void {
    const k = this.states.length;
    if ((this.checkpoints + 1) * k > this.counts.length) {
      const grown = new Uint32Array(this.counts.length * 2);
      grown.set(this.counts);
      this.counts = grown;
    }
    const base = this.checkpoints * k;
    if (this.checkpoints > 0) {
      const previous = (this.checkpoints - 1) * k;
      for (let s = 0; s < k; s++) this.counts[base + s] = this.counts[previous + s]!;
      for (let r = (this.checkpoints - 1) * CHECKPOINT_ROWS; r < this.checkpoints * CHECKPOINT_ROWS; r++) this.counts[base + this.srcOf[r]!]!++;
    }
    this.checkpoints++;
  }
}
