import { win32 } from "node:path";
import { describe, expect, it } from "vitest";
import { parseFileArgs } from "./cli-args";

const all = (): boolean => true;
const opts = { path: win32 } as const;

describe("parseFileArgs", () => {
  it("packaged: skips the executable and keeps file arguments", () => {
    const argv = ["C:\\Apps\\cbl-log.exe", "C:\\logs\\app.log"];
    expect(parseFileArgs(argv, "C:\\work", { ...opts, isPackaged: true, exists: all })).toEqual(["C:\\logs\\app.log"]);
  });

  it("dev: also skips the application path", () => {
    const argv = ["C:\\proj\\node_modules\\electron\\dist\\electron.exe", ".", "C:\\logs\\app.log"];
    expect(parseFileArgs(argv, "C:\\proj", { ...opts, isPackaged: false, exists: all })).toEqual(["C:\\logs\\app.log"]);
  });

  it("ignores Chromium and app flags", () => {
    const argv = ["cbl-log.exe", "--allow-file-access-from-files", "--inspect=5858", "C:\\logs\\a.log"];
    expect(parseFileArgs(argv, "C:\\w", { ...opts, isPackaged: true, exists: all })).toEqual(["C:\\logs\\a.log"]);
  });

  it("resolves relative paths against the working directory", () => {
    const argv = ["cbl-log.exe", "sub\\a.log", "..\\b.log"];
    expect(parseFileArgs(argv, "C:\\work\\x", { ...opts, isPackaged: true, exists: all })).toEqual([
      "C:\\work\\x\\sub\\a.log",
      "C:\\work\\b.log",
    ]);
  });

  it("keeps only existing paths and removes duplicates", () => {
    const argv = ["cbl-log.exe", "C:\\logs\\a.log", "C:\\logs\\missing.log", "C:\\logs\\a.log"];
    const exists = (p: string): boolean => p !== "C:\\logs\\missing.log";
    expect(parseFileArgs(argv, "C:\\w", { ...opts, isPackaged: true, exists })).toEqual(["C:\\logs\\a.log"]);
  });

  it("returns nothing when there are no file arguments", () => {
    expect(parseFileArgs(["cbl-log.exe"], "C:\\w", { ...opts, isPackaged: true, exists: all })).toEqual([]);
    expect(parseFileArgs(["electron.exe", "."], "C:\\w", { ...opts, isPackaged: false, exists: all })).toEqual([]);
  });
});
