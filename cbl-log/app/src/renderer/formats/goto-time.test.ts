import { WEBSPHERE_BASIC, SPRING_BOOT, compileFormat } from "@cbl-log/shared";
import { describe, expect, it } from "vitest";
import { findRowAtTime, parseGotoInput, resolveTarget, wallClockOf } from "./goto-time";

const spring = compileFormat(SPRING_BOOT);
const websphere = compileFormat(WEBSPHERE_BASIC);
const MIN = 60_000;

const head = (min: number): string => `2026-10-14 10:${String(min).padStart(2, "0")}:00.000  INFO 1 --- [main] c.e.App : hello ${min}`;

describe("parseGotoInput", () => {
  it("reads a time of day, with seconds and milliseconds", () => {
    expect(parseGotoInput("10:02")).toEqual({ kind: "time", msOfDay: (10 * 60 + 2) * MIN });
    expect(parseGotoInput("10:02:11.204")).toEqual({ kind: "time", msOfDay: ((10 * 60 + 2) * 60 + 11) * 1000 + 204 });
  });

  it("reads ISO and day-first dates", () => {
    const ms = Date.UTC(2026, 9, 14, 10, 2, 11);
    expect(parseGotoInput("2026-10-14 10:02:11")).toEqual({ kind: "date", ms });
    expect(parseGotoInput("2026-10-14T10:02:11")).toEqual({ kind: "date", ms });
    expect(parseGotoInput("14/10/2026 10:02:11")).toEqual({ kind: "date", ms });
  });

  it("rejects what is not a time", () => {
    for (const text of ["", "abc", "25:00", "10:61", "2026-13-01 10:00", "12"]) expect(parseGotoInput(text)).toBeUndefined();
  });
});

describe("wallClockOf / resolveTarget", () => {
  it("reads the clock of the first record head, ignoring its zone", () => {
    const text = "[10/14/26 10:02:11:204 CEST] 0000004a SystemOut     O Hello";
    expect(wallClockOf(websphere, ["\tat a.b.C", text])).toBe(Date.UTC(2026, 9, 14, 10, 2, 11, 204));
  });

  it("is undefined without timestamp", () => {
    expect(wallClockOf(spring, ["\tat a.b.C", "plain"])).toBeUndefined();
  });

  it("gives a time of day the date of the log", () => {
    const reference = Date.UTC(2026, 9, 14, 23, 0, 0);
    expect(resolveTarget({ kind: "time", msOfDay: 10 * 60 * MIN }, reference)).toBe(Date.UTC(2026, 9, 14, 10, 0, 0));
  });
});

describe("findRowAtTime", () => {
  // one record per minute 10:00..10:59, every 5th followed by a stack frame line
  const rows: string[] = [];
  for (let m = 0; m < 60; m++) {
    rows.push(head(m));
    if (m % 5 === 0) rows.push("\tat a.b.C.d(C.java:1)");
  }
  const search = {
    compiled: spring,
    from: 0,
    to: rows.length,
    readTexts: async (first: number, count: number) => rows.slice(first, first + count),
  };
  const at = (min: number): number => Date.UTC(2026, 9, 14, 10, min, 0);

  it("finds the first record at or after the time", async () => {
    const hit = await findRowAtTime(search, at(30));
    expect(rows[hit.row]).toBe(head(30));
    const between = await findRowAtTime(search, at(30) + 1000);
    expect(rows[between.row]).toBe(head(31));
  });

  it("tells when the time is before the first record or after the last one", async () => {
    expect(await findRowAtTime(search, at(0) - MIN)).toMatchObject({ row: 0, before: true, after: false });
    expect(await findRowAtTime(search, at(59) + MIN)).toMatchObject({ row: rows.length, after: true });
  });

  it("does not look before `from` (cleared rows)", async () => {
    const hit = await findRowAtTime({ ...search, from: 40 }, at(1));
    expect(hit.row).toBe(40);
  });

  it("handles an empty range", async () => {
    expect(await findRowAtTime({ ...search, from: 0, to: 0 }, at(1))).toEqual({ row: 0, before: false, after: true });
  });
});
