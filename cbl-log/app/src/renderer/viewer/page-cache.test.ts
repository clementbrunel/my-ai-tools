import type { Row } from "@cbl-log/shared";
import { describe, expect, it } from "vitest";
import { MAX_PAGES, PAGE_SIZE, PageCache } from "./page-cache";

const makeRows = (first: number, count: number, tag = "v1"): Row[] =>
  Array.from({ length: count }, (_, i) => ({ lineNo: first + i, text: `${tag}:${first + i}`, truncated: false }));

/** Fetcher whose answers are released by hand, to test in-flight behaviour. */
function manualFetcher(total: number) {
  const calls: { first: number; count: number; resolve: (rows: Row[]) => void }[] = [];
  const fetch = (first: number, count: number): Promise<Row[]> =>
    new Promise((resolve) => {
      calls.push({
        first,
        count,
        resolve: (rows) => resolve(rows),
      });
      void total;
    });
  return { calls, fetch };
}

const flush = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

describe("PageCache", () => {
  it("loads the requested pages plus both neighbours", async () => {
    const asked: number[] = [];
    const cache = new PageCache(async (first, count) => {
      asked.push(first);
      return makeRows(first, count);
    });
    cache.request(PAGE_SIZE * 3 + 5, 40, 10_000);
    await flush();
    expect(asked.sort((a, b) => a - b)).toEqual([PAGE_SIZE * 2, PAGE_SIZE * 3, PAGE_SIZE * 4]);
    expect(cache.getRow(PAGE_SIZE * 3 + 5)?.text).toBe(`v1:${PAGE_SIZE * 3 + 5}`);
  });

  it("does not request pages beyond the total", async () => {
    const asked: number[] = [];
    const cache = new PageCache(async (first, count) => {
      asked.push(first);
      return makeRows(first, Math.min(count, 250 - first));
    });
    cache.request(0, 50, 250);
    await flush();
    expect(Math.max(...asked)).toBeLessThan(250);
  });

  it("de-duplicates in-flight requests", () => {
    const { calls, fetch } = manualFetcher(1000);
    const cache = new PageCache(fetch);
    cache.request(0, 50, 1000);
    cache.request(0, 50, 1000);
    cache.request(10, 50, 1000);
    expect(calls.map((c) => c.first)).toEqual([0, PAGE_SIZE]);
  });

  it("reports missing pages and notifies subscribers when a page lands", async () => {
    const cache = new PageCache(async (first, count) => makeRows(first, count));
    let notified = 0;
    cache.subscribe(() => notified++);
    expect(cache.missingPages(0, 10, 1000)).toEqual([0]);
    cache.request(0, 10, 1000);
    await flush();
    expect(cache.missingPages(0, 10, 1000)).toEqual([]);
    expect(notified).toBeGreaterThan(0);
  });

  it("evicts the least recently used pages", async () => {
    const cache = new PageCache(async (first, count) => makeRows(first, count), 3);
    cache.request(10 * PAGE_SIZE, 1, 100_000); // loads pages 9, 10, 11
    await flush();
    expect(cache.getRow(10 * PAGE_SIZE)).toBeDefined();
    cache.request(20 * PAGE_SIZE, 1, 100_000); // loads pages 19, 20, 21: the old ones go
    await flush();
    expect(cache.getRow(20 * PAGE_SIZE)).toBeDefined();
    expect(cache.getRow(10 * PAGE_SIZE)).toBeUndefined();
  });

  it("uses 200-row pages and keeps 50 of them by default", () => {
    expect(PAGE_SIZE).toBe(200);
    expect(MAX_PAGES).toBe(50);
  });

  it("keeps stale rows readable until the refetch lands", async () => {
    let version = "v1";
    const cache = new PageCache(async (first, count) => makeRows(first, count, version));
    cache.request(0, 10, 1000);
    await flush();
    version = "v2";
    cache.invalidateFrom(5);
    expect(cache.getRow(3)?.text).toBe("v1:3"); // still shown
    expect(cache.missingPages(0, 10, 1000)).toEqual([0]);
    cache.request(0, 10, 1000);
    await flush();
    expect(cache.getRow(3)?.text).toBe("v2:3");
  });

  it("only invalidates pages from the given row on", async () => {
    const cache = new PageCache(async (first, count) => makeRows(first, count));
    cache.request(0, PAGE_SIZE * 3, 10_000);
    await flush();
    cache.invalidateFrom(PAGE_SIZE * 2 + 1);
    expect(cache.missingPages(0, PAGE_SIZE * 2, 10_000)).toEqual([]);
    expect(cache.missingPages(PAGE_SIZE * 2, 10, 10_000)).toEqual([2]);
  });

  it("discards an answer that was in flight when its page was invalidated", async () => {
    const { calls, fetch } = manualFetcher(1000);
    const cache = new PageCache(fetch);
    cache.request(0, 10, 1000);
    const first = calls[0]!;
    cache.invalidateFrom(0);
    first.resolve(makeRows(first.first, first.count, "old"));
    await flush();
    expect(cache.getRow(0)).toBeUndefined();
    // the invalidation allowed a fresh request
    cache.request(0, 10, 1000);
    expect(calls.filter((c) => c.first === 0)).toHaveLength(2);
  });

  it("indexes rows by line number when some lines are missing", async () => {
    const cache = new PageCache(async () => [
      { lineNo: 0, text: "a", truncated: false },
      { lineNo: 2, text: "c", truncated: false },
    ]);
    cache.request(0, 5, 3);
    await flush();
    expect(cache.getRow(1)).toBeUndefined();
    expect(cache.getRow(2)?.text).toBe("c");
  });

  it("places the rows of a positional cache by rank, whatever their line numbers", async () => {
    const lineOf = (position: number): number => position * 10 + 3; // the filtered view: sparse lines of the file
    const cache = new PageCache(
      async (first, count) => Array.from({ length: count }, (_, i) => ({ lineNo: lineOf(first + i), text: `r${first + i}`, truncated: false })),
      MAX_PAGES,
      true,
    );
    cache.request(PAGE_SIZE + 4, 10, 10_000);
    await flush();
    expect(cache.getRow(PAGE_SIZE + 4)).toMatchObject({ lineNo: lineOf(PAGE_SIZE + 4), text: `r${PAGE_SIZE + 4}` });
    expect(cache.getRow(2)?.text).toBe("r2");
  });
});
