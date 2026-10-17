import { appendFileSync, copyFileSync, existsSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { TailEvent } from "@cbl-log/shared";
import { afterEach, describe, expect, it } from "vitest";
import { BlockCache, PollScheduler, Tailer, type TailerOptions } from "../src/index";
import { useTempDir, waitFor } from "./helpers";

const tempDir = useTempDir();
const cleanups: (() => Promise<void> | void)[] = [];
afterEach(async () => {
  for (const c of cleanups.splice(0)) await c();
});

const lines = (from: number, to: number, tag = "L"): string =>
  Array.from({ length: to - from }, (_, i) => `${tag}${from + i} ${"x".repeat(40)}\n`).join("");
const ids = (from: number, to: number): string[] => Array.from({ length: to - from }, (_, i) => `L${from + i}`);
const texts = async (t: Tailer): Promise<string[]> => (await t.getLines(0, t.totalRows)).map((l) => l.text.split(" ")[0]!);

/** Hand-driven tailer: no automatic tick, no watch; each `check()` is one tick. */
async function manual(path: string, extra: Partial<TailerOptions> = {}) {
  const scheduler = new PollScheduler();
  const tailer = new Tailer({ path, scheduler, pollIntervalMs: 3_600_000, watch: false, cache: new BlockCache(), ...extra });
  const events: TailEvent[] = [];
  tailer.on((e) => events.push(e));
  cleanups.push(async () => {
    await tailer.stop();
    scheduler.close();
  });
  await tailer.start();
  return { tailer, events };
}

describe("Tailer", () => {
  it("indexes on open then follows appends (real polling + watch)", async () => {
    const path = join(await tempDir(), "app.log");
    writeFileSync(path, lines(0, 10));
    const scheduler = new PollScheduler();
    const tailer = new Tailer({ path, scheduler, pollIntervalMs: 20 });
    const events: TailEvent[] = [];
    tailer.on((e) => events.push(e));
    cleanups.push(async () => {
      await tailer.stop();
      scheduler.close();
    });
    await tailer.start();
    expect(tailer.totalRows).toBe(10);
    expect(events[0]).toEqual({ type: "state", state: "following" });

    for (let i = 0; i < 20; i++) appendFileSync(path, lines(10 + i * 5, 15 + i * 5));
    await waitFor(() => tailer.totalRows === 110, "110 lines");
    await waitFor(() => events.some((e) => e.type === "rows" && e.total === 110), "final rows event");
    const appended = events.reduce((n, e) => n + (e.type === "rows" ? e.appended : 0), 0);
    expect(appended).toBe(110);
    expect((await texts(tailer)).slice(-2)).toEqual(["L108", "L109"]);
    expect(tailer.segments).toHaveLength(1);
  });

  it("coalesces rows: at most one event per ~50 ms", async () => {
    const path = join(await tempDir(), "app.log");
    writeFileSync(path, "");
    const scheduler = new PollScheduler();
    const tailer = new Tailer({ path, scheduler, pollIntervalMs: 5, watch: false });
    const stamps: number[] = [];
    tailer.on((e) => e.type === "rows" && stamps.push(Date.now()));
    cleanups.push(async () => {
      await tailer.stop();
      scheduler.close();
    });
    await tailer.start();
    const end = Date.now() + 400;
    let n = 0;
    while (Date.now() < end) {
      appendFileSync(path, lines(n, n + 1));
      n++;
      await new Promise((r) => setTimeout(r, 3));
    }
    await waitFor(() => tailer.totalRows === n, "all the lines");
    // the last coalesced event fires up to ~50 ms after the rows were counted
    await waitFor(() => stamps.length >= 1, "a rows event");
    await new Promise((r) => setTimeout(r, 120));
    // far fewer events than the ~130 appends (the bound that matters); a starved process may even deliver a single batch
    expect(stamps.length).toBeGreaterThanOrEqual(1);
    expect(stamps.length).toBeLessThanOrEqual(400 / 50 + 4);
    for (let i = 1; i < stamps.length; i++) expect(stamps[i]! - stamps[i - 1]!).toBeGreaterThanOrEqual(40);
  });

  it("missing file: Missing, then resumes when it appears", async () => {
    const path = join(await tempDir(), "later.log");
    const { tailer, events } = await manual(path);
    expect(tailer.phase).toBe("missing");
    expect(events).toEqual([{ type: "state", state: "missing" }]);
    writeFileSync(path, lines(0, 3));
    await tailer.check();
    expect(tailer.phase).toBe("following");
    expect(await texts(tailer)).toEqual(ids(0, 3));
    // first file = initial segment, not a rolling
    expect(events.some((e) => e.type === "rolled")).toBe(false);
    expect(tailer.segments[0]).toMatchObject({ startedBy: "initial", startRow: 0, rowCount: 3 });
  });

  it("rename + create: the old file is drained up to EOF before the switch (T-04b)", async () => {
    const dir = await tempDir();
    const path = join(dir, "SystemOut.log");
    writeFileSync(path, lines(0, 5));
    const { tailer, events } = await manual(path);
    appendFileSync(path, lines(5, 8)); // never seen by a tick
    renameSync(path, join(dir, "SystemOut_26.10.14.log"));
    writeFileSync(path, lines(8, 12));
    await tailer.check();
    expect(await texts(tailer)).toEqual(ids(0, 12));
    const rolled = events.find((e) => e.type === "rolled");
    expect(rolled).toEqual({ type: "rolled", reason: "rename", previous: join(dir, "SystemOut_26.10.14.log"), at: 8 });
    expect(tailer.segments.map((s) => [s.startRow, s.rowCount, s.readable])).toEqual([
      [0, 8, true],
      [8, 4, true],
    ]);
  });

  it("rename observed while the path has no file (Missing): drain then resume, reason rename", async () => {
    const dir = await tempDir();
    const path = join(dir, "a.log");
    writeFileSync(path, lines(0, 4));
    const { tailer, events } = await manual(path);
    appendFileSync(path, lines(4, 6));
    renameSync(path, join(dir, "a.1.log"));
    await tailer.check();
    expect(tailer.phase).toBe("missing");
    expect(tailer.totalRows).toBe(6); // drained while Missing
    writeFileSync(path, lines(6, 9));
    await tailer.check();
    expect(await texts(tailer)).toEqual(ids(0, 9));
    expect(events.find((e) => e.type === "rolled")).toMatchObject({ reason: "rename", previous: join(dir, "a.1.log"), at: 6 });
  });

  it("deletion + recreation (T-05): new-file", async () => {
    const dir = await tempDir();
    const path = join(dir, "a.log");
    writeFileSync(path, lines(0, 4));
    const { tailer, events } = await manual(path);
    rmSync(path);
    await tailer.check();
    expect(tailer.phase).toBe("missing");
    writeFileSync(path, lines(4, 7));
    await tailer.check();
    expect(await texts(tailer)).toEqual(ids(0, 7));
    expect(events.find((e) => e.type === "rolled")).toMatchObject({ reason: "new-file", at: 4 });
  });

  it("plain truncate: reset, previous segment unreadable, rows never decrease", async () => {
    const dir = await tempDir();
    const path = join(dir, "a.log");
    writeFileSync(path, lines(0, 200));
    const { tailer, events } = await manual(path);
    writeFileSync(path, ""); // emptied, no archive
    await tailer.check();
    expect(events.find((e) => e.type === "rolled")).toEqual({ type: "rolled", reason: "truncate", at: 200 });
    expect(tailer.totalRows).toBe(200);
    appendFileSync(path, lines(0, 3, "N"));
    await tailer.check();
    expect(tailer.totalRows).toBe(203);
    expect(tailer.segments.map((s) => s.readable)).toEqual([false, true]);
    expect((await tailer.getLines(0, 203)).map((l) => [l.lineNo, l.text.split(" ")[0]])).toEqual([
      [200, "N0"],
      [201, "N1"],
      [202, "N2"],
    ]);
  });

  it("truncate that regrows beyond the old size between two ticks: detected by the anchor (criterion 3b)", async () => {
    const dir = await tempDir();
    const path = join(dir, "a.log");
    writeFileSync(path, lines(0, 100, "OLD"));
    const { tailer, events } = await manual(path);
    // same file (same inode), different content and BIGGER than the old one
    writeFileSync(path, lines(0, 300, "NEW"));
    await tailer.check();
    expect(events.find((e) => e.type === "rolled")).toMatchObject({ reason: "truncate", at: 100 });
    expect(tailer.segments.map((s) => [s.readable, s.rowCount])).toEqual([
      [false, 100],
      [true, 300],
    ]);
    expect((await tailer.getLines(100, 3)).map((l) => l.text.split(" ")[0])).toEqual(["NEW0", "NEW1", "NEW2"]);
  });

  it("copytruncate: lines written before the truncation are recovered from the archive", async () => {
    const dir = await tempDir();
    const path = join(dir, "app.log");
    writeFileSync(path, lines(0, 150));
    const { tailer, events } = await manual(path);
    appendFileSync(path, lines(150, 170)); // never read
    copyFileSync(path, join(dir, "app.log.1"));
    writeFileSync(path, lines(170, 175)); // truncate + new lines
    await tailer.check();
    await waitFor(() => events.some((e) => e.type === "rows" && e.total === 175), "rows of the new segment (coalesced)");
    const order = events.filter((e) => e.type === "rows" || e.type === "rolled").map((e) => e.type);
    expect(order.slice(-3)).toEqual(["rows", "rolled", "rows"]); // recovered BEFORE the separator
    expect(events.find((e) => e.type === "rolled")).toEqual({
      type: "rolled",
      reason: "truncate",
      previous: join(dir, "app.log.1"),
      at: 170,
    });
    expect(await texts(tailer)).toEqual(ids(0, 175));
    expect(tailer.segments.map((s) => [s.startRow, s.rowCount, s.readable])).toEqual([
      [0, 170, true],
      [170, 5, true],
    ]);
  });

  it("copytruncate: an archive inconsistent with the anchor is not used", async () => {
    const dir = await tempDir();
    const path = join(dir, "app.log");
    writeFileSync(path, lines(0, 150));
    const { tailer } = await manual(path);
    writeFileSync(join(dir, "autre.log"), lines(0, 400, "ZZZ")); // big enough, wrong content
    writeFileSync(path, lines(0, 2, "N"));
    await tailer.check();
    expect(tailer.segments.map((s) => s.readable)).toEqual([false, true]);
    expect(tailer.totalRows).toBe(152);
  });

  it("dated name (resolvePath): switches to the newest file after draining, reason new-file", async () => {
    const dir = await tempDir();
    const a = join(dir, "app20261014.log");
    const b = join(dir, "app20261015.log");
    writeFileSync(a, lines(0, 3));
    const { tailer, events } = await manual(a, { resolvePath: () => (existsSync(b) ? b : a) });
    appendFileSync(a, lines(3, 5));
    writeFileSync(b, lines(5, 8));
    await tailer.check();
    expect(await texts(tailer)).toEqual(ids(0, 8));
    expect(events.find((e) => e.type === "rolled")).toEqual({ type: "rolled", reason: "new-file", previous: a, at: 5 });
  });

  it("releases segments beyond maxRetainedSegments (rows stay counted)", async () => {
    const dir = await tempDir();
    const path = join(dir, "a.log");
    writeFileSync(path, lines(0, 2));
    const { tailer } = await manual(path, { maxRetainedSegments: 1 });
    for (let k = 1; k <= 3; k++) {
      renameSync(path, join(dir, `a.${k}.log`));
      writeFileSync(path, lines(k * 2, k * 2 + 2));
      await tailer.check();
    }
    expect(tailer.totalRows).toBe(8);
    expect(tailer.segments.map((s) => s.readable)).toEqual([false, false, true, true]);
    expect((await tailer.getLines(0, 8)).map((l) => l.lineNo)).toEqual([4, 5, 6, 7]);
  });

  it("last line without terminator: counted, then completed without duplicate", async () => {
    const path = join(await tempDir(), "a.log");
    writeFileSync(path, "abc\ndef");
    const { tailer } = await manual(path);
    expect(tailer.totalRows).toBe(2);
    expect(tailer.isLastLineOpen).toBe(true);
    appendFileSync(path, "ghi\njkl\n");
    await tailer.check();
    expect(tailer.isLastLineOpen).toBe(false);
    expect((await tailer.getLines(0, 10)).map((l) => l.text)).toEqual(["abc", "defghi", "jkl"]);
  });
});
