import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { MessageChannel } from "node:worker_threads";
import type { DockerContainersEvent, EngineEvent, EngineMessage, EngineRequestMap, EngineResponse, TabEvent } from "@cbl-log/shared";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { EngineService } from "../src/index";
import { FakeDocker } from "./fake-docker";
import { useTempDir, waitFor } from "./helpers";

const tempDir = useTempDir();
let fake: FakeDocker;
const cleanups: (() => Promise<void> | void)[] = [];

beforeEach(async () => {
  fake = new FakeDocker();
  await fake.up();
});
afterEach(async () => {
  for (const c of cleanups.splice(0)) await c();
  await fake.down();
});

async function connect() {
  const spoolRoot = await tempDir();
  const service = new EngineService({
    docker: {
      client: fake.client(),
      spoolRoot,
      spooler: { flushMs: 5, retryMs: 20, maxRetryMs: 40, pollMs: 20 },
      watcher: { throttleMs: 10, retryMs: 20 },
    },
  });
  const { port1, port2 } = new MessageChannel();
  const detach = service.attach({
    postMessage: (m) => port1.postMessage(m),
    onMessage: (h) => {
      const listener = (m: unknown): void => h(m);
      port1.on("message", listener);
      return () => port1.off("message", listener);
    },
  });
  const events: EngineEvent[] = [];
  const containerEvents: DockerContainersEvent[] = [];
  const pending = new Map<number, (r: EngineResponse) => void>();
  port2.on("message", (m: EngineMessage) => {
    if (m.kind === "event") events.push(m);
    else if (m.kind === "dockerContainers") containerEvents.push(m);
    else if (m.kind === "response") pending.get(m.id)?.(m);
  });
  let nextId = 1;
  cleanups.push(async () => {
    detach();
    await service.dispose();
    port1.close();
    port2.close();
  });
  const call = <K extends keyof EngineRequestMap>(op: K, params: EngineRequestMap[K]["params"]): Promise<EngineResponse> =>
    new Promise((resolve) => {
      const id = nextId++;
      pending.set(id, resolve);
      port2.postMessage({ kind: "request", id, op, params });
    });
  const ok = async <K extends keyof EngineRequestMap>(op: K, params: EngineRequestMap[K]["params"]): Promise<EngineRequestMap[K]["result"]> => {
    const res = await call(op, params);
    if (!res.ok) throw new Error(`${res.error.code}: ${res.error.message}`);
    return res.result as EngineRequestMap[K]["result"];
  };
  const tabEvents = (type: TabEvent["type"]): TabEvent[] => events.filter((e) => e.event.type === type).map((e) => e.event);
  const rows = async (tabId: string, count = 100): Promise<string[]> =>
    (await ok("getRows", { tabId, first: 0, count })).rows.map((r) => r.text);
  return { ok, call, events, containerEvents, tabEvents, rows, spoolRoot };
}

const nums = (from: number, to: number): string[] => Array.from({ length: to - from }, (_, i) => `line ${from + i}`);
const docker = { context: "desktop-linux", name: "web" };

