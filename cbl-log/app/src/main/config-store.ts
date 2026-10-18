// settings.json and session.json in the user data folder. A missing file gives the defaults; an
// invalid one is reported and ignored (left untouched on disk), never fatal.
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  defaultSettings,
  emptySession,
  parseSession,
  parseSettings,
  type ParseResult,
  type Session,
  type Settings,
} from "@cbl-log/shared";
import { writeJsonAtomic } from "./json-file";

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
