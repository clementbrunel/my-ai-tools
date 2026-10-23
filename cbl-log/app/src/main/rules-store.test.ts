import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDefaultRuleSet } from "@cbl-log/shared";
import { afterEach, describe, expect, it } from "vitest";
import { exportRuleSet, loadRuleSets, readRuleSetFile, saveRuleSet } from "./rules-store";

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
  it("creates the built-in rule sets on first load, default first", async () => {
    const dir = join(tempRoot(), "rules");
    const { sets, warnings } = await loadRuleSets(dir);
    expect(warnings).toEqual([]);
    expect(sets.map((s) => s.id)).toEqual(["default", "websphere"]);
    expect(JSON.parse(readFileSync(join(dir, "default.json"), "utf8")).schemaVersion).toBe(1);
    expect(JSON.parse(readFileSync(join(dir, "websphere.json"), "utf8")).formats).toEqual(["websphere-basic"]);
  });

  it("adds a built-in set that is missing from an existing folder, and never overwrites a customized one", async () => {
    const dir = tempRoot();
    const mine = { ...createDefaultRuleSet(), name: "Mon défaut" };
    await saveRuleSet(dir, mine); // an install from before the WebSphere profile existed
    const { sets } = await loadRuleSets(dir);
    expect(sets.map((s) => s.id)).toEqual(["default", "websphere"]);
    expect(sets[0]?.name).toBe("Mon défaut");
    const websphere = JSON.parse(readFileSync(join(dir, "websphere.json"), "utf8"));
    websphere.name = "Mon WebSphere";
    writeFileSync(join(dir, "websphere.json"), JSON.stringify(websphere));
    expect((await loadRuleSets(dir)).sets.find((x) => x.id === "websphere")?.name).toBe("Mon WebSphere");
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
    expect(sets.map((s) => s.id)).toEqual(["default", "websphere"]);
    expect(warnings).toHaveLength(2);
    expect(warnings.some((w) => w.startsWith("broken.json"))).toBe(true);
  });

  it("falls back to the defaults in memory when every file is invalid, without touching them", async () => {
    const dir = tempRoot();
    writeFileSync(join(dir, "default.json"), "oops");
    const { sets, warnings } = await loadRuleSets(dir);
    expect(sets.map((s) => s.id)).toEqual(["default", "websphere"]);
    expect(warnings).toHaveLength(1);
    expect(readFileSync(join(dir, "default.json"), "utf8")).toBe("oops");
  });

  it("refuses ids that could escape the directory", async () => {
    const set = { ...createDefaultRuleSet(), id: "../evil" };
    await expect(saveRuleSet(tempRoot(), set)).rejects.toThrow(/Invalid rule set id/);
  });

  it("round-trips an exported profile, and the file can also be dropped in the rules folder", async () => {
    const root = tempRoot();
    const shared = { ...createDefaultRuleSet(), id: "equipe", name: "Équipe", formats: ["spring-boot"] };
    const path = join(root, "partage", "equipe.json");
    await exportRuleSet(path, shared);
    expect(await readRuleSetFile(path)).toEqual({ ok: true, value: shared });
    const dir = join(root, "rules");
    await loadRuleSets(dir);
    writeFileSync(join(dir, "equipe.json"), readFileSync(path, "utf8"));
    expect((await loadRuleSets(dir)).sets.map((s) => s.id)).toContain("equipe");
  });

  it("reports an unreadable, invalid or oversized profile file instead of throwing", async () => {
    const root = tempRoot();
    expect((await readRuleSetFile(join(root, "absent.json"))).ok).toBe(false);
    writeFileSync(join(root, "bad.json"), "{ pas du json");
    expect(await readRuleSetFile(join(root, "bad.json"))).toMatchObject({ ok: false, error: expect.stringContaining("Invalid JSON") });
    writeFileSync(join(root, "other.json"), JSON.stringify({ schemaVersion: 1, theme: "dark" }));
    expect((await readRuleSetFile(join(root, "other.json"))).ok).toBe(false);
    writeFileSync(join(root, "big.json"), "x".repeat(2 * 1024 * 1024));
    expect(await readRuleSetFile(join(root, "big.json"))).toMatchObject({ ok: false, error: expect.stringContaining("volumineux") });
  });
});
