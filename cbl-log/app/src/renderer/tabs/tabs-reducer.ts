import { defaultFilterSettings, dockerUri, type DockerRef, type Encoding, type FilterSettings, type SearchError, type SearchQuery, type TabEvent, type TabId, type TabInfo } from "@cbl-log/shared";
import { baseName } from "../files/path-key";
import { historyMarks, type RollMark } from "../viewer/roll-mark";

export type QueryEvent = Extract<TabEvent, { type: "query" }>;
export type FilterEvent = Extract<TabEvent, { type: "filter" }>;

export interface SearchState {
  query: SearchQuery;
  /** Engine-side search id (null until the engine has answered). */
  id: string | null;
  /** Match the view is parked on. */
  current?: { row: number; ordinal: number | null };
}

/** The "All" tab: the tabs it interleaves, and those the user unticked. */
export interface MergedTabState {
  sources: { tabId: TabId; label: string }[];
  hidden: TabId[];
}

export interface TabState {
  info: TabInfo;
  /** Set for the "All" tab (`info.source === "merged"`). */
  merged?: MergedTabState;
  /** Docker tab: the container it follows, by name (`info.path` is then its spool file). */
  docker?: DockerRef;
  total: number;
  follow: boolean;
  /** Rows appended while the tab was not the active one. */
  unseen: number;
  /** Indexing progress 0..1 while the file is being indexed, undefined otherwise. */
  indexing?: number;
  state: "following" | "missing" | "error" | "stopped" | "waiting";
  message?: string;
  /** First visible row, remembered when the tab is left. */
  scrollRow: number;
  /** Rolling / truncation separators seen while following. */
  marks: RollMark[];
  /** "Clear": rows before this one are hidden (0 = show everything). */
  clearedBefore: number;
  search?: SearchState;
  /** Detected log format: undefined = not detected yet, null = raw (no known format). */
  formatId?: string | null;
  /** Highlighting profile chosen by the user for this tab; undefined = automatic (from the format). */
  ruleSetId?: string;
  /** Name given by the user, shown instead of the file name; undefined = file name. */
  customName?: string;
  /** Encoding forced by the user; undefined = the one detected by the engine (`info.encoding`). */
  encodingChoice?: Encoding;
  /** Latest progress event of the engine search (matched to `search.id` by searchStatus). */
  queryEvent?: QueryEvent;
  /** What the user asked to show (levels, texts to include / exclude). */
  filter: FilterSettings;
  /** Engine-side id of the filter in force; null = none, undefined = not applied yet. */
  filterId?: string | null;
  /** The full file is shown although a filter is in force (it keeps running, ready to be shown again). */
  filterSuspended?: boolean;
  /**
   * Pause (T-06): the view is frozen at this many rows (of the file, and of the filtered view when a
   * filter is shown) while the engine keeps reading; the rows that arrive are shown on resume.
   */
  pausedAt?: { total: number; matches?: number };
  /** Latest progress event of the engine filter (matched to `filterId` by filterStatus). */
  filterEvent?: FilterEvent;
}

/** Name shown on the tab: the user's, else the container's, else the file's. */
export function tabLabel(tab: TabState): string {
  if (tab.merged) return "Tout";
  return tab.customName ?? tab.docker?.name ?? baseName(tab.info.path);
}

/** What identifies the tab in the session and in the recent list: the file path, or the `docker://` URI. */
export function tabUri(tab: TabState): string {
  if (tab.merged) return "merged://all";
  return tab.docker ? dockerUri(tab.docker) : tab.info.path;
}

