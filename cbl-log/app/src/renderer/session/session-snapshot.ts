import type { Session, TabId } from "@cbl-log/shared";
import { isDefaultFilter } from "../filter/filter-state";
import { tabUri, type TabState } from "../tabs/tabs-reducer";

/** First row of the live file: the archives loaded with it come before (see TabInfo.history). */
export function liveStartRow(tab: Pick<TabState, "info">): number {
  const last = tab.info.history?.files.at(-1);
  return last ? last.startRow + last.rowCount : 0;
}

/**
 * What gets written to session.json: the open files in tab order with their follow state, position
 * and cleared origin. `viewRow` is the first visible row (global) of the active tab, which the tab
 * state only learns when the viewport is left. Rows are counted from the start of the live file: the
 * archives loaded before it will differ at the next open.
 */
export function buildSession(tabs: readonly TabState[], activeId: TabId | undefined, viewRow: number): Session {
  const active = tabs.find((t) => t.info.tabId === activeId);
  return {
    schemaVersion: 1,
    tabs: tabs.map((tab) => {
      const live = liveStartRow(tab);
      const top = tab === active ? Math.max(viewRow, tab.clearedBefore) : tab.clearedBefore + tab.scrollRow;
      const cleared = Math.max(0, tab.clearedBefore - live);
      return {
        path: tabUri(tab),
        follow: tab.follow,
        scrollRow: Math.max(0, top - live - cleared),
        clearedBefore: cleared,
        ...(tab.customName ? { customName: tab.customName } : {}),
        ...(tab.ruleSetId ? { ruleSetId: tab.ruleSetId } : {}),
        ...(tab.encodingChoice ? { encoding: tab.encodingChoice } : {}),
        ...(isDefaultFilter(tab.filter) ? {} : { filter: { levels: [...tab.filter.levels], include: [...tab.filter.include], exclude: [...tab.filter.exclude], foldTraces: tab.filter.foldTraces } }),
      };
    }),
    ...(active ? { activePath: tabUri(active) } : {}),
  };
}
