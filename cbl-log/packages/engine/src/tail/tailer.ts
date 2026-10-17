// Real-time following of a log file (architecture 4.3): Following / Draining / Switching /
// Truncated / Missing state machine, lossless rolling, truncation detection by anchor.
//
// Line model exposed to the UI: SEGMENTS, one per followed physical file (the first file, then a
// new one at each rolling). Line numbers ("rows") are GLOBAL and never decrease: segment k starts
// at `startRow` = total of the previous segments. A rolling therefore erases nothing; the UI draws
// the T-04d separator at `segment.startRow` (id > 0).
// A segment stays readable as long as its content is:
//   - rename: we keep the handle open on the renamed file (readable, delete sharing);
//   - copytruncate with the archive found: the segment is re-pointed at the archive;
//   - truncate without archive: the content is gone, segment `readable: false` (rows stay counted);
//   - beyond `maxRetainedSegments` readable segments, the oldest is released (handle closed).
import { watch, type BigIntStats, type FSWatcher } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import type { RolledReason, TailEvent } from "@cbl-log/shared";
import { detectEncoding, type Encoding } from "../source/encoding.js";
import type { BlockCache } from "../source/block-cache.js";
import { FileSource } from "../source/file-source.js";
import { SourceError, toSourceError } from "../source/source.js";
import type { SourceIdentity } from "../source/source.js";
import { LineIndex } from "../index/line-index.js";
import type { NumberedLine } from "../index/lines.js";
import { defaultPollInterval, getGlobalPollScheduler, type PollScheduler, type PollTask } from "./poll-scheduler.js";

/** Anchor size: fingerprint of the bytes preceding the scanned offset. */
export const ANCHOR_BYTES = 4096;
export const DEFAULT_COALESCE_MS = 50;
export const DEFAULT_MAX_RETAINED_SEGMENTS = 3;
const MAX_DRAIN_PASSES = 16;
const MAX_ARCHIVE_CANDIDATES = 25;
const MAX_DIR_ENTRIES = 2000;
const WATCH_MIN_SPACING_MS = 50;

export type TailerPhase = "idle" | "following" | "draining" | "switching" | "truncated" | "missing" | "error";
export type SegmentOrigin = "initial" | RolledReason;

/** A followed physical file; see the file header for the numbering model. */
export interface TailSegment {
  id: number;
  path: string;
  /** Global (0-based) number of the first line of this segment. */
  startRow: number;
  rowCount: number;
  startedBy: SegmentOrigin;
  /** false: the content is no longer accessible (truncated without archive, or released); rows stay counted. */
  readable: boolean;
}

export interface TailerOptions {
  path: string;
  /** Default: the application-wide shared scheduler. */
  scheduler?: PollScheduler;
  /** Default: 250 ms, 1 s for a UNC path. */
  pollIntervalMs?: number;
  /** fs.watch on the directory as a hint (default true). A failing watch is ignored. */
  watch?: boolean;
  /** Default: detected when each file is opened. */
  encoding?: Encoding;
  cache?: BlockCache;
  chunkSize?: number;
  /** Coalescing window of `rows` events (default 50 ms). */
  coalesceMs?: number;
  /** Readable segments kept (handles open) besides the current one (default 3). */
  maxRetainedSegments?: number;
  /** Copytruncate recovery from the archive (default true). */
  recoverCopytruncate?: boolean;
  /**
   * Indexing of the FIRST file (default: appendFrom on the current thread). For a very large
   * file, pass `(i) => i.indexWithWorker()`.
   */
  initialIndexer?: (index: LineIndex) => Promise<void>;
  /**
   * Chooses the file to follow at each tick (dated-name pattern, F-09). A path different from the
   * current one triggers Draining then Switching (`new-file`); `undefined` = no file (Missing).
   * `path` is then only used to pick the directory watched by fs.watch.
   */
  resolvePath?: () => string | undefined | Promise<string | undefined>;
}

interface Segment {
  id: number;
  path: string;
  startRow: number;
  startedBy: SegmentOrigin;
  readable: boolean;
  frozenRows: number;
  source: FileSource | undefined;
  index: LineIndex | undefined;
  identity: SourceIdentity;
  anchor: Buffer;
  /** Offset just after the anchor bytes (the scanned offset when the anchor was taken). */
  anchorEnd: number;
}

function errCode(err: unknown): string | undefined {
  const direct = (err as NodeJS.ErrnoException | null)?.code;
  if (direct) return direct;
  return err instanceof SourceError ? err.code : undefined;
}

