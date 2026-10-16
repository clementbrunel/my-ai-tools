import type { TextDecoder } from "node:util";

/** Plafond d'affichage par ligne (archi 4.2). Les offsets, eux, restent exacts. */
export const MAX_LINE_BYTES = 64 * 1024;

export interface DecodedLine {
  text: string;
  truncated: boolean;
}

export interface NumberedLine extends DecodedLine {
  lineNo: number;
}

/** `content` : au plus MAX_LINE_BYTES octets du debut de la ligne ; `fullLength` : sa vraie longueur. */
export function decodeLine(decoder: TextDecoder, content: Buffer, fullLength: number): DecodedLine {
  return { text: decoder.decode(content), truncated: fullLength > MAX_LINE_BYTES };
}
