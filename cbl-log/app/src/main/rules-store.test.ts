import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDefaultRuleSet } from "@cbl-log/shared";
import { afterEach, describe, expect, it } from "vitest";
import { loadRuleSets, saveRuleSet } from "./rules-store";

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});
const tempRoot = (): string => {
  const d = mkdtempSync(join(tmpdir(), "cbl-log-rules-"));
  dirs.push(d);
  return d;
};

describe("rules store", () => {
  it("creates the default rule set on first load", async () => {
    const dir = join(tempRoot(), "rules");
    const { sets, warnings } = await loadRuleSets(dir);
    expect(warnings).toEqual([]);
    expect(sets).toHaveLength(1);
    expect(sets[0]?.id).toBe("default");
    expect(JSON.parse(readFileSync(join(dir, "default.json"), "utf8")).schemaVersion).toBe(1);
  });

  it("round-trips a saved rule set", async () => {
    const dir = tempRoot();
    const set = createDefaultRuleSet();
    set.rules[0]!.enabled = false;
    await saveRuleSet(dir, set);
    const { sets } = await loadRuleSets(dir);
    expect(sets[0]?.rules[0]?.enabled).toBe(false);
  });

  it("skips invalid files with a warning and keeps the valid ones", async () => {
    const dir = tempRoot();
    await saveRuleSet(dir, createDefaultRuleSet());
    writeFileSync(join(dir, "broken.json"), "{ not json");
    writeFileSync(join(dir, "wrong.json"), JSON.stringify({ schemaVersion: 2, id: "x", rules: [] }));
    const { sets, warnings } = await loadRuleSets(dir);
    expect(sets.map((s) => s.id)).toEqual(["default"]);
    expect(warnings).toHaveLength(2);
    expect(warnings.some((w) => w.startsWith("broken.json"))).toBe(true);
  });

  it("falls back to the defaults in memory when every file is invalid, without touching them", async () => {
    const dir = tempRoot();
    writeFileSync(join(dir, "default.json"), "oops");
    const { sets, warnings } = await loadRuleSets(dir);
    expect(sets[0]?.id).toBe("default");
    expect(warnings).toHaveLength(1);
    expect(readFileSync(join(dir, "default.json"), "utf8")).toBe("oops");
  });

  it("refuses ids that could escape the directory", async () => {
    const set = { ...createDefaultRuleSet(), id: "../evil" };
    await expect(saveRuleSet(tempRoot(), set)).rejects.toThrow(/Invalid rule set id/);
  });
});
