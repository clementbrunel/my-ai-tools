import type { ScanResult, Status } from "../types.js";
import { getComponentName } from "../types.js";
import { getProviderInfo } from "../scanner/hook-providers.js";

const STATUS_ICON: Record<Status, string> = {
  ok: "✅",
  warning: "⚠️",
  error: "❌",
  outdated: "🔄",
};

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

export function generateMermaid(result: ScanResult): string {
  const lines: string[] = [];

  lines.push("```mermaid");
  lines.push("graph LR");
  lines.push("");

  // --- Claude Code node with model info ---
  const model = result.model;
  const modelIcon = STATUS_ICON[model.status];
  const modelLabel = model.configured
    ? `${model.configured} ${modelIcon}`
    : `default (unset)`;

  lines.push(`  Claude["🤖 Claude Code<br/><small>model: ${escapeLabel(modelLabel)}</small>"]:::${model.status}`);
  lines.push("");

  // --- MCP Servers ---
  if (result.mcpServers.length > 0) {
    lines.push("  subgraph MCP_Servers[MCP Servers]");

    for (const server of result.mcpServers) {
      const id = `mcp_${sanitizeId(server.name)}`;
      const icon = STATUS_ICON[server.status];
      let label = `${server.name} ${icon}`;

      if (server.diagnostics.length > 0) {
        const diag = server.diagnostics
          .slice(0, 2)
          .map((d) => escapeLabel(d))
          .join("<br/>");
        label += `<br/><i>${diag}</i>`;
      }

      const typeLabel =
        server.type === "stdio"
          ? `stdio: ${server.command}`
          : server.type === "sse"
            ? `sse: ${server.url}`
            : "unknown";
      label += `<br/><small>${escapeLabel(typeLabel)}</small>`;

      if (server.subServers && server.subServers.length > 0) {
        // Gateway node + sub-servers as siblings (Mermaid subgraph titles don't support HTML)
        lines.push(`    ${id}["${label}"]:::${server.status}`);
        for (const sub of server.subServers) {
          const subId = `mcp_${sanitizeId(server.name)}_${sanitizeId(sub)}`;
          lines.push(`    ${subId}["${sub}"]:::ok`);
        }
      } else {
        lines.push(`    ${id}["${label}"]:::${server.status}`);
      }
    }

    lines.push("  end");
    lines.push("");
  }

  // --- Context Files ---
  const existingContextFiles = result.contextFiles;
  if (existingContextFiles.length > 0) {
    lines.push("  subgraph Context[Context Files]");

    for (const ctx of existingContextFiles) {
      const id = `ctx_${sanitizeId(ctx.path)}`;
      const normalizedPath = ctx.path.replace(/\\/g, "/");
      const shortPath = normalizedPath.replace(/^.*\//, "");
      const sizeKb = (ctx.sizeBytes / 1024).toFixed(1);
      const tokens = formatTokens(ctx.estimatedTokens);
      const icon = STATUS_ICON[ctx.status];
      const label = `${escapeLabel(shortPath)} ${icon}<br/><small>${ctx.scope} · ${sizeKb}KB · ~${tokens}</small>`;
      lines.push(`    ${id}["${label}"]:::${ctx.status}`);
    }

    lines.push("  end");
    lines.push("");
  }

  // --- Hooks grouped by provider ---
  if (result.hooks.length > 0) {
    type HookStatus = (typeof result.hooks)[0]["status"];
    const statusRank: Record<string, number> = { ok: 0, outdated: 1, warning: 2, error: 3 };
    const providerMap = new Map<string, { hooks: (typeof result.hooks); worstStatus: HookStatus }>();

    for (const hook of result.hooks) {
      const key = extractProvider(hook.command);
      const entry = providerMap.get(key);
      if (entry) {
        entry.hooks.push(hook);
        if ((statusRank[hook.status] ?? 0) > (statusRank[entry.worstStatus] ?? 0)) {
          entry.worstStatus = hook.status;
        }
      } else {
        providerMap.set(key, { hooks: [hook], worstStatus: hook.status });
      }
    }

    lines.push("  subgraph Hooks[Hooks]");
    for (const [key, { hooks: phooks, worstStatus }] of providerMap) {
      const id = `hookprov_${sanitizeId(key)}`;
      const icon = STATUS_ICON[worstStatus];
      const info = getProviderInfo(key);
      const displayName = info ? escapeLabel(info.name) : escapeLabel(key);
      const events = [...new Set(phooks.map((h) => h.event))];
      const eventsStr = events.length <= 4
        ? escapeLabel(events.join(", "))
        : `${escapeLabel(events.slice(0, 3).join(", "))} +${events.length - 3}`;
      let nodeLabel = `${displayName} ${icon}<br/><small>${phooks.length} hooks · ${eventsStr}</small>`;
      if (info?.description) {
        nodeLabel += `<br/><i>${escapeLabel(info.description)}</i>`;
      }
      lines.push(`    ${id}["${nodeLabel}"]:::${worstStatus}`);
    }
    lines.push("  end");
    lines.push("");
  }

  // --- Integrations (MemPalace, Caveman, RTK, ...) ---
  if (result.integrations.length > 0) {
    lines.push("  subgraph Integrations[Integrations]");

    for (let i = 0; i < result.integrations.length; i++) {
      const integration = result.integrations[i];
      const id = `integ_${i}_${sanitizeId(integration.name)}`;
      const icon = STATUS_ICON[integration.status];
      let label = `${integration.name} ${icon}`;

      if (integration.detail) {
        label += ` <small>[${escapeLabel(integration.detail)}]</small>`;
      }

      if (!integration.detected) {
        label += `<br/><i>not detected</i>`;
      } else if (integration.diagnostics.length > 0) {
        const diag = integration.diagnostics
          .slice(0, 2)
          .map((d) => escapeLabel(d))
          .join("<br/>");
        label += `<br/><i>${diag}</i>`;
      }

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
    const icon = STATUS_ICON[envStatus];
    let label = `Env Vars ${icon}<br/><small>${env.set}/${env.total} set</small>`;

    if (env.setList.length > 0) {
      const setVars = env.setList.slice(0, 3).join(", ");
      label += `<br/><small>Set: ${escapeLabel(setVars)}`;
      if (env.setList.length > 3) {
        label += ` +${env.setList.length - 3} more`;
      }
      label += `</small>`;
    }

    if (env.missingList.length > 0) {
      const missing = env.missingList.slice(0, 3).join(", ");
      label += `<br/><i>Missing: ${escapeLabel(missing)}</i>`;
      if (env.missingList.length > 3) {
        label += `<br/><i>+${env.missingList.length - 3} more</i>`;
      }
    }

    lines.push(`  env_summary["${label}"]:::${envStatus}`);
    lines.push("");
  }

  // --- Edges ---
  lines.push("  %% Connections");
  for (const server of result.mcpServers) {
    const id = `mcp_${sanitizeId(server.name)}`;
    lines.push(`  Claude --> ${id}`);
    if (server.subServers && server.subServers.length > 0) {
      for (const sub of server.subServers) {
        const subId = `mcp_${sanitizeId(server.name)}_${sanitizeId(sub)}`;
        lines.push(`  ${id} --> ${subId}`);
      }
    }
  }
  for (const ctx of existingContextFiles) {
    const id = `ctx_${sanitizeId(ctx.path)}`;
    lines.push(`  Claude --> ${id}`);
  }
  if (result.hooks.length > 0) {
    const seenProviders = new Set<string>();
    for (const hook of result.hooks) {
      const key = hook.command.replace(/\\/g, "/").trim().replace(/^"/, "").split(/\s+/)[0].split("/").pop()?.replace(/\.[^.]+$/, "") ?? "unknown";
      if (!seenProviders.has(key)) {
        seenProviders.add(key);
        lines.push(`  Claude --> hookprov_${sanitizeId(key)}`);
      }
    }
  }
  for (let i = 0; i < result.integrations.length; i++) {
    const integration = result.integrations[i];
    const id = `integ_${i}_${sanitizeId(integration.name)}`;
    lines.push(`  Claude --> ${id}`);
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
  const total =
    result.mcpServers.length +
    result.contextFiles.length +
    result.hooks.length +
    result.integrations.length;

  const errors = [
    ...(result.model.status === "error" ? [{ name: "Model", diagnostics: result.model.diagnostics }] : []),
    ...result.mcpServers.filter((s) => s.status === "error"),
    ...result.hooks.filter((h) => h.status === "error"),
    ...result.integrations.filter((i) => i.status === "error"),
  ];
  const warnings = [
    ...(result.model.status === "warning" ? [{ name: "Model", diagnostics: result.model.diagnostics }] : []),
    ...result.mcpServers.filter((s) => s.status === "warning"),
    ...result.hooks.filter((h) => h.status === "warning"),
    ...result.integrations.filter((i) => i.status === "warning"),
  ];
  const outdated = [
    ...result.mcpServers.filter((s) => s.status === "outdated"),
    ...result.integrations.filter((i) => i.status === "outdated"),
  ];

  const totalContextTokens = result.contextFiles.reduce(
    (sum, f) => sum + f.estimatedTokens,
    0
  );
  let contextStatus: Status = "ok";
  if (result.contextFiles.some((f) => f.status === "error")) contextStatus = "error";
  else if (result.contextFiles.some((f) => f.status === "warning")) contextStatus = "warning";
  const modelLabel = result.model.configured ?? "default (unset)";

  lines.push(`## AI Environment Summary`);
  lines.push("");
  lines.push(`| Category | Value |`);
  lines.push(`|----------|-------|`);
  const modelSuffix = result.model.configured ? ` ${STATUS_ICON[result.model.status]}` : "";
  lines.push(`| Model | ${modelLabel}${modelSuffix} |`);
  lines.push(`| MCP Servers | ${result.mcpServers.length} |`);
  lines.push(`| Context Files | ${result.contextFiles.length} (~${formatTokens(totalContextTokens)}) ${STATUS_ICON[contextStatus]} |`);
  lines.push(`| Hooks | ${result.hooks.length} |`);
  const integrationLabels = result.integrations.map((i) => {
    const icon = i.detected ? STATUS_ICON[i.status] : "➖";
    const detail = i.detail ? ` \`${i.detail}\`` : "";
    return `${i.name}${detail} ${icon}`;
  });
  lines.push(`| Integrations | ${integrationLabels.join(" · ")} |`);
  lines.push(`| Env Vars | ${result.envVarSummary.set}/${result.envVarSummary.total} set |`);
  lines.push("");

  if (errors.length > 0) {
    lines.push(`### ❌ Errors (${errors.length})`);
    lines.push("");
    for (const item of errors) {
      const name = getComponentName(item);
      const diags =
        "diagnostics" in item ? item.diagnostics.join("; ") : "";
      lines.push(`- **${name}**: ${diags}`);
    }
    lines.push("");
  }

  if (warnings.length > 0) {
    lines.push(`### ⚠️ Warnings (${warnings.length})`);
    lines.push("");
    for (const item of warnings) {
      const name = getComponentName(item);
      const diags =
        "diagnostics" in item ? item.diagnostics.join("; ") : "";
      lines.push(`- **${name}**: ${diags}`);
    }
    lines.push("");
  }

  if (outdated.length > 0) {
    lines.push(`### 🔄 Outdated (${outdated.length})`);
    lines.push("");
    for (const item of outdated) {
      const name = getComponentName(item);
      const diags = "diagnostics" in item ? item.diagnostics.join("; ") : "";
      lines.push(`- **${name}**: ${diags}`);
    }
    lines.push("");
  }

  if (errors.length === 0 && warnings.length === 0 && outdated.length === 0) {
    lines.push(
      `> All ${total} components are properly configured. ✅`
    );
    lines.push("");
  }

  return lines.join("\n");
}
