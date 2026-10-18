import { LEVELS, defaultFilterSettings, toLineFilter, type FilterSettings, type TextMatcher } from "@cbl-log/shared";
import { describe, expect, it } from "vitest";
import { initialTabsState, filterStatus, tabsReducer, type TabsAction } from "../tabs/tabs-reducer";
import { buildSession } from "../session/session-snapshot";
import { LEVEL_PILLS, addMatcher, describeFilterCount, isDefaultFilter, pillActive, removeMatcher, togglePill } from "./filter-state";

const pill = (id: string) => LEVEL_PILLS.find((p) => p.id === id)!;
const text = (pattern: string, extra: Partial<TextMatcher> = {}): TextMatcher => ({ pattern, isRegex: false, caseSensitive: false, ...extra });

describe("level pills", () => {
  it("are all on by default", () => {
    for (const p of LEVEL_PILLS) expect(pillActive(LEVELS, p)).toBe(true);
  });

  it("toggle one pill without touching the others (fatal and error go together)", () => {
    const off = togglePill(LEVELS, pill("error"));
    expect(off).toEqual(["warn", "info", "debug", "trace"]);
    expect(pillActive(off, pill("error"))).toBe(false);
    expect(togglePill(off, pill("error"))).toEqual(LEVELS);
    expect(togglePill(LEVELS, pill("debug"))).toEqual(["fatal", "error", "warn", "info", "trace"]);
  });
});

describe("matchers", () => {
  it("are added to their list once, and removed by position", () => {
    let s = defaultFilterSettings();
    s = addMatcher(s, "include", text("Cart"));
    s = addMatcher(s, "include", text("Cart"));
    s = addMatcher(s, "include", text("Cart", { caseSensitive: true }));
    s = addMatcher(s, "exclude", text("Cart"));
    s = addMatcher(s, "exclude", text(""));
    expect(s.include).toHaveLength(2);
    expect(s.exclude).toHaveLength(1);
    expect(removeMatcher(s, "include", 0).include).toEqual([text("Cart", { caseSensitive: true })]);
  });
});

describe("toLineFilter", () => {
  it("is null when nothing is hidden", () => {
    expect(toLineFilter(defaultFilterSettings(), true)).toBeNull();
    expect(toLineFilter(undefined, true)).toBeNull();
  });

  it("restricts levels only when some are unchecked and a format is known", () => {
    const s: FilterSettings = { ...defaultFilterSettings(), levels: ["fatal", "error"] };
    expect(toLineFilter(s, true)).toEqual({ levels: ["fatal", "error"] });
    expect(toLineFilter(s, false)).toBeNull();
  });

  it("carries the texts", () => {
    const s: FilterSettings = { levels: LEVELS, include: [text("a")], exclude: [text("b")] };
    expect(toLineFilter(s, false)).toEqual({ include: [text("a")], exclude: [text("b")] });
  });
});

describe("filter on a tab", () => {
  const info = { tabId: "a", path: "C:/logs/a.log", encoding: "utf-8", sizeBytes: 1, totalRows: 10, lineEnding: "unknown" } as const;
  const run = (...actions: TabsAction[]) => actions.reduce(tabsReducer, initialTabsState);

  it("starts unfiltered and is changed by the user", () => {
    const filter: FilterSettings = { ...defaultFilterSettings(), levels: ["error"] };
    const s = run({ type: "opened", info }, { type: "filterChanged", tabId: "a", filter });
    expect(s.tabs[0]!.filter).toBe(filter);
    expect(isDefaultFilter(defaultFilterSettings())).toBe(true);
    expect(isDefaultFilter(filter)).toBe(false);
  });

  it("reports the progress of the filter in force only", () => {
    const base = run({ type: "opened", info }, { type: "filterApplied", tabId: "a", filterId: "f2" });
    expect(filterStatus(base.tabs[0]!)).toBeUndefined();
    const old = tabsReducer(base, { type: "event", tabId: "a", event: { type: "filter", id: "f1", matches: 3, done: true }, receivedAt: 0 });
    expect(filterStatus(old.tabs[0]!)).toBeUndefined();
    const now = tabsReducer(old, { type: "event", tabId: "a", event: { type: "filter", id: "f2", matches: 7, done: false }, receivedAt: 0 });
    expect(filterStatus(now.tabs[0]!)).toEqual({ matches: 7, done: false });
  });

  it("can be set aside to show the full file, and a new filter ends that", () => {
    const filter: FilterSettings = { ...defaultFilterSettings(), levels: ["error"] };
    const applied = run({ type: "opened", info }, { type: "filterApplied", tabId: "a", filterId: "f1" });
    const aside = tabsReducer(applied, { type: "filterSuspended", tabId: "a", suspended: true });
    expect(aside.tabs[0]!.filterSuspended).toBe(true);
    expect(tabsReducer(aside, { type: "filterSuspended", tabId: "a", suspended: true })).toBe(aside);
    expect(tabsReducer(aside, { type: "filterSuspended", tabId: "a", suspended: false }).tabs[0]).not.toHaveProperty("filterSuspended");
    expect(tabsReducer(aside, { type: "filterChanged", tabId: "a", filter }).tabs[0]).not.toHaveProperty("filterSuspended");
    expect(tabsReducer(aside, { type: "filterApplied", tabId: "a", filterId: "f2" }).tabs[0]).not.toHaveProperty("filterSuspended");
  });

  it("is saved in the session unless it hides nothing", () => {
    const filter: FilterSettings = { levels: ["error"], include: [text("Cart")], exclude: [] };
    const plain = run({ type: "opened", info });
    expect(buildSession(plain.tabs, "a", 0).tabs[0]).not.toHaveProperty("filter");
    const filtered = tabsReducer(plain, { type: "filterChanged", tabId: "a", filter });
    expect(buildSession(filtered.tabs, "a", 0).tabs[0]!.filter).toEqual(filter);
  });
});

describe("describeFilterCount", () => {
  it("says how many lines are shown out of how many", () => {
    expect(describeFilterCount(12, 3456).replace(/\s/g, " ")).toBe("12 ligne(s) affichée(s) sur 3 456");
  });
});
