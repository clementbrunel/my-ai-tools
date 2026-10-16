// Coeur du scanner de fins de ligne : fonctions pures sur des Buffer, sans fichier ni worker.
// Partage tel quel par l'indexation en processus, le worker, la lecture a rebours et getLines().
import { bomLength, isPartialBom, unitSize, type Encoding } from "../source/encoding.js";

export const CHECKPOINT_INTERVAL = 64;

/** Etat porte d'un chunk au suivant. */
export interface ScanCarry {
  /** Le chunk precedent finissait par un \r : \r\n ou \r seul, on ne sait pas encore. */
  pendingCR: boolean;
}

/**
 * Appele a chaque fin de ligne confirmee, avec l'offset du debut de la ligne suivante et la taille
 * du terminateur en octets. Retourner true arrete le scan juste apres ce terminateur.
 */
export type LineEndHandler = (nextLineStart: number, terminatorBytes: number) => boolean | void;

/**
 * Scanne `buf` (qui commence a l'offset absolu `base`, aligne sur une unite de code) et appelle
 * `onLineEnd` pour chaque fin de ligne : \n, \r\n ou \r seul (F-06). Retourne le nombre d'octets
 * consommes : tout le chunk (arrondi a l'unite en UTF-16), ou moins si le handler a demande l'arret.
 * Un \r en toute fin de chunk reste en attente dans `carry`, resolu au chunk suivant.
 */
export function scanChunk(buf: Buffer, base: number, encoding: Encoding, carry: ScanCarry, onLineEnd: LineEndHandler): number {
  const unit = unitSize(encoding);
  const bigEndian = encoding === "utf-16be";
  const len = unit === 2 ? buf.length & ~1 : buf.length;
  if (len === 0) return 0;

  // Position de la prochaine unite `code` (0x0a ou 0x0d) a partir de `from`, alignee en UTF-16.
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
      pos = unit; // \r\n coupe entre deux chunks : un seul terminateur de 2 unites
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
 * Etat d'indexation d'un fichier. Sérialisable (structured clone) : c'est ce qui voyage entre le
 * worker et le thread principal.
 */
export interface IndexState {
  bomLength: number;
  /** Fins de ligne confirmees = lignes terminees. */
  terminators: number;
  /** Debut de la derniere ligne (ouverte ou non encore commencee) = octets "completement" indexes. */
  lineStart: number;
  /** Octets consommes par le scanner (>= lineStart ; l'ecart est la ligne ouverte). */
  scanned: number;
  pendingCR: boolean;
}

/** Etat de depart, ou null si l'echantillon est un debut de BOM (fichier en cours d'ecriture). */
export function initialIndexState(encoding: Encoding, sample: Buffer): IndexState | null {
  if (sample.length === 0 || isPartialBom(encoding, sample)) return null;
  const bom = bomLength(encoding, sample);
  return { bomLength: bom, terminators: 0, lineStart: bom, scanned: bom, pendingCR: false };
}

export function lineCountOf(state: IndexState): number {
  return state.terminators + (state.scanned > state.lineStart ? 1 : 0);
}

/** Nombre de points de controle connus : un par multiple de 64 lignes, plus celui de la ligne 0. */
export function checkpointCountOf(state: IndexState): number {
  return Math.floor(state.terminators / CHECKPOINT_INTERVAL) + 1;
}

/** Fait avancer un IndexState en place, chunk apres chunk. */
export class IndexBuilder {
  constructor(
    private readonly encoding: Encoding,
    readonly state: IndexState,
    private readonly onCheckpoint: (checkpointIndex: number, offset: number) => void,
  ) {}

  /** `chunk` commence a state.scanned. Retourne le nombre d'octets consommes. */
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
