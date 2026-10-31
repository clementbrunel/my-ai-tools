// Typed request/response protocol between the renderer and the engine (utilityProcess), carried
// over a MessagePort. Requests are correlated with their responses by numeric id.
import type { LineFilter } from "./filter.js";
import type { Level, LogFormat } from "./formats.js";
import type { TabEvent, TabId } from "./index.js";

/** Text encodings the engine can decode (single source of truth, re-exported by the engine). */
export type Encoding = "utf-16le" | "utf-16be" | "utf-8" | "windows-1252" | "iso-8859-1";

/** One displayed line. `lineNo` is 0-based and global (never decreases across rolling segments). */
export interface Row {
  lineNo: number;
  text: string;
  truncated: boolean;
  /** Level of the line (own or inherited), only reported by the filtered view. */
  level?: Level | undefined;
  /** Filtered view with folding: lines hidden under this one (the continuation of its record). */
  folded?: number | undefined;
}

export interface OpenParams {
  path: string;
  /** Default: detected from the file content. */
  encoding?: Encoding;
  /**
   * Chosen by the caller: `indexing` events of the initial indexing are pushed under this id (the
   * tab id is only known once `open` has answered), so a loader can show the progress.
   */
  openId?: string;
  /**
   * Archives of the file (same directory, rolled names) modified within this many hours are loaded
   * before it as one stream (T-09). 0 or absent: the file alone.
   */
  historyHours?: number;
  /** Regex (source) the archive names must match; absent: the default rule (`<stem>_<date>.log`, `app.log.1`…). */
  archivePattern?: string;
}

/** An archive loaded before the live file: its lines are rows [startRow, startRow + rowCount). */
export interface HistoryFile {
  path: string;
  startRow: number;
  rowCount: number;
  /** Last modification (ms since epoch): when the writer rolled it. */
  mtimeMs: number;
}

export interface TabHistory {
  /** Oldest first; the live file starts right after the last one. */
  files: HistoryFile[];
  /** Older archives left out by `historyHours`. */
  skipped: number;
  hours: number;
}

export interface TabInfo {
  tabId: TabId;
  path: string;
  encoding: Encoding;
  sizeBytes: number;
  totalRows: number;
  /** "unknown" is accepted until line-ending detection is implemented. */
  lineEnding: "crlf" | "lf" | "unknown";
  /** Archives loaded before the file (`historyHours` > 0). */
  history?: TabHistory;
}

export interface GetRowsParams {
  tabId: TabId;
  first: number;
  count: number;
  /**
   * Read the filtered view of this filter (`setFilter` answer) instead of the file: `first` and
   * `count` then index the retained lines, whose `lineNo` stay those of the file.
   */
  filterId?: string;
}

export interface RowsResult {
  first: number;
  rows: Row[];
  total: number;
}

export interface CloseParams {
  tabId: TabId;
}

/** Text or regex query (S-01). Matching is per line. */
export interface SearchQuery {
  pattern: string;
  isRegex: boolean;
  caseSensitive: boolean;
  /** Whole words only (see patternSource). Absent = false. */
  wholeWord?: boolean | undefined;
}

export interface SearchParams {
  tabId: TabId;
  /** null cancels the current search of the tab. */
  query: SearchQuery | null;
}

export interface SearchStarted {
  /** Identifier carried by the `query` events; null when the search was cancelled. */
  searchId: string | null;
}

export interface SearchNextParams {
  tabId: TabId;
  searchId: string;
  /** Reference row: "next" finds the first match after it, "prev" the last match before it. */
  fromRow: number;
  dir: "next" | "prev";
}

export interface SearchHit {
  /** Global row of the match, null when there is none (yet). */
  row: number | null;
  /** 1-based rank of the match among the results found so far. */
  ordinal: number | null;
  /** Matches found so far. */
  matches: number;
  /** The whole file has been scanned: counts and ranks are final. */
  done: boolean;
  /** The search went around the end (or the start) of the file. */
  wrapped: boolean;
}

export interface SetFilterParams {
  tabId: TabId;
  /** null (or a filter that hides nothing) removes the filter of the tab. */
  filter: LineFilter | null;
  /** Format giving the level of each line; required when the filter restricts levels. */
  format?: LogFormat | null;
}

export interface FilterStarted {
  /** Identifier carried by the `filter` events and by `getRows`; null when there is no filter. */
  filterId: string | null;
}

export interface FilterLocateParams {
  tabId: TabId;
  filterId: string;
  /** Global row (line number) in the file. */
  row: number;
}

/** Where a line of the file falls in the filtered view. */
export interface FilterLocation {
  /** Position of the first retained line at or after `row`: the retained lines before it, counted. */
  position: number;
  /** The line itself is retained (it is at `position`). */
  exact: boolean;
  /** The filter has scanned far enough to be sure of `position` (else it may still move). */
  covered: boolean;
}

// Follow, goto and pause (T-06) are renderer-only state (pull model): the engine keeps reading and
// the renderer simply stops asking for the rows that arrived after the pause.

export interface EngineRequestMap {
  open: { params: OpenParams; result: TabInfo };
  close: { params: CloseParams; result: void };
  getRows: { params: GetRowsParams; result: RowsResult };
  search: { params: SearchParams; result: SearchStarted };
  searchNext: { params: SearchNextParams; result: SearchHit };
  setFilter: { params: SetFilterParams; result: FilterStarted };
  filterLocate: { params: FilterLocateParams; result: FilterLocation };
}

export type EngineOp = keyof EngineRequestMap;

export type EngineRequest<K extends EngineOp = EngineOp> = {
  [P in K]: { kind: "request"; id: number; op: P; params: EngineRequestMap[P]["params"] };
}[K];

export interface EngineErrorPayload {
  code: string;
  message: string;
}

export type EngineResponse =
  | { kind: "response"; id: number; ok: true; result: unknown }
  | { kind: "response"; id: number; ok: false; error: EngineErrorPayload };

export interface EngineEvent {
  kind: "event";
  tabId: TabId;
  event: TabEvent;
}

export type EngineMessage = EngineResponse | EngineEvent;

/** Hard cap on the rows returned by one `getRows` request (the service clamps). */
export const MAX_ROWS_PER_REQUEST = 2000;