/** Lines available in the filtered view, or undefined while there is no filter in force (or no answer yet). */
export function filterStatus(tab: TabState): { matches: number; done: boolean; error?: SearchError } | undefined {
  if (!tab.filterId || tab.filterEvent?.id !== tab.filterId) return undefined;
  const { matches, done, error } = tab.filterEvent;
  return { matches, done, ...(error ? { error } : {}) };
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
  /** `index`: position in the tab bar (default: last), used when a tab is reopened in place. */
  | { type: "opened"; info: TabInfo; docker?: DockerRef; encodingChoice?: Encoding; index?: number }
  | { type: "closed"; tabId: TabId }
  /** The "All" tab merged other sources (same tab id): its rows start over. */
  | { type: "mergedUpdated"; info: TabInfo }
  | { type: "mergedHidden"; tabId: TabId; hidden: TabId[] }
  | { type: "activated"; tabId: TabId }
  | { type: "event"; tabId: TabId; event: TabEvent; receivedAt: number }
  | { type: "searchStarted"; tabId: TabId; query: SearchQuery; id: string | null }
  | { type: "searchHit"; tabId: TabId; row: number; ordinal: number | null }
  | { type: "searchStopped"; tabId: TabId }
  | { type: "formatDetected"; tabId: TabId; formatId: string | null }
  | { type: "filterChanged"; tabId: TabId; filter: FilterSettings }
  | { type: "filterApplied"; tabId: TabId; filterId: string | null }
  | { type: "filterSuspended"; tabId: TabId; suspended: boolean }
  | { type: "paused"; tabId: TabId; total: number; matches?: number }
  | { type: "resumed"; tabId: TabId }
  /** Empty / blank name = back to the file name. */
  | { type: "renamed"; tabId: TabId; name: string }
  | { type: "ruleSetChosen"; tabId: TabId; ruleSetId: string | undefined }
  | { type: "clearedTo"; tabId: TabId; row: number }
  | { type: "clear"; tabId: TabId }
  | { type: "unclear"; tabId: TabId }
  | { type: "follow"; tabId: TabId; follow: boolean }
  | { type: "scrollRow"; tabId: TabId; row: number }
  | { type: "reloaded"; tabId: TabId; total: number; addedBefore: number }
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
    case "filter":
      return { ...tab, filterEvent: event };
    case "rolled": {
      const mark: RollMark = { row: event.at, reason: event.reason, at: receivedAt, ...(event.previous ? { previous: event.previous } : {}), ...(event.source ? { source: event.source } : {}) };
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
        ...(action.docker ? { docker: action.docker } : {}),
        total: action.info.totalRows,
        follow: true,
        unseen: 0,
        state: "following",
        scrollRow: 0,
        marks: historyMarks(action.info.history),
        ...(action.info.merged ? { merged: { sources: action.info.merged.sources, hidden: [] } } : {}),
        clearedBefore: 0,
        filter: defaultFilterSettings(),
        ...(action.encodingChoice ? { encodingChoice: action.encodingChoice } : {}),
      };
      const at = Math.min(Math.max(0, action.index ?? state.tabs.length), state.tabs.length);
      return { tabs: [...state.tabs.slice(0, at), tab, ...state.tabs.slice(at)], activeId: action.info.tabId };
    }
    case "mergedUpdated":
      return updateTab(state, action.info.tabId, (tab) => ({
        ...tab,
        info: action.info,
        total: action.info.totalRows,
        marks: [],
        unseen: 0,
        scrollRow: 0,
        ...(action.info.merged ? { merged: { sources: action.info.merged.sources, hidden: tab.merged?.hidden ?? [] } } : {}),
      }));
    case "mergedHidden":
      return updateTab(state, action.tabId, (tab) => (tab.merged ? { ...tab, merged: { ...tab.merged, hidden: action.hidden } } : tab));
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
    case "renamed":
      return updateTab(state, action.tabId, (t) => {
        const name = action.name.trim();
        if ((t.customName ?? "") === name) return t;
        const { customName: _previous, ...rest } = t;
        return name ? { ...rest, customName: name } : rest;
      });
    case "ruleSetChosen":
      return updateTab(state, action.tabId, (t) => {
        if (t.ruleSetId === action.ruleSetId) return t;
        const { ruleSetId: _previous, ...rest } = t;
        return action.ruleSetId === undefined ? rest : { ...rest, ruleSetId: action.ruleSetId };
      });
    case "formatDetected":
      return updateTab(state, action.tabId, (t) => (t.formatId === action.formatId ? t : { ...t, formatId: action.formatId }));
    case "filterChanged":
      // a new filter is meant to be seen: it ends the "full file" view (the fold choice alone does not)
      return updateTab(state, action.tabId, (t) => {
        if (t.filter === action.filter) return t;
        const foldOnly = t.filter.levels === action.filter.levels && t.filter.include === action.filter.include && t.filter.exclude === action.filter.exclude;
        if (foldOnly) {
          const { pausedAt: _paused, ...rest } = t;
          return { ...rest, filter: action.filter };
        }
        const { filterSuspended: _suspended, pausedAt: _paused, ...rest } = t;
        return { ...rest, filter: action.filter };
      });
    case "filterApplied":
      // keep `filterEvent`: the engine may have reported progress before its answer reached us
      return updateTab(state, action.tabId, (t) => {
        if (t.filterId === action.filterId) return t;
        const { pausedAt: _paused, ...rest } = t;
        return { ...rest, filterId: action.filterId };
      });
    case "paused":
      return updateTab(state, action.tabId, (t) =>
        t.pausedAt ? t : { ...t, pausedAt: { total: action.total, ...(action.matches !== undefined ? { matches: action.matches } : {}) } },
      );
    case "resumed":
      return updateTab(state, action.tabId, (t) => {
        if (!t.pausedAt) return t;
        const { pausedAt: _paused, ...rest } = t;
        return rest;
      });
    case "filterSuspended":
      return updateTab(state, action.tabId, (t) => {
        if (!!t.filterSuspended === action.suspended) return t;
        const { filterSuspended: _suspended, pausedAt: _paused, ...rest } = t;
        return action.suspended ? { ...rest, filterSuspended: true } : rest;
      });
    case "clearedTo":
      return updateTab(state, action.tabId, (t) => {
        const row = Math.min(Math.max(0, action.row), t.total);
        return t.clearedBefore === row ? t : { ...t, clearedBefore: row };
      });
    case "unclear":
      return updateTab(state, action.tabId, (t) => (t.clearedBefore === 0 ? t : { ...t, clearedBefore: 0 }));
    case "follow":
      return updateTab(state, action.tabId, (t) => (t.follow === action.follow ? t : { ...t, follow: action.follow }));
    case "scrollRow":
      return updateTab(state, action.tabId, (t) => (t.scrollRow === action.row ? t : { ...t, scrollRow: action.row }));
    case "reloaded":
      // "load more history": the spool was rebuilt, older lines now come first; marks and cleared origin shift with them
      return updateTab(state, action.tabId, (t) => ({
        ...t,
        total: action.total,
        scrollRow: t.scrollRow + action.addedBefore,
        clearedBefore: t.clearedBefore > 0 ? t.clearedBefore + action.addedBefore : 0,
        marks: t.marks.map((m) => ({ ...m, row: m.row + action.addedBefore })),
      }));
    case "reset":
      return initialTabsState;
  }
}
