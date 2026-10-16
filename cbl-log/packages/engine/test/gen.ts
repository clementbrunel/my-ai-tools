// Generateur de fichiers de log aleatoires (PRNG seede) avec la verite terrain connue.
import type { Encoding } from "../src/index";

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function encode(text: string, encoding: Encoding): Buffer {
  switch (encoding) {
    case "utf-16le":
      return Buffer.from(text, "utf16le");
    case "utf-16be":
      return Buffer.from(text, "utf16le").swap16();
    case "windows-1252":
    case "iso-8859-1":
      return Buffer.from(text, "latin1");
    default:
      return Buffer.from(text, "utf8");
  }
}

export function bomFor(encoding: Encoding): Buffer {
  if (encoding === "utf-8") return Buffer.from([0xef, 0xbb, 0xbf]);
  if (encoding === "utf-16le") return Buffer.from([0xff, 0xfe]);
  if (encoding === "utf-16be") return Buffer.from([0xfe, 0xff]);
  return Buffer.alloc(0);
}

// Caracteres dont les octets UTF-16 ressemblent a 0x0a / 0x0d mais mal alignes (U+0A41, U+0D0A, U+0A0D, U+0A00).
const ALPHABET = ["a", "b", "Z", " ", "\t", "7", "-", ":", "é", "€", "ੁ", "ഊ", "਍", "਀"];
const LATIN_ALPHABET = ["a", "b", "Z", " ", "\t", "7", "-", ":", "é", "ü"];
const TERMS = ["\n", "\r\n", "\r"] as const;

export interface GeneratedFile {
  data: Buffer;
  /** Texte attendu de chaque ligne (sans terminateur). */
  lines: string[];
  /** Offset attendu du debut de chaque ligne. */
  offsets: number[];
  endsWithOpenLine: boolean;
}

export function generateFile(rand: () => number, encoding: Encoding, opts: { maxLines?: number; maxLen?: number; bom?: boolean } = {}): GeneratedFile {
  const alphabet = encoding === "windows-1252" ? LATIN_ALPHABET : ALPHABET;
  const n = Math.floor(rand() * ((opts.maxLines ?? 300) + 1));
  const maxLen = opts.maxLen ?? 120;
  const parts: Buffer[] = [];
  const lines: string[] = [];
  const offsets: number[] = [];
  let pos = 0;
  const bom = opts.bom === false ? Buffer.alloc(0) : bomFor(encoding);
  parts.push(bom);
  pos += bom.length;

  const text = (): string => {
    const len = rand() < 0.15 ? 0 : Math.floor(rand() * maxLen);
    let s = "";
    for (let i = 0; i < len; i++) s += alphabet[Math.floor(rand() * alphabet.length)];
    return s;
  };

  let prevTerm = "";
  for (let i = 0; i < n; i++) {
    let t = text();
    // un CR seul suivi d'une ligne vide terminee par LF ferait un CRLF : ambigu pour la verite terrain
    if (prevTerm === "\r" && t === "") t = "x";
    const term = TERMS[Math.floor(rand() * TERMS.length)]!;
    const bytes = encode(t + term, encoding);
    prevTerm = term;
    lines.push(t);
    offsets.push(pos);
    parts.push(bytes);
    pos += bytes.length;
  }
  let endsWithOpenLine = false;
  if (rand() < 0.5) {
    const t = text() || "x";
    const bytes = encode(t, encoding);
    lines.push(t);
    offsets.push(pos);
    parts.push(bytes);
    endsWithOpenLine = true;
  }
  return { data: Buffer.concat(parts), lines, offsets, endsWithOpenLine };
}
