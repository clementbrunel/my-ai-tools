import type { TabEvent, TabId, TabInfo } from "@cbl-log/shared";

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
}

export interface TabsState {
  tabs: TabState[];
  activeId: TabId | undefined;
}

export type TabsAction =
  | { type: "opened"; info: TabInfo }
  | { type: "closed"; tabId: TabId }
  | { type: "activated"; tabId: TabId }
  | { type: "event"; tabId: TabId; event: TabEvent }
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

function applyEvent(tab: TabState, isActive: boolean, event: TabEvent): TabState {
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
    default:
      return tab; // rolled / query / alert: handled elsewhere (or not in M1)
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
      return updateTab(state, action.tabId, (t) => applyEvent(t, state.activeId === action.tabId, action.event));
    case "follow":
      return updateTab(state, action.tabId, (t) => (t.follow === action.follow ? t : { ...t, follow: action.follow }));
    case "scrollRow":
      return updateTab(state, action.tabId, (t) => (t.scrollRow === action.row ? t : { ...t, scrollRow: action.row }));
    case "reset":
      return initialTabsState;
  }
}
