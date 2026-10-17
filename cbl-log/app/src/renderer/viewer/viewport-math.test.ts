import { describe, expect, it } from "vitest";
import {
  contentHeight,
  isAtBottom,
  isScaled,
  MAX_SCROLL_PX,
  rowToScrollTop,
  scrollTopToRow,
  visibleRange,
} from "./viewport-math";

const RH = 18;
const VH = 540; // 30 rows

describe("unscaled geometry", () => {
  it("content height is total * rowHeight", () => {
    expect(contentHeight(1000, RH)).toBe(18_000);
    expect(isScaled(1_000_000, RH)).toBe(false);
  });

  it("maps scrollTop to rows and back exactly", () => {
    expect(scrollTopToRow(0, VH, 1_000_000, RH)).toBe(0);
    expect(scrollTopToRow(18 * 500_000, VH, 1_000_000, RH)).toBe(500_000);
    expect(rowToScrollTop(500_000, VH, 1_000_000, RH)).toBe(18 * 500_000);
  });

  it("clamps rowToScrollTop to the scroll range", () => {
    expect(rowToScrollTop(999_999, VH, 1_000_000, RH)).toBe(18_000_000 - VH);
    expect(rowToScrollTop(-5, VH, 100, RH)).toBe(0);
  });

  it("visible range includes overscan and clamps at both ends", () => {
    const mid = visibleRange(18 * 100, VH, 1000, 10, RH);
    expect(mid.first).toBe(90);
    expect(mid.top).toBe(18 * 90);
    expect(mid.count).toBe(30 + 1 + 10 + 10);

    const head = visibleRange(0, VH, 1000, 10, RH);
    expect(head.first).toBe(0);

    const tail = visibleRange(18_000 - VH, VH, 1000, 10, RH);
    expect(tail.first + tail.count).toBe(1000);
  });

  it("handles empty and short content", () => {
    expect(visibleRange(0, VH, 0, 10, RH)).toEqual({ first: 0, count: 0, top: 0 });
    expect(visibleRange(0, VH, 5, 10, RH).count).toBe(5);
  });

  it("detects the bottom with a tolerance", () => {
    expect(isAtBottom(18_000 - VH, VH, 1000, RH)).toBe(true);
    expect(isAtBottom(18_000 - VH - 0.5, VH, 1000, RH)).toBe(true);
    expect(isAtBottom(18_000 - VH - 50, VH, 1000, RH)).toBe(false);
    expect(isAtBottom(0, VH, 10, RH)).toBe(true); // content shorter than the viewport
  });
});

describe("scaled geometry (beyond MAX_SCROLL_PX)", () => {
  const total = 1_000_000_000;

  it("caps the spacer height", () => {
    expect(isScaled(total, RH)).toBe(true);
    expect(contentHeight(total, RH)).toBe(MAX_SCROLL_PX);
  });

  it("reaches the very first and very last rows", () => {
    expect(scrollTopToRow(0, VH, total, RH)).toBe(0);
    const maxTop = MAX_SCROLL_PX - VH;
    const last = visibleRange(maxTop, VH, total, 0, RH);
    expect(last.first + last.count).toBe(total);
    expect(isAtBottom(maxTop, VH, total, RH)).toBe(true);
  });

  it("is monotonic and roughly invertible", () => {
    const a = scrollTopToRow(10_000_000, VH, total, RH);
    const b = scrollTopToRow(10_000_100, VH, total, RH);
    expect(b).toBeGreaterThan(a);
    const back = scrollTopToRow(rowToScrollTop(500_000_000, VH, total, RH), VH, total, RH);
    // one scroll pixel is worth ~33 rows in this configuration
    expect(Math.abs(back - 500_000_000)).toBeLessThan(100);
  });
});
