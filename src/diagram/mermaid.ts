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

export function generateMermaid(result: ScanResult): string {
  const lines: string[] = [];

  lines.push("```mermaid");
  lines.push("graph LR");
  lines.push("");
  lines.push('  Claude["🤖 Claude Code"]');
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
      const label = `${shortPath} ✅<br/><small>${ctx.scope} · ${sizeKb}KB</small>`;
      lines.push(`    ${id}["${label}"]:::ok`);
    }

    lines.push("  end");
    lines.push("");
  }

  // --- Hooks ---
  if (result.hooks.length > 0) {
    lines.push("  subgraph Hooks[Hooks]");

    for (let i = 0; i < result.hooks.length; i++) {
      const hook = result.hooks[i];
      const id = `hook_${i}_${sanitizeId(hook.event)}`;
      const icon = STATUS_ICON[hook.status];
      let label = `${hook.event} ${icon}`;

      if (hook.matcher && hook.matcher !== "*") {
        label += `<br/><small>matcher: ${escapeLabel(hook.matcher)}</small>`;
      }

      if (hook.diagnostics.length > 0) {
        const diag = hook.diagnostics
          .slice(0, 1)
          .map((d) => escapeLabel(d))
          .join("<br/>");
        label += `<br/><i>${diag}</i>`;
      }

      lines.push(`    ${id}["${label}"]:::${hook.status}`);
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
    result.hooks.length;

  const errors = [
    ...result.mcpServers.filter((s) => s.status === "error"),
    ...result.hooks.filter((h) => h.status === "error"),
  ];
  const warnings = [
    ...result.mcpServers.filter((s) => s.status === "warning"),
    ...result.hooks.filter((h) => h.status === "warning"),
  ];

  lines.push(`## AI Environment Summary`);
  lines.push("");
  lines.push(`| Category | Count |`);
  lines.push(`|----------|-------|`);
  lines.push(`| MCP Servers | ${result.mcpServers.length} |`);
  lines.push(`| Context Files | ${result.contextFiles.length} |`);
  lines.push(`| Hooks | ${result.hooks.length} |`);
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
