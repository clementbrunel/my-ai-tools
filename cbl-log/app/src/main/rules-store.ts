// Persistence of highlighting rule sets: one `<id>.json` file per set in the `rules` directory of the
// user data folder. Electron-free so it can be tested; the directory is passed in.
import { mkdir, readdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createDefaultRuleSet, parseRuleSet, type RuleSet } from "@cbl-log/shared";

export interface LoadedRuleSets {
  sets: RuleSet[];
  /** Files that were skipped (invalid JSON or schema): reported, never fatal. */
  warnings: string[];
}

const SAFE_ID = /^[\w.-]+$/;

/** Loads every rule set; writes the default set the first time (no file at all). */
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
  if (names.length === 0) {
    const fresh = createDefaultRuleSet();
    await saveRuleSet(dir, fresh);
    sets.push(fresh);
  } else if (sets.length === 0) {
    sets.push(createDefaultRuleSet()); // everything on disk was invalid: work in memory, keep the files
  }
  return { sets, warnings };
}

/** Writes a rule set atomically (temp file + rename). Throws for an unsafe id. */
export async function saveRuleSet(dir: string, set: RuleSet): Promise<void> {
  if (!SAFE_ID.test(set.id)) throw new Error(`Invalid rule set id: ${set.id}`);
  await mkdir(dir, { recursive: true });
  const target = join(dir, `${set.id}.json`);
  const temp = `${target}.tmp`;
  await writeFile(temp, `${JSON.stringify(set, null, 2)}\n`, "utf8");
  await rename(temp, target);
}
