import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { applyMigrations } from "@cbl-log/shared";
import { afterEach, describe, expect, it } from "vitest";
import { classifyConfigFile, ConfigWatcher, type ConfigKind } from "./config-watcher";

const cleanups: (() => void)[] = [];
afterEach(() => {
  for (const c of cleanups.splice(0)) c();
});

async function waitFor(cond: () => boolean, what: string, timeoutMs = 5000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!cond()) {
    if (Date.now() > deadline) throw new Error(`Timed out: ${what}`);
    await new Promise((r) => setTimeout(r, 20));
  }
}

function setup() {
  const dir = mkdtempSync(join(tmpdir(), "cbl-log-watch-"));
  mkdirSync(join(dir, "rules"));
  const changes: ConfigKind[] = [];
  const watcher = new ConfigWatcher(dir, (kind) => changes.push(kind), 50);
  watcher.start();
  cleanups.push(() => {
    watcher.stop();
    rmSync(dir, { recursive: true, force: true });
  });
  return { dir, watcher, changes };
}

describe("classifyConfigFile", () => {
  it("recognizes settings and rule files only", () => {
    expect(classifyConfigFile("settings.json")).toBe("settings");
    expect(classifyConfigFile("rules/default.json")).toBe("rules");
    expect(classifyConfigFile("rules\\custom.json")).toBe("rules");
    expect(classifyConfigFile("formats/mine.json")).toBe("formats");
    expect(classifyConfigFile("session.json")).toBeUndefined();
    expect(classifyConfigFile("rules/default.json.tmp")).toBeUndefined();
    expect(classifyConfigFile("rules/sub/x.json")).toBeUndefined();
  });
});

describe("ConfigWatcher", () => {
  it("reports an external edit of settings.json", async () => {
    const { dir, changes } = setup();
    writeFileSync(join(dir, "settings.json"), '{"schemaVersion":1,"theme":"dark"}');
    await waitFor(() => changes.includes("settings"), "settings change");
  });

  it("reports an external edit of a rule file", async () => {
    const { dir, changes } = setup();
    writeFileSync(join(dir, "rules", "mine.json"), "{}");
    await waitFor(() => changes.includes("rules"), "rules change");
  });

  it("ignores the app's own write but reports a later external edit", async () => {
    const { dir, watcher, changes } = setup();
    const text = '{"schemaVersion":1,"theme":"light"}';
    watcher.noteWrite("settings.json", text);
    writeFileSync(join(dir, "settings.json"), text);
    await new Promise((r) => setTimeout(r, 400));
    expect(changes).toEqual([]);
    writeFileSync(join(dir, "settings.json"), '{"schemaVersion":1,"theme":"dark"}');
    await waitFor(() => changes.length > 0, "external edit after own write");
  });
});

describe("applyMigrations", () => {
  const migrations = {
    1: (raw: Record<string, unknown>) => ({ ...raw, renamed: raw["old"], old: undefined }),
    2: (raw: Record<string, unknown>) => ({ ...raw, extra: true }),
  };

  it("applies each step in order and stamps the version", () => {
    expect(applyMigrations({ schemaVersion: 1, old: "x" }, migrations, 3)).toMatchObject({ schemaVersion: 3, renamed: "x", extra: true });
  });

  it("leaves a current file alone and refuses a newer one", () => {
    const current = { schemaVersion: 3, a: 1 };
    expect(applyMigrations(current, migrations, 3)).toEqual(current);
    expect(() => applyMigrations({ schemaVersion: 4 }, migrations, 3)).toThrow(/newer/);
  });

  it("fails when a step is missing", () => {
    expect(() => applyMigrations({ schemaVersion: 1 }, {}, 2)).toThrow(/No migration/);
  });
});
