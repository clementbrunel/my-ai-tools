import chalk from "chalk";
import type { ScanResult, Status, McpServer, Hook, Integration, ContextFile } from "../types.js";
import { getProviderInfo } from "../scanner/hook-providers.js";
import { STATUS_LABEL, STATUS_RANK, formatTokens, extractProvider, shortSource } from "./shared.js";

// --- ASCII table helpers ---

function colWidths(rows: string[][]): number[] {
  const cols = rows[0]?.length ?? 0;
  return Array.from({ length: cols }, (_, i) =>
    Math.max(...rows.map((r) => visibleWidth(r[i] ?? "")))
  );
}

function stripAnsi(str: string): string {
  // biome-ignore lint/suspicious/noControlCharactersInRegex: needed to strip ANSI codes
  return str.replace(/\x1B\[[0-9;]*m/g, "");
}

function visibleWidth(str: string): number {
  return stripAnsi(str).length;
}

const WRAP_THRESHOLD = 48;

function pad(str: string, width: number): string {
  const visible = visibleWidth(str);
  return str + " ".repeat(Math.max(0, width - visible));
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

function renderAsciiTable(headers: string[], rows: string[][]): string {
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

// --- Status helpers ---

function consoleStatusColor(status: Status) {
  if (status === "ok") return chalk.green;
  if (status === "warning") return chalk.yellow;
  if (status === "outdated") return chalk.blue;
  return chalk.red;
}

function consoleStatus(status: Status): string {
  return consoleStatusColor(status)(STATUS_LABEL[status]);
}

function sectionHeader(title: string): string {
  return chalk.bold.cyan(`\n  ── ${title} `);
}

// --- Section renderers ---

function renderMcpConsole(servers: McpServer[]): string {
  if (servers.length === 0) return sectionHeader("MCP SERVERS") + chalk.dim("  none\n");

  const hasDiag = servers.some((s) => s.diagnostics.length > 0);
  const rows = servers.map((s) => [
    s.name,
    s.type,
    s.command ? shortSource(s.command) : (s.url ?? "—"),
    shortSource(s.source),
    consoleStatus(s.status),
    ...(hasDiag ? [s.diagnostics.length > 0 ? chalk.dim(s.diagnostics[0]) : ""] : []),
  ]);
  const headers = ["Name", "Type", "Command / URL", "Source", "Status", ...(hasDiag ? ["Diagnostic"] : [])];

  return sectionHeader("MCP SERVERS") + "\n" + renderAsciiTable(headers, rows);
}

function renderContextConsole(files: ContextFile[]): string {
  if (files.length === 0) return sectionHeader("CONTEXT FILES") + chalk.dim("  none\n");

  const rows = files.map((f) => [
    shortSource(f.path),
    f.scope,
    `${(f.sizeBytes / 1024).toFixed(1)} KB`,
    formatTokens(f.estimatedTokens),
    consoleStatus(f.status),
  ]);

  return sectionHeader("CONTEXT FILES") + "\n" +
    renderAsciiTable(["Path", "Scope", "Size", "Tokens", "Status"], rows);
}

function renderHooksConsole(hooks: Hook[]): string {
  if (hooks.length === 0) return sectionHeader("HOOKS") + chalk.dim("  none\n");

  const providerMap = new Map<string, { hooks: Hook[]; worstSt: Status }>();
  for (const hook of hooks) {
    const key = extractProvider(hook.command);
    const entry = providerMap.get(key);
    if (entry) {
      entry.hooks.push(hook);
      if (STATUS_RANK[hook.status] > STATUS_RANK[entry.worstSt]) entry.worstSt = hook.status;
    } else {
      providerMap.set(key, { hooks: [hook], worstSt: hook.status });
    }
  }

  const rows: string[][] = [];
  for (const [key, { hooks: ph, worstSt }] of providerMap) {
    const info = getProviderInfo(key);
    const name = info?.name ?? key;
    const events = [...new Set(ph.map((h) => h.event))].join(", ");
    rows.push([name, String(ph.length), events, consoleStatus(worstSt)]);
  }

  return sectionHeader("HOOKS") + "\n" +
    renderAsciiTable(["Provider", "Count", "Events", "Status"], rows);
}

function renderIntegrationsConsole(integrations: Integration[]): string {
  if (integrations.length === 0) return sectionHeader("INTEGRATIONS") + chalk.dim("  none\n");

  const rows = integrations.map((integ) => [
    integ.name,
    integ.detected ? chalk.green("yes") : chalk.dim("no"),
    integ.detail ?? "—",
    consoleStatus(integ.status),
  ]);

  return sectionHeader("INTEGRATIONS") + "\n" +
    renderAsciiTable(["Name", "Detected", "Detail", "Status"], rows);
}

function renderEnvConsole(summary: ScanResult["envVarSummary"]): string {
  if (summary.total === 0) return "";

  const status: Status = summary.missing > 0 ? "error" : "ok";
  const rows: string[][] = [
    ...summary.setList.map((n) => [n, "", consoleStatus("ok")]),
    ...summary.missingList.map((n) => [n, chalk.red("required"), consoleStatus("error")]),
  ];

  return sectionHeader("ENV VARS") + chalk.dim(` (${summary.set}/${summary.total} set)`) +
    " " + consoleStatus(status) + "\n" +
    renderAsciiTable(["Variable", "Note", "Status"], rows);
}

// --- Main export ---

export function renderConsole(result: ScanResult): string {
  const parts: string[] = [];
  const { model, mcpServers, contextFiles, hooks, integrations, envVarSummary } = result;

  const modelLabel = model.configured ?? "unset (default)";
  parts.push(chalk.bold.cyan("\n  ── MODEL "));
  parts.push("  " + consoleStatusColor(model.status)(modelLabel) +
    (model.source ? chalk.dim(` (from ${shortSource(model.source)})`) : ""));

  parts.push(renderMcpConsole(mcpServers));
  parts.push(renderContextConsole(contextFiles));
  parts.push(renderHooksConsole(hooks));
  parts.push(renderIntegrationsConsole(integrations));
  parts.push(renderEnvConsole(envVarSummary));

  const errors = [
    ...(model.status === "error" ? [{ name: "Model", diag: model.diagnostics[0] }] : []),
    ...mcpServers.filter((s) => s.status === "error").map((s) => ({ name: s.name, diag: s.diagnostics[0] })),
    ...hooks.filter((h) => h.status === "error").map((h) => ({ name: h.event, diag: h.diagnostics[0] })),
  ];
  const warnings = [
    ...mcpServers.filter((s) => s.status === "warning").map((s) => ({ name: s.name, diag: s.diagnostics[0] })),
    ...hooks.filter((h) => h.status === "warning").map((h) => ({ name: h.event, diag: h.diagnostics[0] })),
  ];
  const outdated = [
    ...mcpServers.filter((s) => s.status === "outdated").map((s) => ({ name: s.name, diag: s.diagnostics[0] })),
    ...integrations.filter((i) => i.status === "outdated").map((i) => ({ name: i.name, diag: i.diagnostics[0] })),
  ];

  if (errors.length > 0) {
    parts.push("\n" + chalk.red(`  ${errors.length} error(s):`));
    for (const e of errors) parts.push(chalk.red(`     • ${e.name}: ${e.diag ?? ""}`));
  }
  if (warnings.length > 0) {
    parts.push("\n" + chalk.yellow(`  ${warnings.length} warning(s):`));
    for (const w of warnings) parts.push(chalk.yellow(`     • ${w.name}: ${w.diag ?? ""}`));
  }
  if (outdated.length > 0) {
    parts.push("\n" + chalk.blue(`  ${outdated.length} outdated:`));
    for (const o of outdated) parts.push(chalk.blue(`     • ${o.name}: ${o.diag ?? ""}`));
  }
  if (errors.length === 0 && warnings.length === 0 && outdated.length === 0) {
    const total = mcpServers.length + contextFiles.length + hooks.length + integrations.length;
    parts.push("\n" + chalk.green(`  All ${total} components OK`));
  }

  parts.push("");
  return parts.join("\n");
}
