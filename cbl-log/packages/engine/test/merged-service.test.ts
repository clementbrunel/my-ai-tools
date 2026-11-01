import { appendFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { MessageChannel } from "node:worker_threads";
import { SPRING_BOOT, type EngineEvent, type EngineMessage, type EngineRequestMap, type EngineResponse, type TabEvent } from "@cbl-log/shared";
import { afterEach, describe, expect, it } from "vitest";
import { EngineService, type EngineServiceOptions } from "../src/index";
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
    else if (m.kind === "response") pending.get(m.id)?.(m);
  });
  let nextId = 1;
  cleanups.push(async () => {
    detach();
    await service.dispose();
    port1.close();
    port2.close();
  });
  const ok = async <K extends keyof EngineRequestMap>(op: K, params: EngineRequestMap[K]["params"]): Promise<EngineRequestMap[K]["result"]> => {
    const id = nextId++;
    const res = await new Promise<EngineResponse>((resolve) => {
      pending.set(id, resolve);
      port2.postMessage({ kind: "request", id, op, params });
    });
    if (!res.ok) throw new Error(`${res.error.code}: ${res.error.message}`);
    return res.result as EngineRequestMap[K]["result"];
  };
  const eventsOf = (tabId: string): TabEvent[] => events.filter((e) => e.tabId === tabId).map((e) => e.event);
  return { ok, eventsOf };
}

const line = (sec: number, msg: string): string =>
  `2026-10-14 10:00:${String(sec).padStart(2, "0")}.000  INFO 1 --- [main] c.e.App : ${msg}\n`;
const message = (text: string): string => text.replace(/^.*: /, "").trim();

describe("the All tab", { timeout: 30_000 }, () => {
  it("interleaves two open tabs by timestamp, labels the rows with their source and follows the files", async () => {
    const dir = await tempDir();
    const a = join(dir, "a.log");
    const b = join(dir, "b.log");
    writeFileSync(a, line(1, "a1") + "\tat x.Y\n" + line(5, "a5"));
    writeFileSync(b, line(2, "b2") + line(3, "b3"));
    const c = connect({ merge: { windowMs: 100 } });
    const tabA = await c.ok("open", { path: a });
    const tabB = await c.ok("open", { path: b });

    const info = await c.ok("openMerged", {
      sources: [
        { tabId: tabA.tabId, label: "srv1", format: SPRING_BOOT },
        { tabId: tabB.tabId, label: "srv2", format: SPRING_BOOT },
      ],
    });
    expect(info.source).toBe("merged");
    expect(info.totalRows).toBe(5);
    expect(info.merged?.sources.map((s) => s.label)).toEqual(["srv1", "srv2"]);

    const first = await c.ok("getRows", { tabId: info.tabId, first: 0, count: 10 });
    expect(first.total).toBe(5);
    expect(first.rows.map((r) => [message(r.text), r.source])).toEqual([
      ["a1", 0],
      ["at x.Y", 0],
      ["b2", 1],
      ["b3", 1],
      ["a5", 0],
    ]);
    expect(first.rows.map((r) => r.lineNo)).toEqual([0, 1, 2, 3, 4]);

    // a new record of b between a1 and a5 in time arrives late: it is added at the end, after the window
    appendFileSync(b, line(4, "b4"));
    await waitFor(() => c.eventsOf(info.tabId).some((e) => e.type === "rows" && e.total === 6), "rows event of the All tab");
    const after = await c.ok("getRows", { tabId: info.tabId, first: 5, count: 5 });
    expect(after.rows.map((r) => [message(r.text), r.source])).toEqual([["b4", 1]]);

    await c.ok("close", { tabId: info.tabId });
    await expect(c.ok("getRows", { tabId: info.tabId, first: 0, count: 1 })).rejects.toThrow(/Unknown tab/);
    // the source tabs are untouched
    expect((await c.ok("getRows", { tabId: tabA.tabId, first: 0, count: 10 })).rows).toHaveLength(3);
  });

  it("can be re-merged with other sources while keeping its id", async () => {
    const dir = await tempDir();
    const a = join(dir, "a.log");
    const b = join(dir, "b.log");
    writeFileSync(a, line(1, "a1"));
    writeFileSync(b, line(2, "b2"));
    const c = connect({ merge: { windowMs: 100 } });
    const tabA = await c.ok("open", { path: a });
    const tabB = await c.ok("open", { path: b });
    const sources = [
      { tabId: tabA.tabId, label: "srv1", format: SPRING_BOOT },
      { tabId: tabB.tabId, label: "srv2", format: SPRING_BOOT },
    ];
    const info = await c.ok("openMerged", { sources });
    const again = await c.ok("openMerged", { sources: sources.slice(1), tabId: info.tabId });
    expect(again.tabId).toBe(info.tabId);
    expect(again.totalRows).toBe(1);
    expect((await c.ok("getRows", { tabId: info.tabId, first: 0, count: 5 })).rows.map((r) => [message(r.text), r.source])).toEqual([["b2", 0]]);
  });

  it("rejects an unknown source and a format without timestamp", async () => {
    const dir = await tempDir();
    const a = join(dir, "a.log");
    writeFileSync(a, line(1, "a1"));
    const c = connect();
    const tabA = await c.ok("open", { path: a });
    await expect(c.ok("openMerged", { sources: [{ tabId: "nope", label: "x", format: SPRING_BOOT }] })).rejects.toThrow(/Unknown tab/);
    await expect(c.ok("openMerged", { sources: [{ tabId: tabA.tabId, label: "x", format: { ...SPRING_BOOT, timestamp: undefined } }] })).rejects.toThrow(/timestamp/);
  });
});

