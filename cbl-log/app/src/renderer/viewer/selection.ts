import type { Row } from "@cbl-log/shared";

/** Row selection (rows, not characters: the list is virtualized, so native selection cannot span it). */
export interface Selection {
  anchor: number;
  head: number;
}

/** Most rows one copy may fetch (guards against Ctrl+A on a multi-million-line file). */
export const MAX_COPY_ROWS = 200_000;

export function selectionRange(selection: Selection): { first: number; last: number } {
  return { first: Math.min(selection.anchor, selection.head), last: Math.max(selection.anchor, selection.head) };
}

export function selectionSize(selection: Selection): number {
  const { first, last } = selectionRange(selection);
  return last - first + 1;
}

export function isSelected(selection: Selection | undefined, row: number): boolean {
  if (!selection) return false;
  const { first, last } = selectionRange(selection);
  return row >= first && row <= last;
}

/** Clipboard text: one line per row, optionally prefixed with the 1-based line number and a tab. */
export function formatRows(rows: readonly Row[], withLineNumbers: boolean): string {
  return rows.map((row) => (withLineNumbers ? `${row.lineNo + 1}\t${row.text}` : row.text)).join("\n");
}
