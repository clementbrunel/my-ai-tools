import { BUILTIN_FORMATS, compileFormat } from "@cbl-log/shared";
import { describe, expect, it } from "vitest";
import { computeRowLevels } from "./row-levels";

const websphere = compileFormat(BUILTIN_FORMATS[0]!);
const head = (level: string) => `[10/14/26 10:02:11:204 UTC] 0000004a SystemOut     O bob|ui|20261014|100211204|${level}|a.B|m|text`;

const rows = [head("INFO"), head("SEVERE"), "\tat a.b.C.d(C.java:1)", "Caused by: x.Y: boom", "\t... 3 more", head("WARNING"), ""];
const textOf = (row: number): string | undefined => rows[row];

describe("computeRowLevels", () => {
  it("gives each record its own level and continuation lines the level above", () => {
    expect(computeRowLevels(websphere, textOf, 0, rows.length)).toEqual(["info", "error", "error", "error", "error", "warn", "warn"]);
  });

  it("finds the record head above the window for the first rows", () => {
    expect(computeRowLevels(websphere, textOf, 2, 3)).toEqual(["error", "error", "error"]);
  });

  it("leaves rows undefined when their record head is not loaded or the text is missing", () => {
    const partial = (row: number): string | undefined => (row >= 2 ? rows[row] : undefined);
    expect(computeRowLevels(websphere, partial, 2, 2)).toEqual([undefined, undefined]);
    expect(computeRowLevels(websphere, (r) => (r === 0 ? rows[0] : undefined), 0, 2)).toEqual(["info", undefined]);
  });

  it("does not inherit when the format has no continuation", () => {
    const flat = compileFormat({ ...BUILTIN_FORMATS[0]!, continuation: "none" });
    expect(computeRowLevels(flat, textOf, 0, 3)).toEqual(["info", "error", undefined]);
  });

  it("returns nothing without a format", () => {
    expect(computeRowLevels(undefined, textOf, 0, 3)).toEqual([]);
  });
});
