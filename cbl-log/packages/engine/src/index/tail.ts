// "La fin d'abord" (F-03) : les dernieres lignes s'affichent avant que l'indexation avant ait fini.
import { bomLength, createDecoder, unitSize, type Encoding } from "../source/encoding.js";
import type { Source } from "../source/source.js";
import { decodeLine, MAX_LINE_BYTES, type DecodedLine } from "./lines.js";
import { scanChunk, type ScanCarry } from "./scan.js";

const STEP = 64 * 1024;
// Un fichier sans aucun saut de ligne ne doit pas etre lu en entier a rebours.
const MAX_TAIL_BYTES = 32 * 1024 * 1024;

export interface TailResult {
  /** Les dernieres lignes, dans l'ordre du fichier. Pas de numeros absolus : l'index n'existe pas encore. */
  lines: DecodedLine[];
  /** true : la premiere ligne est la ligne 0 du fichier (numeros alors deductibles). */
  startsAtFileStart: boolean;
  isLastLineOpen: boolean;
  /** Offset de debut de la premiere ligne renvoyee. */
  startOffset: number;
  /** Taille lue (fin exclusive) : l'indexation avant reprend a partir de la. */
  endOffset: number;
}

interface Span {
  start: number;
  end: number;
  partial: boolean;
}

export async function readTail(source: Source, encoding: Encoding, maxLines = 500): Promise<TailResult> {
  const unit = unitSize(encoding);
  const size = await source.size();
  const bom = bomLength(encoding, await source.readAt(0, Math.min(size, 4)));
  const end = size < bom ? bom : bom + Math.floor((size - bom) / unit) * unit;
  const decoder = createDecoder(encoding);

  let from = end;
  let region: Buffer = Buffer.alloc(0);
  let spans: Span[] = [];
  let open = false;
  while (from > bom) {
    const next = Math.max(bom, from - STEP);
    const chunk = await source.readAt(next, from - next);
    if (chunk.length !== from - next) break; // le fichier a rétréci pendant la lecture
    region = region.length ? Buffer.concat([chunk, region]) : chunk;
    from = next;
    ({ spans, open } = analyze(region, from, bom, end, encoding));
    if (spans.length >= maxLines || end - from >= MAX_TAIL_BYTES) break;
  }

  const chosen = spans.slice(-maxLines);
  const lines = chosen.map((s) => {
    const length = s.end - s.start;
    const content = region.subarray(s.start - from, s.start - from + Math.min(length, MAX_LINE_BYTES));
    const line = decodeLine(decoder, content, length);
    return s.partial ? { ...line, truncated: true } : line;
  });
  return {
    lines,
    startsAtFileStart: chosen.length > 0 && chosen[0]!.start === bom && !chosen[0]!.partial,
    isLastLineOpen: open,
    startOffset: chosen[0]?.start ?? end,
    endOffset: end,
  };
}

/** Decoupe `region` (qui commence a `from`) en lignes ; ce qui precede le premier terminateur est ignore. */
function analyze(region: Buffer, from: number, bom: number, end: number, encoding: Encoding): { spans: Span[]; open: boolean } {
  const unit = unitSize(encoding);
  const carry: ScanCarry = { pendingCR: false };
  const starts: number[] = [];
  const terms: number[] = [];
  scanChunk(region, from, encoding, carry, (next, term) => {
    starts.push(next);
    terms.push(term);
  });

  // from === bom : le debut du fichier est une vraie frontiere de ligne.
  // Plafond atteint plus loin que le premier terminateur : sinon la premiere ligne est partielle.
  const leading = from === bom ? [bom] : [];
  const spans: Span[] = [];
  const all = [...leading, ...starts];
  for (let k = 0; k < all.length; k++) {
    const start = all[k]!;
    if (k + 1 < all.length) {
      spans.push({ start, end: all[k + 1]! - terms[k + 1 - leading.length]!, partial: false });
    } else if (start < end) {
      spans.push({ start, end: end - (carry.pendingCR ? unit : 0), partial: false });
    }
  }
  const open = all.length > 0 && all[all.length - 1]! < end;
  if (spans.length === 0 && starts.length === 0 && leading.length === 0 && region.length > 0 && end - from >= MAX_TAIL_BYTES) {
    spans.push({ start: from, end: end - (carry.pendingCR ? unit : 0), partial: true });
    return { spans, open: true };
  }
  return { spans, open };
}
