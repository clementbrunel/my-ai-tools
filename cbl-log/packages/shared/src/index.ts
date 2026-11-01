/** Why a search stopped early: a regex that stalled a worker, or a file that could not be read. */
export type SearchError = "too-expensive" | "failed";

/** Identifier of a tab (a followed file or pattern). */
export type TabId = string;

/** Events pushed by the engine to the renderer (architecture, section 6). */
export type TabEvent =
  | { type: "rows"; total: number; appended: number }
  | { type: "indexing"; progress: number; provisional: boolean }
  | { type: "rolled"; reason: "rename" | "truncate" | "new-file" | "recreated"; previous?: string; at: number }
  | { type: "state"; state: "following" | "missing" | "error" | "stopped" | "waiting"; message?: string }
  | { type: "query"; id: string; matches: number; done: boolean; error?: SearchError }
  /** Progress of the line filter of the tab: `matches` lines are available in the filtered view. */
  | { type: "filter"; id: string; matches: number; done: boolean; error?: SearchError }
  | { type: "alert"; ruleId: string; line: number };

export type RowsEvent = Extract<TabEvent, { type: "rows" }>;
export type RolledEvent = Extract<TabEvent, { type: "rolled" }>;
export type StateEvent = Extract<TabEvent, { type: "state" }>;
export type RolledReason = RolledEvent["reason"];

/** Subset of TabEvent emitted by file following (engine Tailer). */
export type TailEvent = RowsEvent | RolledEvent | StateEvent;

export * from "./protocol.js";

export * from "./rules.js";

export * from "./config.js";

export * from "./formats.js";

export * from "./pattern.js";

export * from "./filter.js";

export * from "./archives.js";
