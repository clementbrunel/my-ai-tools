import { SPRING_BOOT, WEBSPHERE_BASIC, compileFormat } from "@cbl-log/shared";
import { describe, expect, it } from "vitest";
import { CHECKPOINT_ROWS, MergedView, type MergeSource } from "../src/merge/merged-view.js";

const spring = compileFormat(SPRING_BOOT);
const websphere = compileFormat(WEBSPHERE_BASIC);

/** A spring-boot head line at 10:00:`sec` (seconds can exceed 59: they roll over the minutes). */
const head = (sec: number, msg: string): string => {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `2026-10-14 10:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.000  INFO 1 --- [main] c.e.App : ${msg}`;
};

class MemorySource implements MergeSource {
  readonly lines: string[];
  constructor(
    readonly label: string,
    lines: string[] = [],
    readonly format = spring,
    readonly startLine = 0,
  ) {
    this.lines = lines;
  }
  lineCount(): number {
    return this.lines.length;
  }
  async read(first: number, count: number): Promise<string[]> {
    return this.lines.slice(first, first + count);
  }
}

const texts = async (view: MergedView): Promise<string[]> => (await view.rows(0, view.rowCount)).map((r) => r.text.replace(/^.*: /, ""));

describe("MergedView", () => {
  it("interleaves two sources by timestamp, ties going to the first source", async () => {
    const a = new MemorySource("srv1", [head(1, "a1"), head(3, "a3"), head(5, "a5")]);
    const b = new MemorySource("srv2", [head(2, "b2"), head(3, "b3"), head(4, "b4")]);
    const view = new MergedView([a, b]);
    expect(await view.update(true)).toBe(6);
    expect(await texts(view)).toEqual(["a1", "b2", "a3", "b3", "b4", "a5"]);
  });

  it("keeps a record together: continuation lines follow their head, and sources keep their own order", async () => {
    const a = new MemorySource("a", [head(1, "a1"), "\tat x.Y", "\tat x.Z", head(4, "a4")]);
    const b = new MemorySource("b", [head(2, "b2"), "\tat q.R", head(3, "b3")]);
    const view = new MergedView([a, b]);
    await view.update(true);
    expect(await texts(view)).toEqual(["a1", "\tat x.Y", "\tat x.Z", "b2", "\tat q.R", "b3", "a4"]);
  });

  it("maps a row to its (source, line) and back, across checkpoints", async () => {
    const a = new MemorySource("a");
    const b = new MemorySource("b");
    for (let i = 0; i < 400; i++) {
      a.lines.push(head(i * 2, `a${i}`));
      if (i % 3 === 0) a.lines.push("\tat cont");
      b.lines.push(head(i * 2 + 1, `b${i}`));
    }
    const view = new MergedView([a, b]);
    await view.update(true);
    expect(view.rowCount).toBe(a.lines.length + b.lines.length);
    expect(view.rowCount).toBeGreaterThan(CHECKPOINT_ROWS * 10);
    for (let row = 0; row < view.rowCount; row += 7) {
      const at = view.locate(row)!;
      expect(view.rowOf(at.source, at.line)).toBe(row);
      const [shown] = await view.rows(row, 1);
      expect(shown!.text).toBe((at.source === 0 ? a : b).lines[at.line]);
    }
    expect(view.locate(view.rowCount)).toBeUndefined();
  });

  it("takes into account the first line of a source (cleared rows)", async () => {
    const a = new MemorySource("a", [head(0, "old"), head(10, "a10"), head(20, "a20")], spring, 1);
    const view = new MergedView([a]);
    await view.update(true);
    expect(await texts(view)).toEqual(["a10", "a20"]);
    expect(view.locate(0)).toEqual({ source: 0, line: 1 });
    expect(view.rowOf(0, 2)).toBe(1);
    expect(view.rowOf(0, 0)).toBeUndefined();
  });

  it("merges sources written in different zones by their real time", async () => {
    const paris = new MemorySource("paris", ["[10/14/26 12:00:05:000 CEST] 0000004a SystemOut     O paris"], websphere);
    const utc = new MemorySource("utc", ["[10/14/26 10:00:01:000 UTC] 0000004a SystemOut     O utc"], websphere);
    const view = new MergedView([paris, utc]);
    await view.update(true);
    expect((await view.rows(0, 2)).map((r) => r.source)).toEqual([1, 0]); // 10:00:01Z comes before 10:00:05Z
  });

  it("refuses a source whose format has no timestamp", () => {
    const raw = { ...spring, format: { ...spring.format, timestamp: undefined } };
    expect(() => new MergedView([new MemorySource("x", [], raw)])).toThrow(/timestamp/);
  });

  describe("real time", () => {
    it("holds the new records for the re-ordering window, then merges them in timestamp order", async () => {
      let now = 0;
      const a = new MemorySource("a", [head(1, "a1")]);
      const b = new MemorySource("b", [head(2, "b2")]);
      const view = new MergedView([a, b], { windowMs: 2000, now: () => now });
      await view.update(true);
      expect(view.rowCount).toBe(2);

      // b's record arrives after a's although it is older: both wait for the window and come out in order
      now = 10_000;
      a.lines.push(head(30, "a30"));
      await view.update();
      now = 10_500;
      b.lines.push(head(20, "b20"));
      expect(await view.update()).toBe(0);
      now = 12_100;
      expect(await view.update()).toBe(0); // b20, the oldest known, is still inside the window
      now = 12_600;
      expect(await view.update()).toBe(2);
      expect((await texts(view)).slice(2)).toEqual(["b20", "a30"]);
    });

    it("keeps the rows already shown in place when an older record arrives late", async () => {
      let now = 0;
      const a = new MemorySource("a", [head(10, "a10")]);
      const view = new MergedView([a], { windowMs: 1000, now: () => now });
      await view.update(true);
      now = 5000;
      a.lines.push(head(5, "late"));
      await view.update();
      now = 7000;
      await view.update();
      expect(await texts(view)).toEqual(["a10", "late"]);
    });

    it("closes the last record only when the next head arrives (or the window passes)", async () => {
      let now = 0;
      const a = new MemorySource("a", [head(1, "a1")]);
      const view = new MergedView([a], { windowMs: 1000, now: () => now });
      now = 100;
      expect(await view.update()).toBe(0); // the record may still grow
      a.lines.push("\tat x.Y");
      now = 200;
      await view.update();
      now = 1500;
      expect(await view.update()).toBe(2);
      expect(await texts(view)).toEqual(["a1", "\tat x.Y"]);
    });
  });

  it("drops the rows of a truncated source and merges what it holds afterwards", async () => {
    const a = new MemorySource("a");
    const b = new MemorySource("b");
    for (let i = 0; i < 200; i++) {
      a.lines.push(head(i * 2, `a${i}`));
      b.lines.push(head(i * 2 + 1, `b${i}`));
    }
    const view = new MergedView([a, b]);
    await view.update(true);
    expect(view.rowCount).toBe(400);

    view.drop(0);
    expect(view.rowCount).toBe(200);
    expect((await view.rows(0, 200)).every((r) => r.source === 1)).toBe(true);
    for (let row = 0; row < 200; row += 13) expect(view.rowOf(1, view.locate(row)!.line)).toBe(row);

    a.lines.splice(0, a.lines.length, head(500 % 600, "fresh"));
    await view.update(true);
    expect(view.rowCount).toBe(201);
    expect((await view.rows(200, 1))[0]!.text).toMatch(/fresh$/);
  });
});
