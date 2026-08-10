import chalk from "chalk";
import type { Status } from "../types.js";
import { STATUS_LABEL } from "./shared.js";

// ANSI-aware table primitives and the status palette, shared by every console-style
// report (the scan report and the verify report) so they stay visually identical.

const WRAP_THRESHOLD = 48;

function stripAnsi(str: string): string {
  // biome-ignore lint/suspicious/noControlCharactersInRegex: needed to strip ANSI codes
  return str.replace(/\x1B\[[0-9;]*m/g, "");
}

export function visibleWidth(str: string): number {
  return stripAnsi(str).length;
}

function pad(str: string, width: number): string {
  const visible = visibleWidth(str);
  return str + " ".repeat(Math.max(0, width - visible));
}

function colWidths(rows: string[][]): number[] {
  const cols = rows[0]?.length ?? 0;
  return Array.from({ length: cols }, (_, i) =>
    Math.max(...rows.map((r) => visibleWidth(r[i] ?? "")))
  );
}

function wrapText(text: string, width: number): string[] {
  if (visibleWidth(text) <= width) return [text];
  const words = text.split(", ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const sep = current ? ", " : "";
    if (visibleWidth(current + sep + word) > width && current) {
      lines.push(current);
      current = word;
    } else {
      current = current + sep + word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export function renderAsciiTable(headers: string[], rows: string[][]): string {
  const allRows = [headers, ...rows];
  const naturalWidths = colWidths(allRows);
  const widths = naturalWidths.map((w) => Math.min(w, WRAP_THRESHOLD));

  const expandedRows: { cells: string[][]; isHeader: boolean }[] = [
    { cells: headers.map((h) => [h]), isHeader: true },
  ];
  for (const row of rows) {
    const wrapped = row.map((cell, i) => wrapText(cell, widths[i]));
    const height = Math.max(...wrapped.map((w) => w.length));
    const cells = wrapped.map((w) => {
      while (w.length < height) w.push("");
      return w;
    });
    expandedRows.push({ cells, isHeader: false });
  }

  const sep = "+" + widths.map((w) => "-".repeat(w + 2)).join("+") + "+";

  const renderSubRow = (subCells: string[], bold = false) => {
    const cells = subCells.map((cell, i) =>
      " " + pad(bold ? chalk.bold(cell) : cell, widths[i]) + " "
    );
    return "|" + cells.join("|") + "|";
  };

  const lines: string[] = [sep];
  for (const { cells, isHeader } of expandedRows) {
    const height = cells[0].length;
    for (let r = 0; r < height; r++) {
      lines.push(renderSubRow(cells.map((col) => col[r] ?? ""), isHeader));
    }
    lines.push(sep);
  }
  return lines.join("\n");
}

// --- Status palette ---

export function consoleStatusColor(status: Status) {
  if (status === "ok") return chalk.green;
  if (status === "warning") return chalk.yellow;
  if (status === "outdated") return chalk.blue;
  return chalk.red;
}

export function consoleStatus(status: Status): string {
  return consoleStatusColor(status)(STATUS_LABEL[status]);
}

export function sectionHeader(title: string): string {
  return chalk.bold.cyan(`\n  ── ${title} `);
}
