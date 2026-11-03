import type { Row } from "@cbl-log/shared";

/** Most rows one copy may fetch (guards against Ctrl+A on a multi-million-line file). */
export const MAX_COPY_ROWS = 200_000;

/** Clipboard text: one line per row, optionally prefixed with the 1-based line number and a tab. */
export function formatRows(rows: readonly Row[], withLineNumbers: boolean): string {
  return rows.map((row) => (withLineNumbers ? `${row.lineNo + 1}\t${row.text}` : row.text)).join("\n");
}
