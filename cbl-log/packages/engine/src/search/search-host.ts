// Main-thread side of the search: runs slices of a file on a small pool of worker_threads, kills a
// worker whose regex stalls (catastrophic backtracking) and reports the matches as they come.
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Worker } from "node:worker_threads";
import type { Encoding, SearchError, SearchQuery } from "@cbl-log/shared";
import type { SearchJob, SearchWorkerMessage } from "./search-types.js";

export const DEFAULT_STALL_MS = 5000;
export const DEFAULT_SEARCH_CHUNK = 256 * 1024;

let injectedWorkerPath: string | undefined;

/** Overrides the location of the compiled search worker (needed when the engine is bundled). */
export function setSearchWorkerPath(path: string | undefined): void {
  injectedWorkerPath = path;
}

function workerUrl(): URL {
  if (injectedWorkerPath) return pathToFileURL(injectedWorkerPath);
  const sibling = new URL("./search-worker.js", import.meta.url);
  if (existsSync(fileURLToPath(sibling))) return sibling;
  const built = new URL("../../dist/search/search-worker.js", import.meta.url);
  if (existsSync(fileURLToPath(built))) return built;
  throw new Error("search-worker.js not found: run `npm run build` in packages/engine");
}

export interface Slice {
  start: number;
  end: number;
}

export interface SearchRunOptions {
  path: string;
  encoding: Encoding;
  query: SearchQuery;
  slices: readonly Slice[];
  maxWorkers: number;
  /** A worker silent for this long is killed ("too expensive" regex). */
  stallMs?: number;
  chunkSize?: number;
  onMatches(sliceIndex: number, offsets: Float64Array): void;
  onSliceDone(sliceIndex: number): void;
  /** Called once: every slice done (no error), or the first failure. Never after `cancel()`. */
  onFinished(error: SearchError | undefined): void;
}

interface Running {
  worker: Worker;
  sliceIndex: number;
  lastBeat: number;
}

export class SearchRun {
  private readonly running = new Set<Running>();
  private nextSlice = 0;
  private finishedSlices = 0;
  private ended = false;
  private readonly watchdog: NodeJS.Timeout;
  private readonly stallMs: number;

  constructor(private readonly opts: SearchRunOptions) {
    this.stallMs = opts.stallMs ?? DEFAULT_STALL_MS;
    this.watchdog = setInterval(() => this.checkStalls(), Math.max(50, Math.min(500, this.stallMs / 4)));
    this.watchdog.unref();
    if (opts.slices.length === 0) queueMicrotask(() => this.finish(undefined));
    else this.fill();
  }

  cancel(): void {
    if (this.ended) return;
    this.ended = true;
    this.shutdown();
  }

  private fill(): void {
    while (!this.ended && this.running.size < this.opts.maxWorkers && this.nextSlice < this.opts.slices.length) {
      this.spawn(this.nextSlice++);
    }
  }

  private spawn(sliceIndex: number): void {
    const slice = this.opts.slices[sliceIndex]!;
    const job: SearchJob = {
      path: this.opts.path,
      encoding: this.opts.encoding,
      query: this.opts.query,
      start: slice.start,
      end: slice.end,
      chunkSize: this.opts.chunkSize ?? DEFAULT_SEARCH_CHUNK,
    };
    let worker: Worker;
    try {
      worker = new Worker(workerUrl(), { workerData: job });
    } catch {
      this.finish("failed");
      return;
    }
    const entry: Running = { worker, sliceIndex, lastBeat: Date.now() };
    this.running.add(entry);

    worker.on("message", (msg: SearchWorkerMessage) => {
      if (this.ended || !this.running.has(entry)) return;
      entry.lastBeat = Date.now();
      if (msg.type === "matches") {
        this.opts.onMatches(sliceIndex, msg.offsets);
      } else if (msg.type === "done") {
        this.running.delete(entry);
        void worker.terminate();
        this.finishedSlices++;
        this.opts.onSliceDone(sliceIndex);
        if (this.finishedSlices === this.opts.slices.length) this.finish(undefined);
        else this.fill();
      } else if (msg.type === "error") {
        this.finish("failed");
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
