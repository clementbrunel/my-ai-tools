import type { SearchError, SearchQuery, TabEvent, TabId, TabInfo } from "@cbl-log/shared";
import type { RollMark } from "../viewer/roll-mark";

export type QueryEvent = Extract<TabEvent, { type: "query" }>;

export interface SearchState {
  query: SearchQuery;
  /** Engine-side search id (null until the engine has answered). */
  id: string | null;
  /** Match the view is parked on. */
  current?: { row: number; ordinal: number | null };
}

export interface TabState {
  info: TabInfo;
  total: number;
  follow: boolean;
  /** Rows appended while the tab was not the active one. */
  unseen: number;
  /** Indexing progress 0..1 while the file is being indexed, undefined otherwise. */
  indexing?: number;
  state: "following" | "missing" | "error";
  message?: string;
  /** First visible row, remembered when the tab is left. */
  scrollRow: number;
  /** Rolling / truncation separators seen while following. */
  marks: RollMark[];
  /** "Clear": rows before this one are hidden (0 = show everything). */
  clearedBefore: number;
  search?: SearchState;
  /** Latest progress event of the engine search (matched to `search.id` by searchStatus). */
  queryEvent?: QueryEvent;
}

/** Progress of the tab search, or undefined when there is none (or the engine has not answered yet). */
export function searchStatus(tab: TabState): { matches: number; done: boolean; error?: SearchError } | undefined {
  if (!tab.search?.id || tab.queryEvent?.id !== tab.search.id) return undefined;
  const { matches, done, error } = tab.queryEvent;
  return { matches, done, ...(error ? { error } : {}) };
}

export interface TabsState {
  tabs: TabState[];
  activeId: TabId | undefined;
}

export type TabsAction =
  | { type: "opened"; info: TabInfo }
  | { type: "closed"; tabId: TabId }
  | { type: "activated"; tabId: TabId }
  | { type: "event"; tabId: TabId; event: TabEvent; receivedAt: number }
  | { type: "searchStarted"; tabId: TabId; query: SearchQuery; id: string | null }
  | { type: "searchHit"; tabId: TabId; row: number; ordinal: number | null }
  | { type: "searchStopped"; tabId: TabId }
  | { type: "clear"; tabId: TabId }
  | { type: "unclear"; tabId: TabId }
  | { type: "follow"; tabId: TabId; follow: boolean }
  | { type: "scrollRow"; tabId: TabId; row: number }
  | { type: "reset" };

export const initialTabsState: TabsState = { tabs: [], activeId: undefined };

function updateTab(state: TabsState, tabId: TabId, patch: (tab: TabState) => TabState): TabsState {
  let changed = false;
  const tabs = state.tabs.map((tab) => {
    if (tab.info.tabId !== tabId) return tab;
    const next = patch(tab);
    if (next !== tab) changed = true;
    return next;
  });
  return changed ? { ...state, tabs } : state;
}

function applyEvent(tab: TabState, isActive: boolean, event: TabEvent, receivedAt: number): TabState {
  switch (event.type) {
    case "rows":
      return {
        ...tab,
        total: event.total,
        unseen: isActive ? 0 : tab.unseen + event.appended,
        indexing: undefined,
      };
    case "indexing":
      return { ...tab, indexing: event.progress < 1 ? event.progress : undefined };
    case "state":
      return { ...tab, state: event.state, message: event.message };
    case "query":
      return { ...tab, queryEvent: event };
    case "rolled": {
      const mark: RollMark = { row: event.at, reason: event.reason, at: receivedAt, ...(event.previous ? { previous: event.previous } : {}) };
      return { ...tab, marks: [...tab.marks, mark] };
    }
    default:
      return tab; // query / alert: not in M1
  }
}

export function tabsReducer(state: TabsState, action: TabsAction): TabsState {
  switch (action.type) {
    case "opened": {
      const tab: TabState = {
        info: action.info,
        total: action.info.totalRows,
        follow: true,
        unseen: 0,
        state: "following",
        scrollRow: 0,
        marks: [],
        clearedBefore: 0,
      };
      return { tabs: [...state.tabs, tab], activeId: action.info.tabId };
    }
    case "closed": {
      const index = state.tabs.findIndex((t) => t.info.tabId === action.tabId);
      if (index === -1) return state;
      const tabs = state.tabs.filter((t) => t.info.tabId !== action.tabId);
      if (state.activeId !== action.tabId) return { ...state, tabs };
      const neighbour = tabs[Math.min(index, tabs.length - 1)];
      return { tabs, activeId: neighbour?.info.tabId };
    }
    case "activated": {
      if (!state.tabs.some((t) => t.info.tabId === action.tabId)) return state;
      const next = updateTab(state, action.tabId, (t) => (t.unseen === 0 ? t : { ...t, unseen: 0 }));
      return { ...next, activeId: action.tabId };
    }
    case "event":
      return updateTab(state, action.tabId, (t) => applyEvent(t, state.activeId === action.tabId, action.event, action.receivedAt));
    case "searchStarted":
      // keep `queryEvent`: the engine may have reported progress before its answer reached us
      return updateTab(state, action.tabId, (t) => ({ ...t, search: { query: action.query, id: action.id } }));
    case "searchHit":
      return updateTab(state, action.tabId, (t) =>
        t.search ? { ...t, search: { ...t.search, current: { row: action.row, ordinal: action.ordinal } } } : t,
      );
    case "searchStopped":
      return updateTab(state, action.tabId, (t) => {
        const { search: _search, queryEvent: _event, ...rest } = t;
        return rest;
      });
    case "clear":
      return updateTab(state, action.tabId, (t) => (t.clearedBefore === t.total ? t : { ...t, clearedBefore: t.total }));
    case "unclear":
      return updateTab(state, action.tabId, (t) => (t.clearedBefore === 0 ? t : { ...t, clearedBefore: 0 }));
    case "follow":
      return updateTab(state, action.tabId, (t) => (t.follow === action.follow ? t : { ...t, follow: action.follow }));
    case "scrollRow":
      return updateTab(state, action.tabId, (t) => (t.scrollRow === action.row ? t : { ...t, scrollRow: action.row }));
    case "reset":
      return initialTabsState;
  }
}
