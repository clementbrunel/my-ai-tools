import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadSession, loadSettings, saveSession, saveSettings } from "./config-store";

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});
const tempDir = (): string => {
  const d = mkdtempSync(join(tmpdir(), "cbl-log-config-"));
  dirs.push(d);
  return d;
};

describe("settings store", () => {
  it("returns the defaults when the file is missing, without creating it", async () => {
    const dir = tempDir();
    expect(await loadSettings(dir)).toEqual({ value: { schemaVersion: 1, theme: "system", checkForUpdates: true, historyHours: 2, archivePatterns: {} } });
  });

  it("round-trips a saved value", async () => {
    const dir = tempDir();
    await saveSettings(dir, { schemaVersion: 1, theme: "dark", checkForUpdates: false, historyHours: 6, archivePatterns: { "c:\\logs\\systemout.log": "SystemOut_\\d+\\.log" } });
    const loaded = (await loadSettings(dir)).value;
    expect(loaded.theme).toBe("dark");
    expect(loaded.historyHours).toBe(6);
    expect(loaded.archivePatterns).toEqual({ "c:\\logs\\systemout.log": "SystemOut_\\d+\\.log" });
  });

  it("fills in missing fields from the schema defaults", async () => {
    const dir = tempDir();
    writeFileSync(join(dir, "settings.json"), JSON.stringify({ schemaVersion: 1 }));
    const loaded = (await loadSettings(dir)).value;
    expect(loaded.theme).toBe("system");
    expect(loaded.historyHours).toBe(2); // settings.json written before the history: 2 h by default
    expect(loaded.archivePatterns).toEqual({});
  });

  it("ignores an invalid file with a warning and leaves it untouched", async () => {
    const dir = tempDir();
    writeFileSync(join(dir, "settings.json"), "{ nope");
    const loaded = await loadSettings(dir);
    expect(loaded.value.theme).toBe("system");
    expect(loaded.warning).toMatch(/^settings\.json/);
    expect(readFileSync(join(dir, "settings.json"), "utf8")).toBe("{ nope");
  });

  it("rejects a file from a newer version instead of misreading it", async () => {
    const dir = tempDir();
    writeFileSync(join(dir, "settings.json"), JSON.stringify({ schemaVersion: 2, theme: "dark" }));
    const loaded = await loadSettings(dir);
    expect(loaded.warning).toMatch(/newer/);
    expect(loaded.value.theme).toBe("system");
  });
});

describe("session store", () => {
  it("is empty when there is no file", async () => {
    expect((await loadSession(tempDir())).value).toEqual({ schemaVersion: 1, tabs: [] });
  });

  it("round-trips tabs, positions and the active tab", async () => {
    const dir = tempDir();
    await saveSession(dir, {
      schemaVersion: 1,
      activePath: "C:\\logs\\b.log",
      tabs: [
        { path: "C:\\logs\\a.log", follow: false, scrollRow: 120, clearedBefore: 5 },
        { path: "C:\\logs\\b.log", follow: true, scrollRow: 0, clearedBefore: 0 },
      ],
    });
    const { value, warning } = await loadSession(dir);
    expect(warning).toBeUndefined();
    expect(value.tabs).toHaveLength(2);
    expect(value.tabs[0]).toMatchObject({ follow: false, scrollRow: 120, clearedBefore: 5 });
    expect(value.activePath).toBe("C:\\logs\\b.log");
  });

  it("defaults the optional tab fields and rejects a malformed tab", async () => {
    const dir = tempDir();
    writeFileSync(join(dir, "session.json"), JSON.stringify({ schemaVersion: 1, tabs: [{ path: "x.log" }] }));
    expect((await loadSession(dir)).value.tabs[0]).toEqual({ path: "x.log", follow: true, scrollRow: 0, clearedBefore: 0 });
    writeFileSync(join(dir, "session.json"), JSON.stringify({ schemaVersion: 1, tabs: [{ follow: true }] }));
    expect((await loadSession(dir)).warning).toMatch(/^session\.json/);
  });

  it("round-trips a forced encoding and rejects an unknown one", async () => {
    const dir = tempDir();
    await saveSession(dir, { schemaVersion: 1, tabs: [{ path: "x.log", follow: true, scrollRow: 0, clearedBefore: 0, encoding: "windows-1252" }] });
    expect((await loadSession(dir)).value.tabs[0]?.encoding).toBe("windows-1252");
    writeFileSync(join(dir, "session.json"), JSON.stringify({ schemaVersion: 1, tabs: [{ path: "x.log", encoding: "ebcdic" }] }));
    expect((await loadSession(dir)).warning).toMatch(/^session\.json/);
  });
});
