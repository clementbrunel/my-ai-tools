import { appendFileSync, utimesSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { MessageChannel } from "node:worker_threads";
import type { EngineEvent, EngineMessage, EngineRequestMap, EngineResponse, TabInfo } from "@cbl-log/shared";
import { afterEach, describe, expect, it } from "vitest";
import { EngineService, type EngineServiceOptions } from "../src/index";
import { useTempDir, waitFor } from "./helpers";

const tempDir = useTempDir();
const cleanups: (() => Promise<void> | void)[] = [];
afterEach(async () => {
  for (const c of cleanups.splice(0)) await c();
});

const lines = (from: number, to: number): string =>
  Array.from({ length: to - from }, (_, i) => `line ${from + i}\n`).join("");

/** Service + a node MessageChannel client speaking the raw protocol. */
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

  function call<K extends keyof EngineRequestMap>(op: K, params: EngineRequestMap[K]["params"]): Promise<EngineResponse> {
    const id = nextId++;
    return new Promise((resolve) => {
      pending.set(id, resolve);
      port2.postMessage({ kind: "request", id, op, params });
    });
  }
  async function ok<K extends keyof EngineRequestMap>(op: K, params: EngineRequestMap[K]["params"]): Promise<EngineRequestMap[K]["result"]> {
    const res = await call(op, params);
    if (!res.ok) throw new Error(`${res.error.code}: ${res.error.message}`);
    return res.result as EngineRequestMap[K]["result"];
  }
  return { call, ok, events, service, port2 };
}

