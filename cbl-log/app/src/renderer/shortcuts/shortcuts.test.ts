import { describe, expect, it } from "vitest";
import { SHORTCUT_GROUPS, filterGroups } from "./shortcuts";

describe("shortcuts registry", () => {
  it("has no empty group and no empty key cap", () => {
    for (const g of SHORTCUT_GROUPS) {
      expect(g.shortcuts.length).toBeGreaterThan(0);
      for (const s of g.shortcuts) expect(s.keys.every((k) => k.length > 0)).toBe(true);
    }
  });

  it("has no duplicate combination inside a group", () => {
    for (const g of SHORTCUT_GROUPS) {
      const combos = g.shortcuts.map((s) => s.keys.join("+"));
      expect(new Set(combos).size).toBe(combos.length);
    }
  });

  it("returns everything for an empty query", () => {
    expect(filterGroups(SHORTCUT_GROUPS, "  ")).toHaveLength(SHORTCUT_GROUPS.length);
  });

  it("filters by label, ignoring case and accents", () => {
    const found = filterGroups(SHORTCUT_GROUPS, "ECHAP");
    expect(found.length).toBeGreaterThan(0);
    expect(found.flatMap((g) => g.shortcuts).every((s) => s.keys.includes("Échap"))).toBe(true);
  });

  it("filters by key cap and requires every word", () => {
    const found = filterGroups(SHORTCUT_GROUPS, "ctrl fermer").flatMap((g) => g.shortcuts);
    expect(found.map((s) => s.keys.join("+"))).toEqual(["Ctrl+W"]);
  });

  it("returns nothing when nothing matches", () => {
    expect(filterGroups(SHORTCUT_GROUPS, "zzzz")).toEqual([]);
  });
});
