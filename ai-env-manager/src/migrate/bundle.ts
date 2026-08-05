import type { ScanResult, McpServer, Integration, ContextFile, Hook } from "../types.js";
import type { YamlValue } from "./yaml.js";
import { toYaml } from "./yaml.js";

export const BUNDLE_VERSION = "1.0";

export interface MigrationFile {
  /** File name relative to the target directory. */
  name: string;
  content: string;
}

export interface MigrationStats {
  mcpServers: number;
  skills: number;
  contextFiles: number;
}

export interface NotMigratedItem {
  item: string;
  reason: string;
}

export interface Migration {
  files: MigrationFile[];
  stats: MigrationStats;
  /** Things that migrated but need a human look before use. */
  needsReview: string[];
  /** Things deliberately left behind, with the reason why. */
  notMigrated: NotMigratedItem[];
}

export interface MigrationOptions {
  targetDir: string;
  /** Injected so the output is deterministic in tests. */
  generatedAt?: string;
}

/** Turns a display name into a stable YAML key: "RTK (Rust Token Killer)" → "rtk-rust-token-killer". */
export function slugify(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "unnamed";
}

/**
 * Env var *values* are never read by the scanner — only names — so the migration
 * emits shell-style placeholders. Secrets stay in the environment, never in the
 * generated YAML.
 */
function envPlaceholders(server: McpServer): Record<string, string> | undefined {
  if (server.envVars.length === 0) return undefined;
  return Object.fromEntries(server.envVars.map((e) => [e.name, `\${${e.name}}`]));
}

function mcpEntry(server: McpServer): YamlValue {
  return {
    transport: server.type,
    command: server.command,
    args: server.args && server.args.length > 0 ? server.args : undefined,
    url: server.url,
    env: envPlaceholders(server),
    source: server.source,
    claude_status: server.status,
    notes: server.diagnostics.length > 0 ? server.diagnostics : undefined,
  };
}

function skillEntry(integration: Integration): YamlValue {
  return {
    enabled: true,
    description: integration.description,
    origin: "claude-code-integration",
    source: integration.source,
    detail: integration.detail,
  };
}

function contextEntry(file: ContextFile): YamlValue {
  return {
    path: file.path,
    scope: file.scope,
    estimated_tokens: file.estimatedTokens,
    size_bytes: file.sizeBytes,
  };
}

/** Uniquifies map keys so two sources with the same name don't silently overwrite each other. */
function uniqueKey(taken: Set<string>, base: string): string {
  if (!taken.has(base)) {
    taken.add(base);
    return base;
  }
  let n = 2;
  while (taken.has(`${base}-${n}`)) n += 1;
  const key = `${base}-${n}`;
  taken.add(key);
  return key;
}

function hookLabel(hook: Hook): string {
  return `${hook.event}${hook.matcher ? ` (${hook.matcher})` : ""}`;
}

export function buildMigration(result: ScanResult, options: MigrationOptions): Migration {
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const needsReview: string[] = [];
  const notMigrated: NotMigratedItem[] = [];

  // --- MCP servers ---
  const mcpKeys = new Set<string>();
  const mcps: Record<string, YamlValue> = {};
  for (const server of result.mcpServers) {
    mcps[uniqueKey(mcpKeys, slugify(server.name))] = mcpEntry(server);
    if (server.status === "error") {
      needsReview.push(
        `MCP "${server.name}" is broken in Claude Code (${server.diagnostics[0] ?? "unknown error"}) — it was migrated as-is`
      );
    }
    const missing = server.envVars.filter((e) => !e.isSet).map((e) => e.name);
    if (missing.length > 0) {
      needsReview.push(`MCP "${server.name}": set ${missing.join(", ")} in the Mistral environment`);
    }
  }

  // --- Skills (detected integrations) ---
  const skillKeys = new Set<string>();
  const skills: Record<string, YamlValue> = {};
  for (const integration of result.integrations.filter((i) => i.detected)) {
    skills[uniqueKey(skillKeys, slugify(integration.name))] = skillEntry(integration);
    needsReview.push(
      `Skill "${integration.name}" is a Claude Code integration — check it has a Mistral equivalent before relying on it`
    );
  }

  // --- Context files ---
  const contextFiles = result.contextFiles.filter((f) => f.exists);

  // --- Hooks: no Mistral equivalent, recorded rather than dropped silently ---
  for (const hook of result.hooks) {
    notMigrated.push({
      item: `hook ${hookLabel(hook)}`,
      reason: "Claude Code hooks have no Mistral equivalent — re-implement manually if needed",
    });
  }
  if (result.model.configured) {
    needsReview.push(
      `Model "${result.model.configured}" is an Anthropic model — pick a Mistral model in config.yaml`
    );
  }

  const stats: MigrationStats = {
    mcpServers: Object.keys(mcps).length,
    skills: Object.keys(skills).length,
    contextFiles: contextFiles.length,
  };

  const provenance = [
    "Generated by ai-env-manager migrate — do not edit by hand, re-run the command instead.",
    `Source project: ${result.projectPath}`,
    `Generated at: ${generatedAt}`,
  ];

  const config: YamlValue = {
    version: BUNDLE_VERSION,
    migration: {
      source: "claude-code",
      generated_by: "ai-env-manager",
      generated_at: generatedAt,
      project: result.projectPath,
    },
    settings: {
      model: {
        claude_model: result.model.configured,
        source: result.model.source,
        mistral_model: null,
      },
      context: contextFiles.map(contextEntry),
    },
  };

  const files: MigrationFile[] = [
    { name: "config.yaml", content: toYaml(config, provenance) },
    { name: "mcps.yaml", content: toYaml({ mcps }, provenance) },
    { name: "skills.yaml", content: toYaml({ skills }, provenance) },
  ];

  const report: YamlValue = {
    migration_report: {
      generated_at: generatedAt,
      source_project: result.projectPath,
      target_dir: options.targetDir,
      statistics: {
        mcp_servers: stats.mcpServers,
        skills: stats.skills,
        context_files: stats.contextFiles,
        hooks_not_migrated: result.hooks.length,
      },
      files_created: [...files.map((f) => f.name), "migration_report.yaml"],
      needs_review: needsReview,
      not_migrated: notMigrated.map((n) => ({ item: n.item, reason: n.reason })),
      notes: [
        "Environment variables are emitted as ${NAME} placeholders — no secret value is written to disk.",
        "This migration preserves structure, not behaviour: review every file before production use.",
      ],
    },
  };

  files.push({ name: "migration_report.yaml", content: toYaml(report, provenance) });

  return { files, stats, needsReview, notMigrated };
}
