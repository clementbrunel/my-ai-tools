// Integration tests (architecture section 10, acceptance criteria 3, 3b, 4): a simulated writer in a
// SEPARATE process writes numbered lines and rolls the file; the tailer must neither lose nor duplicate lines.
import { type ChildProcess, fork } from "node:child_process";
import { copyFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { TailEvent } from "@cbl-log/shared";
import { afterEach, describe, expect, it } from "vitest";
import { BlockCache, PollScheduler, Tailer, type TailerOptions } from "../src/index";
import { useTempDir, waitFor } from "./helpers";

const WRITER = fileURLToPath(new URL("./fixtures/rolling-writer.mjs", import.meta.url));
const TEST_TIMEOUT = 90_000;
const LINE_RE = /^(\d{8}) p{80}$/;

const tempDir = useTempDir();
const cleanups: (() => Promise<void> | void)[] = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
});

/** Reads every new row through the public tailer API, like the UI does, and keeps the sequence numbers. */
class Collector {
  readonly seen: number[] = [];
  garbled = 0;
  private next = 0;
  private busy: Promise<void> = Promise.resolve();

  constructor(private readonly tailer: Tailer) {}

  private hasReadableRows(from: number, to: number): boolean {
    return this.tailer.segments.some((seg) => seg.readable && seg.startRow < to && seg.startRow + seg.rowCount > from);
  }

  get last(): number {
    return this.seen.at(-1) ?? -1;
  }

  pump(): Promise<void> {
    this.busy = this.busy.then(async () => {
      // the last line may still be growing: leave it for the next pump
      const limit = this.tailer.totalRows - (this.tailer.isLastLineOpen ? 1 : 0);
      if (limit <= this.next) return;
      const lines = await this.tailer.getLines(this.next, limit - this.next);
      for (const line of lines) {
        // Rows of unreadable segments are gone for good, but a gap inside a readable segment means
        // getLines withheld rows transiently (file being truncated under load): stop there and
        // request them again on the next pump instead of skipping them.
        if (line.lineNo > this.next && this.hasReadableRows(this.next, line.lineNo)) return;
        const match = LINE_RE.exec(line.text);
        if (match) this.seen.push(Number(match[1]));
        else this.garbled++;
        this.next = line.lineNo + 1;
      }
      if (lines.length > 0) return;
      if (!this.tailer.segments.some((s) => s.readable && s.startRow + s.rowCount > this.next)) this.next = limit;
    });
    return this.busy;
  }
}

function expectStrictlyIncreasing(seen: number[]): void {
  for (let i = 1; i < seen.length; i++) {
    if (!(seen[i]! > seen[i - 1]!)) throw new Error(`Sequence not strictly increasing at index ${i}: ${seen[i - 1]} then ${seen[i]}`);
  }
}

interface Scenario {
  mode: "rename" | "truncate" | "copytruncate" | "dated" | "delete";
  /** The writer waits until the tailer has consumed everything before each roll (quiet-period rotation). */
  syncRoll?: boolean;
  rolls?: number;
  rollBytes?: number;
  /** Default 100: every rolled handle stays open. */
  maxRetainedSegments?: number;
}

