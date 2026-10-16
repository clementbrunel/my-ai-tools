import type { TabInfo } from "@cbl-log/shared";
import { describe, expect, it } from "vitest";
import { initialTabsState, tabsReducer, type TabsAction, type TabsState } from "./tabs-reducer";

const info = (tabId: string, totalRows = 10): TabInfo => ({
  tabId,
  path: `C:\\logs\\${tabId}.log`,
  encoding: "utf-8",
  sizeBytes: 100,
  totalRows,
  lineEnding: "unknown",
});

const run = (...actions: TabsAction[]): TabsState => actions.reduce(tabsReducer, initialTabsState);

describe("tabsReducer", () => {
  it("opens a tab, activates it and starts in follow mode", () => {
    const s = run({ type: "opened", info: info("a", 42) });
    expect(s.activeId).toBe("a");
    expect(s.tabs[0]).toMatchObject({ total: 42, follow: true, unseen: 0, state: "following" });
  });

  it("counts unseen rows only on inactive tabs", () => {
    const s = run(
      { type: "opened", info: info("a") },
      { type: "opened", info: info("b") },
      { type: "event", tabId: "a", event: { type: "rows", total: 15, appended: 5 } },
      { type: "event", tabId: "a", event: { type: "rows", total: 18, appended: 3 } },
      { type: "event", tabId: "b", event: { type: "rows", total: 11, appended: 1 } },
    );
    expect(s.tabs.find((t) => t.info.tabId === "a")).toMatchObject({ total: 18, unseen: 8 });
    expect(s.tabs.find((t) => t.info.tabId === "b")).toMatchObject({ total: 11, unseen: 0 });
  });

  it("resets the unseen counter when the tab is activated", () => {
    const s = run(
      { type: "opened", info: info("a") },
      { type: "opened", info: info("b") },
      { type: "event", tabId: "a", event: { type: "rows", total: 15, appended: 5 } },
      { type: "activated", tabId: "a" },
    );
    expect(s.activeId).toBe("a");
    expect(s.tabs[0]?.unseen).toBe(0);
  });

  it("tracks indexing progress and clears it when done", () => {
    let s = run({ type: "opened", info: info("a") }, { type: "event", tabId: "a", event: { type: "indexing", progress: 0.4, provisional: false } });
    expect(s.tabs[0]?.indexing).toBe(0.4);
    s = tabsReducer(s, { type: "event", tabId: "a", event: { type: "indexing", progress: 1, provisional: false } });
    expect(s.tabs[0]?.indexing).toBeUndefined();
  });

  it("records missing / error state and recovery", () => {
    let s = run({ type: "opened", info: info("a") }, { type: "event", tabId: "a", event: { type: "state", state: "missing", message: "gone" } });
    expect(s.tabs[0]).toMatchObject({ state: "missing", message: "gone" });
    s = tabsReducer(s, { type: "event", tabId: "a", event: { type: "state", state: "following" } });
    expect(s.tabs[0]).toMatchObject({ state: "following", message: undefined });
  });

  it("toggles follow and remembers the scroll row", () => {
    const s = run(
      { type: "opened", info: info("a") },
      { type: "follow", tabId: "a", follow: false },
      { type: "scrollRow", tabId: "a", row: 123 },
    );
    expect(s.tabs[0]).toMatchObject({ follow: false, scrollRow: 123 });
  });

  it("returns the same state object when nothing changes", () => {
    const s = run({ type: "opened", info: info("a") });
    expect(tabsReducer(s, { type: "follow", tabId: "a", follow: true })).toBe(s);
    expect(tabsReducer(s, { type: "event", tabId: "zzz", event: { type: "rows", total: 1, appended: 1 } })).toBe(s);
  });

  it("closing the active tab activates its neighbour, closing the last one empties the bar", () => {
    let s = run({ type: "opened", info: info("a") }, { type: "opened", info: info("b") }, { type: "opened", info: info("c") }, { type: "activated", tabId: "b" });
    s = tabsReducer(s, { type: "closed", tabId: "b" });
    expect(s.activeId).toBe("c");
    s = tabsReducer(s, { type: "closed", tabId: "c" });
    expect(s.activeId).toBe("a");
    s = tabsReducer(s, { type: "closed", tabId: "a" });
    expect(s).toEqual({ tabs: [], activeId: undefined });
  });

  it("closing an inactive tab keeps the active one", () => {
    const s = run({ type: "opened", info: info("a") }, { type: "opened", info: info("b") }, { type: "closed", tabId: "a" });
    expect(s.activeId).toBe("b");
    expect(s.tabs).toHaveLength(1);
  });

  it("reset drops every tab", () => {
    expect(run({ type: "opened", info: info("a") }, { type: "reset" })).toEqual(initialTabsState);
  });
});
