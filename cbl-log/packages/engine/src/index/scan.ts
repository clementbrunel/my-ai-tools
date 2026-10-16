// Core of the line-end scanner: pure functions over Buffers, no file or worker involved.
// Shared as-is by in-process indexing, the worker, backward reading and getLines().
import { bomLength, isPartialBom, unitSize, type Encoding } from "../source/encoding.js";

export const CHECKPOINT_INTERVAL = 64;

/** State carried from one chunk to the next. */
export interface ScanCarry {
  /** The previous chunk ended with a \r: \r\n or a lone \r, not known yet. */
  pendingCR: boolean;
}

/**
 * Called for each confirmed line end, with the offset of the start of the next line and the
 * terminator size in bytes. Returning true stops the scan right after that terminator.
 */
export type LineEndHandler = (nextLineStart: number, terminatorBytes: number) => boolean | void;

/**
 * Scans `buf` (which starts at absolute offset `base`, aligned on a code unit) and calls
 * `onLineEnd` for each line end: \n, \r\n or a lone \r (F-06). Returns the number of bytes
 * consumed: the whole chunk (rounded to the unit in UTF-16), or less if the handler asked to stop.
 * A \r at the very end of the chunk stays pending in `carry`, resolved by the next chunk.
 */
export function scanChunk(buf: Buffer, base: number, encoding: Encoding, carry: ScanCarry, onLineEnd: LineEndHandler): number {
  const unit = unitSize(encoding);
  const bigEndian = encoding === "utf-16be";
  const len = unit === 2 ? buf.length & ~1 : buf.length;
  if (len === 0) return 0;

  // Position of the next `code` unit (0x0a or 0x0d) from `from`, aligned in UTF-16.
  const find = (code: number, from: number): number => {
    if (unit === 1) {
      const i = buf.indexOf(code, from);
      return i === -1 || i >= len ? -1 : i;
    }
    let i = buf.indexOf(code, bigEndian ? from + 1 : from);
    while (i !== -1 && i < len) {
      if (bigEndian) {
        if (i % 2 === 1 && buf[i - 1] === 0) return i - 1;
      } else if (i % 2 === 0 && buf[i + 1] === 0) {
        return i;
      }
      i = buf.indexOf(code, i + 1);
    }
    return -1;
  };
  const isLF = (i: number): boolean =>
    unit === 1 ? buf[i] === 0x0a : bigEndian ? buf[i] === 0 && buf[i + 1] === 0x0a : buf[i] === 0x0a && buf[i + 1] === 0;

  let pos = 0;
  if (carry.pendingCR) {
    carry.pendingCR = false;
    if (isLF(0)) {
      pos = unit; // \r\n split across two chunks: a single 2-unit terminator
      if (onLineEnd(base + unit, 2 * unit)) return pos;
    } else if (onLineEnd(base, unit)) {
      return 0;
    }
  }

  let lf = find(0x0a, pos);
  let cr = find(0x0d, pos);
  while (lf !== -1 || cr !== -1) {
    if (cr === -1 || (lf !== -1 && lf < cr)) {
      pos = lf + unit;
      if (onLineEnd(base + pos, unit)) return pos;
      lf = find(0x0a, pos);
    } else if (cr + unit >= len) {
      carry.pendingCR = true;
      return len;
    } else if (isLF(cr + unit)) {
      pos = cr + 2 * unit;
      if (onLineEnd(base + pos, 2 * unit)) return pos;
      lf = find(0x0a, pos);
      cr = find(0x0d, pos);
    } else {
      pos = cr + unit;
      if (onLineEnd(base + pos, unit)) return pos;
      cr = find(0x0d, pos);
    }
  }
  return len;
}

/**
 * Indexing state of a file. Serializable (structured clone): this is what travels between the
 * worker and the main thread.
 */
export interface IndexState {
  bomLength: number;
  /** Confirmed line ends = terminated lines. */
  terminators: number;
  /** Start of the last line (open or not yet started) = bytes that are "fully" indexed. */
  lineStart: number;
  /** Bytes consumed by the scanner (>= lineStart; the gap is the open line). */
  scanned: number;
  pendingCR: boolean;
}

/** Initial state, or null if the sample is a BOM prefix (file still being written). */
export function initialIndexState(encoding: Encoding, sample: Buffer): IndexState | null {
  if (sample.length === 0 || isPartialBom(encoding, sample)) return null;
  const bom = bomLength(encoding, sample);
  return { bomLength: bom, terminators: 0, lineStart: bom, scanned: bom, pendingCR: false };
}

export function lineCountOf(state: IndexState): number {
  return state.terminators + (state.scanned > state.lineStart ? 1 : 0);
}

/** Number of known checkpoints: one per multiple of 64 lines, plus the one for line 0. */
export function checkpointCountOf(state: IndexState): number {
  return Math.floor(state.terminators / CHECKPOINT_INTERVAL) + 1;
}

/** Advances an IndexState in place, chunk after chunk. */
export class IndexBuilder {
  constructor(
    private readonly encoding: Encoding,
    readonly state: IndexState,
    private readonly onCheckpoint: (checkpointIndex: number, offset: number) => void,
  ) {}

  /** `chunk` starts at state.scanned. Returns the number of bytes consumed. */
  feed(chunk: Buffer): number {
    const state = this.state;
    const carry: ScanCarry = { pendingCR: state.pendingCR };
    const consumed = scanChunk(chunk, state.scanned, this.encoding, carry, (next) => {
      state.terminators++;
      state.lineStart = next;
      if (state.terminators % CHECKPOINT_INTERVAL === 0) this.onCheckpoint(state.terminators / CHECKPOINT_INTERVAL, next);
    });
    state.scanned += consumed;
    state.pendingCR = carry.pendingCR;
    return consumed;
  }
}
