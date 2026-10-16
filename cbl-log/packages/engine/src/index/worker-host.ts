// Cote thread principal de l'indexation en worker_thread.
//
// Strategie : le worker ouvre son propre fd, lit par blocs de 1 Mio, et POSTE des lots de points de
// controle (Float64Array transferee) + l'etat du scanner toutes les ~100 ms. Le thread principal
// les copie dans son CheckpointStore. Pas de SharedArrayBuffer partage entre les deux threads : un
// SAB extensible ne peut pas etre agrandi de facon fiable depuis deux threads, et les lots coutent
// peu (10 Go = ~9 Mo de points au total). Les lots servent aussi de progression et rendent l'index
// utilisable pendant l'indexation.
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Worker } from "node:worker_threads";
import type { Encoding } from "../source/encoding.js";
import { SourceError } from "../source/source.js";
import { lineCountOf, type IndexState } from "./scan.js";

export const WORKER_BLOCK_SIZE = 1024 * 1024;
export const PROGRESS_INTERVAL_MS = 100;

export interface IndexProgress {
  bytesRead: number;
  totalBytes: number;
  lines: number;
}

export interface IndexBatch {
  /** Indice du premier point de controle de `checkpoints`. */
  firstCheckpoint: number;
  checkpoints: Float64Array;
  state: IndexState;
}

export interface WorkerIndexOptions {
  /** Reprise : etat d'un index deja entame. Absent = depuis le debut du fichier. */
  start?: IndexState;
  chunkSize?: number;
  progressIntervalMs?: number;
  signal?: AbortSignal;
  onProgress?: (progress: IndexProgress) => void;
  onBatch?: (batch: IndexBatch) => void;
}

export interface WorkerIndexResult {
  /** null si le fichier est vide (ou ne contient qu'un debut de BOM). */
  state: IndexState | null;
  firstCheckpoint: number;
  /** Tous les points de controle produits par ce run (concatenation des lots). */
  checkpoints: Float64Array;
}

export interface WorkerJob {
  path: string;
  encoding: Encoding;
  start: IndexState | null;
  chunkSize: number;
  progressIntervalMs: number;
}

export type WorkerMessage =
  | { type: "batch"; firstCheckpoint: number; checkpoints: Float64Array; state: IndexState; totalBytes: number }
  | { type: "done"; state: IndexState | null }
  | { type: "error"; code: string; message: string };

/**
 * Le worker est du JS compile (dist/index/indexer-worker.js). Sous vitest le code tourne depuis
 * src/ en TypeScript, où ce fichier n'existe pas : on retombe sur la version compilee, que le script
 * `test` du moteur construit au prealable.
 */
function workerUrl(): URL {
  const sibling = new URL("./indexer-worker.js", import.meta.url);
  if (existsSync(fileURLToPath(sibling))) return sibling;
  const built = new URL("../../dist/index/indexer-worker.js", import.meta.url);
  if (existsSync(fileURLToPath(built))) return built;
  throw new Error("indexer-worker.js introuvable : lancer `npm run build` dans packages/engine");
}

function abortError(): Error {
  const err = new Error("Indexation annulee");
  err.name = "AbortError";
  return err;
}

export function indexInWorker(path: string, encoding: Encoding, options: WorkerIndexOptions = {}): Promise<WorkerIndexResult> {
  const { signal } = options;
  if (signal?.aborted) return Promise.reject(abortError());

  const job: WorkerJob = {
    path,
    encoding,
    start: options.start ?? null,
    chunkSize: options.chunkSize ?? WORKER_BLOCK_SIZE,
    progressIntervalMs: options.progressIntervalMs ?? PROGRESS_INTERVAL_MS,
  };

  return new Promise<WorkerIndexResult>((resolve, reject) => {
    const worker = new Worker(workerUrl(), { workerData: job });
    const batches: Float64Array[] = [];
    let firstCheckpoint = -1;
    let settled = false;

    const finish = (action: () => void): void => {
      if (settled) return;
      settled = true;
      signal?.removeEventListener("abort", onAbort);
      void worker.terminate();
      action();
    };
    const onAbort = (): void => finish(() => reject(abortError()));
    signal?.addEventListener("abort", onAbort, { once: true });

    worker.on("message", (msg: WorkerMessage) => {
      if (settled) return;
      if (msg.type === "batch") {
        if (firstCheckpoint === -1) firstCheckpoint = msg.firstCheckpoint;
        batches.push(msg.checkpoints);
        options.onBatch?.({ firstCheckpoint: msg.firstCheckpoint, checkpoints: msg.checkpoints, state: msg.state });
        options.onProgress?.({ bytesRead: msg.state.scanned, totalBytes: msg.totalBytes, lines: lineCountOf(msg.state) });
      } else if (msg.type === "done") {
        const total = batches.reduce((n, b) => n + b.length, 0);
        const checkpoints = new Float64Array(total);
        let at = 0;
        for (const b of batches) {
          checkpoints.set(b, at);
          at += b.length;
        }
        finish(() => resolve({ state: msg.state, firstCheckpoint: Math.max(firstCheckpoint, 0), checkpoints }));
      } else {
        const code = msg.code === "ENOENT" || msg.code === "EACCES" || msg.code === "EISDIR" ? msg.code : "UNKNOWN";
        finish(() => reject(new SourceError(code, path, msg.message)));
      }
    });
    worker.on("error", (err) => finish(() => reject(new SourceError("UNKNOWN", path, err.message, { cause: err }))));
    worker.on("exit", (code) => {
      if (code !== 0) finish(() => reject(new SourceError("UNKNOWN", path, `Worker d'indexation arrete (code ${code})`)));
    });
  });
}
