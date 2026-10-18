import type { Session, TabId } from "@cbl-log/shared";
import { isDefaultFilter } from "../filter/filter-state";
import type { TabState } from "../tabs/tabs-reducer";

/**
 * What gets written to session.json: the open files in tab order with their follow state, position
 * and cleared origin. `viewRow` is the first visible row (global) of the active tab, which the tab
 * state only learns when the viewport is left.
 */
export function buildSession(tabs: readonly TabState[], activeId: TabId | undefined, viewRow: number): Session {
  const active = tabs.find((t) => t.info.tabId === activeId);
  return {
    schemaVersion: 1,
    tabs: tabs.map((tab) => ({
      path: tab.info.path,
      follow: tab.follow,
      scrollRow: tab === active ? Math.max(0, viewRow - tab.clearedBefore) : tab.scrollRow,
      clearedBefore: tab.clearedBefore,
      ...(tab.ruleSetId ? { ruleSetId: tab.ruleSetId } : {}),
      ...(tab.encodingChoice ? { encoding: tab.encodingChoice } : {}),
      ...(isDefaultFilter(tab.filter) ? {} : { filter: { levels: [...tab.filter.levels], include: [...tab.filter.include], exclude: [...tab.filter.exclude] } }),
    })),
    ...(active ? { activePath: active.info.path } : {}),
  };
}
