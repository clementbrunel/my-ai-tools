import { appendFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { MessageChannel } from "node:worker_threads";
import {
  FilterEvaluator,
  SPRING_BOOT,
  compileFormat,
  type EngineEvent,
  type EngineMessage,
  type EngineRequestMap,
  type EngineResponse,
  type Level,
  type LineFilter,
  type Row,
  type TabEvent,
} from "@cbl-log/shared";
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
  const filterEvents = (tabId: string): Extract<TabEvent, { type: "filter" }>[] =>
    events.flatMap((e) => (e.tabId === tabId && e.event.type === "filter" ? [e.event] : []));
  return { call, ok, events, filterEvents };
}

const LEVELS_CYCLE = ["INFO", "WARN", "ERROR", "DEBUG", "INFO"] as const;

/** Record i is a Spring Boot line; ERROR records are followed by a stack trace. A banner opens the file. */
function makeLog(records: number): string[] {
  const lines = ["=== environment banner ==="];
  for (let i = 0; i < records; i++) {
    const level = LEVELS_CYCLE[i % LEVELS_CYCLE.length]!;
    lines.push(`2026-10-14 10:02:11.204 ${level.padStart(5)} 123 --- [main] com.example.${i % 7 === 0 ? "Cart" : "Order"} : record ${i}`);
    if (level === "ERROR") {
      lines.push("java.lang.IllegalStateException: boom " + i, "\tat com.example.Cart.add(Cart.java:42)", "\tat com.example.Order.run(Order.java:7)");
    }
  }
  return lines;
}

/** What the filter must retain, computed in-process line by line (no slicing, no warm-up). */
function expected(lines: string[], filter: LineFilter): { line: number; level: Level | undefined }[] {
  const evaluator = new FilterEvaluator(filter, compileFormat(SPRING_BOOT));
  const out: { line: number; level: Level | undefined }[] = [];
  lines.forEach((text, line) => {
    const v = evaluator.test(text);
    if (v.keep) out.push({ line, level: v.level });
  });
  return out;
}

async function open(lines: string[], options?: EngineServiceOptions) {
  const dir = await tempDir();
  const path = join(dir, "a.log");
  writeFileSync(path, lines.join("\n") + "\n");
  // small slices: many slice boundaries inside the file, so that the warm-up matters
  const c = connect({ filter: { sliceBytes: 1500, maxWorkers: 3, stallMs: 3000, ...options?.filter }, ...options });
  const info = await c.ok("open", { path });
  return { ...c, tabId: info.tabId, path, dir };
}
type Ctx = Awaited<ReturnType<typeof open>>;

async function setFilter(ctx: Ctx, filter: LineFilter | null) {
  const { filterId } = await ctx.ok("setFilter", { tabId: ctx.tabId, filter, format: SPRING_BOOT });
  if (filterId) await waitFor(() => ctx.filterEvents(ctx.tabId).some((e) => e.id === filterId && e.done), "filter done");
  return filterId;
}

async function readAll(ctx: Ctx, filterId: string): Promise<Row[]> {
  const rows: Row[] = [];
  for (;;) {
    const page = await ctx.ok("getRows", { tabId: ctx.tabId, first: rows.length, count: 500, filterId });
    if (page.rows.length === 0) return rows;
    rows.push(...page.rows);
  }
}

const summary = (rows: Row[]) => rows.map((r) => ({ line: r.lineNo, level: r.level }));

