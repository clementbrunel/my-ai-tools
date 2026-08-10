import chalk from "chalk";
import type { ScanResult, Status, McpServer, Hook, Integration, ContextFile } from "../types.js";
import { getProviderInfo } from "../scanner/hook-providers.js";
import { STATUS_RANK, formatTokens, extractProvider, shortSource } from "./shared.js";
import { renderAsciiTable, consoleStatus, consoleStatusColor, sectionHeader } from "./table.js";

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

  const totalBytes = files.reduce((s, f) => s + f.sizeBytes, 0);
  const totalTokens = files.reduce((s, f) => s + f.estimatedTokens, 0);
  let totalStatus: Status = "ok";
  if (files.some((f) => f.status === "error")) totalStatus = "error";
  else if (files.some((f) => f.status === "warning")) totalStatus = "warning";
  rows.push([
    chalk.bold("TOTAL"),
    "",
    chalk.bold(`${(totalBytes / 1024).toFixed(1)} KB`),
    chalk.bold(formatTokens(totalTokens)),
    consoleStatus(totalStatus),
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

  // Only *detected* integrations can be broken: an undetected one is an absence, not a problem,
  // and listing all of them would bury the real issues under "not detected" noise.
  const brokenIntegrations = (status: Status) =>
    integrations.filter((i) => i.detected && i.status === status);

  const errors = [
    ...(model.status === "error" ? [{ name: "Model", diag: model.diagnostics[0] }] : []),
    ...mcpServers.filter((s) => s.status === "error").map((s) => ({ name: s.name, diag: s.diagnostics[0] })),
    ...hooks.filter((h) => h.status === "error").map((h) => ({ name: h.event, diag: h.diagnostics[0] })),
    ...brokenIntegrations("error").map((i) => ({ name: i.name, diag: i.diagnostics[0] })),
  ];
  const warnings = [
    ...mcpServers.filter((s) => s.status === "warning").map((s) => ({ name: s.name, diag: s.diagnostics[0] })),
    ...hooks.filter((h) => h.status === "warning").map((h) => ({ name: h.event, diag: h.diagnostics[0] })),
    ...brokenIntegrations("warning").map((i) => ({ name: i.name, diag: i.diagnostics[0] })),
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
