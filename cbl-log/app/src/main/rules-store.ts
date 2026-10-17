// Persistence of highlighting rule sets: one `<id>.json` file per set in the `rules` directory of the
// user data folder. Electron-free so it can be tested; the directory is passed in.
import { mkdir, readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { createBuiltinRuleSets, createDefaultRuleSet, parseRuleSet, type RuleSet } from "@cbl-log/shared";
import { writeJsonAtomic } from "./json-file";

export interface LoadedRuleSets {
  sets: RuleSet[];
  /** Files that were skipped (invalid JSON or schema): reported, never fatal. */
  warnings: string[];
}

const SAFE_ID = /^[\w.-]+$/;

/** Loads every rule set; writes the built-in ones that have no file yet (never overwrites a file). */
export async function loadRuleSets(dir: string): Promise<LoadedRuleSets> {
  await mkdir(dir, { recursive: true });
  const names = (await readdir(dir)).filter((name) => name.toLowerCase().endsWith(".json")).sort();
  const sets: RuleSet[] = [];
  const warnings: string[] = [];
  for (const name of names) {
    try {
      const parsed = parseRuleSet(await readFile(join(dir, name), "utf8"));
      if (parsed.ok) sets.push(parsed.value);
      else warnings.push(`${name}: ${parsed.error}`);
    } catch (err) {
      warnings.push(`${name}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  const present = new Set(names.map((n) => n.toLowerCase()));
  for (const builtin of createBuiltinRuleSets()) {
    if (present.has(`${builtin.id}.json`)) continue;
    await saveRuleSet(dir, builtin);
    sets.push(builtin);
  }
  if (!sets.some((set) => set.id === "default")) {
    sets.push(createDefaultRuleSet()); // its file is invalid: work in memory, keep the file
  }
  sets.sort((a, b) => (a.id === "default" ? -1 : b.id === "default" ? 1 : a.id.localeCompare(b.id)));
  return { sets, warnings };
}

/** Writes a rule set atomically. Returns the text written. Throws for an unsafe id. */
export async function saveRuleSet(dir: string, set: RuleSet): Promise<string> {
  if (!SAFE_ID.test(set.id)) throw new Error(`Invalid rule set id: ${set.id}`);
  return writeJsonAtomic(join(dir, `${set.id}.json`), set);
}
