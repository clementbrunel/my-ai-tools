import { describe, expect, it } from "vitest";
import { formatRows } from "./selection";

const row = (lineNo: number, text: string) => ({ lineNo, text, truncated: false });

describe("selection", () => {
  it("formats rows without line numbers", () => {
    expect(formatRows([row(0, "a"), row(1, "b")], false)).toBe("a\nb");
  });

  it("formats rows with 1-based line numbers and a tab", () => {
    expect(formatRows([row(41, "a"), row(42, "b")], true)).toBe("42\ta\n43\tb");
  });

  it("returns an empty string for no rows", () => {
    expect(formatRows([], true)).toBe("");
  });
});
