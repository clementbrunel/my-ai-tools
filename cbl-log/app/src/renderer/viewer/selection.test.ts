import { describe, expect, it } from "vitest";
import { formatRows, isSelected, selectionRange, selectionSize } from "./selection";

const row = (lineNo: number, text: string) => ({ lineNo, text, truncated: false });

describe("selection", () => {
  it("normalizes a backwards selection", () => {
    expect(selectionRange({ anchor: 9, head: 4 })).toEqual({ first: 4, last: 9 });
    expect(selectionSize({ anchor: 9, head: 4 })).toBe(6);
    expect(selectionSize({ anchor: 3, head: 3 })).toBe(1);
  });

  it("tells which rows are selected", () => {
    const s = { anchor: 2, head: 4 };
    expect([1, 2, 3, 4, 5].map((r) => isSelected(s, r))).toEqual([false, true, true, true, false]);
    expect(isSelected(undefined, 2)).toBe(false);
  });

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
