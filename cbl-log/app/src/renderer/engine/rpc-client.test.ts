import { writeFileSync, appendFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MessageChannel } from "node:worker_threads";
import { EngineService } from "@cbl-log/engine";
import type { TabEvent } from "@cbl-log/shared";
import { afterEach, describe, expect, it } from "vitest";
import { EngineRequestError, RpcClient, type MinimalPort } from "./rpc-client";

const cleanups: (() => Promise<void> | void)[] = [];
afterEach(async () => {
  for (const c of cleanups.splice(0)) await c();
});

function tempFile(content: string): { dir: string; path: string } {
  const dir = mkdtempSync(join(tmpdir(), "cbl-log-app-"));
  cleanups.push(() => rmSync(dir, { recursive: true, force: true }));
  const path = join(dir, "a.log");
  writeFileSync(path, content);
  return { dir, path };
}

function nodePort(port: import("node:worker_threads").MessagePort): MinimalPort {
  return {
    postMessage: (m) => port.postMessage(m),
    onMessage: (h) => {
      const l = (m: unknown): void => h(m);
      port.on("message", l);
      return () => port.off("message", l);
    },
  };
}

/** Real RpcClient talking to a real EngineService through a node MessageChannel. */
function setup(timeoutMs?: number) {
  const service = new EngineService();
  const { port1, port2 } = new MessageChannel();
  service.attach(nodePort(port1));
  const client = new RpcClient(nodePort(port2), timeoutMs);
  cleanups.push(async () => {
    client.dispose();
    await service.dispose();
    port1.close();
    port2.close();
  });
  return client;
}

const wait = async (cond: () => boolean): Promise<void> => {
  for (let i = 0; i < 400 && !cond(); i++) await new Promise((r) => setTimeout(r, 10));
  expect(cond()).toBe(true);
};

describe("RpcClient", () => {
  it("correlates concurrent requests with their responses", async () => {
    const { path } = tempFile("a\nb\nc\nd\n");
    const client = setup();
    const { tabId } = await client.request("open", { path });
    const [x, y] = await Promise.all([
      client.request("getRows", { tabId, first: 0, count: 2 }),
      client.request("getRows", { tabId, first: 2, count: 2 }),
    ]);
    expect(x.rows.map((r) => r.text)).toEqual(["a", "b"]);
    expect(y.rows.map((r) => r.text)).toEqual(["c", "d"]);
  });

  it("propagates engine errors as EngineRequestError with the code", async () => {
    const { dir } = tempFile("x\n");
    const client = setup();
    const err = await client.request("open", { path: join(dir, "missing.log") }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(EngineRequestError);
    expect((err as EngineRequestError).code).toBe("ENOENT");
  });

  it("routes events by tab id", async () => {
    const a = tempFile("1\n");
    const b = tempFile("1\n");
    const client = setup();
    const tabA = await client.request("open", { path: a.path });
    const tabB = await client.request("open", { path: b.path });
    const gotA: TabEvent[] = [];
    const gotB: TabEvent[] = [];
    const any: string[] = [];
    client.onTabEvent(tabA.tabId, (e) => gotA.push(e));
    client.onTabEvent(tabB.tabId, (e) => gotB.push(e));
    client.onAnyEvent((id) => any.push(id));
    appendFileSync(a.path, "2\n3\n");
    await wait(() => gotA.some((e) => e.type === "rows" && e.total === 3));
    expect(gotB).toEqual([]);
    expect(any).toContain(tabA.tabId);
  });

  it("stops delivering events after unsubscribe", async () => {
    const f = tempFile("1\n");
    const client = setup();
    const { tabId } = await client.request("open", { path: f.path });
    const got: TabEvent[] = [];
    const off = client.onTabEvent(tabId, (e) => got.push(e));
    off();
    appendFileSync(f.path, "2\n");
    await new Promise((r) => setTimeout(r, 400));
    expect(got).toEqual([]);
  });

  it("rejects with TIMEOUT when the engine never answers", async () => {
    const { port1, port2 } = new MessageChannel();
    cleanups.push(() => {
      port1.close();
      port2.close();
    });
    const client = new RpcClient(nodePort(port2), 50);
    cleanups.push(() => client.dispose());
    const err = await client.request("open", { path: "x" }).catch((e: unknown) => e);
    expect((err as EngineRequestError).code).toBe("TIMEOUT");
  });

  it("rejects pending requests on dispose", async () => {
    const { port1, port2 } = new MessageChannel();
    cleanups.push(() => {
      port1.close();
      port2.close();
    });
    const client = new RpcClient(nodePort(port2), 5000);
    const p = client.request("open", { path: "x" }).catch((e: unknown) => e);
    client.dispose();
    expect(((await p) as EngineRequestError).code).toBe("DISCONNECTED");
  });
});
