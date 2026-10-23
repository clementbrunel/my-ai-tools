// Main-thread side of the search: runs slices of a file on a small pool of worker_threads, kills a
// worker whose regex stalls (catastrophic backtracking) and reports the matches as they come.
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { Encoding, SearchError, SearchQuery } from "@cbl-log/shared";
import { DEFAULT_STALL_MS, SliceRun } from "../pool/slice-run.js";
import type { SearchJob, SearchWorkerMessage } from "./search-types.js";

export { DEFAULT_STALL_MS };
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

export class SearchRun {
  private readonly run: SliceRun<SearchWorkerMessage>;

  constructor(opts: SearchRunOptions) {
    this.run = new SliceRun<SearchWorkerMessage>({
      workerUrl,
      sliceCount: opts.slices.length,
      jobFor: (sliceIndex): SearchJob => {
        const slice = opts.slices[sliceIndex]!;
        return {
          path: opts.path,
          encoding: opts.encoding,
          query: opts.query,
          start: slice.start,
          end: slice.end,
          chunkSize: opts.chunkSize ?? DEFAULT_SEARCH_CHUNK,
        };
      },
      maxWorkers: opts.maxWorkers,
      stallMs: opts.stallMs,
      onMessage: (sliceIndex, msg) => {
        if (msg.type === "matches") opts.onMatches(sliceIndex, msg.offsets);
      },
      onSliceDone: opts.onSliceDone,
      onFinished: opts.onFinished,
    });
  }

  cancel(): void {
    this.run.cancel();
  }
}
