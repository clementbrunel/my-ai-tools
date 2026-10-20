import type { Decoder } from "../source/encoding.js";

/** Per-line display cap (architecture 4.2). Offsets themselves stay exact. */
export const MAX_LINE_BYTES = 64 * 1024;

export interface DecodedLine {
  text: string;
  truncated: boolean;
}

export interface NumberedLine extends DecodedLine {
  lineNo: number;
}

/** `content`: at most MAX_LINE_BYTES bytes from the start of the line; `fullLength`: its real length. */
export function decodeLine(decoder: Decoder, content: Buffer, fullLength: number): DecodedLine {
  return { text: decoder.decode(content), truncated: fullLength > MAX_LINE_BYTES };
}
