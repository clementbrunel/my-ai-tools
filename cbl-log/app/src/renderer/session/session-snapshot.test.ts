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
  lineEnding: "unknown",
});
const run = (...actions: TabsAction[]) => actions.reduce(tabsReducer, initialTabsState);

describe("buildSession", () => {
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
});
