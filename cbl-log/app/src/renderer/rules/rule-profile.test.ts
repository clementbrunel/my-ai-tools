import { createBuiltinRuleSets, createDefaultRuleSet, createWebSphereRuleSet, type RuleSet } from "@cbl-log/shared";
import { describe, expect, it } from "vitest";
import { compileRules, highlightLine, withAlpha } from "../highlight/highlight";
import { autoRuleSet, pickRuleSet } from "./rule-profile";

const sets = createBuiltinRuleSets();
const mine: RuleSet = { ...createDefaultRuleSet(), id: "mine", name: "Mine", formats: ["spring-boot"] };

describe("rule profile selection", () => {
  it("proposes the WebSphere profile for a WebSphere log and the default one otherwise", () => {
    expect(autoRuleSet(sets, "websphere-basic")?.id).toBe("websphere");
    expect(autoRuleSet(sets, "spring-boot")?.id).toBe("default");
    expect(autoRuleSet(sets, null)?.id).toBe("default");
    expect(autoRuleSet(sets, undefined)?.id).toBe("default");
  });

  it("a user set can claim a format", () => {
    expect(autoRuleSet([...sets, mine], "spring-boot")?.id).toBe("mine");
  });

  it("the user's choice wins while the set exists, then falls back to automatic", () => {
    expect(pickRuleSet(sets, "websphere-basic", "default")?.id).toBe("default");
    expect(pickRuleSet(sets, "websphere-basic", "deleted-set")?.id).toBe("websphere");
    expect(pickRuleSet(sets, "websphere-basic", undefined)?.id).toBe("websphere");
  });

  it("copes with a folder that has no default set", () => {
    expect(autoRuleSet([mine], "websphere-basic")?.id).toBe("mine");
    expect(autoRuleSet([], "websphere-basic")).toBeUndefined();
  });
});

describe("built-in WebSphere profile", () => {
  const { compiled, errors } = compileRules(createWebSphereRuleSet().rules);
  const line = (level: string, msg = "x") => `[10/14/26 10:02:11:204 UTC] 0000004a SystemOut     O bob|ui|20261014|100211204|${level}|a.B|m|${msg}`;

  it("every rule compiles", () => {
    expect(errors).toEqual({});
    expect(compiled).toHaveLength(createWebSphereRuleSet().rules.length);
  });

  it("colors lines by the application's own level", () => {
    expect(highlightLine(line("SEVERE"), compiled).lineBg).toBe(withAlpha("#d93025", 0.3));
    expect(highlightLine(line("WARNING"), compiled).lineBg).toBe(withAlpha("#f29900", 0.3));
    expect(highlightLine(line("INFO"), compiled).lineBg).toBeUndefined();
  });

  it("marks the application level word and dims FINE levels and the WebSphere prefix", () => {
    const info = highlightLine(line("INFO"), compiled);
    expect(info.segments.some((s) => s.text === "|INFO|" && s.bg)).toBe(true);
    expect(info.segments[0]).toMatchObject({ fg: "#80868b" }); // the "[date] thread SystemOut O " prefix
    const fine = highlightLine(line("FINEST"), compiled);
    expect(fine.segments.some((s) => s.text === "|FINEST|" && s.fg === "#80868b")).toBe(true);
  });

  it("colors IBM message ids and exceptions", () => {
    expect(highlightLine(line("INFO", "SESN0066E: session lost"), compiled).lineBg).toBe(withAlpha("#d93025", 0.3));
    expect(highlightLine("Caused by: java.io.IOException: boom", compiled).segments.filter((s) => s.bg).map((s) => s.text)).toEqual(["Caused by:", "java.io.IOException"]);
  });
});
