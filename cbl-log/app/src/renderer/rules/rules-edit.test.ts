import type { HighlightRule } from "@cbl-log/shared";
import { describe, expect, it } from "vitest";
import { createRule, moveRuleTo, newRuleId, removeRule, updateRule } from "./rules-edit";

const make = (...ids: string[]): HighlightRule[] =>
  ids.map((id) => ({ id, name: id, pattern: id, isRegex: false, caseSensitive: false, wholeWord: false, scope: "line", enabled: true }));
const ids = (rules: HighlightRule[]): string[] => rules.map((r) => r.id);

describe("rules-edit", () => {
  it("generates unique ids", () => {
    expect(newRuleId([])).toBe("rule-1");
    expect(newRuleId(make("rule-2", "rule-1"))).toBe("rule-3");
    expect(newRuleId(make("rule-2"))).toBe("rule-3");
  });

  it("creates an enabled, empty rule with a fresh id", () => {
    const rule = createRule(make("a"));
    expect(rule).toMatchObject({ id: "rule-2", pattern: "", enabled: true, scope: "line" });
  });

  it("updates one rule without touching the others or mutating the input", () => {
    const before = make("a", "b");
    const after = updateRule(before, "b", { enabled: false, pattern: "x" });
    expect(after[1]).toMatchObject({ enabled: false, pattern: "x" });
    expect(after[0]).toBe(before[0]);
    expect(before[1]?.enabled).toBe(true);
  });

  it("removes a rule", () => {
    expect(ids(removeRule(make("a", "b", "c"), "b"))).toEqual(["a", "c"]);
  });

  it("moves a rule to a target position, and ignores bad input", () => {
    const rules = make("a", "b", "c");
    expect(ids(moveRuleTo(rules, "c", 0))).toEqual(["c", "a", "b"]);
    expect(ids(moveRuleTo(rules, "a", 2))).toEqual(["b", "c", "a"]);
    expect(ids(moveRuleTo(rules, "b", 1))).toEqual(["a", "b", "c"]);
    expect(ids(moveRuleTo(rules, "a", 3))).toEqual(["a", "b", "c"]);
    expect(ids(moveRuleTo(rules, "zzz", 0))).toEqual(["a", "b", "c"]);
  });
});
