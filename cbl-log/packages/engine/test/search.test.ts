import { appendFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { MessageChannel } from "node:worker_threads";
import type { EngineEvent, EngineMessage, EngineRequestMap, EngineResponse, SearchQuery, TabEvent } from "@cbl-log/shared";
import { afterEach, describe, expect, it } from "vitest";
import { EngineService, planSlices, type EngineServiceOptions } from "../src/index";
import { useTempDir, waitFor } from "./helpers";

const tempDir = useTempDir();
const cleanups: (() => Promise<void> | void)[] = [];
afterEach(async () => {
  for (const c of cleanups.splice(0)) await c();
});

function connect(options?: EngineServiceOptions) {
  const service = new EngineService(options);
  const { port1, port2 } = new MessageChannel();
  const detach = service.attach({
    postMessage: (m) => port1.postMessage(m),
    onMessage: (h) => {
      const listener = (m: unknown): void => h(m);
      port1.on("message", listener);
      return () => port1.off("message", listener);
    },
  });
  const events: EngineEvent[] = [];
  const pending = new Map<number, (r: EngineResponse) => void>();
  port2.on("message", (m: EngineMessage) => {
    if (m.kind === "event") events.push(m);
    else pending.get(m.id)?.(m);
  });
  let nextId = 1;
  cleanups.push(async () => {
    detach();
    await service.dispose();
    port1.close();
    port2.close();
  });
  const call = <K extends keyof EngineRequestMap>(op: K, params: EngineRequestMap[K]["params"]): Promise<EngineResponse> => {
    const id = nextId++;
    return new Promise((resolve) => {
      pending.set(id, resolve);
      port2.postMessage({ kind: "request", id, op, params });
    });
  };
  const ok = async <K extends keyof EngineRequestMap>(op: K, params: EngineRequestMap[K]["params"]): Promise<EngineRequestMap[K]["result"]> => {
    const res = await call(op, params);
    if (!res.ok) throw new Error(`${res.error.code}: ${res.error.message}`);
    return res.result as EngineRequestMap[K]["result"];
  };
  const queryEvents = (tabId: string): Extract<TabEvent, { type: "query" }>[] =>
    events.flatMap((e) => (e.tabId === tabId && e.event.type === "query" ? [e.event] : []));
  return { call, ok, events, queryEvents };
}

/** 1 line in `every` contains the marker; line i is `line <i> <marker or filler>`. */
const makeLines = (count: number, every: number, marker = "NEEDLE"): string[] =>
  Array.from({ length: count }, (_, i) => `line ${i} ${i % every === 0 ? marker : "filler"} ${"x".repeat(30)}`);

async function openLines(lines: string[], options?: EngineServiceOptions, newline = "\n") {
  const dir = await tempDir();
  const path = join(dir, "a.log");
  writeFileSync(path, lines.join(newline) + newline);
  const c = connect({ search: { sliceBytes: 2048, maxWorkers: 2, stallMs: 2000, ...options?.search }, ...options });
  const info = await c.ok("open", { path });
  return { ...c, tabId: info.tabId, path };
}

async function search(ctx: Awaited<ReturnType<typeof openLines>>, query: Partial<SearchQuery> & { pattern: string }) {
  const q: SearchQuery = { isRegex: false, caseSensitive: true, ...query };
  const { searchId } = await ctx.ok("search", { tabId: ctx.tabId, query: q });
  await waitFor(() => ctx.queryEvents(ctx.tabId).some((e) => e.id === searchId && e.done), "search done");
  return searchId!;
}

const finalEvent = (ctx: Awaited<ReturnType<typeof openLines>>, id: string) => ctx.queryEvents(ctx.tabId).filter((e) => e.id === id).at(-1)!;

describe("planSlices", () => {
  it("cuts at checkpoints at least sliceBytes apart and covers the whole range", () => {
    const cps = [10, 100, 200, 300, 400];
    expect(planSlices(cps, 10, 450, 150)).toEqual([
      { start: 10, end: 200 },
      { start: 200, end: 400 },
      { start: 400, end: 450 },
    ]);
  });

  it("returns one slice for a small range and none for an empty one", () => {
    expect(planSlices([0, 64], 0, 50, 1000)).toEqual([{ start: 0, end: 50 }]);
    expect(planSlices([0], 50, 50, 1000)).toEqual([]);
  });
});

// Each test starts worker threads (Windows runners can be slow to spawn them): well above the 5 s default.
describe("search", { timeout: 30_000 }, () => {
  it("counts the matching lines (raw literal fast path) across several slices", async () => {
    const ctx = await openLines(makeLines(3000, 7));
    const id = await search(ctx, { pattern: "NEEDLE" });
    expect(finalEvent(ctx, id)).toMatchObject({ matches: Math.ceil(3000 / 7), done: true });
  });

  it("finds the same lines with the regex path, case-insensitively", async () => {
    const lines = makeLines(2000, 11, "Needle");
    const ctx = await openLines(lines);
    const expected = Math.ceil(2000 / 11);
    expect(finalEvent(ctx, await search(ctx, { pattern: "needle", caseSensitive: false })).matches).toBe(expected);
    expect(finalEvent(ctx, await search(ctx, { pattern: "Needle \\w+", isRegex: true })).matches).toBe(expected);
    expect(finalEvent(ctx, await search(ctx, { pattern: "needle", caseSensitive: true })).matches).toBe(0);
  });

  it("navigates next / previous with ranks, and wraps around", async () => {
    const ctx = await openLines(makeLines(500, 100)); // matches at rows 0, 100, 200, 300, 400
    const id = await search(ctx, { pattern: "NEEDLE" });
    const nav = (fromRow: number, dir: "next" | "prev") => ctx.ok("searchNext", { tabId: ctx.tabId, searchId: id, fromRow, dir });

    expect(await nav(-1, "next")).toMatchObject({ row: 0, ordinal: 1, matches: 5, done: true, wrapped: false });
    expect(await nav(0, "next")).toMatchObject({ row: 100, ordinal: 2 });
    expect(await nav(250, "next")).toMatchObject({ row: 300, ordinal: 4 });
    expect(await nav(400, "next")).toMatchObject({ row: 0, ordinal: 1, wrapped: true });
    expect(await nav(250, "prev")).toMatchObject({ row: 200, ordinal: 3 });
    expect(await nav(0, "prev")).toMatchObject({ row: 400, ordinal: 5, wrapped: true });
  });

  it("matches inside CRLF files and UTF-16 files", async () => {
    const crlf = await openLines(makeLines(300, 50), undefined, "\r\n");
    expect(finalEvent(crlf, await search(crlf, { pattern: "NEEDLE" })).matches).toBe(6);

    const dir = await tempDir();
    const path = join(dir, "u16.log");
    writeFileSync(path, Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(makeLines(400, 40).join("\n") + "\n", "utf16le")]));
    const c = connect({ search: { sliceBytes: 2048, maxWorkers: 2 } });
    const { tabId } = await c.ok("open", { path });
    const { searchId } = await c.ok("search", { tabId, query: { pattern: "NEEDLE", isRegex: false, caseSensitive: true } });
    await waitFor(() => c.queryEvents(tabId).some((e) => e.id === searchId && e.done), "utf-16 search");
    expect(c.queryEvents(tabId).at(-1)?.matches).toBe(10);
  });

  it("extends the results when the file grows", async () => {
    const ctx = await openLines(makeLines(200, 50));
    const id = await search(ctx, { pattern: "NEEDLE" });
    expect(finalEvent(ctx, id).matches).toBe(4);
    appendFileSync(ctx.path, "tail NEEDLE one\ntail filler\ntail NEEDLE two\n");
    await waitFor(() => finalEvent(ctx, id).matches === 6 && finalEvent(ctx, id).done, "results extended");
    const last = await ctx.ok("searchNext", { tabId: ctx.tabId, searchId: id, fromRow: 0, dir: "prev" });
    expect(last.row).toBe(202); // wraps to the last match
  });

  it("a new search replaces the previous one", async () => {
    const ctx = await openLines(makeLines(300, 10));
    const first = await search(ctx, { pattern: "NEEDLE" });
    const second = await search(ctx, { pattern: "line 1" });
    expect(second).not.toBe(first);
    const stale = await ctx.ok("searchNext", { tabId: ctx.tabId, searchId: first, fromRow: 0, dir: "next" });
    expect(stale.row).toBeNull();
    const cancelled = await ctx.ok("search", { tabId: ctx.tabId, query: null });
    expect(cancelled.searchId).toBeNull();
  });

  it("rejects an invalid regex", async () => {
    const ctx = await openLines(makeLines(10, 2));
    const res = await ctx.call("search", { tabId: ctx.tabId, query: { pattern: "(", isRegex: true, caseSensitive: true } });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("BAD_QUERY");
  });

  it("kills a catastrophic regex and reports it as too expensive", async () => {
    const evil = `${"a".repeat(45)}b`;
    const ctx = await openLines([evil, "fine", evil], { search: { sliceBytes: 1 << 20, maxWorkers: 1, stallMs: 400 } });
    const { searchId } = await ctx.ok("search", { tabId: ctx.tabId, query: { pattern: "^(a+)+$", isRegex: true, caseSensitive: true } });
    await waitFor(() => ctx.queryEvents(ctx.tabId).some((e) => e.id === searchId && e.error), "stall detected", 15_000);
    expect(finalEvent(ctx, searchId!)).toMatchObject({ error: "too-expensive" });
  });
});
