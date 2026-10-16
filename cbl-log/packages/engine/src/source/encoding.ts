// Encoding detection (F-04): BOM first, then BOM-less UTF-16 (heuristic), then valid UTF-8, else windows-1252.
import { TextDecoder } from "node:util";

export type Encoding = "utf-8" | "utf-16le" | "utf-16be" | "windows-1252" | "iso-8859-1";

const BOMS: Partial<Record<Encoding, readonly number[]>> = {
  "utf-8": [0xef, 0xbb, 0xbf],
  "utf-16le": [0xff, 0xfe],
  "utf-16be": [0xfe, 0xff],
};

export function isUtf16(encoding: Encoding): boolean {
  return encoding === "utf-16le" || encoding === "utf-16be";
}

/** Size in bytes of a code unit (and therefore of a line-terminator character). */
export function unitSize(encoding: Encoding): 1 | 2 {
  return isUtf16(encoding) ? 2 : 1;
}

function startsWith(sample: Buffer, bom: readonly number[]): boolean {
  return sample.length >= bom.length && bom.every((b, i) => sample[i] === b);
}

/** Length of the `encoding` BOM at the start of `sample` (0 if there is none). */
export function bomLength(encoding: Encoding, sample: Buffer): number {
  const bom = BOMS[encoding];
  return bom && startsWith(sample, bom) ? bom.length : 0;
}

/** True if `sample` is a strict prefix of the BOM: undecidable yet (file still being written). */
export function isPartialBom(encoding: Encoding, sample: Buffer): boolean {
  const bom = BOMS[encoding];
  return !!bom && sample.length > 0 && sample.length < bom.length && bom.slice(0, sample.length).every((b, i) => sample[i] === b);
}

/** Contains NUL bytes: probably binary. Informative only, never fatal. */
export function looksBinary(sample: Buffer): boolean {
  return sample.includes(0x00);
}

function isValidUtf8(sample: Buffer): boolean {
  try {
    // stream: true tolerates a multi-byte sequence cut at the end of the sample
    new TextDecoder("utf-8", { fatal: true }).decode(sample, { stream: true });
    return true;
  } catch {
    return false;
  }
}

/** BOM-less UTF-16: Latin text has every other byte at 0x00, always on the same side. */
function guessBomlessUtf16(sample: Buffer): "utf-16le" | "utf-16be" | undefined {
  const pairs = sample.length >> 1;
  if (pairs < 4) return undefined;
  let evenZeros = 0;
  let oddZeros = 0;
  for (let i = 0; i + 1 < sample.length; i += 2) {
    if (sample[i] === 0) evenZeros++;
    if (sample[i + 1] === 0) oddZeros++;
  }
  if (oddZeros >= pairs * 0.3 && evenZeros <= pairs * 0.05) return "utf-16le";
  if (evenZeros >= pairs * 0.3 && oddZeros <= pairs * 0.05) return "utf-16be";
  return undefined;
}

export function detectEncoding(sample: Buffer): Encoding {
  if (startsWith(sample, BOMS["utf-8"]!)) return "utf-8";
  if (startsWith(sample, BOMS["utf-16le"]!)) return "utf-16le";
  if (startsWith(sample, BOMS["utf-16be"]!)) return "utf-16be";
  const utf16 = guessBomlessUtf16(sample);
  if (utf16) return utf16;
  return isValidUtf8(sample) ? "utf-8" : "windows-1252";
}

/** Decoder that keeps the BOM: the caller skips `bomLength` itself. */
export function createDecoder(encoding: Encoding): TextDecoder {
  // WHATWG note: the iso-8859-1 label is an alias of windows-1252.
  return new TextDecoder(encoding, { fatal: false, ignoreBOM: true });
}
