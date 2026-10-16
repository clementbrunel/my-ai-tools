import type { TextDecoder } from "node:util";
import { createDecoder, unitSize, type Encoding } from "../source/encoding.js";
import { SourceError } from "../source/source.js";
import type { Source } from "../source/source.js";
import { CheckpointStore } from "./checkpoint-store.js";
import { decodeLine, MAX_LINE_BYTES, type NumberedLine } from "./lines.js";
import {
  CHECKPOINT_INTERVAL,
  checkpointCountOf,
  IndexBuilder,
  initialIndexState,
  lineCountOf,
  scanChunk,
  type IndexState,
  type ScanCarry,
} from "./scan.js";
import { indexInWorker, type IndexBatch, type IndexProgress } from "./worker-host.js";

export const DEFAULT_CHUNK_SIZE = 1024 * 1024;
// offsetOf() ne lit qu'une petite fenetre : 63 lignes de ~150 o tiennent en ~10 Ko
const OFFSET_WINDOW = 16 * 1024;
const GET_LINES_WINDOW = 256 * 1024;

export interface LineIndexOptions {
  /** Taille des lectures d'indexation (defaut 1 Mio). Les tests la reduisent pour franchir les bords de chunk. */
  chunkSize?: number;
}

export interface AppendResult {
  appendedBytes: number;
  /** La source est plus petite que ce qui a deja ete indexe : l'appelant doit reset() (troncature / rolling). */
  truncated: boolean;
}

/** Index creux : un point de controle toutes les 64 lignes, la ligne exacte se retrouve par un petit scan. */
export class LineIndex {
  private source: Source;
  private readonly encoding: Encoding;
  private readonly decoder: TextDecoder;
  private readonly chunkSize: number;
  private readonly store = new CheckpointStore();
  private state: IndexState | null = null;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(source: Source, encoding: Encoding, options: LineIndexOptions = {}) {
    this.source = source;
    this.encoding = encoding;
    this.decoder = createDecoder(encoding);
    const unit = unitSize(encoding);
    // multiple de l'unite pour rester aligne en UTF-16
    this.chunkSize = Math.max(unit, Math.floor((options.chunkSize ?? DEFAULT_CHUNK_SIZE) / unit) * unit);
  }

  get lineCount(): number {
    return this.state ? lineCountOf(this.state) : 0;
  }

  /** Offset jusqu'ou toutes les lignes sont terminees (= debut de la ligne ouverte, ou fin du fichier). */
  get indexedBytes(): number {
    return this.state?.lineStart ?? 0;
  }

  /** Offset jusqu'ou le fichier a ete lu (reprise de appendFrom). */
  get scannedBytes(): number {
    return this.state?.scanned ?? 0;
  }

  /** La derniere ligne n'a pas (encore) de terminateur : elle sera re-emise si elle grandit. */
  get isLastLineOpen(): boolean {
    return !!this.state && this.state.scanned > this.state.lineStart;
  }

  /** Tampon partageable des points de controle (lecture seule pour les autres threads). */
  get checkpoints(): { buffer: SharedArrayBuffer; count: number; byteLength: number } {
    return { buffer: this.store.buffer, count: this.store.count, byteLength: this.store.byteLength };
  }

  reset(): void {
    this.state = null;
    this.store.clear();
  }

  /** Change de source (rolling) sans toucher a l'index : a combiner avec reset() si c'est un autre fichier. */
  setSource(source: Source): void {
    this.source = source;
  }

  /** Indexation incrementale de la queue : lit de scannedBytes jusqu'a la taille courante. */
  appendFrom(source: Source = this.source): Promise<AppendResult> {
    return this.serialize(async () => {
      this.source = source;
      const size = await source.size();
      if (!this.state) {
        const sample = await source.readAt(0, Math.min(size, 4), { cache: false });
        const initial = initialIndexState(this.encoding, sample);
        if (!initial) return { appendedBytes: 0, truncated: false };
        this.state = initial;
        this.store.set(0, initial.bomLength);
      }
      const state = this.state;
      if (size < state.scanned) return { appendedBytes: 0, truncated: true };

      const startScanned = state.scanned;
      const builder = new IndexBuilder(this.encoding, state, (i, off) => this.store.set(i, off));
      while (state.scanned < size) {
        // lecture directe : balayer un fichier de 10 Go ne doit pas vider le cache de blocs
        const buf = await source.readAt(state.scanned, Math.min(this.chunkSize, size - state.scanned), { cache: false });
        if (buf.length === 0 || builder.feed(buf) === 0) break;
      }
      return { appendedBytes: state.scanned - startScanned, truncated: false };
    });
  }

