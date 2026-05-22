import { execSync } from "node:child_process";
import { join, resolve } from "node:path";
import { homedir } from "node:os";
import type { McpServer, EnvVarCheck, Status } from "../types.js";
import { parseJsonFile, isCommandAvailable, isApiKeyPattern } from "../utils.js";

interface McpServerConfig {
  command?: string;
  args?: string[];
  url?: string;
  type?: string;
  env?: Record<string, string>;
}

interface McpJsonFile {
  mcpServers?: Record<string, McpServerConfig>;
}

interface ClaudeSettingsFile {
  mcpServers?: Record<string, McpServerConfig>;
}

function extractNpmPackage(config: McpServerConfig): string | undefined {
  if (config.command !== "npx") return undefined;
  const args = config.args ?? [];
  // Skip npx flags (-y, --yes, --no-install, etc.)
  const pkg = args.find((a) => !a.startsWith("-"));
  if (!pkg) return undefined;
  // Strip version pin: @scope/name@1.2.3 → @scope/name | name@1.2.3 → name
  if (pkg.startsWith("@")) {
    const rest = pkg.slice(1); // "scope/name[@version]"
    const atIdx = rest.indexOf("@");
    return atIdx === -1 ? pkg : `@${rest.slice(0, atIdx)}`;
  }
  return pkg.split("@")[0];
}

function isDockerMcpGateway(config: McpServerConfig): boolean {
  return (
    config.command === "docker" &&
    Array.isArray(config.args) &&
    config.args[0] === "mcp" &&
    config.args[1] === "gateway" &&
    config.args[2] === "run"
  );
}

function parseDockerMcpTableNames(output: string): string[] {
  const results: string[] = [];
  let pastHeader = false;
  for (const line of output.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    // The NAME header row marks the start of data rows
    if (/^NAME\b/.test(trimmed)) {
      pastHeader = true;
      continue;
    }
    if (!pastHeader) continue;
    // Stop at footer lines (tips, blank separators)
    if (/^Tip:/i.test(trimmed)) break;
    // First whitespace-delimited token is the server name
    const name = trimmed.split(/\s+/)[0];
    if (name) results.push(name);
  }
  return results;
}

function getDockerMcpSubServers(): string[] {
  try {
    const output = execSync("docker mcp server list 2>/dev/null", { stdio: "pipe" }).toString();
    return parseDockerMcpTableNames(output);
  } catch {
    return [];
  }
}

function checkEnvVars(
  envConfig: Record<string, string> | undefined
): EnvVarCheck[] {
  if (!envConfig) return [];
  return Object.keys(envConfig).map((name) => ({
    name,
    isSet: process.env[name] !== undefined,
    isApiKey: isApiKeyPattern(name),
  }));
}

function determineStatus(
  server: Omit<McpServer, "status" | "diagnostics">
): { status: Status; diagnostics: string[] } {
  const diagnostics: string[] = [];

  // Check command availability for stdio servers
  if (server.type === "stdio" && server.commandAvailable === false) {
    diagnostics.push(`Command '${server.command}' not found in PATH`);
  }

  // Check missing env vars
  const missingEnv = server.envVars.filter((e) => !e.isSet);
  const missingKeys = missingEnv.filter((e) => e.isApiKey);
  const missingOther = missingEnv.filter((e) => !e.isApiKey);

  for (const key of missingKeys) {
    diagnostics.push(`Missing API key: ${key.name}`);
  }
  for (const env of missingOther) {
    diagnostics.push(`Missing env var: ${env.name}`);
  }

  let status: Status = "ok";
  if (missingKeys.length > 0 || server.commandAvailable === false) {
    status = "error";
  } else if (missingOther.length > 0) {
    status = "warning";
  }

  return { status, diagnostics };
}

function parseServersFromConfig(
  servers: Record<string, McpServerConfig>,
  source: string
): McpServer[] {
  return Object.entries(servers).map(([name, config]) => {
    const type: "stdio" | "sse" | "unknown" = config.url
      ? "sse"
      : config.command
        ? "stdio"
        : "unknown";
    const commandAvailable =
      type === "stdio" && config.command
        ? isCommandAvailable(config.command)
        : null;
    const envVars = checkEnvVars(config.env);

    const subServers = isDockerMcpGateway(config) ? getDockerMcpSubServers() : undefined;

    const npmPackage = extractNpmPackage(config);

    const partial = {
      name,
      source,
      type,
      command: config.command,
      args: config.args,
      url: config.url,
      envVars,
      commandAvailable,
      subServers,
      npmPackage,
    };

    const { status, diagnostics } = determineStatus(partial);

    return { ...partial, status, diagnostics } as McpServer;
  });
}

function getClaudeDesktopConfigPath(): string | null {
  const p = process.platform;
  const home = homedir();
  if (p === "win32") {
    const appData = process.env.APPDATA ?? join(home, "AppData", "Roaming");
    return join(appData, "Claude", "claude_desktop_config.json");
  }
  if (p === "darwin") {
    return join(home, "Library", "Application Support", "Claude", "claude_desktop_config.json");
  }
  // Linux
  const configHome = process.env.XDG_CONFIG_HOME ?? join(home, ".config");
  return join(configHome, "Claude", "claude_desktop_config.json");
}

export function scanMcpServers(projectPath: string): McpServer[] {
  const absPath = resolve(projectPath);
  const desktopConfigPath = getClaudeDesktopConfigPath();

  const sources: [string, string][] = [
    [join(absPath, ".mcp.json"),                    ".mcp.json"],
    [join(absPath, ".claude", "settings.json"),     ".claude/settings.json"],
    [join(homedir(), ".claude", "settings.json"),   "~/.claude/settings.json"],
    ...(desktopConfigPath ? [[desktopConfigPath, "claude_desktop_config.json"] as [string, string]] : []),
  ];

  return sources.flatMap(([path, label]) => {
    const cfg = parseJsonFile<McpJsonFile & ClaudeSettingsFile>(path);
    return cfg?.mcpServers ? parseServersFromConfig(cfg.mcpServers, label) : [];
  });
}