const isMissingCode = (code: string | undefined): boolean => code === "ENOENT" || code === "ENOTDIR";

export class Tailer {
  private readonly opts: TailerOptions;
  private readonly scheduler: PollScheduler;
  private readonly listeners = new Set<(event: TailEvent) => void>();
  private readonly segs: Segment[] = [];
  private cur: Segment | undefined;
  private phaseValue: TailerPhase = "idle";
  private running = false;
  private task: PollTask | undefined;
  private watcher: FSWatcher | undefined;
  private queue: Promise<void> = Promise.resolve();
  private lastCheckAt = 0;
  private nextSegmentId = 0;
  private pendingRoll: { reason: RolledReason; previous?: string } | undefined;
  private publicState: { state: string; message?: string } | undefined;

  private rowsDirty = false;
  private rowsAppended = 0;
  private lastRowsAt = 0;
  private rowsTimer: NodeJS.Timeout | undefined;

  constructor(options: TailerOptions) {
    this.opts = options;
    this.scheduler = options.scheduler ?? getGlobalPollScheduler();
  }

  get path(): string {
    return this.opts.path;
  }

  get phase(): TailerPhase {
    return this.phaseValue;
  }

  /** Total number of lines across all segments (never decreases). */
  get totalRows(): number {
    return this.segs.reduce((n, s) => n + this.rowCountOf(s), 0);
  }

  /** The last line of the current segment is not terminated: it may still grow. */
  get isLastLineOpen(): boolean {
    return !!this.cur?.index?.isLastLineOpen;
  }

  get segments(): readonly TailSegment[] {
    return this.segs.map((s) => ({
      id: s.id,
      path: s.path,
      startRow: s.startRow,
      rowCount: this.rowCountOf(s),
      startedBy: s.startedBy,
      readable: s.readable,
    }));
  }

