import type { RolledReason } from "@cbl-log/shared";
import { baseName } from "../files/path-key";

/** A rolling / truncation seen while following: drawn as a separator before row `row`. */
export interface RollMark {
  /** Global row of the first line of the new file generation. */
  row: number;
  reason: RolledReason;
  /** Archive the previous content went to, when the engine found it. */
  previous?: string;
  /** Time the event was received (ms since epoch). */
  at: number;
}

const pad = (n: number): string => String(n).padStart(2, "0");

export function formatClock(timestamp: number): string {
  const d = new Date(timestamp);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/** Text of the separator, e.g. "rolling 10:02:11 → app.log.1" or "tronqué 10:02:11". */
export function rollMarkLabel(mark: RollMark): string {
  const time = formatClock(mark.at);
  if (mark.reason === "truncate") {
    return mark.previous ? `tronqué ${time} → ${baseName(mark.previous)}` : `tronqué ${time}`;
  }
  return mark.previous ? `rolling ${time} → ${baseName(mark.previous)}` : `rolling ${time}`;
}

/** Marks by row, for the renderer (several marks on the same row keep the latest). */
export function marksByRow(marks: readonly RollMark[]): Map<number, RollMark> {
  const byRow = new Map<number, RollMark>();
  for (const mark of marks) byRow.set(mark.row, mark);
  return byRow;
}
