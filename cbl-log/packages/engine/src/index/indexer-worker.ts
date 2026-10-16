// Entry point of the indexing worker (see worker-host.ts). Depends only on the pure scanner.
import { open } from "node:fs/promises";
import { parentPort, workerData } from "node:worker_threads";
import { checkpointCountOf, IndexBuilder, initialIndexState, type IndexState } from "./scan.js";
import type { WorkerJob, WorkerMessage } from "./worker-host.js";

const port = parentPort;
if (!port) throw new Error("indexer-worker must run inside a worker_thread");

function post(msg: WorkerMessage, transfer: ArrayBuffer[] = []): void {
  port!.postMessage(msg, transfer);
}

async function run(job: WorkerJob): Promise<void> {
  const handle = await open(job.path, "r");
  try {
    let totalBytes = (await handle.stat()).size;
    let state: IndexState | null = job.start;
    let pending: number[] = [];
    let pendingFirst = 0;

    if (!state) {
      const sample = Buffer.alloc(4);
      const { bytesRead } = await handle.read(sample, 0, 4, 0);
      state = initialIndexState(job.encoding, sample.subarray(0, bytesRead));
      if (!state) return post({ type: "done", state: null });
      pending.push(state.bomLength);
    } else {
      pendingFirst = checkpointCountOf(state);
    }

    const builder = new IndexBuilder(job.encoding, state, (_i, offset) => pending.push(offset));
    const flush = async (): Promise<void> => {
      totalBytes = Math.max(totalBytes, (await handle.stat()).size);
      const checkpoints = Float64Array.from(pending);
      post({ type: "batch", firstCheckpoint: pendingFirst, checkpoints, state: { ...state! }, totalBytes }, [checkpoints.buffer]);
      pendingFirst += pending.length;
      pending = [];
    };

    const buf = Buffer.allocUnsafe(job.chunkSize);
    let lastPost = Date.now();
    for (;;) {
      const { bytesRead } = await handle.read(buf, 0, buf.length, state.scanned);
      if (bytesRead === 0 || builder.feed(buf.subarray(0, bytesRead)) === 0) break;
      if (Date.now() - lastPost >= job.progressIntervalMs) {
        await flush();
        lastPost = Date.now();
      }
    }
    await flush();
    post({ type: "done", state });
  } finally {
    await handle.close();
  }
}

run(workerData as WorkerJob).catch((err: unknown) => {
  const e = err as NodeJS.ErrnoException;
  post({ type: "error", code: e?.code ?? "UNKNOWN", message: e?.message ?? String(err) });
});
