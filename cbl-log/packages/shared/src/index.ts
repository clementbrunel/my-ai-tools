import { z } from "zod";

/** Identifier of a tab (a followed file or pattern). */
export type TabId = string;

/** Events pushed by the engine to the renderer (architecture, section 6). */
export type TabEvent =
  | { type: "rows"; total: number; appended: number }
  | { type: "indexing"; progress: number; provisional: boolean }
  | { type: "rolled"; reason: "rename" | "truncate" | "new-file"; previous?: string; at: number }
  | { type: "state"; state: "following" | "missing" | "error"; message?: string }
  | { type: "query"; id: string; matches: number; done: boolean }
  | { type: "alert"; ruleId: string; line: number };

export type RowsEvent = Extract<TabEvent, { type: "rows" }>;
export type RolledEvent = Extract<TabEvent, { type: "rolled" }>;
export type StateEvent = Extract<TabEvent, { type: "state" }>;
export type RolledReason = RolledEvent["reason"];

/** Subset of TabEvent emitted by file following (engine Tailer). */
export type TailEvent = RowsEvent | RolledEvent | StateEvent;

/** Skeleton of the configuration schema (architecture, section 8). */
export const settingsSchema = z.object({
  schemaVersion: z.literal(1),
  theme: z.enum(["system", "dark", "light"]).default("system"),
});

export type Settings = z.infer<typeof settingsSchema>;

export * from "./protocol.js";
