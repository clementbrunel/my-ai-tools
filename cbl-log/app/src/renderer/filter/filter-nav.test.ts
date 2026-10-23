import type { FilterLocation, SearchHit } from "@cbl-log/shared";
import { describe, expect, it } from "vitest";
import { nextVisibleHit } from "./filter-nav";

/** Search over fixed hit rows, wrapping around; a filter that shows only some rows. */
function world(hits: number[], shown: number[]) {
  const searchNext = async (fromRow: number, dir: "next" | "prev"): Promise<SearchHit> => {
    const sorted = [...hits].sort((a, b) => a - b);
    let row = dir === "next" ? sorted.find((h) => h > fromRow) : [...sorted].reverse().find((h) => h < fromRow);
    row ??= dir === "next" ? sorted[0] : sorted[sorted.length - 1];
    return { row: row ?? null, ordinal: null, matches: hits.length, done: true, wrapped: false };
  };
  const locate = async (row: number): Promise<FilterLocation> => ({
    position: shown.filter((s) => s < row).length,
    exact: shown.includes(row),
    covered: true,
  });
  return { searchNext, locate };
}

describe("nextVisibleHit", () => {
  it("returns the next hit when its line is shown, with its position in the view", async () => {
    const w = world([10, 20, 30], [5, 20, 30]);
    const found = await nextVisibleHit(w.searchNext, w.locate, 10, "next");
    expect(found?.hit.row).toBe(20);
    expect(found?.position).toBe(1);
  });

  it("skips the hits on hidden lines, forwards and backwards", async () => {
    const w = world([10, 20, 30, 40], [30]);
    expect((await nextVisibleHit(w.searchNext, w.locate, 0, "next"))?.hit.row).toBe(30);
    expect((await nextVisibleHit(w.searchNext, w.locate, 100, "prev"))?.hit.row).toBe(30);
  });

  it("goes around the end of the file", async () => {
    const w = world([10, 20, 30], [10]);
    expect((await nextVisibleHit(w.searchNext, w.locate, 20, "next"))?.hit.row).toBe(10);
  });

  it("gives up when every hit is hidden, or there is none", async () => {
    const hidden = world([10, 20, 30], [99]);
    expect(await nextVisibleHit(hidden.searchNext, hidden.locate, 0, "next")).toBeUndefined();
    const none = world([], [1]);
    expect(await nextVisibleHit(none.searchNext, none.locate, 0, "next")).toBeUndefined();
  });

  it("gives up after the skip budget", async () => {
    const hits = Array.from({ length: 50 }, (_, i) => i * 10);
    const w = world(hits, [9999]);
    expect(await nextVisibleHit(w.searchNext, w.locate, -1, "next", 5)).toBeUndefined();
  });
});