  /**
   * Indexation par un worker_thread (voir worker-host.ts). L'index se remplit au fil des lots :
   * lineCount grandit pendant l'execution. Reprend a scannedBytes si l'index est deja entame.
   */
  indexWithWorker(options: { onProgress?: (p: IndexProgress) => void; signal?: AbortSignal; chunkSize?: number } = {}): Promise<void> {
    return this.serialize(async () => {
      const applyBatch = (batch: IndexBatch): void => {
        this.store.setMany(batch.firstCheckpoint, batch.checkpoints);
        this.state = batch.state;
      };
      await indexInWorker(this.source.path, this.encoding, {
        start: this.state ?? undefined,
        chunkSize: options.chunkSize ?? this.chunkSize,
        signal: options.signal,
        onBatch: applyBatch,
        onProgress: options.onProgress,
      });
    });
  }

  /** Offset du debut de la ligne `line` (0-based) : point de controle + au plus 63 fins de ligne a sauter. */
  async offsetOf(line: number): Promise<number> {
    const state = this.requireLine(line);
    const block = Math.floor(line / CHECKPOINT_INTERVAL);
    let pos = this.store.get(block);
    let skip = line - block * CHECKPOINT_INTERVAL;
    if (skip === 0) return pos;

    const carry: ScanCarry = { pendingCR: false };
    let found: number | undefined;
    while (found === undefined && pos < state.scanned) {
      const buf = await this.source.readAt(pos, Math.min(OFFSET_WINDOW, state.scanned - pos));
      const consumed = scanChunk(buf, pos, this.encoding, carry, (next) => {
        if (--skip === 0) {
          found = next;
          return true;
        }
      });
      if (consumed === 0) break;
      pos += consumed;
    }
    if (found === undefined) throw this.inconsistent();
    return found;
  }

  /** Lignes decodees [first, first+count) ; plafonnees a 64 Ko d'affichage chacune. */
  async getLines(first: number, count: number): Promise<NumberedLine[]> {
    const state = this.state;
    if (!state || first < 0 || count <= 0 || first >= lineCountOf(state)) return [];
    count = Math.min(count, lineCountOf(state) - first);

    const unit = unitSize(this.encoding);
    const limit = state.scanned;
    const readSize = Math.min(GET_LINES_WINDOW, this.chunkSize);
    const out: NumberedLine[] = [];
    const carry: ScanCarry = { pendingCR: false };
    let lineStart = await this.offsetOf(first);
    let pos = lineStart;

    const push = async (end: number, win: { buf: Buffer; base: number }): Promise<void> => {
      const length = end - lineStart;
      const wanted = Math.min(length, MAX_LINE_BYTES);
      const inWindow = lineStart >= win.base && lineStart + wanted <= win.base + win.buf.length;
      const content = inWindow
        ? win.buf.subarray(lineStart - win.base, lineStart - win.base + wanted)
        : await this.source.readAt(lineStart, wanted);
      out.push({ lineNo: first + out.length, ...decodeLine(this.decoder, content, length) });
    };

    while (out.length < count && pos < limit) {
      const buf = await this.source.readAt(pos, Math.min(readSize, limit - pos));
      if (buf.length === 0) break;
      const base = pos;
      const ends: { next: number; end: number }[] = [];
      const consumed = scanChunk(buf, base, this.encoding, carry, (next, term) => {
        ends.push({ next, end: next - term });
        return out.length + ends.length >= count;
      });
      // les lignes d'un chunk sont decodees avant de lire le suivant (le tampon est local)
      for (const e of ends) {
        await push(e.end, { buf, base });
        lineStart = e.next;
      }
      if (consumed === 0) break;
      pos += consumed;
    }
    if (out.length < count && lineStart < limit) {
      // ligne ouverte : un \r final est un terminateur en attente, pas du texte
      await push(carry.pendingCR ? limit - unit : limit, { buf: Buffer.alloc(0), base: 0 });
    }
    return out;
  }

  private requireLine(line: number): IndexState {
    const state = this.state;
    if (!state || !Number.isInteger(line) || line < 0 || line >= lineCountOf(state)) {
      throw new RangeError(`Ligne ${line} hors de [0, ${this.lineCount})`);
    }
    if (checkpointCountOf(state) > this.store.count) throw this.inconsistent();
    return state;
  }

  private inconsistent(): SourceError {
    return new SourceError("UNKNOWN", this.source.path, "Index incoherent avec le fichier (modifie ?) : reset() requis");
  }

  private serialize<T>(task: () => Promise<T>): Promise<T> {
    const run = this.queue.then(task, task);
    this.queue = run.catch(() => {});
    return run;
  }
}