describe("the All tab: search, filter and navigation", { timeout: 30_000 }, () => {
  const levelLine = (sec: number, level: string, msg: string): string =>
    `2026-10-14 10:00:${String(sec).padStart(2, "0")}.000 ${level.padEnd(5)} 1 --- [main] c.e.App : ${msg}
`;

  async function setup() {
    const dir = await tempDir();
    const a = join(dir, "a.log");
    const b = join(dir, "b.log");
    writeFileSync(a, levelLine(1, "INFO", "a1 needle") + levelLine(3, "ERROR", "a3") + "\tat x.Y\n" + levelLine(5, "INFO", "a5 needle"));
    writeFileSync(b, levelLine(2, "WARN", "b2") + levelLine(4, "INFO", "b4 needle"));
    const c = connect({ merge: { windowMs: 100 } });
    const tabA = await c.ok("open", { path: a });
    const tabB = await c.ok("open", { path: b });
    const info = await c.ok("openMerged", {
      sources: [
        { tabId: tabA.tabId, label: "srv1", format: SPRING_BOOT },
        { tabId: tabB.tabId, label: "srv2", format: SPRING_BOOT },
      ],
    });
    return { c, info, tabA, tabB, a, b };
  }

  it("searches the merged rows and navigates with ranks, wrapping around", async () => {
    const { c, info } = await setup();
    const { searchId } = await c.ok("search", { tabId: info.tabId, query: { pattern: "needle", isRegex: false, caseSensitive: true } });
    await waitFor(() => c.eventsOf(info.tabId).some((e) => e.type === "query" && e.id === searchId && e.done), "search done");
    const hit = (fromRow: number, dir: "next" | "prev") => c.ok("searchNext", { tabId: info.tabId, searchId: searchId!, fromRow, dir });
    // merged rows: 0 a1, 1 b2, 2 a3, 3 at x.Y, 4 b4, 5 a5
    expect(await hit(-1, "next")).toMatchObject({ row: 0, ordinal: 1, matches: 3, done: true, wrapped: false });
    expect(await hit(0, "next")).toMatchObject({ row: 4, ordinal: 2 });
    expect(await hit(5, "next")).toMatchObject({ row: 0, ordinal: 1, wrapped: true });
    expect(await hit(4, "prev")).toMatchObject({ row: 0, ordinal: 1 });
    expect(await hit(0, "prev")).toMatchObject({ row: 5, ordinal: 3, wrapped: true });
  });

  it("filters by level and text across the sources, with the level of each record", async () => {
    const { c, info } = await setup();
    const started = await c.ok("setFilter", { tabId: info.tabId, filter: { levels: ["error", "warn"] }, format: SPRING_BOOT });
    await waitFor(() => c.eventsOf(info.tabId).some((e) => e.type === "filter" && e.id === started.filterId && e.done), "filter done");
    const view = await c.ok("getRows", { tabId: info.tabId, first: 0, count: 10, filterId: started.filterId! });
    expect(view.total).toBe(3);
    // the stack frame inherits the level of its record (a3: error)
    expect(view.rows.map((r) => [message(r.text), r.level, r.source, r.lineNo])).toEqual([
      ["b2", "warn", 1, 1],
      ["a3", "error", 0, 2],
      ["at x.Y", "error", 0, 3],
    ]);
    expect(await c.ok("filterLocate", { tabId: info.tabId, filterId: started.filterId!, row: 3 })).toMatchObject({ position: 2, exact: true });
    expect(await c.ok("filterLocate", { tabId: info.tabId, filterId: started.filterId!, row: 4 })).toMatchObject({ position: 3, exact: false, covered: true });

    const text = await c.ok("setFilter", { tabId: info.tabId, filter: { include: [{ pattern: "b4", isRegex: false, caseSensitive: false }] } });
    await waitFor(() => c.eventsOf(info.tabId).some((e) => e.type === "filter" && e.id === text.filterId && e.done), "text filter done");
    expect((await c.ok("getRows", { tabId: info.tabId, first: 0, count: 10, filterId: text.filterId! })).rows.map((r) => message(r.text))).toEqual(["b4 needle"]);
    // the previous filter is gone
    expect((await c.ok("getRows", { tabId: info.tabId, first: 0, count: 10, filterId: started.filterId! })).total).toBe(0);
  });

  it("keeps its filter and search when the sources change, and picks up new rows", async () => {
    const { c, info, tabA, tabB, b } = await setup();
    const { filterId } = await c.ok("setFilter", { tabId: info.tabId, filter: { include: [{ pattern: "needle", isRegex: false, caseSensitive: true }] } });
    await waitFor(() => c.eventsOf(info.tabId).some((e) => e.type === "filter" && e.id === filterId && e.done), "filter done");
    expect((await c.ok("getRows", { tabId: info.tabId, first: 0, count: 10, filterId: filterId! })).total).toBe(3);

    appendFileSync(b, levelLine(9, "INFO", "b9 needle"));
    await waitFor(async () => (await c.ok("getRows", { tabId: info.tabId, first: 0, count: 10, filterId: filterId! })).total === 4, "new row filtered");

    await c.ok("openMerged", { tabId: info.tabId, sources: [{ tabId: tabB.tabId, label: "srv2", format: SPRING_BOOT }] });
    await waitFor(async () => {
      const r = await c.ok("getRows", { tabId: info.tabId, first: 0, count: 10, filterId: filterId! });
      return r.total === 2 && r.rows.every((x) => x.source === 0);
    }, "filter over the new sources");
    void tabA;
  });

  it("finds the row of a line of a source, and gives the line of a row", async () => {
    const { c, info, tabA, tabB } = await setup();
    // a: lines 0 a1, 1 a3, 2 frame, 3 a5   b: lines 0 b2, 1 b4
    expect(await c.ok("mergedLocate", { tabId: info.tabId, sourceTabId: tabA.tabId, line: 3 })).toEqual({ row: 5 });
    expect(await c.ok("mergedLocate", { tabId: info.tabId, sourceTabId: tabB.tabId, line: 1 })).toEqual({ row: 4 });
    expect(await c.ok("mergedLocate", { tabId: info.tabId, sourceTabId: tabB.tabId, line: 9 })).toEqual({ row: null });
    const rows = (await c.ok("getRows", { tabId: info.tabId, first: 2, count: 3 })).rows;
    expect(rows.map((r) => [r.source, r.sourceLine])).toEqual([[0, 1], [0, 2], [1, 1]]);
  });
});
