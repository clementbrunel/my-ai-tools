// Configuration files of %APPDATA%\cbl-log (architecture, section 8): settings.json and session.json.
// Each carries a `schemaVersion`, is migrated to the current version on load, then validated.
import { z } from "zod";
import { LEVELS } from "./formats.js";

export const themeSchema = z.enum(["system", "dark", "light"]);
export type Theme = z.infer<typeof themeSchema>;

export const settingsSchema = z.object({
  schemaVersion: z.literal(1),
  theme: themeSchema.default("system"),
  /** Looks for a newer GitHub release at startup (the only network access of the app, NF-07). */
  checkForUpdates: z.boolean().default(true),
  /** Rolled archives of a file modified within this many hours are loaded before it (T-09); 0 = the file alone. */
  historyHours: z.number().min(0).max(720).default(2),
  /** Archive name pattern learned for a followed file (path key → regex source), see learnArchivePattern. */
  archivePatterns: z.record(z.string(), z.string()).default({}),
});
export type Settings = z.infer<typeof settingsSchema>;

export const encodingSchema = z.enum(["utf-8", "utf-16le", "utf-16be", "windows-1252", "iso-8859-1"]);

const textMatcherSchema = z.object({
  pattern: z.string().min(1),
  isRegex: z.boolean().default(false),
  caseSensitive: z.boolean().default(false),
  wholeWord: z.boolean().optional(),
});

/** Filter of a tab (see FilterSettings): the levels shown, the texts to include / exclude. */
export const filterSettingsSchema = z.object({
  levels: z.array(z.enum(LEVELS)).default([...LEVELS]),
  include: z.array(textMatcherSchema).default([]),
  exclude: z.array(textMatcherSchema).default([]),
  foldTraces: z.boolean().default(false),
});

export const sessionTabSchema = z.object({
  path: z.string().min(1),
  follow: z.boolean().default(true),
  /** First visible row, relative to `clearedBefore`. Rows count from the start of the live file (not of its archives). */
  scrollRow: z.number().int().min(0).default(0),
  clearedBefore: z.number().int().min(0).default(0),
  /** Highlighting profile chosen for this tab; absent = automatic (from the detected format). */
  ruleSetId: z.string().optional(),
  /** Encoding forced by the user for this tab; absent = detected from the file content. */
  encoding: encodingSchema.optional(),
  /** Filter in force on this tab; absent = none. */
  filter: filterSettingsSchema.optional(),
  /** Name given by the user, shown instead of the file name; absent = file name. */
  customName: z.string().optional(),
});
export type SessionTab = z.infer<typeof sessionTabSchema>;

export const sessionSchema = z.object({
  schemaVersion: z.literal(1),
  tabs: z.array(sessionTabSchema),
  /** Path of the active tab. */
  activePath: z.string().optional(),
});
export type Session = z.infer<typeof sessionSchema>;

/** recent.json: files opened lately, most recent first. */
export const MAX_RECENT_FILES = 10;
export const recentSchema = z.object({
  schemaVersion: z.literal(1),
  files: z.array(z.string().min(1)).default([]),
});
export type Recent = z.infer<typeof recentSchema>;

export const defaultSettings = (): Settings => ({ schemaVersion: 1, theme: "system", checkForUpdates: true, historyHours: 2, archivePatterns: {} });
export const emptyRecent = (): Recent => ({ schemaVersion: 1, files: [] });
export const emptySession = (): Session => ({ schemaVersion: 1, tabs: [] });

/** Upgrades `from` -> `from + 1`. */
export type Migration = (raw: Record<string, unknown>) => Record<string, unknown>;

/**
 * Brings a parsed config object up to `current`, applying `migrations[v]` for each version v below it.
 * Throws for a file that claims a newer version than this build understands.
 */
export function applyMigrations(raw: unknown, migrations: Readonly<Record<number, Migration>>, current: number): unknown {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return raw;
  let value = raw as Record<string, unknown>;
  let version = typeof value["schemaVersion"] === "number" ? value["schemaVersion"] : current;
  if (version > current) throw new Error(`schemaVersion ${version} is newer than the supported ${current}`);
  while (version < current) {
    const step = migrations[version];
    if (!step) throw new Error(`No migration from schemaVersion ${version}`);
    value = { ...step(value), schemaVersion: version + 1 };
    version++;
  }
  return value;
}

export type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string };

function parseWith<T>(text: string, schema: z.ZodType<T>, migrations: Readonly<Record<number, Migration>>, current: number): ParseResult<T> {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (err) {
    return { ok: false, error: `Invalid JSON: ${err instanceof Error ? err.message : String(err)}` };
  }
  try {
    const result = schema.safeParse(applyMigrations(json, migrations, current));
    return result.success ? { ok: true, value: result.data } : { ok: false, error: result.error.message };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

const SETTINGS_MIGRATIONS: Readonly<Record<number, Migration>> = {};
const SESSION_MIGRATIONS: Readonly<Record<number, Migration>> = {};
const RECENT_MIGRATIONS: Readonly<Record<number, Migration>> = {};

export const parseSettings = (text: string): ParseResult<Settings> => parseWith(text, settingsSchema, SETTINGS_MIGRATIONS, 1);
export const parseSession = (text: string): ParseResult<Session> => parseWith(text, sessionSchema, SESSION_MIGRATIONS, 1);
export const parseRecent = (text: string): ParseResult<Recent> => parseWith(text, recentSchema, RECENT_MIGRATIONS, 1);
