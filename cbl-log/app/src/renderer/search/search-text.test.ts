import { describe, expect, it } from "vitest";
import { describeSearch, validateQuery } from "./search-text";

const q = (pattern: string, isRegex = true) => ({ pattern, isRegex, caseSensitive: false });

describe("validateQuery", () => {
  it("accepts literals and valid regex", () => {
    expect(validateQuery(q("(", false))).toBeUndefined();
    expect(validateQuery(q("a+b"))).toBeUndefined();
    expect(validateQuery(q(""))).toBeUndefined();
  });

  it("explains an invalid regex", () => {
    expect(validateQuery(q("("))).toMatch(/\S/);
  });
});

describe("describeSearch", () => {
  const base = { pattern: "x", invalid: undefined, ordinal: null };

  it("covers every state", () => {
    expect(describeSearch({ ...base, pattern: "", status: undefined })).toBe("");
    expect(describeSearch({ ...base, invalid: "boom", status: undefined })).toBe("Regex invalide : boom");
    expect(describeSearch({ ...base, status: undefined })).toBe("Recherche…");
    expect(describeSearch({ ...base, status: { matches: 0, done: false } })).toBe("Recherche…");
    expect(describeSearch({ ...base, status: { matches: 0, done: true } })).toBe("Aucun résultat");
    expect(describeSearch({ ...base, status: { matches: 1, done: true } })).toBe("1 résultat");
    expect(describeSearch({ ...base, status: { matches: 12, done: false } })).toBe("12 résultats+");
    expect(describeSearch({ ...base, ordinal: 3, status: { matches: 12, done: true } })).toBe("3 / 12 résultats");
    expect(describeSearch({ ...base, status: { matches: 4, done: false, error: "too-expensive" } })).toBe("Regex trop coûteuse : recherche interrompue");
    expect(describeSearch({ ...base, status: { matches: 0, done: true, error: "failed" } })).toBe("Recherche impossible");
  });
});
