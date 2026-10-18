// Typed request/response protocol between the renderer and the engine (utilityProcess), carried
// over a MessagePort. Requests are correlated with their responses by numeric id.
import type { TabEvent, TabId } from "./index.js";

/** Text encodings the engine can decode (single source of truth, re-exported by the engine). */
export type Encoding = "utf-16le" | "utf-16be" | "utf-8" | "windows-1252" | "iso-8859-1";

/** One displayed line. `lineNo` is 0-based and global (never decreases across rolling segments). */
export interface Row {
  lineNo: number;
  text: string;
  truncated: boolean;
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
}

export interface TabInfo {
  tabId: TabId;
  path: string;
  encoding: Encoding;
  sizeBytes: number;
  totalRows: number;
  /** "unknown" is accepted until line-ending detection is implemented. */
  lineEnding: "crlf" | "lf" | "unknown";
}

export interface GetRowsParams {
  tabId: TabId;
  first: number;
  count: number;
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

// TODO(M1+): goto / setFollow / setPaused. Follow and goto are renderer-only state for now
// (pull model), pause (T-06) is deferred.

export interface EngineRequestMap {
  open: { params: OpenParams; result: TabInfo };
  close: { params: CloseParams; result: void };
  getRows: { params: GetRowsParams; result: RowsResult };
  search: { params: SearchParams; result: SearchStarted };
  searchNext: { params: SearchNextParams; result: SearchHit };
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
