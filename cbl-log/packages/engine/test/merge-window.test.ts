import { SPRING_BOOT, compileFormat } from "@cbl-log/shared";
import { describe, expect, it } from "vitest";
import { windowStarts } from "../src/merge/merge-window.js";
import { MergedView, type MergeSource } from "../src/merge/merged-view.js";

const spring = compileFormat(SPRING_BOOT);
const head = (sec: number, msg: string): string => {
  const m = Math.floor(sec / 60);
  return `2026-10-14 10:${String(m).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}.000  INFO 1 --- [main] c.e.App : ${msg}`;
};

class MemorySource implements MergeSource {
  reads = 0;
  constructor(
    readonly label: string,
    readonly lines: string[],
    public startLine?: number,
    readonly format = spring,
  ) {}
  lineCount(): number {
    return this.lines.length;
  }
  async read(first: number, count: number): Promise<string[]> {
    this.reads++;
    return this.lines.slice(first, first + count);
  }
}

/** One head line per second from `from`, every fifth followed by a stack frame. */
const seconds = (from: number, to: number, name: string): string[] =>
  Array.from({ length: to - from }, (_, i) => [head(from + i, `${name}${from + i}`), ...((from + i) % 5 === 0 ? ["\tat x.Y"] : [])]).flat();

describe("windowStarts", () => {
  it("keeps everything when no source is longer than the window, or when the window is 0", async () => {
    const a = new MemorySource("a", seconds(0, 50, "a"));
    const b = new MemorySource("b", seconds(0, 30, "b"));
    expect(await windowStarts([a, b], 1000)).toEqual({ starts: [0, 0], complete: true });
    expect(await windowStarts([a, b], 0)).toEqual({ starts: [0, 0], complete: true });
  });

  it("starts every source at the time where the busiest one has `window` lines left", async () => {
    const busy = new MemorySource("busy", seconds(0, 600, "x")); // 720 lines, last 100 lines ≈ the last 83 s
    const quiet = new MemorySource("quiet", seconds(0, 600, "q").filter((_, i) => i % 10 < 2)); // sparse
    const { starts, complete } = await windowStarts([busy, quiet], 100);
    expect(complete).toBe(false);
    // the busy source starts on a record head within the last 100 lines
    expect(starts[0]).toBeGreaterThanOrEqual(busy.lines.length - 100);
    expect(starts[0]).toBeLessThan(busy.lines.length);
    expect(busy.lines[starts[0]!]).not.toMatch(/^\t/);
    // both begin at the same time: no line of the quiet source before it, every one from it on
    const since = busy.lines[starts[0]!]!.slice(0, 19);
    const kept = quiet.lines.slice(starts[1]!).filter((l) => !l.startsWith("\t"));
    expect(kept.every((l) => l.slice(0, 19) >= since)).toBe(true);
    const dropped = quiet.lines.slice(0, starts[1]).filter((l) => !l.startsWith("\t"));
    expect(dropped.every((l) => l.slice(0, 19) < since)).toBe(true);
  });

  it("finds the start with a few reads, not by reading the file", async () => {
    const big = new MemorySource("big", seconds(0, 3000, "x")); // 3 600 lines
    await windowStarts([big], 200);
    expect(big.reads).toBeLessThan(40);
  });

  it("merges only the window, the same rows as the end of the whole merge", async () => {
    const a = new MemorySource("a", seconds(0, 300, "a"));
    const b = new MemorySource("b", seconds(100, 300, "b"));
    const whole = new MergedView([new MemorySource("a", a.lines), new MemorySource("b", b.lines)]);
    await whole.update(true);
    const { starts } = await windowStarts([a, b], 150);
    const windowed = new MergedView([new MemorySource("a", a.lines, starts[0]), new MemorySource("b", b.lines, starts[1])]);
    await windowed.update(true);
    expect(windowed.rowCount).toBeLessThan(whole.rowCount);
    const tail = (await whole.rows(whole.rowCount - windowed.rowCount, windowed.rowCount)).map((r) => r.text);
    expect((await windowed.rows(0, windowed.rowCount)).map((r) => r.text)).toEqual(tail);
  });
});
