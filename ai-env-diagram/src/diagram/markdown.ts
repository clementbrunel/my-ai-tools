import type { ScanResult, Status, McpServer, Hook, Integration, ContextFile } from "../types.js";
import { getProviderInfo } from "../scanner/hook-providers.js";
import { STATUS_RANK, worstStatus, formatTokens, extractProvider, shortSource } from "./shared.js";

// --- Status badges ---

const MD_BADGE_COLOR: Record<Status, string> = {
  ok: "brightgreen",
  warning: "yellow",
  error: "red",
  outdated: "blue",
};

function mdStatus(status: Status): string {
  return `![${status}](https://img.shields.io/badge/${status}-${MD_BADGE_COLOR[status]})`;
}

// --- Table helper ---

function mdTable(headers: string[], rows: string[][]): string {
  const sep = headers.map(() => "---");
  const allRows = [headers, sep, ...rows];
  return allRows.map((r) => "| " + r.join(" | ") + " |").join("\n");
}

// --- Section renderers ---

function renderMcpMarkdown(servers: McpServer[]): string {
  const lines = ["## MCP Servers", ""];
  if (servers.length === 0) { lines.push("_none_", ""); return lines.join("\n"); }

  const hasDiag = servers.some((s) => s.diagnostics.length > 0);
  const rows = servers.map((s) => [
    `**${s.name}**`,
    s.type,
    s.command ? `\`${shortSource(s.command)}\`` : (s.url ? `\`${s.url}\`` : "—"),
    `\`${shortSource(s.source)}\``,
    ...(hasDiag ? [s.diagnostics.length > 0 ? s.diagnostics[0] : ""] : []),
    mdStatus(s.status),
  ]);
  const headers = ["Name", "Type", "Command / URL", "Source", ...(hasDiag ? ["Diagnostic"] : []), "Status"];
  lines.push(mdTable(headers, rows), "");
  return lines.join("\n");
}

function renderContextMarkdown(files: ContextFile[]): string {
  const lines = ["## Context Files", ""];
  if (files.length === 0) { lines.push("_none_", ""); return lines.join("\n"); }

  const rows = files.map((f) => [
    `\`${shortSource(f.path)}\``,
    f.scope,
    `${(f.sizeBytes / 1024).toFixed(1)} KB`,
    formatTokens(f.estimatedTokens),
    mdStatus(f.status),
  ]);
  lines.push(mdTable(["Path", "Scope", "Size", "Tokens", "Status"], rows), "");
  return lines.join("\n");
}

function renderHooksMarkdown(hooks: Hook[]): string {
  const lines = ["## Hooks", ""];
  if (hooks.length === 0) { lines.push("_none_", ""); return lines.join("\n"); }

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
    const events = [...new Set(ph.map((h) => h.event))].join(", ");
    rows.push([info?.name ?? key, String(ph.length), events, mdStatus(worstSt)]);
  }
  lines.push(mdTable(["Provider", "Count", "Events", "Status"], rows), "");
  return lines.join("\n");
}

function renderIntegrationsMarkdown(integrations: Integration[]): string {
  const lines = ["## Integrations", ""];
  if (integrations.length === 0) { lines.push("_none_", ""); return lines.join("\n"); }

  const rows = integrations.map((integ) => [
    `**${integ.name}**`,
    integ.detected ? "yes" : "no",
    integ.detail ?? "—",
    mdStatus(integ.status),
  ]);
  lines.push(mdTable(["Name", "Detected", "Detail", "Status"], rows), "");
  return lines.join("\n");
}

function renderEnvMarkdown(summary: ScanResult["envVarSummary"]): string {
  if (summary.total === 0) return "";
  const lines = [`## Env Vars (${summary.set}/${summary.total} set)`, ""];
  const rows: string[][] = [
    ...summary.setList.map((n) => [n, "", mdStatus("ok")]),
    ...summary.missingList.map((n) => [n, "required", mdStatus("error")]),
  ];
  lines.push(mdTable(["Variable", "Note", "Status"], rows), "");
  return lines.join("\n");
}

// --- Main export ---

export function renderMarkdown(result: ScanResult): string {
  const { model, mcpServers, contextFiles, hooks, integrations, envVarSummary } = result;
  const date = new Date().toISOString().slice(0, 19).replace("T", " ");

  const overallStatus = worstStatus([
    model.status,
    ...mcpServers.map((s) => s.status),
    ...contextFiles.map((f) => f.status),
    ...hooks.map((h) => h.status),
    ...integrations.map((i) => i.status),
  ]);

  const parts: string[] = [
    `# AI Environment — \`${result.projectPath.replaceAll("\\", "/")}\``,
    "",
    `${mdStatus(overallStatus)} _scanned ${date}_`,
    "",
    "## Model",
    "",
    mdTable(
      ["Configured", "Source", "Status"],
      [[
        `\`${model.configured ?? "unset (default)"}\``,
        model.source ? `\`${shortSource(model.source)}\`` : "—",
        mdStatus(model.status),
      ]]
    ),
    "",
    renderMcpMarkdown(mcpServers),
    renderContextMarkdown(contextFiles),
    renderHooksMarkdown(hooks),
    renderIntegrationsMarkdown(integrations),
    renderEnvMarkdown(envVarSummary),
  ];

  const errors = [
    ...(model.status === "error" ? model.diagnostics.map((d) => `Model: ${d}`) : []),
    ...mcpServers.filter((s) => s.status === "error").flatMap((s) => s.diagnostics.map((d) => `${s.name}: ${d}`)),
    ...hooks.filter((h) => h.status === "error").flatMap((h) => h.diagnostics.map((d) => `${h.event}: ${d}`)),
  ];
  const warnings = [
    ...mcpServers.filter((s) => s.status === "warning").flatMap((s) => s.diagnostics.map((d) => `${s.name}: ${d}`)),
    ...hooks.filter((h) => h.status === "warning").flatMap((h) => h.diagnostics.map((d) => `${h.event}: ${d}`)),
  ];

  if (errors.length > 0) {
    parts.push("## Errors", "");
    for (const e of errors) parts.push(`- ${e}`);
    parts.push("");
  }
  if (warnings.length > 0) {
    parts.push("## Warnings", "");
    for (const w of warnings) parts.push(`- ${w}`);
    parts.push("");
  }

  return parts.join("\n");
}