describe("FilterEvaluator", () => {
  const format = compileFormat(SPRING_BOOT);
  const head = (level: string, msg = "m") => `2026-10-14 10:02:11.204 ${level.padStart(5)} 1 --- [main] com.example.Cart : ${msg}`;

  it("keeps the levels asked for, continuation lines following their record", () => {
    const f = new FilterEvaluator({ levels: ["error"] }, format);
    expect(f.test(head("INFO")).keep).toBe(false);
    expect(f.test(head("ERROR")).keep).toBe(true);
    expect(f.test("\tat com.example.Cart.add(Cart.java:42)")).toEqual({ keep: true, level: "error", folded: false });
    expect(f.test(head("WARN")).keep).toBe(false);
    expect(f.test("\tat com.example.Other(Other.java:1)").keep).toBe(false);
  });

  it("hides the lines without a level as soon as levels are restricted", () => {
    const f = new FilterEvaluator({ levels: ["error", "warn", "info", "debug", "trace", "fatal"] }, format);
    expect(f.test("=== banner ===").keep).toBe(false);
    expect(new FilterEvaluator({ include: [{ pattern: "banner", isRegex: false, caseSensitive: true }] }, format).test("=== banner ===").keep).toBe(true);
  });

  it("combines include (OR) and exclude (OR) with the level", () => {
    const txt = (pattern: string, extra: object = {}) => ({ pattern, isRegex: false, caseSensitive: false, ...extra });
    const f = new FilterEvaluator({ levels: ["error", "warn"], include: [txt("cart"), txt("^.*order 9$", { isRegex: true })], exclude: [txt("ignore me")] }, format);
    expect(f.test(head("WARN", "Cart updated")).keep).toBe(true);
    expect(f.test(head("WARN", "something else")).keep).toBe(true); // "Cart" is the logger of every line here
    expect(f.test(head("WARN", "Cart: ignore me")).keep).toBe(false);
    expect(f.test(head("INFO", "Cart updated")).keep).toBe(false);
  });

  it("rejects an invalid regular expression", () => {
    expect(() => new FilterEvaluator({ include: [{ pattern: "(", isRegex: true, caseSensitive: true }] }, format)).toThrow();
  });
});

describe("setFilter", () => {
  it("returns the retained lines with the numbers and levels of the file, across slice boundaries", async () => {
    const lines = makeLog(400);
    const ctx = await open(lines);
    for (const filter of [
      { levels: ["error"] },
      { levels: ["warn", "debug"] },
      { levels: ["info", "error"], exclude: [{ pattern: "record 1", isRegex: false, caseSensitive: true }] },
      { include: [{ pattern: "Cart", isRegex: false, caseSensitive: true }] },
    ] satisfies LineFilter[]) {
      const id = await setFilter(ctx, filter);
      expect(id).not.toBeNull();
      const rows = await readAll(ctx, id!);
      const want = expected(lines, filter);
      expect(summary(rows)).toEqual(want);
      expect(rows.map((r) => r.text)).toEqual(want.map((w) => lines[w.line]));
      expect(ctx.filterEvents(ctx.tabId).filter((e) => e.id === id).at(-1)).toMatchObject({ done: true, matches: want.length });
    }
  });

  it("reads a window of the filtered view", async () => {
    const lines = makeLog(300);
    const ctx = await open(lines);
    const id = (await setFilter(ctx, { levels: ["error"] }))!;
    const want = expected(lines, { levels: ["error"] });
    const page = await ctx.ok("getRows", { tabId: ctx.tabId, first: 7, count: 11, filterId: id });
    expect(page.total).toBe(want.length);
    expect(page.rows.map((r) => r.lineNo)).toEqual(want.slice(7, 18).map((w) => w.line));
    expect((await ctx.ok("getRows", { tabId: ctx.tabId, first: want.length, count: 5, filterId: id })).rows).toEqual([]);
  });

  it("removes the filter with null or a filter that hides nothing", async () => {
    const ctx = await open(makeLog(20));
    expect(await setFilter(ctx, { levels: ["info"] })).not.toBeNull();
    expect(await setFilter(ctx, null)).toBeNull();
    expect(await setFilter(ctx, {})).toBeNull();
  });

  it("answers nothing for a filter that was replaced", async () => {
    const ctx = await open(makeLog(50));
    const first = (await setFilter(ctx, { levels: ["error"] }))!;
    await setFilter(ctx, { levels: ["warn"] });
    expect((await ctx.ok("getRows", { tabId: ctx.tabId, first: 0, count: 10, filterId: first })).rows).toEqual([]);
  });

  it("reports a bad regular expression and a level filter without a format", async () => {
    const ctx = await open(makeLog(5));
    const bad = await ctx.call("setFilter", { tabId: ctx.tabId, filter: { include: [{ pattern: "(", isRegex: true, caseSensitive: true }] } });
    expect(bad.ok).toBe(false);
    const noFormat = await ctx.call("setFilter", { tabId: ctx.tabId, filter: { levels: ["error"] }, format: null });
    expect(noFormat.ok).toBe(false);
  });

  it("applies to the lines written afterwards (real time)", async () => {
    const lines = makeLog(120);
    const ctx = await open(lines);
    const id = (await setFilter(ctx, { levels: ["error"] }))!;
    const before = (await readAll(ctx, id)).length;

    const more = makeLog(200).slice(1); // no second banner
    appendFileSync(ctx.path, more.join("\n") + "\n");
    const all = [...lines, ...more];
    const want = expected(all, { levels: ["error"] });
    await waitFor(async () => (await readAll(ctx, id)).length === want.length, "appended lines filtered", 20_000, 50);
    expect(before).toBeLessThan(want.length);
    expect(summary(await readAll(ctx, id))).toEqual(want);
  });

  it("starts over on the new file after a rolling", async () => {
    const lines = makeLog(100);
    const ctx = await open(lines);
    const id = (await setFilter(ctx, { levels: ["error"] }))!;
    expect((await readAll(ctx, id)).length).toBeGreaterThan(0);

    renameSync(ctx.path, join(ctx.dir, "a.1.log"));
    const fresh = makeLog(30);
    writeFileSync(ctx.path, fresh.join("\n") + "\n");
    const want = expected(fresh, { levels: ["error"] });
    const startRow = lines.length;
    await waitFor(async () => (await readAll(ctx, id)).length === want.length && want.length > 0, "filter restarted after rolling", 20_000, 50);
    // line numbers stay global: the new file starts after the previous one
    expect((await readAll(ctx, id)).map((r) => r.lineNo)).toEqual(want.map((w) => startRow + w.line));
  });
});

