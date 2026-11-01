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
