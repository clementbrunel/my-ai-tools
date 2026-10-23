// Runs the slices of a file on a small pool of worker_threads (search, filter): hands each worker its
// job, relays its messages, kills a worker that went silent (catastrophic regex) and reports the end.
import { Worker } from "node:worker_threads";
import type { SearchError } from "@cbl-log/shared";

export const DEFAULT_STALL_MS = 5000;

/** Messages every worker speaks besides its own: completion and failure. */
export type WorkerEnd = { type: "done" } | { type: "error"; code: string; message: string };

export interface SliceRunOptions<Msg extends { type: string }> {
  /** Location of the compiled worker. */
  workerUrl(): URL;
  sliceCount: number;
  /** `workerData` of the worker handling slice `sliceIndex`. */
  jobFor(sliceIndex: number): unknown;
  maxWorkers: number;
  /** A worker silent for this long is killed ("too expensive" regex). */
  stallMs?: number | undefined;
  /** Every message of a worker except `done` and `error`. Any message counts as a heartbeat. */
  onMessage(sliceIndex: number, msg: Exclude<Msg, WorkerEnd>): void;
  onSliceDone(sliceIndex: number): void;
  /** Called once: every slice done (no error), or the first failure. Never after `cancel()`. */
  onFinished(error: SearchError | undefined): void;
}

interface Running {
  worker: Worker;
  sliceIndex: number;
  lastBeat: number;
}

export class SliceRun<Msg extends { type: string }> {
  private readonly running = new Set<Running>();
  private nextSlice = 0;
  private finishedSlices = 0;
  private ended = false;
  private readonly watchdog: NodeJS.Timeout;
  private readonly stallMs: number;

  constructor(private readonly opts: SliceRunOptions<Msg | WorkerEnd>) {
    this.stallMs = opts.stallMs ?? DEFAULT_STALL_MS;
    this.watchdog = setInterval(() => this.checkStalls(), Math.max(50, Math.min(500, this.stallMs / 4)));
    this.watchdog.unref();
    if (opts.sliceCount === 0) queueMicrotask(() => this.finish(undefined));
    else this.fill();
  }

  cancel(): void {
    if (this.ended) return;
    this.ended = true;
    this.shutdown();
  }

  private fill(): void {
    while (!this.ended && this.running.size < this.opts.maxWorkers && this.nextSlice < this.opts.sliceCount) {
      this.spawn(this.nextSlice++);
    }
  }

  private spawn(sliceIndex: number): void {
    let worker: Worker;
    try {
      worker = new Worker(this.opts.workerUrl(), { workerData: this.opts.jobFor(sliceIndex) });
    } catch {
      this.finish("failed");
      return;
    }
    const entry: Running = { worker, sliceIndex, lastBeat: Date.now() };
    this.running.add(entry);

    worker.on("message", (msg: Msg | WorkerEnd) => {
      if (this.ended || !this.running.has(entry)) return;
      entry.lastBeat = Date.now();
      if (msg.type === "done") {
        this.running.delete(entry);
        void worker.terminate();
        this.finishedSlices++;
        this.opts.onSliceDone(sliceIndex);
        if (this.finishedSlices === this.opts.sliceCount) this.finish(undefined);
        else this.fill();
      } else if (msg.type === "error") {
        this.finish("failed");
      } else {
        this.opts.onMessage(sliceIndex, msg as Exclude<Msg, WorkerEnd>);
      }
    });
    worker.on("error", () => this.finish("failed"));
    worker.on("exit", (code) => {
      if (code !== 0 && this.running.has(entry)) this.finish("failed");
    });
  }

  private checkStalls(): void {
    if (this.ended) return;
    const now = Date.now();
    for (const entry of this.running) {
      if (now - entry.lastBeat > this.stallMs) {
        this.finish("too-expensive");
        return;
      }
    }
  }

  private finish(error: SearchError | undefined): void {
    if (this.ended) return;
    this.ended = true;
    this.shutdown();
    this.opts.onFinished(error);
  }

  private shutdown(): void {
    clearInterval(this.watchdog);
    for (const entry of this.running) void entry.worker.terminate();
    this.running.clear();
  }
}
