// Main-thread side of the filter: the same pool as the search, on the filter worker.
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { Encoding, LineFilter, LogFormat, SearchError } from "@cbl-log/shared";
import { SliceRun } from "../pool/slice-run.js";
import type { FilterJob, FilterWorkerMessage } from "./filter-types.js";

export const DEFAULT_FILTER_CHUNK = 256 * 1024;

let injectedWorkerPath: string | undefined;

/** Overrides the location of the compiled filter worker (needed when the engine is bundled). */
export function setFilterWorkerPath(path: string | undefined): void {
  injectedWorkerPath = path;
}

function workerUrl(): URL {
  if (injectedWorkerPath) return pathToFileURL(injectedWorkerPath);
  const sibling = new URL("./filter-worker.js", import.meta.url);
  if (existsSync(fileURLToPath(sibling))) return sibling;
  const built = new URL("../../dist/filter/filter-worker.js", import.meta.url);
  if (existsSync(fileURLToPath(built))) return built;
  throw new Error("filter-worker.js not found: run `npm run build` in packages/engine");
}

export interface FilterSlice {
  warmupOffset: number;
  warmupLine: number;
  start: number;
  end: number;
}

export interface FilterRunOptions {
  path: string;
  encoding: Encoding;
  filter: LineFilter;
  format: LogFormat | null;
  slices: readonly FilterSlice[];
  maxWorkers: number;
  stallMs?: number | undefined;
  chunkSize?: number | undefined;
  onLines(sliceIndex: number, lines: Uint32Array, levels: Uint8Array): void;
  onSliceDone(sliceIndex: number): void;
  /** Called once: every slice done (no error), or the first failure. Never after `cancel()`. */
  onFinished(error: SearchError | undefined): void;
}

export class FilterRun {
  private readonly run: SliceRun<FilterWorkerMessage>;

  constructor(opts: FilterRunOptions) {
    this.run = new SliceRun<FilterWorkerMessage>({
      workerUrl,
      sliceCount: opts.slices.length,
      jobFor: (sliceIndex): FilterJob => ({
        path: opts.path,
        encoding: opts.encoding,
        filter: opts.filter,
        format: opts.format,
        ...opts.slices[sliceIndex]!,
        chunkSize: opts.chunkSize ?? DEFAULT_FILTER_CHUNK,
      }),
      maxWorkers: opts.maxWorkers,
      stallMs: opts.stallMs,
      onMessage: (sliceIndex, msg) => {
        if (msg.type === "lines") opts.onLines(sliceIndex, msg.lines, msg.levels);
      },
      onSliceDone: opts.onSliceDone,
      onFinished: opts.onFinished,
    });
  }

  cancel(): void {
    this.run.cancel();
  }
}
