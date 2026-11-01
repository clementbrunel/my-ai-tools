import type { TabInfo } from "@cbl-log/shared";
import { describe, expect, it } from "vitest";
import { initialTabsState, searchStatus, tabsReducer, type TabsAction, type TabsState } from "./tabs-reducer";

const info = (tabId: string, totalRows = 10): TabInfo => ({
  tabId,
  path: `C:\\logs\\${tabId}.log`,
  encoding: "utf-8",
  sizeBytes: 100,
  totalRows,
  source: "file",
  lineEnding: "unknown",
});

const run = (...actions: TabsAction[]): TabsState => actions.reduce(tabsReducer, initialTabsState);

describe("tabsReducer", () => {
  it("opens a tab, activates it and starts in follow mode", () => {
    const s = run({ type: "opened", info: info("a", 42) });
    expect(s.activeId).toBe("a");
    expect(s.tabs[0]).toMatchObject({ total: 42, follow: true, unseen: 0, state: "following" });
  });

  it("starts with a separator after each archive loaded with the file", () => {
    const history = { files: [{ path: "C:\\logs\\a_26.10.21_09.30.46.log", startRow: 0, rowCount: 30, mtimeMs: 1 }], skipped: 2, hours: 2 };
    const s = run({ type: "opened", info: { ...info("a", 42), history } });
    expect(s.tabs[0]!.marks).toEqual([{ row: 30, reason: "rename", previous: "C:\\logs\\a_26.10.21_09.30.46.log", at: 1 }]);
  });

  it("remembers a forced encoding, and opens a tab at a given position", () => {
    const s = run(
      { type: "opened", info: info("a") },
      { type: "opened", info: info("b") },
      { type: "opened", info: info("c"), encodingChoice: "windows-1252", index: 1 },
    );
    expect(s.tabs.map((t) => t.info.tabId)).toEqual(["a", "c", "b"]);
    expect(s.tabs[1]?.encodingChoice).toBe("windows-1252");
    expect(s.tabs[0]).not.toHaveProperty("encodingChoice");
    expect(s.activeId).toBe("c");
  });

  it("counts unseen rows only on inactive tabs", () => {
    const s = run(
      { type: "opened", info: info("a") },
      { type: "opened", info: info("b") },
      { type: "event", tabId: "a", event: { type: "rows", total: 15, appended: 5 }, receivedAt: 0 },
      { type: "event", tabId: "a", event: { type: "rows", total: 18, appended: 3 }, receivedAt: 0 },
      { type: "event", tabId: "b", event: { type: "rows", total: 11, appended: 1 }, receivedAt: 0 },
    );
    expect(s.tabs.find((t) => t.info.tabId === "a")).toMatchObject({ total: 18, unseen: 8 });
    expect(s.tabs.find((t) => t.info.tabId === "b")).toMatchObject({ total: 11, unseen: 0 });
  });

  it("resets the unseen counter when the tab is activated", () => {
    const s = run(
      { type: "opened", info: info("a") },
      { type: "opened", info: info("b") },
      { type: "event", tabId: "a", event: { type: "rows", total: 15, appended: 5 }, receivedAt: 0 },
      { type: "activated", tabId: "a" },
    );
    expect(s.activeId).toBe("a");
    expect(s.tabs[0]?.unseen).toBe(0);
  });

  it("tracks indexing progress and clears it when done", () => {
    let s = run({ type: "opened", info: info("a") }, { type: "event", tabId: "a", event: { type: "indexing", progress: 0.4, provisional: false }, receivedAt: 0 });
    expect(s.tabs[0]?.indexing).toBe(0.4);
    s = tabsReducer(s, { type: "event", tabId: "a", event: { type: "indexing", progress: 1, provisional: false }, receivedAt: 0 });
    expect(s.tabs[0]?.indexing).toBeUndefined();
  });

  it("records missing / error state and recovery", () => {
    let s = run({ type: "opened", info: info("a") }, { type: "event", tabId: "a", event: { type: "state", state: "missing", message: "gone" }, receivedAt: 0 });
    expect(s.tabs[0]).toMatchObject({ state: "missing", message: "gone" });
    s = tabsReducer(s, { type: "event", tabId: "a", event: { type: "state", state: "following" }, receivedAt: 0 });
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
    expect(tabsReducer(s, { type: "event", tabId: "zzz", event: { type: "rows", total: 1, appended: 1 }, receivedAt: 0 })).toBe(s);
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

  it("records rolling marks with their time", () => {
    const s = run(
      { type: "opened", info: info("a") },
      { type: "event", tabId: "a", event: { type: "rolled", reason: "rename", previous: "C:/logs/a.log.1", at: 10 }, receivedAt: 123 },
      { type: "event", tabId: "a", event: { type: "rolled", reason: "truncate", at: 25 }, receivedAt: 456 },
    );
    expect(s.tabs[0]?.marks).toEqual([
      { row: 10, reason: "rename", previous: "C:/logs/a.log.1", at: 123 },
      { row: 25, reason: "truncate", at: 456 },
    ]);
  });

  it("clear hides everything before the current end, unclear shows it again", () => {
    let s = run(
      { type: "opened", info: info("a", 40) },
      { type: "event", tabId: "a", event: { type: "rows", total: 50, appended: 10 }, receivedAt: 0 },
      { type: "clear", tabId: "a" },
    );
    expect(s.tabs[0]?.clearedBefore).toBe(50);
    s = tabsReducer(s, { type: "unclear", tabId: "a" });
    expect(s.tabs[0]?.clearedBefore).toBe(0);
  });

  const query = { pattern: "x", isRegex: false, caseSensitive: true };

  it("tracks search progress by search id, even when it arrives before the engine answer", () => {
    let s = run(
      { type: "opened", info: info("a") },
      { type: "event", tabId: "a", event: { type: "query", id: "s1", matches: 3, done: true }, receivedAt: 0 },
    );
    expect(searchStatus(s.tabs[0]!)).toBeUndefined();
    s = tabsReducer(s, { type: "searchStarted", tabId: "a", query, id: "s1" });
    expect(searchStatus(s.tabs[0]!)).toEqual({ matches: 3, done: true });
  });

  it("ignores progress of another search and records the current hit", () => {
    let s = run(
      { type: "opened", info: info("a") },
      { type: "searchStarted", tabId: "a", query, id: "new" },
      { type: "event", tabId: "a", event: { type: "query", id: "old", matches: 9, done: true }, receivedAt: 0 },
    );
    expect(searchStatus(s.tabs[0]!)).toBeUndefined();
    s = tabsReducer(s, { type: "event", tabId: "a", event: { type: "query", id: "new", matches: 2, done: false, error: "too-expensive" }, receivedAt: 0 });
    expect(searchStatus(s.tabs[0]!)).toEqual({ matches: 2, done: false, error: "too-expensive" });
    s = tabsReducer(s, { type: "searchHit", tabId: "a", row: 40, ordinal: 2 });
    expect(s.tabs[0]?.search?.current).toEqual({ row: 40, ordinal: 2 });
  });

  it("stopping the search forgets it", () => {
    const s = run({ type: "opened", info: info("a") }, { type: "searchStarted", tabId: "a", query, id: "s" }, { type: "searchStopped", tabId: "a" });
    expect(s.tabs[0]?.search).toBeUndefined();
    expect(s.tabs[0]?.queryEvent).toBeUndefined();
  });

  it("records the detected format (null = raw) without touching other state", () => {
    let s = run({ type: "opened", info: info("a") });
    expect(s.tabs[0]?.formatId).toBeUndefined();
    s = tabsReducer(s, { type: "formatDetected", tabId: "a", formatId: "websphere-basic" });
    expect(s.tabs[0]?.formatId).toBe("websphere-basic");
    expect(tabsReducer(s, { type: "formatDetected", tabId: "a", formatId: "websphere-basic" })).toBe(s);
    expect(tabsReducer(s, { type: "formatDetected", tabId: "a", formatId: null }).tabs[0]?.formatId).toBeNull();
  });

  it("remembers the highlighting profile chosen for a tab, and forgets it when set back to automatic", () => {
    let s = run({ type: "opened", info: info("a") });
    s = tabsReducer(s, { type: "ruleSetChosen", tabId: "a", ruleSetId: "websphere" });
    expect(s.tabs[0]?.ruleSetId).toBe("websphere");
    expect(tabsReducer(s, { type: "ruleSetChosen", tabId: "a", ruleSetId: "websphere" })).toBe(s);
    const auto = tabsReducer(s, { type: "ruleSetChosen", tabId: "a", ruleSetId: undefined });
    expect("ruleSetId" in auto.tabs[0]!).toBe(false);
  });

  it("reset drops every tab", () => {
    expect(run({ type: "opened", info: info("a") }, { type: "reset" })).toEqual(initialTabsState);
  });

  it("renames a tab and goes back to the file name on a blank name", () => {
    const named = tabsReducer(tabsReducer(initialTabsState, { type: "opened", info: info("a") }), { type: "renamed", tabId: "a", name: "  prod  " });
    expect(named.tabs[0]!.customName).toBe("prod");
    const reset = tabsReducer(named, { type: "renamed", tabId: "a", name: " " });
    expect(reset.tabs[0]!.customName).toBeUndefined();
  });
});