describe("filterLocate", () => {
  it("tells where a line falls in the filtered view, exact or not", async () => {
    const lines = makeLog(300);
    const ctx = await open(lines);
    const filter: LineFilter = { levels: ["error"] };
    const id = (await setFilter(ctx, filter))!;
    const want = expected(lines, filter).map((w) => w.line);
    const locate = (row: number) => ctx.ok("filterLocate", { tabId: ctx.tabId, filterId: id, row });

    for (const rank of [0, 1, 5, want.length - 1]) {
      expect(await locate(want[rank]!)).toEqual({ position: rank, exact: true, covered: true });
    }
    // a line that is not retained: the position of the next retained one
    const between = want[3]! + 1;
    expect(want).not.toContain(between);
    expect(await locate(between)).toEqual({ position: 4, exact: false, covered: true });
    expect(await locate(0)).toMatchObject({ position: 0, exact: want[0] === 0 });
    // past the last retained line: after all of them
    expect(await locate(lines.length + 50)).toEqual({ position: want.length, exact: false, covered: true });
  });

  it("answers for the current file only after a rolling (numbers stay global)", async () => {
    const ctx = await open(makeLog(60));
    const id = (await setFilter(ctx, { levels: ["error"] }))!;
    const startRow = makeLog(60).length;
    renameSync(ctx.path, join(ctx.dir, "a.1.log"));
    const fresh = makeLog(40);
    writeFileSync(ctx.path, fresh.join("\n") + "\n");
    const want = expected(fresh, { levels: ["error"] }).map((w) => w.line);
    await waitFor(async () => (await readAll(ctx, id)).length === want.length && want.length > 0, "filter restarted", 20_000, 50);
    expect(await ctx.ok("filterLocate", { tabId: ctx.tabId, filterId: id, row: 3 })).toMatchObject({ position: 0 });
    expect(await ctx.ok("filterLocate", { tabId: ctx.tabId, filterId: id, row: startRow + want[2]! })).toEqual({ position: 2, exact: true, covered: true });
  });

  it("knows nothing of a replaced filter", async () => {
    const ctx = await open(makeLog(30));
    const old = (await setFilter(ctx, { levels: ["error"] }))!;
    await setFilter(ctx, { levels: ["warn"] });
    expect(await ctx.ok("filterLocate", { tabId: ctx.tabId, filterId: old, row: 10 })).toEqual({ position: 0, exact: false, covered: true });
  });
});