async function runScenario(scenario: Scenario) {
  const dir = await tempDir();
  const rolls = scenario.rolls ?? 10;
  const config = { dir, mode: scenario.mode, rollBytes: scenario.rollBytes ?? 256 * 1024, rolls, syncRoll: !!scenario.syncRoll };
  const child: ChildProcess = fork(WRITER, [JSON.stringify(config)], { execArgv: [] });
  cleanups.push(() => void child.kill());
  const writerErrors: unknown[] = [];
  let done: { lastSeq: number; rolls: number } | undefined;
  let ready = false;
  let tailer: Tailer | undefined;
  let collector: Collector | undefined;
  const exited = new Promise<number | null>((resolve) => child.once("exit", resolve));

  child.on("message", (msg: { type: string; nextSeq?: number }) => {
    if (msg.type === "ready") ready = true;
    else if (msg.type === "error") writerErrors.push(msg);
    else if (msg.type === "done") done = msg as unknown as { lastSeq: number; rolls: number };
    else if (msg.type === "rolling") {
      // acknowledge once every line written so far has been collected
      void waitFor(async () => {
        await collector?.pump();
        return (collector?.last ?? -1) >= msg.nextSeq! - 1;
      }, `lines up to ${msg.nextSeq! - 1} collected before the roll`).then(() => child.send({ type: "go" }));
    }
  });
  await waitFor(() => ready, "writer ready");

  const first = join(dir, scenario.mode === "dated" ? "app-0.log" : "app.log");
  const resolvePath =
    scenario.mode === "dated"
      ? () => {
          const latest = readdirSync(dir)
            .map((name) => /^app-(\d+)\.log$/.exec(name))
            .filter((m): m is RegExpExecArray => !!m)
            .map((m) => Number(m[1]))
            .sort((a, b) => b - a)[0];
          return join(dir, `app-${latest ?? 0}.log`);
        }
      : undefined;
  const scheduler = new PollScheduler();
  tailer = new Tailer({
    path: first,
    scheduler,
    pollIntervalMs: 25,
    maxRetainedSegments: scenario.maxRetainedSegments ?? 100,
    cache: new BlockCache(),
    ...(resolvePath ? { resolvePath } : {}),
  });
  collector = new Collector(tailer);
  const events: TailEvent[] = [];
  tailer.on((e) => {
    events.push(e);
    if (e.type === "rows") void collector!.pump();
  });
  cleanups.push(async () => {
    await tailer!.stop();
    scheduler.close();
  });
  await tailer.start();

  await waitFor(() => done !== undefined, "writer done", 60_000);
  await waitFor(async () => {
    await collector!.pump();
    return collector!.last >= done!.lastSeq;
  }, `tailer caught up to line ${done?.lastSeq}`, 30_000);
  expect(await exited).toBe(0);

  expect(writerErrors).toEqual([]); // no rename/unlink/copy ever failed because of our open handles
  // An unsynchronized truncation can cut the line the tailer had only partly read: that stub is the
  // only legitimate garbled row, at most one per roll.
  const cutsLines = scenario.mode === "truncate" && !scenario.syncRoll;
  if (cutsLines) expect(collector.garbled).toBeLessThanOrEqual(rolls);
  else expect(collector.garbled).toBe(0);
  expectStrictlyIncreasing(collector.seen);
  const rolled = events.filter((e) => e.type === "rolled");
  return { tailer, collector, events, rolled, lastSeq: done!.lastSeq, dir };
}

function missingRanges(seen: number[], lastSeq: number): string[] {
  const out: string[] = [];
  let expected = 0;
  for (const n of seen) {
    if (n > expected) out.push(`${expected}-${n - 1}`);
    expected = n + 1;
  }
  if (expected <= lastSeq) out.push(`${expected}-${lastSeq}`);
  return out;
}

function expectLossless(r: Awaited<ReturnType<typeof runScenario>>): void {
  expect(missingRanges(r.collector.seen, r.lastSeq)).toEqual([]);
  expect(r.collector.seen).toHaveLength(r.lastSeq + 1);
  expect(r.collector.seen[0]).toBe(0);
  expect(r.collector.seen.at(-1)).toBe(r.lastSeq);
}

/** Re-reads the whole tab afterwards, like scrolling back to the top: every written line must be there. */
async function expectWholeHistoryReadable(r: Awaited<ReturnType<typeof runScenario>>): Promise<void> {
  const seq = (await r.tailer.getLines(0, r.tailer.totalRows)).map((l) => Number(LINE_RE.exec(l.text)?.[1]));
  expect(seq).toEqual(Array.from({ length: r.lastSeq + 1 }, (_, i) => i));
}

