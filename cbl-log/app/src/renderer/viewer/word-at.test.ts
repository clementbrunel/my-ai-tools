import { describe, expect, it } from "vitest";
import { wordBounds } from "./word-at";

const wordAt = (text: string, offset: number): string | undefined => {
  const b = wordBounds(text, offset);
  return b ? text.slice(b[0], b[1]) : undefined;
};

describe("wordBounds", () => {
  const line = '2026-10-14 10:02:11.123 [main] ERROR com.acme.Service - user=john id=10.0.0.1 "failed", retry.';

  it("takes a dotted class name as one word", () => {
    expect(wordAt(line, line.indexOf("acme"))).toBe("com.acme.Service");
  });

  it("strips brackets, quotes and equal signs", () => {
    expect(wordAt(line, line.indexOf("main"))).toBe("main");
    expect(wordAt(line, line.indexOf("john"))).toBe("john");
    expect(wordAt(line, line.indexOf("failed"))).toBe("failed");
  });

  it("keeps an IP address and a time whole", () => {
    expect(wordAt(line, line.indexOf("0.0.1"))).toBe("10.0.0.1");
    expect(wordAt(line, line.indexOf("02:11"))).toBe("10:02:11.123");
  });

  it("trims the trailing sentence dot", () => {
    expect(wordAt(line, line.indexOf("retry"))).toBe("retry");
  });

  it("takes the word the caret touches at its edges", () => {
    expect(wordAt("foo bar", 3)).toBe("foo"); // right after foo
    expect(wordAt("foo bar", 4)).toBe("bar"); // right before bar
    expect(wordAt("foo bar", 0)).toBe("foo");
    expect(wordAt("foo bar", 7)).toBe("bar"); // end of the text
  });

  it("finds nothing between blanks or on a separator alone", () => {
    expect(wordAt("foo   bar", 5)).toBeUndefined();
    expect(wordAt("", 0)).toBeUndefined();
    expect(wordAt("a = b", 2)).toBeUndefined();
    expect(wordAt("--", 1)).toBeUndefined();
  });
});
