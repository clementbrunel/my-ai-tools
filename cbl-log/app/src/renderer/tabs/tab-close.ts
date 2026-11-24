// "Close several tabs" actions of the tab right-click menu. The "All" tab is pinned on the right and
// counts as a tab like the others (it is rebuilt from the open files on demand).
import type { TabId } from "@cbl-log/shared";

export type CloseKind = "others" | "right" | "all";

/** Tabs closed by `kind`, from the tab that was right-clicked, in bar order. */
export function tabsToClose(order: readonly TabId[], from: TabId, kind: CloseKind): TabId[] {
  const at = order.indexOf(from);
  if (at < 0) return [];
  switch (kind) {
    case "others":
      return order.filter((id) => id !== from);
    case "right":
      return order.slice(at + 1);
    case "all":
      return [...order];
  }
}
