import { utimesSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { learnArchivePattern } from "@cbl-log/shared";
import { describe, expect, it } from "vitest";
import { defaultArchivePattern, findArchives } from "../src/index";
import { useTempDir } from "./helpers";

const tempDir = useTempDir();
const matches = (live: string, name: string, pattern = defaultArchivePattern(live)): boolean => new RegExp(`^(?:${pattern})$`, "i").test(name);

/** Creates files modified at the given minutes before `now`. */
function files(dir: string, now: number, entries: [name: string, minutesAgo: number][]): void {
  for (const [name, ago] of entries) {
    const path = join(dir, name);
    writeFileSync(path, `${name}\n`);
    const t = (now - ago * 60_000) / 1000;
    utimesSync(path, t, t);
  }
}

describe("default archive pattern", () => {
  it("recognizes the usual rolled names", () => {
    expect(matches("SystemOut.log", "SystemOut_26.10.21_09.30.46.log")).toBe(true); // WebSphere traditional
    expect(matches("messages.log", "messages_26.10.21_09.30.46.0.log")).toBe(true); // Liberty
    expect(matches("app.log", "app.2026-10-21.0.log")).toBe(true); // Logback / Log4j2
    expect(matches("app.log", "app.log.1")).toBe(true);
  });

  it("leaves out other logs of the directory and compressed archives", () => {
    expect(matches("SystemOut.log", "SystemErr_26.10.21_09.30.46.log")).toBe(false);
    expect(matches("SystemOut.log", "SystemOut.log")).toBe(false);
    expect(matches("SystemOut.log", "SystemOut_old.log")).toBe(false); // nothing dated nor numbered
    expect(matches("SystemOut.log", "SystemOut_26.10.21_09.30.46.log.gz")).toBe(false);
    expect(matches("SystemOut.log", "SystemOutX_26.log")).toBe(false);
  });
});

describe("learnArchivePattern", () => {
  it("keeps what the names share and generalizes the digits", () => {
    const pattern = learnArchivePattern("C:\\logs\\SystemOut.log", "C:\\logs\\SystemOut_26.10.21_09.30.46.log");
    expect(pattern).toBe("SystemOut_\\d+\\.\\d+\\.\\d+_\\d+\\.\\d+\\.\\d+\\.log");
    expect(matches("SystemOut.log", "SystemOut_26.10.22_10.00.01.log", pattern)).toBe(true);
    expect(matches("SystemOut.log", "SystemOut_26.10.22.log", pattern)).toBe(false);
  });

  it("learns names the default rule misses", () => {
    const pattern = learnArchivePattern("/var/log/server.out", "/var/log/server-backup-0042.out");
    expect(matches("server.out", "server-backup-0042.out")).toBe(true);
    expect(matches("server.out", "server-backup-7.out", pattern)).toBe(true);
    expect(matches("server.out", "server-other-7.out", pattern)).toBe(false);
    expect(learnArchivePattern("/x/app.log", "/x/old/app.1.log")).toBe("app\\.\\d+\\.log");
  });

  it("refuses an example that does not differ by a date or a number", () => {
    expect(() => learnArchivePattern("/x/app.log", "/x/app.log")).toThrow();
    expect(() => learnArchivePattern("/x/app.log", "/x/app.old.log")).toThrow();
  });
});

describe("findArchives", () => {
  it("lists the archives oldest first and leaves out those older than the budget", async () => {
    const dir = await tempDir();
    const now = Date.now();
    files(dir, now, [
      ["SystemOut.log", 0],
      ["SystemOut_26.10.21_07.00.00.log", 180],
      ["SystemOut_26.10.21_09.30.46.log", 30],
      ["SystemOut_26.10.21_08.30.00.log", 90],
      ["SystemErr.log", 1],
      ["SystemErr_26.10.21_09.30.46.log", 30],
    ]);
    const scan = await findArchives(join(dir, "SystemOut.log"), { since: now - 2 * 3_600_000 });
    expect(scan.loaded.map((a) => a.path)).toEqual([join(dir, "SystemOut_26.10.21_08.30.00.log"), join(dir, "SystemOut_26.10.21_09.30.46.log")]);
    expect(scan.skipped).toBe(1);
  });

  it("uses a learned pattern instead of the default rule; an invalid one finds nothing", async () => {
    const dir = await tempDir();
    files(dir, Date.now(), [
      ["server.out", 0],
      ["server-backup-1.out", 5],
      ["server_2.out", 4],
    ]);
    const live = join(dir, "server.out");
    expect((await findArchives(live)).loaded.map((a) => a.path)).toEqual([join(dir, "server-backup-1.out"), join(dir, "server_2.out")]);
    const learned = learnArchivePattern(live, join(dir, "server-backup-1.out"));
    expect((await findArchives(live, { pattern: learned })).loaded.map((a) => a.path)).toEqual([join(dir, "server-backup-1.out")]);
    expect(await findArchives(live, { pattern: "(" })).toEqual({ loaded: [], skipped: 0 });
  });

  it("a missing directory has no archives", async () => {
    expect(await findArchives(join(await tempDir(), "nope", "app.log"))).toEqual({ loaded: [], skipped: 0 });
  });
});
