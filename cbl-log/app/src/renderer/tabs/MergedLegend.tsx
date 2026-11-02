import type { TabId } from "@cbl-log/shared";

/** Colour of a source in the "All" tab (by its place among the file tabs, so it never changes while they stay). */
export const SOURCE_COLORS = ["#4f8cff", "#e6892e", "#3fb68b", "#c264d6", "#d9534f", "#2fb5c9", "#a3a33a", "#8e8e93"];

export interface LegendSource {
  tabId: TabId;
  label: string;
  color: string;
  /** Shown in the merge (ticked). */
  shown: boolean;
  /** Why it cannot be merged (no format with a timestamp); greyed out. */
  unavailable?: string | undefined;
}

interface Props {
  sources: LegendSource[];
  onToggle(tabId: TabId): void;
}

/** The "All" tab's sources: colour, name and a box to hide / show each one (M-01b). */
export function MergedLegend({ sources, onToggle }: Props) {
  return (
    <div className="merged-legend" role="group" aria-label="Sources de l'onglet Tout">
      {sources.map((s) => (
        <label key={s.tabId} className={s.unavailable ? "merged-source off" : "merged-source"} title={s.unavailable}>
          <input type="checkbox" checked={s.shown && !s.unavailable} disabled={!!s.unavailable} onChange={() => onToggle(s.tabId)} />
          <span className="merged-chip" style={{ backgroundColor: s.color }} />
          {s.label}
        </label>
      ))}
    </div>
  );
}