describe("folding of continuation lines", () => {
  const isHead = (text: string): boolean => /^\d{4}-\d{2}-\d{2} /.test(text);
  /** Heads kept (the banner before the first head stays), with the lines that continue each. */
  const expectedFolds = (lines: string[], keepHead: (text: string) => boolean = () => true) => {
    const out: { line: number; folded: number }[] = [];
    let current: { line: number; folded: number } | undefined;
    lines.forEach((text, line) => {
      if (isHead(text)) {
        current = keepHead(text) ? { line, folded: 0 } : undefined;
        if (current) out.push(current);
      } else if (line > 0 && current) {
        current.folded++;
      } else if (line === 0) {
        out.push({ line, folded: 0 }); // the banner: no record above it
      }
    });
    return out;
  };

  it("keeps the record heads with the number of lines folded under each, across slice boundaries", async () => {
    const lines = makeLog(400);
    const ctx = await open(lines);
    const id = (await setFilter(ctx, { foldContinuation: true }))!;
    const rows = await readAll(ctx, id);
    const want = expectedFolds(lines);
    expect(rows.map((r) => ({ line: r.lineNo, folded: r.folded ?? 0 }))).toEqual(want);
    expect(rows.some((r) => (r.folded ?? 0) === 3)).toBe(true);
    expect(rows.map((r) => r.text)).toEqual(want.map((w) => lines[w.line]));
  });

  it("combines with the levels: only the heads of the chosen levels", async () => {
    const lines = makeLog(300);
    const ctx = await open(lines);
    const id = (await setFilter(ctx, { levels: ["error"], foldContinuation: true }))!;
    const rows = await readAll(ctx, id);
    const want = expectedFolds(lines, (t) => t.includes(" ERROR ")).filter((w) => w.line !== 0);
    expect(rows.map((r) => ({ line: r.lineNo, folded: r.folded ?? 0 }))).toEqual(want);
    expect(rows.every((r) => r.level === "error")).toBe(true);
  });

  it("does nothing without a format that has continuation lines", async () => {
    const lines = makeLog(40);
    const ctx = await open(lines);
    const { filterId } = await ctx.ok("setFilter", { tabId: ctx.tabId, filter: { foldContinuation: true }, format: null });
    await waitFor(() => ctx.filterEvents(ctx.tabId).some((e) => e.id === filterId && e.done), "filter done");
    expect((await readAll(ctx, filterId!)).length).toBe(lines.length);
  });

  it("counts a record that was still being written when the file was scanned, once it is complete", async () => {
    const head = (i: number) => `2026-10-14 10:02:11.204 ERROR 123 --- [main] com.example.Cart : record ${i}`;
    const ctx = await open([head(1), "\tat a.b.C(C.java:1)", head(2), "\tat a.b.C(C.java:2)"]);
    const id = (await setFilter(ctx, { foldContinuation: true }))!;
    expect(summary(await readAll(ctx, id))).toEqual([{ line: 0, level: "error" }, { line: 2, level: "error" }]);
    expect((await readAll(ctx, id)).map((r) => r.folded ?? 0)).toEqual([1, 1]);

    appendFileSync(ctx.path, ["\tat a.b.C(C.java:3)", "\tat a.b.C(C.java:4)", head(3)].join("\n") + "\n");
    await waitFor(async () => (await readAll(ctx, id)).length === 3, "third record");
    await waitFor(async () => (await readAll(ctx, id)).map((r) => r.folded ?? 0).join() === "1,3,0", "folded counts", 20_000, 50);
  });
});