  on(listener: (event: TailEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Opens the file if it exists (initial indexing included) then follows it; never rejects. */
  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;
    this.watchDirectory();
    this.task = this.scheduler.add(() => this.check(), this.opts.pollIntervalMs ?? defaultPollInterval(this.opts.path));
    await this.check();
  }

  /** One full check (stat, drain, switch, truncation, indexing), serialized. Never rejects. */
  check(): Promise<void> {
    const run = this.queue.then(() => this.doCheck());
    this.queue = run;
    return run;
  }

  /** Lines [first, first+count) in global numbering; unreadable segments are skipped. */
  async getLines(first: number, count: number): Promise<NumberedLine[]> {
    // A read that races a truncation / archive switch is retried after a check() has reconciled the
    // segments; lines are never silently dropped for a segment that is (or becomes) readable.
    for (let attempt = 0; ; attempt++) {
      const { lines, dropped } = await this.readLines(first, count);
      if (!dropped || attempt >= 3 || !this.running) return lines;
      await this.check();
    }
  }

  private async readLines(first: number, count: number): Promise<{ lines: NumberedLine[]; dropped: boolean }> {
    const out: NumberedLine[] = [];
    let dropped = false;
    const end = first + count;
    for (const seg of [...this.segs]) {
      const start = seg.startRow;
      const stop = start + this.rowCountOf(seg);
      if (stop <= first) continue;
      if (start >= end) break;
      const index = seg.index;
      if (!seg.readable || !index) continue;
      const from = Math.max(first, start) - start;
      const n = Math.min(end, stop) - start - from;
      try {
        const read = await index.getLines(from, n);
        // The live file may have been truncated while we read: offsets then point into new content.
        // Drop those lines (the next check() reconciles) rather than return the wrong text.
        if (seg === this.cur && !(await this.anchorMatches(seg))) {
          dropped = true;
          continue;
        }
        for (const line of read) out.push({ ...line, lineNo: line.lineNo + start });
      } catch {
        // file modified under our feet (truncation in progress) or source closed by a switch
        dropped = true;
      }
    }
    return { lines: out, dropped };
  }

  async stop(): Promise<void> {
    if (!this.running && this.phaseValue === "idle") return;
    this.running = false;
    this.task?.cancel();
    this.task = undefined;
    this.watcher?.close();
    this.watcher = undefined;
    await this.queue;
    this.flushRows();
    for (const seg of this.segs) await this.release(seg);
    this.cur = undefined;
    this.phaseValue = "idle";
  }

  close(): Promise<void> {
    return this.stop();
  }

  // ---------------------------------------------------------------------------------------------

  private rowCountOf(seg: Segment): number {
    return seg.readable && seg.index ? seg.index.lineCount : seg.frozenRows;
  }

  private emit(event: TailEvent): void {
    for (const listener of [...this.listeners]) {
      try {
        listener(event);
      } catch {
        // a failing subscriber must not break the following
      }
    }
  }

  private noteRows(delta: number): void {
    this.rowsAppended += Math.max(0, delta);
    this.rowsDirty = true;
    if (this.rowsTimer) return;
    const wait = this.lastRowsAt + (this.opts.coalesceMs ?? DEFAULT_COALESCE_MS) - Date.now();
    if (wait <= 0) {
      this.flushRows();
      return;
    }
    this.rowsTimer = setTimeout(() => {
      this.rowsTimer = undefined;
      this.flushRows();
    }, wait);
    this.rowsTimer.unref();
  }

  private flushRows(): void {
    if (this.rowsTimer) {
      clearTimeout(this.rowsTimer);
      this.rowsTimer = undefined;
    }
    if (!this.rowsDirty) return;
    const appended = this.rowsAppended;
    this.rowsDirty = false;
    this.rowsAppended = 0;
    this.lastRowsAt = Date.now();
    this.emit({ type: "rows", total: this.totalRows, appended });
  }

  private setState(state: "following" | "missing" | "error", message?: string): void {
    const prev = this.publicState;
    if (prev && prev.state === state && prev.message === message) return;
    this.publicState = { state, message };
    this.flushRows();
    this.emit(message === undefined ? { type: "state", state } : { type: "state", state, message });
  }

  private watchDirectory(): void {
    if (this.opts.watch === false) return;
    const target = basename(this.opts.path);
    try {
      const watcher = watch(dirname(this.opts.path), { persistent: false }, (type, filename) => {
        if (!this.running) return;
        if (type === "rename") {
          this.task?.poke(); // creation / deletion / rename: always
        } else if (!filename || String(filename) === target) {
          if (Date.now() - this.lastCheckAt >= WATCH_MIN_SPACING_MS) this.task?.poke();
        }
      });
      watcher.on("error", () => {
        watcher.close();
        if (this.watcher === watcher) this.watcher = undefined;
      });
      this.watcher = watcher;
    } catch {
      // network share, missing directory: polling is enough
    }
  }

  private async doCheck(): Promise<void> {
    if (!this.running) return;
    this.lastCheckAt = Date.now();
    try {
      await this.step();
    } catch (err) {
      if (!this.running) return;
      this.phaseValue = "error";
      this.setState("error", err instanceof Error ? err.message : String(err));
    }
  }

  private async step(): Promise<void> {
    const target = this.opts.resolvePath ? await this.opts.resolvePath() : this.opts.path;
    let st: BigIntStats | undefined;
    if (target !== undefined) {
      try {
        st = await stat(target, { bigint: true });
      } catch (err) {
        if (!isMissingCode(errCode(err))) throw toSourceError(err, target);
      }
    }
    const cur = this.cur;

    if (!st || target === undefined) {
      // between rename and create, or after deletion: the old handle stays readable, keep draining it
      if (cur) await this.drain(cur);
      this.phaseValue = "missing";
      this.setState("missing");
      return;
    }
    if (!cur) {
      await this.openSegment(target);
      return;
    }
    const sameFile = target === cur.path && (st.ino === 0n || st.ino.toString() === cur.identity.ino);
    if (!sameFile) {
      this.phaseValue = "draining";
      await this.drain(cur); // T-04b: no line lost before the switch
      this.phaseValue = "switching";
      this.pendingRoll = await this.classifyRoll(cur, target);
      await this.openSegment(target);
      return;
    }
    this.phaseValue = "following";
    this.setState("following");
    await this.follow(cur);
  }

  private async follow(seg: Segment): Promise<void> {
    const source = seg.source;
    let index = seg.index;
    if (!source || !index) return;
    const size = await source.size();
    if (size < index.scannedBytes || !(await this.anchorMatches(seg))) {
      await this.truncate(seg);
      return;
    }
    if (index.scannedBytes === 0 && size > 0 && !this.opts.encoding) {
      // file was empty when opened: the encoding could not be detected
      const sample = await source.readAt(0, 4096, { cache: false });
      index = seg.index = this.newIndex(source, detectEncoding(sample));
    }
    const before = index.lineCount;
    const snapshot = index.snapshot();
    const res = await index.appendFrom();
    if (res.truncated) {
      await this.truncate(seg);
      return;
    }
    // The file may have been truncated and regrown while we were reading: the bytes just indexed
    // would then come from the new generation. Re-check the anchor BEFORE refreshing it, and undo the
    // read so that truncate() can still recover the old generation's tail from the archive.
    if (res.appendedBytes > 0) {
      // Order matters: read the new anchor FIRST, then verify the old one. A truncation after the
      // check cannot taint the new anchor (it was read earlier); one before it fails the check.
      const fresh = await this.readAnchor(seg);
      if (!(await this.anchorMatches(seg))) {
        index.restore(snapshot);
        await this.truncate(seg);
        return;
      }
      seg.anchor = fresh.anchor;
      seg.anchorEnd = fresh.anchorEnd;
      this.noteRows(index.lineCount - before);
    }
  }

  /** Reads the old handle up to EOF (appendFrom until stable). */
  private async drain(seg: Segment): Promise<void> {
    const index = seg.index;
    if (!seg.readable || !index) return;
    for (let pass = 0; pass < MAX_DRAIN_PASSES; pass++) {
      const before = index.lineCount;
      const res = await index.appendFrom();
      if (res.truncated || res.appendedBytes === 0) return;
      await this.refreshAnchor(seg);
      this.noteRows(index.lineCount - before);
    }
  }

  private newIndex(source: FileSource, encoding: Encoding): LineIndex {
    return new LineIndex(source, encoding, this.opts.chunkSize ? { chunkSize: this.opts.chunkSize } : {});
  }

  private async refreshAnchor(seg: Segment): Promise<void> {
    const fresh = await this.readAnchor(seg);
    seg.anchor = fresh.anchor;
    seg.anchorEnd = fresh.anchorEnd;
  }

  /** Fingerprint of the ANCHOR_BYTES preceding the scanned offset, without storing it. */
  private async readAnchor(seg: Segment): Promise<{ anchor: Buffer; anchorEnd: number }> {
    const scanned = seg.index?.scannedBytes ?? 0;
    const len = Math.min(ANCHOR_BYTES, scanned);
    const anchor = seg.source && len > 0 ? await seg.source.readAt(scanned - len, len, { cache: false }) : Buffer.alloc(0);
    return { anchor, anchorEnd: scanned };
  }

  /** The fingerprint re-read at each tick must equal the one taken after the last read. */
  private async anchorMatches(seg: Segment): Promise<boolean> {
    const len = seg.anchor.length;
    if (len === 0 || !seg.source) return true;
    const now = await seg.source.readAt(seg.anchorEnd - len, len, { cache: false });
    return now.length === len && now.equals(seg.anchor);
  }

  /** Looks in the directory for the renamed file (same identity) to fill in `previous`. */
  private async classifyRoll(old: Segment, target: string): Promise<{ reason: RolledReason; previous?: string }> {
    if (target !== old.path) return { reason: "new-file", previous: old.path };
    const found = await this.findByIdentity(old);
    return found ? { reason: "rename", previous: found } : { reason: "new-file" };
  }

  private async findByIdentity(old: Segment): Promise<string | undefined> {
    if (old.identity.ino === "0") return undefined;
    try {
      const dir = dirname(old.path);
      const names = (await readdir(dir)).slice(0, MAX_DIR_ENTRIES);
      for (const name of names) {
        const full = join(dir, name);
        if (full === old.path) continue;
        try {
          if ((await stat(full, { bigint: true })).ino.toString() === old.identity.ino) return full;
        } catch {
          // vanished meanwhile
        }
      }
    } catch {
      // unreadable directory
    }
    return undefined;
  }

  /**
   * Truncation (size < offset, or anchor changed). If an archive consistent with the anchor exists
   * (copytruncate), the current segment is re-pointed at it and catches up on `[offset, end]`: those
   * lines are APPENDED TO THE END OF THE PREVIOUS SEGMENT (rows then rolled are emitted in that
   * order). Otherwise the content is lost: unreadable segment. Either way a new segment starts on the path.
   */
  private async truncate(seg: Segment): Promise<void> {
    this.phaseValue = "truncated";
    const index = seg.index;
    const oldSource = seg.source;
    if (!index || !oldSource) return;
    const oldScanned = index.scannedBytes;
    oldSource.invalidate();

    let previous: string | undefined;
    const archive = this.opts.recoverCopytruncate === false ? undefined : await this.findArchive(seg, oldScanned);
    if (archive) {
      try {
        const before = index.lineCount;
        await index.appendFrom(archive.source);
        seg.source = archive.source;
        await oldSource.close().catch(() => {});
        previous = archive.path;
        this.noteRows(index.lineCount - before);
      } catch {
        await archive.source.close().catch(() => {});
        await this.freeze(seg);
      }
    } else {
      await this.freeze(seg);
    }
    this.pendingRoll = { reason: "truncate", ...(previous ? { previous } : {}) };
    this.cur = undefined; // if the path vanished meanwhile, the next tick reopens a segment
    await this.openSegment(seg.path);
  }

  private async freeze(seg: Segment): Promise<void> {
    seg.frozenRows = seg.index?.lineCount ?? seg.frozenRows;
    seg.readable = false;
    await this.release(seg);
  }

  private async release(seg: Segment): Promise<void> {
    if (seg.readable && seg.index) seg.frozenRows = seg.index.lineCount;
    seg.readable = false;
    seg.index?.reset();
    seg.index = undefined;
    const source = seg.source;
    seg.source = undefined;
    await source?.close().catch(() => {});
  }

  private async findArchive(seg: Segment, oldScanned: number): Promise<{ path: string; source: FileSource } | undefined> {
    const anchor = seg.anchor;
    if (anchor.length === 0 || oldScanned < anchor.length) return undefined;
    const anchorStart = seg.anchorEnd - anchor.length;
    const dir = dirname(seg.path);
    let candidates: { path: string; mtime: number }[] = [];
    try {
      for (const name of (await readdir(dir)).slice(0, MAX_DIR_ENTRIES)) {
        const full = join(dir, name);
        if (full === seg.path) continue;
        try {
          const st = await stat(full);
          if (st.isFile() && st.size >= oldScanned) candidates.push({ path: full, mtime: st.mtimeMs });
        } catch {
          // vanished meanwhile
        }
      }
    } catch {
      return undefined;
    }
    candidates = candidates.sort((a, b) => b.mtime - a.mtime).slice(0, MAX_ARCHIVE_CANDIDATES);
    for (const candidate of candidates) {
      let source: FileSource | undefined;
      try {
        source = await FileSource.open(candidate.path, this.opts.cache ? { cache: this.opts.cache } : {});
        const bytes = await source.readAt(anchorStart, anchor.length, { cache: false });
        if (bytes.length === anchor.length && bytes.equals(anchor)) return { path: candidate.path, source };
      } catch {
        // unreadable: next candidate
      }
      await source?.close().catch(() => {});
    }
    return undefined;
  }

  /** Opens `target` as a new segment (first file, rolling or reappeared file). */
  private async openSegment(target: string): Promise<void> {
    const first = this.segs.length === 0;
    let source: FileSource;
    try {
      source = await FileSource.open(target, this.opts.cache ? { cache: this.opts.cache } : {});
    } catch (err) {
      if (errCode(err) === "ENOENT") {
        this.phaseValue = "missing";
        this.setState("missing");
        return;
      }
      throw err;
    }
    try {
      const identity = await source.identity();
      const sample = await source.readAt(0, 4096, { cache: false });
      const index = this.newIndex(source, this.opts.encoding ?? detectEncoding(sample));
      if (first && this.opts.initialIndexer) await this.opts.initialIndexer(index);
      else await index.appendFrom();

      const startRow = this.totalRows;
      const seg: Segment = {
        id: this.nextSegmentId++,
        path: target,
        startRow,
        startedBy: first ? "initial" : (this.pendingRoll?.reason ?? "new-file"),
        readable: true,
        frozenRows: 0,
        source,
        index,
        identity,
        anchor: Buffer.alloc(0),
        anchorEnd: 0,
      };
      await this.refreshAnchor(seg);
      const roll = first ? undefined : (this.pendingRoll ?? { reason: "new-file" as const });
      this.pendingRoll = undefined;
      this.flushRows(); // the `rows` preceding the rolling must not count the new segment's lines
      this.segs.push(seg);
      this.cur = seg;
      await this.enforceRetention();
      this.phaseValue = "following";
      this.setState("following");
      if (roll) {
        this.emit({ type: "rolled", reason: roll.reason, ...(roll.previous ? { previous: roll.previous } : {}), at: startRow });
      }
      if (index.lineCount > 0) this.noteRows(index.lineCount);
    } catch (err) {
      await source.close().catch(() => {});
      throw err;
    }
  }

  private async enforceRetention(): Promise<void> {
    const max = this.opts.maxRetainedSegments ?? DEFAULT_MAX_RETAINED_SEGMENTS;
    const old = this.segs.filter((s) => s !== this.cur && s.readable);
    for (const seg of old.slice(0, Math.max(0, old.length - max))) await this.release(seg);
  }
}
