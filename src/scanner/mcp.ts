import { readFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { join, resolve } from "node:path";
import { homedir } from "node:os";
import type { McpServer, EnvVarCheck, Status } from "../types.js";

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

function parseJsonFile<T>(filePath: string): T | null {
  try {
    if (!existsSync(filePath)) return null;
    const content = readFileSync(filePath, "utf-8");
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}

function isCommandAvailable(command: string): boolean {
  try {
    execSync(`which ${command} 2>/dev/null`, { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

function isApiKeyPattern(name: string): boolean {
  const upper = name.toUpperCase();
  return (
    upper.endsWith("_API_KEY") ||
    upper.endsWith("_TOKEN") ||
    upper.endsWith("_SECRET") ||
    upper.endsWith("_KEY") ||
    upper.endsWith("_PASSWORD") ||
    upper.includes("API_KEY") ||
    upper.includes("AUTH")
  );
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

    const partial = {
      name,
      source,
      type,
      command: config.command,
      args: config.args,
      url: config.url,
      envVars,
      commandAvailable,
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
  const results: McpServer[] = [];
  const absPath = resolve(projectPath);

  // 1. Project-level .mcp.json
  const mcpJsonPath = join(absPath, ".mcp.json");
  const mcpJson = parseJsonFile<McpJsonFile>(mcpJsonPath);
  if (mcpJson?.mcpServers) {
    results.push(
      ...parseServersFromConfig(mcpJson.mcpServers, `.mcp.json`)
    );
  }

  // 2. Project-level .claude/settings.json
  const projectSettingsPath = join(absPath, ".claude", "settings.json");
  const projectSettings = parseJsonFile<ClaudeSettingsFile>(projectSettingsPath);
  if (projectSettings?.mcpServers) {
    results.push(
      ...parseServersFromConfig(
        projectSettings.mcpServers,
        `.claude/settings.json`
      )
    );
  }

  // 3. User-level ~/.claude/settings.json
  const userSettingsPath = join(homedir(), ".claude", "settings.json");
  const userSettings = parseJsonFile<ClaudeSettingsFile>(userSettingsPath);
  if (userSettings?.mcpServers) {
    results.push(
      ...parseServersFromConfig(
        userSettings.mcpServers,
        `~/.claude/settings.json`
      )
    );
  }

  // 4. Claude Desktop config (shared by Desktop app and VSCode extension)
  const desktopConfigPath = getClaudeDesktopConfigPath();
  if (desktopConfigPath) {
    const desktopConfig = parseJsonFile<McpJsonFile>(desktopConfigPath);
    if (desktopConfig?.mcpServers) {
      results.push(
        ...parseServersFromConfig(
          desktopConfig.mcpServers,
          `claude_desktop_config.json`
        )
      );
    }
  }

  return results;
}
