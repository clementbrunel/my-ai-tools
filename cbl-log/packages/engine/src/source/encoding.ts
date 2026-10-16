// Detection d'encodage (F-04) : BOM, puis UTF-16 sans BOM (heuristique), puis UTF-8 valide, sinon windows-1252.
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

/** Taille d'une unite de code (et donc d'un caractere de fin de ligne) en octets. */
export function unitSize(encoding: Encoding): 1 | 2 {
  return isUtf16(encoding) ? 2 : 1;
}

function startsWith(sample: Buffer, bom: readonly number[]): boolean {
  return sample.length >= bom.length && bom.every((b, i) => sample[i] === b);
}

/** Longueur du BOM de `encoding` present en tete de `sample` (0 s'il n'y en a pas). */
export function bomLength(encoding: Encoding, sample: Buffer): number {
  const bom = BOMS[encoding];
  return bom && startsWith(sample, bom) ? bom.length : 0;
}

/** Vrai si `sample` est un debut strict de BOM : on ne peut pas encore trancher (fichier en cours d'ecriture). */
export function isPartialBom(encoding: Encoding, sample: Buffer): boolean {
  const bom = BOMS[encoding];
  return !!bom && sample.length > 0 && sample.length < bom.length && bom.slice(0, sample.length).every((b, i) => sample[i] === b);
}

/** Contient des NUL : probablement un binaire. Informatif, jamais fatal. */
export function looksBinary(sample: Buffer): boolean {
  return sample.includes(0x00);
}

function isValidUtf8(sample: Buffer): boolean {
  try {
    // stream: true tolere une sequence multi-octets coupee a la fin de l'echantillon
    new TextDecoder("utf-8", { fatal: true }).decode(sample, { stream: true });
    return true;
  } catch {
    return false;
  }
}

/** UTF-16 sans BOM : du texte latin donne un octet sur deux a 0x00, toujours du meme cote. */
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

/** Decodeur qui conserve le BOM : l'appelant saute `bomLength` lui-meme. */
export function createDecoder(encoding: Encoding): TextDecoder {
  // Note WHATWG : le label iso-8859-1 est un alias de windows-1252.
  return new TextDecoder(encoding, { fatal: false, ignoreBOM: true });
}