describe("EngineService", () => {
  it("historyHours: the recent archives of the directory come before the file, older ones are counted", async () => {
    const dir = await tempDir();
    const now = Date.now() / 1000;
    const archive = (name: string, from: number, to: number, hoursAgo: number): string => {
      const p = join(dir, name);
      writeFileSync(p, lines(from, to));
      utimesSync(p, now - hoursAgo * 3600, now - hoursAgo * 3600);
      return p;
    };
    archive("SystemOut_26.10.21_06.00.00.log", 0, 50, 3);
    const a1 = archive("SystemOut_26.10.21_08.00.00.log", 100, 110, 1.5);
    const a2 = archive("SystemOut_26.10.21_09.00.00.log", 110, 115, 0.5);
    const path = join(dir, "SystemOut.log");
    writeFileSync(path, lines(115, 120));
    const { ok } = connect();
    const info = await ok("open", { path, historyHours: 2 });
    expect(info.totalRows).toBe(20);
    expect(info.history?.skipped).toBe(1);
    expect(info.history?.hours).toBe(2);
    expect(info.history?.files.map((f) => [f.path, f.startRow, f.rowCount])).toEqual([
      [a1, 0, 10],
      [a2, 10, 5],
    ]);
    expect(info.history?.files[0]!.mtimeMs).toBeGreaterThan(0);
    const { rows } = await ok("getRows", { tabId: info.tabId, first: 0, count: 20 });
    expect(rows.map((r) => r.text)).toEqual(lines(100, 120).trimEnd().split("\n"));

    const alone = await ok("open", { path: join(dir, "SystemOut_26.10.21_06.00.00.log") });
    expect(alone.history).toBeUndefined();
  });

  it("open returns consistent TabInfo", async () => {
    const dir = await tempDir();
    const path = join(dir, "a.log");
    writeFileSync(path, lines(0, 10));
    const { ok } = connect();
    const info: TabInfo = await ok("open", { path });
    expect(info.path).toBe(path);
    expect(info.encoding).toBe("utf-8");
    expect(info.totalRows).toBe(10);
    expect(info.sizeBytes).toBe(lines(0, 10).length);
    expect(info.lineEnding).toBe("unknown");
    expect(info.tabId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("getRows returns start, middle and end ranges and clamps", async () => {
    const dir = await tempDir();
    const path = join(dir, "a.log");
    writeFileSync(path, lines(0, 100));
    const { ok } = connect();
    const { tabId } = await ok("open", { path });

    const head = await ok("getRows", { tabId, first: 0, count: 3 });
    expect(head.rows.map((r) => r.text)).toEqual(["line 0", "line 1", "line 2"]);
    expect(head.rows[0]?.lineNo).toBe(0);
    expect(head.total).toBe(100);

    const mid = await ok("getRows", { tabId, first: 50, count: 2 });
    expect(mid.rows.map((r) => r.lineNo)).toEqual([50, 51]);

    const tail = await ok("getRows", { tabId, first: 98, count: 50 });
    expect(tail.rows.map((r) => r.text)).toEqual(["line 98", "line 99"]);

    const beyond = await ok("getRows", { tabId, first: 500, count: 10 });
    expect(beyond.rows).toEqual([]);

    const negative = await ok("getRows", { tabId, first: -5, count: 2 });
    expect(negative.first).toBe(0);
    expect(negative.rows).toHaveLength(2);
  });

  it("caps one request at MAX_ROWS_PER_REQUEST rows", async () => {
    const dir = await tempDir();
    const path = join(dir, "big.log");
    writeFileSync(path, lines(0, 3000));
    const { ok } = connect();
    const { tabId } = await ok("open", { path });
    const res = await ok("getRows", { tabId, first: 0, count: 100_000 });
    expect(res.rows).toHaveLength(2000);
  });

  it("emits rows events when the file grows, then serves the new lines", async () => {
    const dir = await tempDir();
    const path = join(dir, "a.log");
    writeFileSync(path, lines(0, 5));
    const { ok, events } = connect();
    const { tabId } = await ok("open", { path });
    appendFileSync(path, lines(5, 8));
    await waitFor(() => events.some((e) => e.tabId === tabId && e.event.type === "rows" && e.event.total === 8), "rows event");
    const res = await ok("getRows", { tabId, first: 5, count: 10 });
    expect(res.rows.map((r) => r.text)).toEqual(["line 5", "line 6", "line 7"]);
  });

  it("close forgets the tab", async () => {
    const dir = await tempDir();
    const path = join(dir, "a.log");
    writeFileSync(path, lines(0, 5));
    const { ok, call } = connect();
    const { tabId } = await ok("open", { path });
    await ok("close", { tabId });
    const res = await call("getRows", { tabId, first: 0, count: 1 });
    expect(res.ok).toBe(false);
  });

  it("reports ENOENT for a missing file without creating a tab", async () => {
    const dir = await tempDir();
    const { call } = connect();
    const res = await call("open", { path: join(dir, "nope.log") });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("ENOENT");
  });

  it("reports EISDIR for a directory and BINARY for binary content", async () => {
    const dir = await tempDir();
    const bin = join(dir, "x.bin");
    writeFileSync(bin, Buffer.from([1, 2, 0, 0, 0, 5, 6, 0, 0, 9, 9, 9]));
    const { call } = connect();
    const dirRes = await call("open", { path: dir });
    expect(dirRes.ok === false && dirRes.error.code).toBe("EISDIR");
    const binRes = await call("open", { path: bin });
    expect(binRes.ok === false && binRes.error.code).toBe("BINARY");
  });

  it("answers unknown requests with an error instead of crashing", async () => {
    const { port2 } = connect();
    const reply = await new Promise<EngineMessage>((resolve) => {
      port2.once("message", resolve);
      port2.postMessage({ kind: "request", id: 99, op: "frobnicate", params: {} });
    });
    expect(reply).toMatchObject({ kind: "response", id: 99, ok: false });
  });

  it("indexes files above the threshold in a worker and emits indexing events", async () => {
    const dir = await tempDir();
    const path = join(dir, "big.log");
    writeFileSync(path, lines(0, 500));
    const { ok, events } = connect({ indexWithWorkerAboveBytes: 1024 });
    const info = await ok("open", { path });
    expect(info.totalRows).toBe(500);
    const indexing = events.filter((e) => e.event.type === "indexing");
    expect(indexing.length).toBeGreaterThan(0);
    const res = await ok("getRows", { tabId: info.tabId, first: 499, count: 1 });
    expect(res.rows[0]?.text).toBe("line 499");
  });

  it("pushes the indexing events under the caller's open id while the file is opening", async () => {
    const dir = await tempDir();
    const path = join(dir, "big.log");
    writeFileSync(path, lines(0, 500));
    const { ok, events } = connect({ indexWithWorkerAboveBytes: 1024 });
    const info = await ok("open", { path, openId: "open-1" });
    const indexing = events.filter((e) => e.event.type === "indexing");
    expect(indexing.length).toBeGreaterThan(0);
    expect(indexing.every((e) => e.tabId === "open-1")).toBe(true);
    expect(info.tabId).not.toBe("open-1");
  });
});
