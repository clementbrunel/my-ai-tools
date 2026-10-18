// recent.json in the user data folder: files opened lately, most recent first. Kept apart from
// settings.json so that adding a file does not look like a settings edit. Never fatal: an unusable
// file is reported and ignored.
import { join } from "node:path";
import { emptyRecent, MAX_RECENT_FILES, parseRecent, type Recent } from "@cbl-log/shared";
import { pathKey } from "../renderer/files/path-key";
import { loadJson, type Loaded } from "./config-store";
import { writeJsonAtomic } from "./json-file";

export const loadRecent = (dir: string): Promise<Loaded<Recent>> => loadJson(join(dir, "recent.json"), "recent.json", parseRecent, emptyRecent);

export const saveRecent = (dir: string, recent: Recent): Promise<string> => writeJsonAtomic(join(dir, "recent.json"), recent);

/** `path` moved (or added) at the head of `files`, without duplicates (Windows paths are case-insensitive). */
export function withRecentFile(files: readonly string[], path: string, max = MAX_RECENT_FILES): string[] {
  const key = pathKey(path);
  return [path, ...files.filter((f) => pathKey(f) !== key)].slice(0, max);
}

export function withoutRecentFile(files: readonly string[], path: string): string[] {
  const key = pathKey(path);
  return files.filter((f) => pathKey(f) !== key);
}
