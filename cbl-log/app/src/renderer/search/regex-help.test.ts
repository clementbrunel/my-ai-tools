import { describe, expect, it } from "vitest";
import { PRESETS, SNIPPETS, explain, insertAt } from "./regex-help";

describe("presets and snippets", () => {
  it("every preset is a valid regex that matches its own example", () => {
    for (const preset of PRESETS) {
      const re = new RegExp(preset.pattern);
      expect(re.test(preset.example), preset.label).toBe(true);
    }
  });

  it("every snippet compiles once wrapped so that it can stand alone", () => {
    for (const snippet of SNIPPETS) {
      const standalone = /^[?{]/.test(snippet.insert) ? `a${snippet.insert}` : snippet.insert;
      expect(() => new RegExp(standalone), snippet.label).not.toThrow();
    }
  });

  it("presets do not match unrelated text", () => {
    const ip = new RegExp(PRESETS.find((p) => p.label === "Adresse IP")!.pattern);
    expect(ip.test("version 1.2.3")).toBe(false);
    const uuid = new RegExp(PRESETS.find((p) => p.label === "Identifiant UUID")!.pattern);
    expect(uuid.test("123e4567-e89b")).toBe(false);
  });
});

describe("insertAt", () => {
  it("inserts at the cursor and replaces a selection", () => {
    expect(insertAt("ab", 1, 1, "\\d+")).toEqual({ value: "a\\d+b", cursor: 4 });
    expect(insertAt("abcd", 1, 3, "X")).toEqual({ value: "aXd", cursor: 2 });
  });

  it("puts the cursor inside delimiters so that the user can type straight away", () => {
    expect(insertAt("", 0, 0, "(ERROR|WARN)").cursor).toBe(1);
    expect(insertAt("x", 1, 1, "[abc]")).toEqual({ value: "x[abc]", cursor: 2 });
  });

  it("clamps out-of-range positions", () => {
    expect(insertAt("ab", 99, 120, "!").value).toBe("ab!");
  });
});

describe("explain", () => {
  const meanings = (pattern: string): string[] => explain(pattern).map((e) => e.meaning);

  it("reads classes, quantifiers and anchors", () => {
    expect(explain("^\\d+$")).toEqual([
      { token: "^", meaning: "début de la ligne" },
      { token: "\\d", meaning: "un chiffre" },
      { token: "+", meaning: "répété 1 fois ou plus" },
      { token: "$", meaning: "fin de la ligne" },
    ]);
  });

  it("groups literal text but keeps a quantifier attached to its character", () => {
    expect(explain("ERROR")).toEqual([{ token: "ERROR", meaning: "le texte « ERROR »" }]);
    expect(explain("colou?r").map((e) => e.token)).toEqual(["colo", "u", "?", "r"]);
    expect(meanings("ab+")).toEqual(["le caractère « a »", "le caractère « b »", "répété 1 fois ou plus"]);
  });

  it("reads groups, alternatives and sets", () => {
    expect(meanings("(ERROR|WARN)")).toEqual(["début d'un groupe", "le texte « ERROR »", "ou bien", "le texte « WARN »", "fin du groupe"]);
    expect(meanings("[A-Z]")).toEqual(["un caractère parmi A-Z"]);
    expect(meanings("[^0-9]")).toEqual(["un caractère qui n'est pas parmi 0-9"]);
    expect(meanings("(?<ts>\\d)")[0]).toBe("début du groupe nommé « ts »");
  });

  it("reads counted and lazy repetitions", () => {
    expect(meanings("\\d{3}")).toContain("répété exactement 3 fois");
    expect(meanings("\\d{2,5}")).toContain("répété de 2 à 5 fois");
    expect(meanings("\\d{2,}")).toContain("répété 2 fois ou plus");
    expect(meanings(".*?")).toEqual(["n'importe quel caractère", "répété 0 fois ou plus, le plus court possible"]);
  });

  it("explains an escaped special character as itself", () => {
    expect(meanings("a\\.b")[1]).toBe("le caractère « . » lui-même");
  });

  it("is empty for an empty pattern and never throws on odd input", () => {
    expect(explain("")).toEqual([]);
    expect(() => explain("[unclosed")).not.toThrow();
    expect(() => explain("(?<broken")).not.toThrow();
    expect(() => explain("\\")).not.toThrow();
  });
});
