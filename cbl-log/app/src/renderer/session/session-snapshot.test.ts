import type { TabInfo } from "@cbl-log/shared";
import { describe, expect, it } from "vitest";
import { initialTabsState, tabsReducer, type TabsAction } from "../tabs/tabs-reducer";
import { buildSession } from "./session-snapshot";

const info = (name: string): TabInfo => ({
  tabId: name,
  path: `C:/logs/${name}.log`,
  encoding: "utf-8",
  sizeBytes: 1,
  totalRows: 100,
  source: "file",
  lineEnding: "unknown",
});
const run = (...actions: TabsAction[]) => actions.reduce(tabsReducer, initialTabsState);

describe("buildSession", () => {
  it("counts rows from the start of the live file, not of the archives loaded before it", () => {
    const history = { files: [{ path: "C:/logs/a_1.log", startRow: 0, rowCount: 1000, mtimeMs: 1 }], skipped: 0, hours: 2 };
    const s = run(
      { type: "opened", info: { ...info("a"), totalRows: 1100, history } },
      { type: "opened", info: { ...info("b"), totalRows: 1100, history } },
      { type: "follow", tabId: "a", follow: false },
      { type: "scrollRow", tabId: "a", row: 1040 },
      { type: "clearedTo", tabId: "b", row: 1030 },
    );
    const [a, b] = buildSession(s.tabs, "b", 1055).tabs;
    expect(a).toMatchObject({ scrollRow: 40, clearedBefore: 0 });
    expect(b).toMatchObject({ scrollRow: 25, clearedBefore: 30 });
    // a position inside the archives is not kept: they will have changed
    expect(buildSession(s.tabs, "a", 500).tabs[0]).toMatchObject({ scrollRow: 0, clearedBefore: 0 });
  });

  it("is empty without tabs", () => {
    expect(buildSession([], undefined, 0)).toEqual({ schemaVersion: 1, tabs: [] });
  });

  it("keeps tab order, follow, cleared origin and the active tab", () => {
    const s = run(
      { type: "opened", info: info("a") },
      { type: "opened", info: info("b") },
      { type: "follow", tabId: "a", follow: false },
      { type: "scrollRow", tabId: "a", row: 40 },
      { type: "clearedTo", tabId: "b", row: 30 },
      { type: "activated", tabId: "b" },
    );
    const session = buildSession(s.tabs, s.activeId, 55);
    expect(session.activePath).toBe("C:/logs/b.log");
    expect(session.tabs).toEqual([
      { path: "C:/logs/a.log", follow: false, scrollRow: 40, clearedBefore: 0 },
      // active tab: position comes from the live viewport, relative to the cleared origin
      { path: "C:/logs/b.log", follow: true, scrollRow: 25, clearedBefore: 30 },
    ]);
  });

  it("keeps a chosen highlighting profile, and omits it when automatic", () => {
    const s = run({ type: "opened", info: info("a") }, { type: "opened", info: info("b") }, { type: "ruleSetChosen", tabId: "b", ruleSetId: "websphere" });
    const tabs = buildSession(s.tabs, s.activeId, 0).tabs;
    expect(tabs[0]).not.toHaveProperty("ruleSetId");
    expect(tabs[1]?.ruleSetId).toBe("websphere");
  });

  it("keeps a forced encoding, and omits it when detected", () => {
    const s = run({ type: "opened", info: info("a") }, { type: "opened", info: info("b"), encodingChoice: "utf-16le" });
    const tabs = buildSession(s.tabs, s.activeId, 0).tabs;
    expect(tabs[0]).not.toHaveProperty("encoding");
    expect(tabs[1]?.encoding).toBe("utf-16le");
  });

  it("never writes a negative position", () => {
    const s = run({ type: "opened", info: info("a") }, { type: "clearedTo", tabId: "a", row: 50 });
    expect(buildSession(s.tabs, s.activeId, 10).tabs[0]?.scrollRow).toBe(0);
  });

  it("persists the custom name only when set", () => {
    const s = run({ type: "opened", info: info("a") }, { type: "opened", info: info("b") }, { type: "renamed", tabId: "b", name: "prod" });
    const { tabs } = buildSession(s.tabs, s.activeId, 0);
    expect(tabs[0]).not.toHaveProperty("customName");
    expect(tabs[1]!.customName).toBe("prod");
  });

  it("writes a Docker tab as its docker:// URI, not as its spool file", () => {
    const docker = { ...info("spool"), source: "docker" as const, path: "C:/Users/me/AppData/Local/cbl-log/docker/default/web-1.log" };
    const s = run({ type: "opened", info: docker, docker: { context: "default", name: "web-1" } });
    const session = buildSession(s.tabs, s.activeId, 0);
    expect(session.tabs[0]?.path).toBe("docker://default/web-1");
    expect(session.activePath).toBe("docker://default/web-1");
  });
});