describe("EngineService with a Docker container", () => {
  it("opens a container as a tab (spool path, source docker), follows it live", async () => {
    fake.add("web", { lines: nums(0, 20) });
    const { ok, rows, spoolRoot } = await connect();
    const info = await ok("open", { docker: { ...docker, initialTail: 5 } });
    expect(info.source).toBe("docker");
    expect(info.path).toBe(join(spoolRoot, "desktop-linux", "web.log"));
    expect(info.totalRows).toBe(5);
    expect(await rows(info.tabId)).toEqual(nums(15, 20));

    fake.log("web", "live 1", "live 2");
    await waitFor(async () => (await rows(info.tabId)).length === 7, "live rows");
    expect((await rows(info.tabId)).slice(5)).toEqual(["live 1", "live 2"]);
  });

  it("reports stopped, then following again after a restart, keeping the rows", async () => {
    fake.add("web", { lines: nums(0, 3) });
    const { ok, rows, tabEvents } = await connect();
    const { tabId } = await ok("open", { docker });
    fake.stop("web");
    await waitFor(() => tabEvents("state").some((e) => e.type === "state" && e.state === "stopped"), "stopped");
    fake.start("web");
    fake.log("web", "again");
    await waitFor(async () => (await rows(tabId)).length === 4, "row after restart");
    const states = tabEvents("state").map((e) => (e.type === "state" ? e.state : ""));
    expect(states.at(-1)).toBe("following");
    expect(await rows(tabId)).toEqual([...nums(0, 3), "again"]);
  });

  it("reports waiting while the daemon is down", async () => {
    fake.add("web", { lines: nums(0, 3) });
    const { ok, rows, tabEvents } = await connect();
    const { tabId } = await ok("open", { docker });
    await fake.down();
    await waitFor(() => tabEvents("state").some((e) => e.type === "state" && e.state === "waiting"), "waiting");
    fake.log("web", "while away");
    await fake.up();
    await waitFor(async () => (await rows(tabId)).length === 4, "caught up");
    expect(await rows(tabId)).toEqual([...nums(0, 3), "while away"]);
  });

  it("shows a recreated container in the same tab with a `recreated` separator", async () => {
    fake.add("web", { lines: nums(0, 3) });
    const { ok, rows, tabEvents } = await connect();
    const { tabId } = await ok("open", { docker });
    fake.recreate("web");
    fake.log("web", "new 1", "new 2");
    await waitFor(() => tabEvents("rolled").length === 1, "rolled event");
    expect(tabEvents("rolled")[0]).toMatchObject({ type: "rolled", reason: "recreated", at: 3 });
    await waitFor(async () => (await rows(tabId)).length === 5, "rows of the new container");
    expect(await rows(tabId)).toEqual([...nums(0, 3), "new 1", "new 2"]);
  });

  it("loads more history in place and tells how many rows were added before", async () => {
    fake.add("web", { lines: nums(0, 40) });
    const { ok, rows } = await connect();
    const { tabId } = await ok("open", { docker: { ...docker, initialTail: 10 } });
    expect(await rows(tabId)).toEqual(nums(30, 40));
    const more = await ok("dockerLoadMore", { tabId, tail: 25 });
    expect(more).toMatchObject({ tabId, totalRows: 25, addedBefore: 15 });
    expect(await rows(tabId, 100)).toEqual(nums(15, 40));
    fake.log("web", "after");
    await waitFor(async () => (await rows(tabId)).length === 26, "follow after reload");
  });

  it("deletes the spool when the tab is closed, and purges leftovers at the first Docker open", async () => {
    fake.add("web", { lines: nums(0, 3) });
    const { ok, spoolRoot } = await connect();
    const dir = join(spoolRoot, "desktop-linux");
    const { tabId } = await ok("open", { docker });
    expect(existsSync(join(dir, "web.log"))).toBe(true);
    await ok("close", { tabId });
    expect(readdirSync(dir)).toEqual([]);

    const { ok: ok2, spoolRoot: root2 } = await connect();
    const stale = join(root2, "old-context");
    await import("node:fs/promises").then((fs) => fs.mkdir(stale, { recursive: true }).then(() => fs.writeFile(join(stale, "gone.log"), "x")));
    await ok2("open", { docker });
    expect(existsSync(stale)).toBe(false);
  });

  it("rejects a container with log driver none, an unknown one, and a second tab on the same container", async () => {
    fake.add("quiet", { logDriver: "none" });
    fake.add("web", { lines: ["a"] });
    const { call, ok } = await connect();
    const none = await call("open", { docker: { ...docker, name: "quiet" } });
    expect(none).toMatchObject({ ok: false, error: { code: "DOCKER_UNREADABLE" } });
    const ghost = await call("open", { docker: { ...docker, name: "ghost" } });
    expect(ghost).toMatchObject({ ok: false, error: { code: "DOCKER_NOT_FOUND" } });
    await ok("open", { docker });
    expect(await call("open", { docker })).toMatchObject({ ok: false });
  });

  it("lists containers and pushes `dockerContainers` events to subscribers", async () => {
    fake.add("web");
    fake.add("quiet", { logDriver: "none" });
    const { ok, containerEvents } = await connect();
    const list = await ok("dockerList", {});
    expect(list.status).toBe("connected");
    expect([list.version, list.apiVersion]).toEqual(["27.0.1", "1.45"]);
    expect(list.context).toBeTruthy();
    expect(list.containers.map((c) => [c.name, c.readable])).toEqual([
      ["quiet", false],
      ["web", true],
    ]);
    const sub = await ok("dockerSubscribe", {});
    expect(sub.containers).toHaveLength(2);
    fake.add("db");
    fake.emitEvent("create", "db");
    await waitFor(() => containerEvents.some((e) => e.containers.length === 3), "event after a container was created");
    await fake.down();
    await waitFor(() => containerEvents.some((e) => e.status === "unavailable"), "unavailable event");
  });
});
