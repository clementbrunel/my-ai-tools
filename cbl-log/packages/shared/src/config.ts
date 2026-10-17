// Configuration files of %APPDATA%\cbl-log (architecture, section 8): settings.json and session.json.
// Each carries a `schemaVersion`, is migrated to the current version on load, then validated.
import { z } from "zod";

export const themeSchema = z.enum(["system", "dark", "light"]);
export type Theme = z.infer<typeof themeSchema>;

export const settingsSchema = z.object({
  schemaVersion: z.literal(1),
  theme: themeSchema.default("system"),
});
export type Settings = z.infer<typeof settingsSchema>;

export const sessionTabSchema = z.object({
  path: z.string().min(1),
  follow: z.boolean().default(true),
  /** First visible row, relative to `clearedBefore`. */
  scrollRow: z.number().int().min(0).default(0),
  clearedBefore: z.number().int().min(0).default(0),
});
export type SessionTab = z.infer<typeof sessionTabSchema>;

export const sessionSchema = z.object({
  schemaVersion: z.literal(1),
  tabs: z.array(sessionTabSchema),
  /** Path of the active tab. */
  activePath: z.string().optional(),
});
export type Session = z.infer<typeof sessionSchema>;

export const defaultSettings = (): Settings => ({ schemaVersion: 1, theme: "system" });
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

export const parseSettings = (text: string): ParseResult<Settings> => parseWith(text, settingsSchema, SETTINGS_MIGRATIONS, 1);
export const parseSession = (text: string): ParseResult<Session> => parseWith(text, sessionSchema, SESSION_MIGRATIONS, 1);
