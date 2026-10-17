import { createDefaultRuleSet, type HighlightRule } from "@cbl-log/shared";
import { describe, expect, it } from "vitest";
import { BACKGROUND_ALPHA, compileRules, highlightLine, withAlpha } from "./highlight";

const rule = (over: Partial<HighlightRule> & { id: string; pattern: string }): HighlightRule => ({
  name: "",
  isRegex: false,
  caseSensitive: false,
  scope: "line",
  enabled: true,
  ...over,
});

const run = (text: string, rules: HighlightRule[]) => highlightLine(text, compileRules(rules).compiled);

describe("compileRules", () => {
  it("skips disabled and empty rules", () => {
    const { compiled } = compileRules([
      rule({ id: "a", pattern: "x", enabled: false }),
      rule({ id: "b", pattern: "" }),
      rule({ id: "c", pattern: "ok" }),
    ]);
    expect(compiled.map((c) => c.rule.id)).toEqual(["c"]);
  });

  it("reports an invalid regex without breaking the other rules", () => {
    const { compiled, errors } = compileRules([rule({ id: "bad", pattern: "(", isRegex: true }), rule({ id: "ok", pattern: "a" })]);
    expect(Object.keys(errors)).toEqual(["bad"]);
    expect(compiled).toHaveLength(1);
  });

  it("treats a non-regex pattern as a literal substring", () => {
    expect(run("a.b", [rule({ id: "l", pattern: "a.b", bg: "#ff0000" })]).lineBg).toBeDefined();
    expect(run("axb", [rule({ id: "l", pattern: "a.b", bg: "#ff0000" })]).lineBg).toBeUndefined();
  });
});

describe("highlightLine", () => {
  it("returns the plain text when nothing matches", () => {
    expect(run("hello", [rule({ id: "r", pattern: "zzz", bg: "#ff0000" })])).toEqual({ segments: [{ text: "hello" }] });
  });

  it("line scope: the first matching rule colors the whole line", () => {
    const r = run("ERROR and WARN", [
      rule({ id: "e", pattern: "ERROR", bg: "#ff0000", fg: "#ffffff" }),
      rule({ id: "w", pattern: "WARN", bg: "#ffaa00" }),
    ]);
    expect(r.lineBg).toBe(withAlpha("#ff0000", BACKGROUND_ALPHA));
    expect(r.lineFg).toBe("#ffffff");
    expect(r.segments).toEqual([{ text: "ERROR and WARN" }]);
  });

  it("is case-insensitive unless asked otherwise", () => {
    expect(run("error", [rule({ id: "e", pattern: "ERROR", bg: "#ff0000" })]).lineBg).toBeDefined();
    expect(run("error", [rule({ id: "e", pattern: "ERROR", bg: "#ff0000", caseSensitive: true })]).lineBg).toBeUndefined();
  });

  it("fragment scope: only the matches are colored", () => {
    const r = run("a ERROR b ERROR c", [rule({ id: "e", pattern: "ERROR", scope: "fragment", bg: "#ff0000" })]);
    expect(r.segments.map((s) => [s.text, !!s.bg])).toEqual([
      ["a ", false],
      ["ERROR", true],
      [" b ", false],
      ["ERROR", true],
      [" c", false],
    ]);
  });

  it("fragment scope: the earlier rule wins on overlapping matches", () => {
    const r = run("abcdef", [
      rule({ id: "1", pattern: "bcd", scope: "fragment", fg: "#111111" }),
      rule({ id: "2", pattern: "cde", scope: "fragment", fg: "#222222" }),
    ]);
    expect(r.segments).toEqual([{ text: "a" }, { text: "bcd", fg: "#111111" }, { text: "ef" }]);
  });

  it("supports regex with groups and ignores empty matches", () => {
    const r = run("id=42 id=7", [rule({ id: "n", pattern: "id=\\d+", isRegex: true, scope: "fragment", fg: "#00aa00" })]);
    expect(r.segments.filter((s) => s.fg).map((s) => s.text)).toEqual(["id=42", "id=7"]);
    expect(() => run("abc", [rule({ id: "e", pattern: "x*", isRegex: true, scope: "fragment", fg: "#00aa00" })])).not.toThrow();
  });

  it("combines a line color with fragment colors", () => {
    const r = run("ERROR Exception", [
      rule({ id: "l", pattern: "ERROR", bg: "#ff0000" }),
      rule({ id: "f", pattern: "Exception", scope: "fragment", fg: "#ffff00" }),
    ]);
    expect(r.lineBg).toBeDefined();
    expect(r.segments.some((s) => s.text === "Exception" && s.fg === "#ffff00")).toBe(true);
  });
});

describe("default rules", () => {
  const compiled = compileRules(createDefaultRuleSet().rules).compiled;

  it("colors ERROR lines and IBM …E ids red, WARN and …W orange", () => {
    expect(highlightLine("2026 ERROR boom", compiled).lineBg).toBe(withAlpha("#d93025", BACKGROUND_ALPHA));
    expect(highlightLine("[x] WSVR0029E: failed", compiled).lineBg).toBe(withAlpha("#d93025", BACKGROUND_ALPHA));
    expect(highlightLine("WARN slow", compiled).lineBg).toBe(withAlpha("#f29900", BACKGROUND_ALPHA));
    expect(highlightLine("CWWKZ0014W something", compiled).lineBg).toBe(withAlpha("#f29900", BACKGROUND_ALPHA));
  });

  it("marks Exception and Caused by as fragments, INFO and DEBUG lightly", () => {
    const r = highlightLine("Caused by: java.lang.NullPointerException", compiled);
    expect(r.segments.filter((s) => s.bg).map((s) => s.text)).toEqual(["Caused by:", "java.lang.NullPointerException"]);
    expect(highlightLine("INFO started", compiled).lineBg).toBeUndefined();
    expect(highlightLine("INFO started", compiled).segments[0]?.text).toBe("INFO");
  });

  it("leaves a plain line untouched", () => {
    expect(highlightLine("nothing to see", compiled)).toEqual({ segments: [{ text: "nothing to see" }] });
  });
});

describe("withAlpha", () => {
  it("converts #rrggbb to rgba", () => {
    expect(withAlpha("#ff8000", 0.5)).toBe("rgba(255, 128, 0, 0.5)");
  });
});
