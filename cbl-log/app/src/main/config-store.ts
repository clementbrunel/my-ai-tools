// settings.json and session.json in the user data folder. A missing file gives the defaults; an
// invalid one is reported and ignored (left untouched on disk), never fatal.
import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  checkSettingsText,
  defaultSettings,
  emptySession,
  parseSession,
  parseSettings,
  type LanguageSetting,
  type ParseResult,
  type Session,
  type Settings,
  settingsToText,
} from "@cbl-log/shared";
import { writeJsonAtomic, writeTextAtomic } from "./json-file";

export interface Loaded<T> {
  value: T;
  /** Set when the file existed but could not be used. */
  warning?: string;
}

export async function loadJson<T>(path: string, name: string, parse: (text: string) => ParseResult<T>, fallback: () => T): Promise<Loaded<T>> {
  let text: string;
  try {
    text = await readFile(path, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return { value: fallback() };
    return { value: fallback(), warning: `${name}: ${err instanceof Error ? err.message : String(err)}` };
  }
  const parsed = parse(text);
  return parsed.ok ? { value: parsed.value } : { value: fallback(), warning: `${name}: ${parsed.error}` };
}

export const loadSettings = (dir: string): Promise<Loaded<Settings>> =>
  loadJson(join(dir, "settings.json"), "settings.json", parseSettings, defaultSettings);

export const loadSession = (dir: string): Promise<Loaded<Session>> =>
  loadJson(join(dir, "session.json"), "session.json", parseSession, emptySession);

/** Returns the text written (the watcher uses it to ignore the app's own writes). */
export const saveSettings = (dir: string, settings: Settings): Promise<string> => writeJsonAtomic(join(dir, "settings.json"), settings);

export const saveSession = (dir: string, session: Session): Promise<string> => writeJsonAtomic(join(dir, "session.json"), session);

export const settingsPath = (dir: string): string => join(dir, "settings.json");

/** Language setting read synchronously at startup (before anything is shown); "system" when unreadable. */
export function readLanguageSetting(dir: string): LanguageSetting {
  try {
    const parsed = parseSettings(readFileSync(settingsPath(dir), "utf8"));
    return parsed.ok ? parsed.value.language : "system";
  } catch {
    return "system";
  }
}

/** Raw text of settings.json for the "Configuration" window; the defaults when the file does not exist yet. */
export async function readSettingsText(dir: string): Promise<{ text: string; path: string; exists: boolean }> {
  const path = settingsPath(dir);
  try {
    return { text: await readFile(path, "utf8"), path, exists: true };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
    return { text: settingsToText(defaultSettings()), path, exists: false };
  }
}

export type SaveTextResult = { ok: true; value: Settings; text: string } | { ok: false; errors: string[] };

/**
 * Writes settings.json as typed by the user (JSON mode keeps their layout), once validated: an invalid
 * text is refused and the file left untouched.
 */
export async function saveSettingsText(dir: string, text: string): Promise<SaveTextResult> {
  const check = checkSettingsText(text);
  if (!check.ok) return { ok: false, errors: check.errors };
  const written = await writeTextAtomic(settingsPath(dir), text.endsWith("\n") ? text : `${text}\n`);
  return { ok: true, value: check.value, text: written };
}
