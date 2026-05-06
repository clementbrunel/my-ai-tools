import type { ScanResult, Status } from "../types.js";

const STATUS_ICON: Record<Status, string> = {
  ok: "✅",
  warning: "⚠️",
  error: "❌",
};

function sanitizeId(name: string): string {
  return name.replace(/[^a-zA-Z0-9]/g, "_");
}

function escapeLabel(text: string): string {
  return text.replace(/"/g, "#quot;");
}

function formatTokens(tokens: number): string {
  if (tokens < 1000) return `${tokens}t`;
  return `${(tokens / 1000).toFixed(1)}kt`;
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
    : `default (unset) ${modelIcon}`;
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

      lines.push(`    ${id}["${label}"]:::${server.status}`);
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
      const shortPath = ctx.path.replace(/^.*\//, "");
      const sizeKb = (ctx.sizeBytes / 1024).toFixed(1);
      const tokens = formatTokens(ctx.estimatedTokens);
      const label = `${shortPath} ✅<br/><small>${ctx.scope} · ${sizeKb}KB · ~${tokens}</small>`;
      lines.push(`    ${id}["${label}"]:::ok`);
    }

    lines.push("  end");
    lines.push("");
  }

  // --- Hooks ---
  if (result.hooks.length > 0) {
    // Group by MCP server; hooks without a server go into the generic list
    const mcpGroups = new Map<string, { hook: (typeof result.hooks)[0]; idx: number }[]>();
    const genericHooks: { hook: (typeof result.hooks)[0]; idx: number }[] = [];

    result.hooks.forEach((hook, i) => {
      if (hook.mcpServer) {
        const group = mcpGroups.get(hook.mcpServer) ?? [];
        group.push({ hook, idx: i });
        mcpGroups.set(hook.mcpServer, group);
      } else {
        genericHooks.push({ hook, idx: i });
      }
    });

    lines.push("  subgraph Hooks[Hooks]");

    // One nested subgraph per MCP server
    for (const [server, entries] of mcpGroups) {
      const subId = sanitizeId(server);
      lines.push(`    subgraph HooksMcp_${subId}[🔌 ${server}]`);
      for (const { hook, idx } of entries) {
        const id = `hook_${idx}_${sanitizeId(hook.event)}`;
        const icon = STATUS_ICON[hook.status];
        let label = `${hook.event} ${icon}`;
        if (hook.mcpTool && hook.mcpTool !== "*") {
          label += `<br/><small>tool: ${escapeLabel(hook.mcpTool)}</small>`;
        } else if (hook.mcpTool === "*") {
          label += `<br/><small>all tools</small>`;
        }
        if (hook.diagnostics.length > 0) {
          const diag = hook.diagnostics.slice(0, 1).map((d) => escapeLabel(d)).join("<br/>");
          label += `<br/><i>${diag}</i>`;
        }
        lines.push(`      ${id}["${label}"]:::${hook.status}`);
      }
      lines.push(`    end`);
    }

    // Generic (non-MCP) hooks
    for (const { hook, idx } of genericHooks) {
      const id = `hook_${idx}_${sanitizeId(hook.event)}`;
      const icon = STATUS_ICON[hook.status];
      let label = `${hook.event} ${icon}`;
      if (hook.matcher && hook.matcher !== "*") {
        label += `<br/><small>matcher: ${escapeLabel(hook.matcher)}</small>`;
      }
      if (hook.diagnostics.length > 0) {
        const diag = hook.diagnostics.slice(0, 1).map((d) => escapeLabel(d)).join("<br/>");
        label += `<br/><i>${diag}</i>`;
      }
      lines.push(`    ${id}["${label}"]:::${hook.status}`);
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
  }
  for (const ctx of existingContextFiles) {
    const id = `ctx_${sanitizeId(ctx.path)}`;
    lines.push(`  Claude --> ${id}`);
  }
  for (let i = 0; i < result.hooks.length; i++) {
    const hook = result.hooks[i];
    const id = `hook_${i}_${sanitizeId(hook.event)}`;
    lines.push(`  Claude --> ${id}`);
    if (hook.mcpServer && result.mcpServers.some((s) => s.name === hook.mcpServer)) {
      lines.push(`  ${id} --> mcp_${sanitizeId(hook.mcpServer)}`);
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

  const totalContextTokens = result.contextFiles.reduce(
    (sum, f) => sum + f.estimatedTokens,
    0
  );
  const modelLabel = result.model.configured ?? "default (unset)";

  lines.push(`## AI Environment Summary`);
  lines.push("");
  lines.push(`| Category | Value |`);
  lines.push(`|----------|-------|`);
  lines.push(`| Model | ${modelLabel} ${STATUS_ICON[result.model.status]} |`);
  lines.push(`| MCP Servers | ${result.mcpServers.length} |`);
  lines.push(`| Context Files | ${result.contextFiles.length} (~${formatTokens(totalContextTokens)}) |`);
  lines.push(`| Hooks | ${result.hooks.length} |`);
  lines.push(`| Integrations | ${result.integrations.filter((i) => i.detected).length}/${result.integrations.length} detected |`);
  lines.push(`| Env Vars | ${result.envVarSummary.set}/${result.envVarSummary.total} set |`);
  lines.push("");

  if (errors.length > 0) {
    lines.push(`### ❌ Errors (${errors.length})`);
    lines.push("");
    for (const item of errors) {
      const name = "name" in item ? item.name : item.event;
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
      const name = "name" in item ? item.name : item.event;
      const diags =
        "diagnostics" in item ? item.diagnostics.join("; ") : "";
      lines.push(`- **${name}**: ${diags}`);
    }
    lines.push("");
  }

  if (errors.length === 0 && warnings.length === 0) {
    lines.push(
      `> All ${total} components are properly configured. ✅`
    );
    lines.push("");
  }

  return lines.join("\n");
}
