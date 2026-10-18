import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadRecent, saveRecent, withoutRecentFile, withRecentFile } from "./recent-store";

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});
const tempDir = (): string => {
  const d = mkdtempSync(join(tmpdir(), "cbl-log-recent-"));
  dirs.push(d);
  return d;
};

describe("recent files list", () => {
  it("puts the newest file first", () => {
    expect(withRecentFile(["C:\\a.log", "C:\\b.log"], "C:\\c.log")).toEqual(["C:\\c.log", "C:\\a.log", "C:\\b.log"]);
  });

  it("moves an already listed file to the head, ignoring case", () => {
    expect(withRecentFile(["C:\\a.log", "C:\\b.log"], "c:\\B.LOG")).toEqual(["c:\\B.LOG", "C:\\a.log"]);
  });

  it("caps the list", () => {
    expect(withRecentFile(["a", "b", "c"], "d", 3)).toEqual(["d", "a", "b"]);
  });

  it("removes a file", () => {
    expect(withoutRecentFile(["C:\\a.log", "C:\\b.log"], "c:\\A.log")).toEqual(["C:\\b.log"]);
  });
});

describe("recent store", () => {
  it("is empty when there is no file", async () => {
    expect(await loadRecent(tempDir())).toEqual({ value: { schemaVersion: 1, files: [] } });
  });

  it("round-trips the list", async () => {
    const dir = tempDir();
    await saveRecent(dir, { schemaVersion: 1, files: ["C:\\a.log"] });
    expect((await loadRecent(dir)).value.files).toEqual(["C:\\a.log"]);
  });

  it("ignores an invalid file with a warning", async () => {
    const dir = tempDir();
    writeFileSync(join(dir, "recent.json"), "{ nope");
    const loaded = await loadRecent(dir);
    expect(loaded.value.files).toEqual([]);
    expect(loaded.warning).toMatch(/^recent\.json/);
  });
});