describe("rolling with a simulated writer process", () => {
  it("rename + create: 10 rolls, no line lost or duplicated, the writer's rename never fails", async () => {
    const r = await runScenario({ mode: "rename" });
    expectLossless(r);
    expect(r.rolled).toHaveLength(10);
    expect(new Set(r.rolled.map((e) => e.reason))).toEqual(new Set(["rename"]));
    expect(r.tailer.segments).toHaveLength(11);
    expect(r.tailer.totalRows).toBe(r.lastSeq + 1);
  }, TEST_TIMEOUT);

  for (const mode of ["rename", "copytruncate", "dated"] as const) {
    it(`${mode}: with the default handle limit, the whole history stays readable after 10 rolls`, async () => {
      const r = await runScenario({ mode, maxRetainedSegments: 3, ...(mode === "copytruncate" ? { syncRoll: true } : {}) });
      expectLossless(r);
      expect(r.tailer.segments.every((s) => s.readable)).toBe(true);
      await expectWholeHistoryReadable(r);
    }, TEST_TIMEOUT);
  }

  it("rename + create: rolled.previous points at the archive", async () => {
    const r = await runScenario({ mode: "rename", rolls: 3 });
    expectLossless(r);
    const previous = r.rolled.map((e) => (e.type === "rolled" ? e.previous : undefined));
    expect(previous.every((p) => p !== undefined && /app\.log\.\d+$/.test(p))).toBe(true);
  }, TEST_TIMEOUT);

  it("delete + recreate (T-05): no line lost or duplicated, the writer's unlink never fails", async () => {
    const r = await runScenario({ mode: "delete" });
    expectLossless(r);
    expect(r.rolled).toHaveLength(10);
    expect(new Set(r.rolled.map((e) => e.reason))).toEqual(new Set(["new-file"]));
  }, TEST_TIMEOUT);

  it("dated file names (F-09 groundwork): follows the newest file, no line lost or duplicated", async () => {
    const r = await runScenario({ mode: "dated" });
    expectLossless(r);
    expect(r.rolled).toHaveLength(10);
    expect(new Set(r.rolled.map((e) => e.reason))).toEqual(new Set(["new-file"]));
  }, TEST_TIMEOUT);

  it("copytruncate: lines written before each truncation are recovered from the archive", async () => {
    const r = await runScenario({ mode: "copytruncate" });
    expectLossless(r);
    expect(r.rolled).toHaveLength(10);
    expect(new Set(r.rolled.map((e) => e.reason))).toEqual(new Set(["truncate"]));
    expect(r.tailer.segments.every((s) => s.readable)).toBe(true);
  }, TEST_TIMEOUT);

  it("truncate in a quiet period (writer waits for the tailer): no line lost or duplicated", async () => {
    const r = await runScenario({ mode: "truncate", syncRoll: true });
    expectLossless(r);
    expect(r.rolled).toHaveLength(10);
  }, TEST_TIMEOUT);

  it("truncate while writing: never a duplicate, order preserved, loss bounded by the polling interval", async () => {
    const r = await runScenario({ mode: "truncate" });
    expect(r.rolled).toHaveLength(10);
    const lost = r.lastSeq + 1 - r.collector.seen.length;
    // the writer produces ~100 lines per 2 ms batch; 25 ms polling may lose a few batches per roll at most
    expect(lost).toBeGreaterThanOrEqual(0);
    expect(lost).toBeLessThan(10 * 5000);
    expect(r.collector.last).toBe(r.lastSeq);
  }, TEST_TIMEOUT);
});

describe("truncation detection without a writer process", () => {
  const rows = (from: number, to: number, tag: string): string =>
    Array.from({ length: to - from }, (_, i) => `${tag}${from + i} ${"x".repeat(60)}\n`).join("");

  async function manualTailer(path: string, extra: Partial<TailerOptions> = {}) {
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

  it("criterion 3b: a file truncated then regrown beyond its old size between two ticks is detected by the anchor", async () => {
    const path = join(await tempDir(), "app.log");
    writeFileSync(path, rows(0, 500, "OLD"));
    const { tailer, events } = await manualTailer(path);
    expect(tailer.totalRows).toBe(500);
    // Same inode, bigger than before, no tick in between: size alone cannot reveal the truncation.
    writeFileSync(path, rows(0, 800, "NEW"));
    await tailer.check();
    expect(events.find((e) => e.type === "rolled")).toMatchObject({ reason: "truncate", at: 500 });
    expect(tailer.totalRows).toBe(1300);
    expect((await tailer.getLines(500, 2)).map((l) => l.text.slice(0, 4))).toEqual(["NEW0", "NEW1"]);
    expect((await tailer.getLines(0, 1300)).every((l) => l.text.startsWith("NEW"))).toBe(true);
  });

  it("copytruncate recovery after regrowth: archive found, nothing lost, nothing duplicated", async () => {
    const dir = await tempDir();
    const path = join(dir, "app.log");
    writeFileSync(path, rows(0, 500, "L"));
    const { tailer } = await manualTailer(path);
    writeFileSync(path, rows(0, 500, "L") + rows(500, 560, "L")); // 60 unseen lines appended
    copyFileSync(path, join(dir, "app.log.1"));
    writeFileSync(path, rows(560, 1200, "L")); // truncated and regrown past the old size
    await tailer.check();
    expect(tailer.totalRows).toBe(1200);
    const all = (await tailer.getLines(0, 1200)).map((l) => l.text.split(" ")[0]);
    expect(all).toEqual(Array.from({ length: 1200 }, (_, i) => `L${i}`));
  });
});
