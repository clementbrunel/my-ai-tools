// Main-thread side of worker_thread indexing.
//
// Strategy: the worker opens its own fd, reads in 1 MiB blocks, and POSTs batches of checkpoints
// (transferred Float64Array) + the scanner state every ~100 ms. The main thread copies them into
// its CheckpointStore. No SharedArrayBuffer is shared between the two threads: a growable SAB
// cannot be grown reliably from two threads, and batches are cheap (10 GB = ~9 MB of checkpoints
// in total). Batches also serve as progress reports and make the index usable while indexing.
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
  /** Index of the first checkpoint in `checkpoints`. */
  firstCheckpoint: number;
  checkpoints: Float64Array;
  state: IndexState;
}

export interface WorkerIndexOptions {
  /** Resume: state of an index already under way. Absent = from the start of the file. */
  start?: IndexState;
  chunkSize?: number;
  progressIntervalMs?: number;
  signal?: AbortSignal;
  onProgress?: (progress: IndexProgress) => void;
  onBatch?: (batch: IndexBatch) => void;
}

export interface WorkerIndexResult {
  /** null if the file is empty (or only holds the start of a BOM). */
  state: IndexState | null;
  firstCheckpoint: number;
  /** All checkpoints produced by this run (concatenation of the batches). */
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
 * The worker is compiled JS (dist/index/indexer-worker.js). Under vitest the code runs from
 * src/ as TypeScript, where this file does not exist: we fall back to the compiled version, which
 * the engine's `test` script builds beforehand.
 */
function workerUrl(): URL {
  const sibling = new URL("./indexer-worker.js", import.meta.url);
  if (existsSync(fileURLToPath(sibling))) return sibling;
  const built = new URL("../../dist/index/indexer-worker.js", import.meta.url);
  if (existsSync(fileURLToPath(built))) return built;
  throw new Error("indexer-worker.js not found: run `npm run build` in packages/engine");
}

function abortError(): Error {
  const err = new Error("Indexing aborted");
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
      if (code !== 0) finish(() => reject(new SourceError("UNKNOWN", path, `Indexing worker stopped (code ${code})`)));
    });
  });
}
