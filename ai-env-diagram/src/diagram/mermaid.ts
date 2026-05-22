import type { ScanResult, Status } from "../types.js";
import { getComponentName } from "../types.js";
import { getProviderInfo } from "../scanner/hook-providers.js";

const STATUS_ICON: Record<Status, string> = {
  ok: "✅",
  warning: "⚠️",
  error: "❌",
  outdated: "🔄",
};

const STATUS_RANK: Record<Status, number> = { ok: 0, outdated: 1, warning: 2, error: 3 };

function sanitizeId(name: string): string {
  return name.replace(/[^a-zA-Z0-9]/g, "_");
}

function escapeLabel(text: string): string {
  return text.replace(/\\/g, "/").replace(/"/g, "#quot;");
}

function formatTokens(tokens: number): string {
  if (tokens < 1000) return `${tokens}t`;
  return `${(tokens / 1000).toFixed(1)}kt`;
}

function extractProvider(command: string): string {
  const unquoted = command.replace(/\\/g, "/").trim().replace(/^"/, "");
  const exe = unquoted.split(/\s+/)[0];
  const base = exe.split("/").pop() ?? exe;
  return base.replace(/\.[^.]+$/, "");
}

function diagLine(diagnostics: string[], max = 2): string {
  if (diagnostics.length === 0) return "";
  return `<br/><i>${diagnostics.slice(0, max).map(escapeLabel).join("<br/>")}</i>`;
}

function truncateList(items: string[], max: number): string {
  const shown = items.slice(0, max).join(", ");
  return items.length > max ? `${shown} +${items.length - max}` : shown;
}

export function generateMermaid(result: ScanResult): string {
  const lines: string[] = [];

  lines.push("```mermaid");
  lines.push("graph LR");
  lines.push("");

  // --- Claude Code node ---
  const model = result.model;
  const modelLabel = model.configured ?? "default (unset)";
  lines.push(`  Claude["🤖 Claude Code<br/><small>model: ${escapeLabel(modelLabel)}</small>"]:::${model.status}`);
  lines.push("");

  // --- MCP Servers ---
  if (result.mcpServers.length > 0) {
    lines.push("  subgraph MCP_Servers[MCP Servers]");
    for (const server of result.mcpServers) {
      const id = `mcp_${sanitizeId(server.name)}`;
      let typeLabel = "unknown";
      if (server.type === "stdio") typeLabel = `stdio: ${server.command}`;
      else if (server.type === "sse") typeLabel = `sse: ${server.url}`;
      const label = `${server.name} ${STATUS_ICON[server.status]}`
        + diagLine(server.diagnostics)
        + `<br/><small>${escapeLabel(typeLabel)}</small>`;
      lines.push(`    ${id}["${label}"]:::${server.status}`);
      for (const sub of server.subServers ?? []) {
        lines.push(`    mcp_${sanitizeId(server.name)}_${sanitizeId(sub)}["${sub}"]:::ok`);
      }
    }
    lines.push("  end");
    lines.push("");
  }

  // --- Context Files ---
  if (result.contextFiles.length > 0) {
    lines.push("  subgraph Context[Context Files]");
    for (const ctx of result.contextFiles) {
      const id = `ctx_${sanitizeId(ctx.path)}`;
      const shortPath = ctx.path.replace(/\\/g, "/").replace(/^.*\//, "");
      const label = `${escapeLabel(shortPath)} ${STATUS_ICON[ctx.status]}`
        + `<br/><small>${ctx.scope} · ${(ctx.sizeBytes / 1024).toFixed(1)}KB · ~${formatTokens(ctx.estimatedTokens)}</small>`;
      lines.push(`    ${id}["${label}"]:::${ctx.status}`);
    }
    lines.push("  end");
    lines.push("");
  }

  // --- Hooks grouped by provider ---
  if (result.hooks.length > 0) {
    const providerMap = new Map<string, { hooks: (typeof result.hooks); worstStatus: Status }>();
    for (const hook of result.hooks) {
      const key = extractProvider(hook.command);
      const entry = providerMap.get(key);
      if (entry) {
        entry.hooks.push(hook);
        if (STATUS_RANK[hook.status] > STATUS_RANK[entry.worstStatus]) {
          entry.worstStatus = hook.status;
        }
      } else {
        providerMap.set(key, { hooks: [hook], worstStatus: hook.status });
      }
    }

    lines.push("  subgraph Hooks[Hooks]");
    for (const [key, { hooks: phooks, worstStatus }] of providerMap) {
      const info = getProviderInfo(key);
      const displayName = info ? escapeLabel(info.name) : escapeLabel(key);
      const events = [...new Set(phooks.map((h) => h.event))];
      const eventsStr = escapeLabel(truncateList(events, 3));
      let nodeLabel = `${displayName} ${STATUS_ICON[worstStatus]}`
        + `<br/><small>${phooks.length} hooks · ${eventsStr}</small>`;
      if (info?.description) nodeLabel += `<br/><i>${escapeLabel(info.description)}</i>`;
      lines.push(`    hookprov_${sanitizeId(key)}["${nodeLabel}"]:::${worstStatus}`);
    }
    lines.push("  end");
    lines.push("");
  }

  // --- Integrations ---
  if (result.integrations.length > 0) {
    lines.push("  subgraph Integrations[Integrations]");
    for (const [i, integration] of result.integrations.entries()) {
      const id = `integ_${i}_${sanitizeId(integration.name)}`;
      let label = `${integration.name} ${STATUS_ICON[integration.status]}`;
      if (integration.detail) label += ` <small>[${escapeLabel(integration.detail)}]</small>`;
      label += !integration.detected
        ? `<br/><i>not detected</i>`
        : diagLine(integration.diagnostics);
      label += `<br/><small>${escapeLabel(integration.description)}</small>`;
      lines.push(`    ${id}["${label}"]:::${integration.status}`);
    }
    lines.push("  end");
    lines.push("");
  }

  // --- Env Var Summary ---
  if (result.envVarSummary.total > 0) {
    const env = result.envVarSummary;
    const envStatus: Status = env.missing > 0 ? "error" : "ok";
    let label = `Env Vars ${STATUS_ICON[envStatus]}<br/><small>${env.set}/${env.total} set</small>`;
    if (env.setList.length > 0) {
      label += `<br/><small>Set: ${escapeLabel(truncateList(env.setList, 3))}${env.setList.length > 3 ? " more" : ""}</small>`;
    }
    if (env.missingList.length > 0) {
      label += `<br/><i>Missing: ${escapeLabel(truncateList(env.missingList, 3))}</i>`;
    }
    lines.push(`  env_summary["${label}"]:::${envStatus}`);
    lines.push("");
  }

  // --- Edges ---
  lines.push("  %% Connections");
  for (const server of result.mcpServers) {
    const id = `mcp_${sanitizeId(server.name)}`;
    lines.push(`  Claude --> ${id}`);
    for (const sub of server.subServers ?? []) {
      lines.push(`  ${id} --> mcp_${sanitizeId(server.name)}_${sanitizeId(sub)}`);
    }
  }
  for (const ctx of result.contextFiles) {
    lines.push(`  Claude --> ctx_${sanitizeId(ctx.path)}`);
  }
  if (result.hooks.length > 0) {
    const seenProviders = new Set<string>();
    for (const hook of result.hooks) {
      const key = extractProvider(hook.command);
      if (!seenProviders.has(key)) {
        seenProviders.add(key);
        lines.push(`  Claude --> hookprov_${sanitizeId(key)}`);
      }
    }
  }
  for (const [i, integration] of result.integrations.entries()) {
    lines.push(`  Claude --> integ_${i}_${sanitizeId(integration.name)}`);
  }
  if (result.envVarSummary.total > 0) {
    lines.push("  Claude --> env_summary");
  }
  lines.push("");

  // --- Styles ---
  lines.push("  classDef ok fill:#2ea043,stroke:#2ea043,color:#fff");
  lines.push("  classDef warning fill:#d29922,stroke:#d29922,color:#fff");
  lines.push("  classDef error fill:#cf222e,stroke:#cf222e,color:#fff");
  lines.push("  classDef outdated fill:#0969da,stroke:#0969da,color:#fff");

  lines.push("```");
  return lines.join("\n");
}

export function generateSummary(result: ScanResult): string {
  const lines: string[] = [];

  const byStatus = (status: Status) => ({
    model: result.model.status === status ? [{ name: "Model", diagnostics: result.model.diagnostics }] : [],
    mcpServers: result.mcpServers.filter((s) => s.status === status),
    hooks: result.hooks.filter((h) => h.status === status),
    integrations: result.integrations.filter((i) => i.status === status),
  });

  const errors   = [...byStatus("error").model,   ...byStatus("error").mcpServers,   ...byStatus("error").hooks,   ...byStatus("error").integrations];
  const warnings = [...byStatus("warning").model, ...byStatus("warning").mcpServers, ...byStatus("warning").hooks, ...byStatus("warning").integrations];
  const outdated = [...byStatus("outdated").mcpServers, ...byStatus("outdated").integrations];

  const total = result.mcpServers.length + result.contextFiles.length + result.hooks.length + result.integrations.length;
  const totalContextTokens = result.contextFiles.reduce((sum, f) => sum + f.estimatedTokens, 0);

  let contextStatus: Status = "ok";
  if (result.contextFiles.some((f) => f.status === "error")) contextStatus = "error";
  else if (result.contextFiles.some((f) => f.status === "warning")) contextStatus = "warning";

  lines.push(`## AI Environment Summary`);
  lines.push("");
  lines.push(`| Category | Value |`);
  lines.push(`|----------|-------|`);
  const modelSuffix = result.model.configured ? ` ${STATUS_ICON[result.model.status]}` : "";
  lines.push(`| Model | ${result.model.configured ?? "default (unset)"}${modelSuffix} |`);
  lines.push(`| MCP Servers | ${result.mcpServers.length} |`);
  lines.push(`| Context Files | ${result.contextFiles.length} (~${formatTokens(totalContextTokens)}) ${STATUS_ICON[contextStatus]} |`);
  lines.push(`| Hooks | ${result.hooks.length} |`);
  const integrationLabels = result.integrations.map((i) => {
    const icon = i.detected ? STATUS_ICON[i.status] : "➖";
    return `${i.name}${i.detail ? ` \`${i.detail}\`` : ""} ${icon}`;
  });
  lines.push(`| Integrations | ${integrationLabels.join(" · ")} |`);
  lines.push(`| Env Vars | ${result.envVarSummary.set}/${result.envVarSummary.total} set |`);
  lines.push("");

  function renderSection(title: string, items: { name?: string; diagnostics?: string[] }[]) {
    if (items.length === 0) return;
    lines.push(`### ${title} (${items.length})`);
    lines.push("");
    for (const item of items) {
      const name = getComponentName(item as Parameters<typeof getComponentName>[0]);
      lines.push(`- **${name}**: ${"diagnostics" in item ? item.diagnostics?.join("; ") : ""}`);
    }
    lines.push("");
  }

  renderSection("❌ Errors", errors);
  renderSection("⚠️ Warnings", warnings);
  renderSection("🔄 Outdated", outdated);

  if (errors.length === 0 && warnings.length === 0 && outdated.length === 0) {
    lines.push(`> All ${total} components are properly configured. ✅`);
    lines.push("");
  }

  return lines.join("\n");
}
