import type { Encoding, SearchQuery } from "@cbl-log/shared";

/** Work given to a search worker: whole lines in the byte range [start, end) of `path`. */
export interface SearchJob {
  path: string;
  encoding: Encoding;
  query: SearchQuery;
  start: number;
  end: number;
  chunkSize: number;
}

export type SearchWorkerMessage =
  /** Start offsets of matching lines, ascending. */
  | { type: "matches"; offsets: Float64Array }
  /** Heartbeat: the worker is alive (a stalled regex stops sending it). */
  | { type: "progress"; bytes: number }
  | { type: "done" }
  | { type: "error"; code: string; message: string };
