import { escapeRegExp, patternSource } from "@cbl-log/shared";
import { describe, expect, it } from "vitest";

const re = (spec: Parameters<typeof patternSource>[0], flags = "") => new RegExp(patternSource(spec), flags);

describe("patternSource", () => {
  it("escapes literal text and leaves regex alone", () => {
    expect(patternSource({ pattern: "a.b", isRegex: false })).toBe(String.raw`a\.b`);
    expect(patternSource({ pattern: "a.b", isRegex: true })).toBe("a.b");
    expect(escapeRegExp("[x]+(y)")).toBe(String.raw`\[x\]\+\(y\)`);
  });

  it("whole word: does not match inside a longer word", () => {
    const error = re({ pattern: "ERROR", isRegex: false, wholeWord: true });
    expect(error.test("an ERROR occurred")).toBe(true);
    expect(error.test("ERROR")).toBe(true);
    expect(error.test("(ERROR)")).toBe(true);
    expect(error.test("ERRORS happened")).toBe(false);
    expect(error.test("MYERROR")).toBe(false);
    expect(error.test("ERROR_CODE")).toBe(false); // underscore is a word character
  });

  it("whole word: works for patterns that start or end with a symbol", () => {
    expect(re({ pattern: "[ERROR]", isRegex: false, wholeWord: true }).test("x [ERROR] y")).toBe(true);
    expect(re({ pattern: ".log", isRegex: false, wholeWord: true }).test("app.log rolled")).toBe(false); // preceded by a word char
    expect(re({ pattern: ".log", isRegex: false, wholeWord: true }).test("see .log files")).toBe(true);
  });

  it("whole word: an alternation is wrapped as one group", () => {
    const either = re({ pattern: "ERROR|WARN", isRegex: true, wholeWord: true });
    expect(either.test("a WARN b")).toBe(true);
    expect(either.test("WARNING")).toBe(false);
    expect(either.test("XERROR")).toBe(false);
  });

  it("without whole word, substrings still match", () => {
    expect(re({ pattern: "ERROR", isRegex: false }).test("ERRORS")).toBe(true);
    expect(re({ pattern: "ERROR", isRegex: false, wholeWord: false }).test("MYERROR")).toBe(true);
  });
});
