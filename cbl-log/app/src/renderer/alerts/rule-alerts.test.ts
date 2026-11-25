import { describe, expect, it } from "vitest";
import type { HighlightRule, Row } from "@cbl-log/shared";
import { compileRules } from "../highlight/highlight";
import { AlertThrottle, alertText, matchAlerts, notifyingRules, rowsToCheck } from "./rule-alerts";

const rule = (id: string, pattern: string, notify?: boolean): HighlightRule => ({
  id,
  name: id.toUpperCase(),
  pattern,
  isRegex: false,
  caseSensitive: false,
  wholeWord: false,
  scope: "line",
  enabled: true,
  ...(notify !== undefined ? { notify } : {}),
});
const rows = (...texts: string[]): Row[] => texts.map((text, i) => ({ lineNo: 100 + i, text, truncated: false }));

describe("matchAlerts", () => {
  const compiled = notifyingRules(compileRules([rule("err", "error", true), rule("warn", "warn"), rule("oom", "OutOfMemory", true)]).compiled);

  it("only keeps the rules that notify", () => {
    expect(compiled.map((c) => c.rule.id)).toEqual(["err", "oom"]);
  });

  it("counts the hits of each rule and keeps the first line", () => {
    const hits = matchAlerts(rows("ok", "ERROR one", "warn", "error two", "java.lang.OutOfMemoryError"), compiled);
    expect(hits).toEqual([
      { ruleId: "err", ruleName: "ERR", count: 3, line: 101, text: "ERROR one" },
      { ruleId: "oom", ruleName: "OOM", count: 1, line: 104, text: "java.lang.OutOfMemoryError" },
    ]);
  });

  it("finds nothing in quiet lines", () => {
    expect(matchAlerts(rows("ok", "fine"), compiled)).toEqual([]);
  });
});

describe("rowsToCheck", () => {
  it("tests the appended lines, at most the last `max`", () => {
    expect(rowsToCheck(10, 15)).toEqual({ first: 10, count: 5 });
    expect(rowsToCheck(0, 100, 30)).toEqual({ first: 70, count: 30 });
    expect(rowsToCheck(20, 20)).toEqual({ first: 20, count: 0 });
  });
});

describe("AlertThrottle", () => {
  const hit = (count: number) => ({ ruleId: "err", ruleName: "ERR", count, line: 1, text: "x" });

  it("notifies at once, then groups the hits during the cooldown", () => {
    const t = new AlertThrottle(1000);
    expect(t.take("tab:err", hit(1), 0)).toEqual(hit(1));
    expect(t.take("tab:err", hit(2), 100)).toBeUndefined();
    expect(t.take("tab:err", hit(3), 500)).toBeUndefined();
    expect(t.due(900)).toEqual([]);
    expect(t.due(1000)).toEqual([["tab:err", hit(5)]]);
    expect(t.take("tab:err", hit(1), 1500)).toBeUndefined();
  });

  it("throttles each key on its own and forgets a closed tab", () => {
    const t = new AlertThrottle(1000);
    t.take("a:err", hit(1), 0);
    expect(t.take("b:err", hit(1), 10)).toEqual(hit(1));
    t.forget("a:");
    expect(t.take("a:err", hit(1), 20)).toEqual(hit(1));
  });
});

describe("alertText", () => {
  it("names the rule, the count and the file, and shows the line", () => {
    expect(alertText("app.log", { ruleId: "err", ruleName: "ERROR", count: 3, line: 41, text: "  boom  " })).toEqual({ title: "ERROR (3 lignes) — app.log", body: "Ligne 42 : boom" });
  });
});
