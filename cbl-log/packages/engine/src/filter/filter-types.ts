import type { Encoding, LineFilter, LogFormat } from "@cbl-log/shared";

/**
 * Work given to a filter worker: the lines in the byte range [start, end) of `path` are tested, after
 * `[warmupOffset, start)` has been read to learn the level of the record the first line belongs to.
 */
export interface FilterJob {
  path: string;
  encoding: Encoding;
  filter: LineFilter;
  /** Gives the level of each line; null = no format (raw file). */
  format: LogFormat | null;
  /** Line start from which reading begins (a checkpoint), and the number of the line found there. */
  warmupOffset: number;
  warmupLine: number;
  start: number;
  end: number;
  /** End of the indexed part of the file: a folded record is counted up to there at most. */
  limit: number;
  chunkSize: number;
}

export type FilterWorkerMessage =
  /** Retained lines of the slice, ascending: numbers in the file and level codes (see levelCode). */
  | { type: "lines"; lines: Uint32Array; levels: Uint8Array; folds: Uint32Array }
  /** The last retained record runs up to the end of the indexed part: it may still grow. */
  | { type: "tail"; line: number; offset: number }
  /** Heartbeat: the worker is alive (a stalled regex stops sending it). */
  | { type: "progress"; bytes: number }
  | { type: "done" }
  | { type: "error"; code: string; message: string };
