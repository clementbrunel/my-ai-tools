import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LogSpooler, type SpoolState, type SpoolerOptions } from "../src/docker/index";
import { FakeDocker } from "./fake-docker";
import { useTempDir, waitFor } from "./helpers";

const tempDir = useTempDir();
let fake: FakeDocker;
const spoolers: LogSpooler[] = [];

beforeEach(async () => {
  fake = new FakeDocker();
  await fake.up();
});
afterEach(async () => {
  for (const s of spoolers.splice(0)) await s.stop();
  await fake.down();
});

const FAST = { flushMs: 5, retryMs: 20, maxRetryMs: 40, pollMs: 20 };

async function spool(name: string, extra: Partial<SpoolerOptions> = {}) {
  const dir = await tempDir();
  const states: SpoolState[] = [];
  const spooler = new LogSpooler({
    client: fake.client(),
    dir,
    name,
    ...FAST,
    onState: (s) => states.push(s),
    ...extra,
  });
  spoolers.push(spooler);
  await spooler.start();
  return { spooler, dir, states, text: () => readFileSync(spooler.path, "utf8") };
}

const nums = (from: number, to: number): string[] => Array.from({ length: to - from }, (_, i) => `line ${from + i}`);
const expected = (from: number, to: number): string => nums(from, to).map((l) => `${l}\n`).join("");

describe("LogSpooler", () => {
  it("loads the last N lines, without the timestamp prefix, then follows", async () => {
    fake.add("web", { lines: nums(0, 10) });
    const { text } = await spool("web", { initialTail: 4 });
    expect(text()).toBe(expected(6, 10));
    fake.log("web", ...nums(10, 13));
    await waitFor(() => text() === expected(6, 13), "live lines");
  });

  it("calls onWrite after each append", async () => {
    fake.add("web", { lines: ["a"] });
    let writes = 0;
    const { text } = await spool("web", { onWrite: () => writes++ });
    const before = writes;
    fake.log("web", "b");
    await waitFor(() => text() === "a\nb\n" && writes > before, "poke after write");
  });

  it("stops, then resumes after a restart without losing or duplicating a line", async () => {
    fake.add("web", { lines: nums(0, 5) });
    const { text, states } = await spool("web");
    fake.log("web", ...nums(5, 8));
    await waitFor(() => text() === expected(0, 8), "before stop");
    fake.stop("web");
    await waitFor(() => states.at(-1) === "stopped", "stopped state");
    fake.log("web", ...nums(8, 10)); // written while stopped (e.g. last lines of the exit)
    fake.start("web");
    fake.log("web", ...nums(10, 12));
    await waitFor(() => text() === expected(0, 12), "after restart");
    await new Promise((r) => setTimeout(r, 150));
    expect(text()).toBe(expected(0, 12));
    expect(states.at(-1)).toBe("following");
  });

  it("goes to waiting when the daemon dies and resumes when it is back", async () => {
    fake.add("web", { lines: nums(0, 3) });
    const { text, states } = await spool("web");
    await fake.down();
    await waitFor(() => states.includes("waiting"), "waiting state");
    fake.log("web", ...nums(3, 6)); // produced while nobody was listening
    await fake.up();
    await waitFor(() => text() === expected(0, 6), "caught up");
    await new Promise((r) => setTimeout(r, 150));
    expect(text()).toBe(expected(0, 6));
    expect(states.at(-1)).toBe("following");
  });

  it("archives the spool and starts a new one when the container is recreated", async () => {
    const oldId = fake.add("web", { lines: nums(0, 3) });
    let recreated = 0;
    const { spooler, dir, text } = await spool("web", { onRecreated: () => recreated++ });
    fake.stop("web");
    fake.recreate("web");
    fake.log("web", "fresh 1", "fresh 2");
    await waitFor(() => text() === "fresh 1\nfresh 2\n", "new spool");
    expect(recreated).toBe(1);
    expect(readFileSync(join(dir, `web.${oldId.slice(0, 12)}.log`), "utf8")).toBe(expected(0, 3));
    expect(spooler.path).toBe(join(dir, "web.log"));
  });

  it("rotates (rename + create) at the size cap and keeps a bounded number of archives", async () => {
    fake.add("web", { lines: [] });
    const { dir, text } = await spool("web", { maxBytes: 100, maxArchives: 2, flushBytes: 1 });
    const all: string[] = [];
    for (let i = 0; i < 30; i++) {
      all.push(`row ${String(i).padStart(3, "0")} ........`);
      fake.log("web", all.at(-1)!);
      await new Promise((r) => setTimeout(r, 8));
    }
    await waitFor(() => text().includes("row 029"), "last row");
    const archives = readdirSync(dir).filter((f) => /^web\.r.+\.log$/.test(f));
    expect(archives.length).toBe(2);
    // nothing lost between the kept archives and the current spool: contiguous rows ending at the last one
    const kept = [...archives.sort().map((f) => readFileSync(join(dir, f), "utf8")), text()].join("");
    expect(all.join("\n") + "\n").toContain(kept.trim());
    expect(kept.endsWith("row 029 ........\n")).toBe(true);
    expect(text().length).toBeLessThanOrEqual(100 + 20);
  });

  it("rebuilds the spool with a bigger tail", async () => {
    fake.add("web", { lines: nums(0, 50) });
    const { spooler, text } = await spool("web", { initialTail: 10 });
    expect(text()).toBe(expected(40, 50));
    await spooler.rebuild(30);
    expect(text()).toBe(expected(20, 50));
    fake.log("web", "after");
    await waitFor(() => text() === expected(20, 50) + "after\n", "follow after rebuild");
    await spooler.rebuild("all");
    expect(text()).toBe(expected(0, 50) + "after\n");
  });

  it("refuses a container without logs (log driver none)", async () => {
    fake.add("quiet", { logDriver: "none" });
    const dir = await tempDir();
    const s = new LogSpooler({ client: fake.client(), dir, name: "quiet", ...FAST });
    await expect(s.start()).rejects.toMatchObject({ code: "UNREADABLE" });
    expect(existsSync(join(dir, "quiet.log"))).toBe(false);
  });

  it("fails to start on an unknown container or a missing daemon", async () => {
    const dir = await tempDir();
    await expect(new LogSpooler({ client: fake.client(), dir, name: "ghost", ...FAST }).start()).rejects.toMatchObject({ code: "NOT_FOUND" });
    await fake.down();
    await expect(new LogSpooler({ client: fake.client(), dir, name: "ghost", ...FAST }).start()).rejects.toMatchObject({ code: "NOT_RUNNING" });
  });

  it("removes the spool, its archives and its state on stop({ remove })", async () => {
    fake.add("web", { lines: nums(0, 3) });
    const { spooler, dir } = await spool("web");
    await spooler.stop({ remove: true });
    expect(readdirSync(dir)).toEqual([]);
  });

  it("resumes from state.json after a restart of the engine, without duplicates", async () => {
    fake.add("web", { lines: nums(0, 5) });
    const dir = await tempDir();
    const make = () => new LogSpooler({ client: fake.client(), dir, name: "web", ...FAST });
    const a = make();
    await a.start();
    await waitFor(() => readFileSync(a.path, "utf8") === expected(0, 5), "first run");
    await a.stop();
    fake.log("web", ...nums(5, 8));
    const b = make();
    spoolers.push(b);
    await b.start();
    await waitFor(() => readFileSync(b.path, "utf8") === expected(0, 8), "second run");
    await new Promise((r) => setTimeout(r, 100));
    expect(readFileSync(b.path, "utf8")).toBe(expected(0, 8));
  });
});
