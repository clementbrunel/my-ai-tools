import { existsSync, statSync, readdirSync, readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { join, resolve } from "node:path";
import { homedir } from "node:os";
import type { Integration, McpServer, Hook, Status } from "../types.js";

function isCommandAvailable(command: string): boolean {
  try {
    execSync(`which ${command} 2>/dev/null`, { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

function isMemPalaceAvailable(): boolean {
  if (isCommandAvailable("mempalace")) return true;
  try {
    execSync("python -m mempalace --help", { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

function findSkillDir(projectPath: string, skillName: string): string | null {
  const candidates = [
    join(projectPath, ".claude", "skills", skillName),
    join(homedir(), ".claude", "skills", skillName),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate) && statSync(candidate).isDirectory()) {
      return candidate;
    }
  }
  return null;
}

function listSkills(projectPath: string): string[] {
  const skillDirs = [
    join(projectPath, ".claude", "skills"),
    join(homedir(), ".claude", "skills"),
  ];
  const skills = new Set<string>();
  for (const dir of skillDirs) {
    if (existsSync(dir) && statSync(dir).isDirectory()) {
      try {
        for (const entry of readdirSync(dir)) {
          const entryPath = join(dir, entry);
          if (statSync(entryPath).isDirectory()) {
            skills.add(entry.toLowerCase());
          }
        }
      } catch {
        // ignore permission errors
      }
    }
  }
  return [...skills];
}

function detectMemPalace(mcpServers: McpServer[], projectPath: string): Integration {
  const diagnostics: string[] = [];
  const match = mcpServers.find((s) =>
    /mem.?palace/i.test(s.name) ||
    (s.command ? /mem.?palace/i.test(s.command) : false) ||
    (s.args ? s.args.some((a) => /mem.?palace/i.test(a)) : false)
  );

  const wingStats = getMemPalaceWingStats(projectPath);

  if (!match) {
    // Fallback: check enabledPlugins (marketplace-installed MemPalace)
    const pluginResult = detectPlugin(/mem.?palace/i, "mempalace");
    if (pluginResult.detected) {
      const commandOk = isMemPalaceAvailable();
      if (!commandOk) diagnostics.push("'mempalace' binary not found in PATH");
      return {
        name: "MemPalace",
        description: "Long-term memory MCP server",
        detected: true,
        source: `plugin: ${pluginResult.source}`,
        status: commandOk ? "ok" : "warning",
        diagnostics,
        detail: wingStats ?? undefined,
      };
    }
    return {
      name: "MemPalace",
      description: "Long-term memory MCP server",
      detected: false,
      status: "warning",
      diagnostics: ["Not configured as an MCP server or plugin in this project"],
    };
  }

  const commandOk = isMemPalaceAvailable();
  let status: Status = match.status;
  if (!commandOk) {
    diagnostics.push("'mempalace' binary not found in PATH");
    status = "error";
  }
  if (match.status !== "ok") {
    diagnostics.push(...match.diagnostics);
  }

  return {
    name: "MemPalace",
    description: "Long-term memory MCP server",
    detected: true,
    source: match.source,
    status,
    diagnostics,
    detail: wingStats ?? undefined,
  };
}

function getMemPalaceWingStats(projectPath: string): string | null {
  // Wing name = last path segment, lowercase, hyphens→underscores
  const wingName = projectPath.split(/[/\\]/).findLast(Boolean)?.toLowerCase().replaceAll("-", "_") ?? "";
  try {
    const output = execSync("python -m mempalace status", { stdio: "pipe", encoding: "utf-8" });
    const normalized = output.replaceAll("\r\n", "\n");
    const wingMatch = new RegExp(String.raw`WING:\s+${wingName}\s*\n((?:\s+ROOM:.*\n)*)`, "i");
    const match = normalized.match(wingMatch);
    if (!match) return null;
    const roomLines = match[1].trim().split("\n").filter(Boolean);
    let total = 0;
    const rooms: string[] = [];
    for (const line of roomLines) {
      const m = line.match(/ROOM:\s+(\S+)\s+(\d+)\s+drawers?/i);
      if (m) {
        total += Number.parseInt(m[2], 10);
        rooms.push(`${m[1]}:${m[2]}`);
      }
    }
    return `${total} drawers (${rooms.join(", ")})`;
  } catch {
    return null;
  }
}

function detectPlugin(namePattern: RegExp, marketplaceDirName: string): { detected: boolean; source?: string } {
  const settingsPath = join(homedir(), ".claude", "settings.json");
  if (!existsSync(settingsPath)) return { detected: false };
  try {
    const settings = JSON.parse(readFileSync(settingsPath, "utf-8"));
    const enabled = settings.enabledPlugins ?? {};
    const pluginKey = Object.keys(enabled).find((k) => namePattern.test(k));
    if (pluginKey && enabled[pluginKey]) {
      const marketplaceDir = join(homedir(), ".claude", "plugins", "marketplaces", marketplaceDirName);
      const source = existsSync(marketplaceDir) ? marketplaceDir : pluginKey;
      return { detected: true, source };
    }
  } catch {
    // ignore parse errors
  }
  return { detected: false };
}

function detectCavemanPlugin(): { detected: boolean; source?: string } {
  return detectPlugin(/caveman/i, "caveman");
}

function hasSkillMd(dir: string): boolean {
  return readdirSync(dir).some((e: string) => /^skill\.md$/i.test(e));
}

function readCavemanLevel(): string | undefined {
  const flagPath = join(homedir(), ".claude", ".caveman-active");
  if (!existsSync(flagPath)) return undefined;
  try {
    const level = readFileSync(flagPath, "utf-8").trim();
    return level || undefined;
  } catch {
    return undefined;
  }
}

function detectCavemanViaPlugin(): Integration | null {
  const pluginResult = detectCavemanPlugin();
  if (!pluginResult.detected) return null;

  const marketplaceDir = pluginResult.source ?? "";
  const skillsDir = join(marketplaceDir, "skills", "caveman");
  const ok = existsSync(skillsDir) && hasSkillMd(skillsDir);
  return {
    name: "Caveman",
    description: "Token-reduction skill (concise output)",
    detected: true,
    source: `plugin: ${pluginResult.source}`,
    status: ok ? "ok" : "warning",
    diagnostics: ok ? [] : ["Plugin installed but SKILL.md not found in skills/caveman/"],
    detail: readCavemanLevel(),
  };
}

function detectCavemanViaSkillDir(skillDir: string): Integration {
  const ok = hasSkillMd(skillDir);
  return {
    name: "Caveman",
    description: "Token-reduction skill (concise output)",
    detected: true,
    source: skillDir,
    status: ok ? "ok" : "warning",
    diagnostics: ok ? [] : ["Skill directory found but no SKILL.md file inside"],
    detail: readCavemanLevel(),
  };
}

function detectCaveman(projectPath: string): Integration {
  const fromPlugin = detectCavemanViaPlugin();
  if (fromPlugin) return fromPlugin;

  const skillDir = findSkillDir(projectPath, "caveman");
  if (skillDir) return detectCavemanViaSkillDir(skillDir);

  const match = listSkills(projectPath).find((s) => s.includes("caveman"));
  if (match) return detectCavemanViaSkillDir(match);

  return {
    name: "Caveman",
    description: "Token-reduction skill (concise output)",
    detected: false,
    status: "warning",
    diagnostics: ["Caveman skill not found in ~/.claude/skills, .claude/skills, or enabledPlugins"],
  };
}

function collectRtkSignals(
  projectPath: string,
  hooks: Hook[]
): { signals: string[]; rtkHook: Hook | undefined; claudeMdConfigured: boolean } {
  const signals: string[] = [];

  if (isCommandAvailable("rtk")) signals.push("binary in PATH");

  const rtkMdCandidates = [
    join(projectPath, "RTK.md"),
    join(homedir(), ".claude", "RTK.md"),
    join(homedir(), "RTK.md"),
  ];
  const rtkMd = rtkMdCandidates.find((p) => existsSync(p));
  if (rtkMd) signals.push(`RTK.md at ${rtkMd}`);

  const rtkHook = hooks.find((h) => /\brtk\b/i.test(h.command));
  if (rtkHook) signals.push(`hook: ${rtkHook.event}`);

  const claudeMdCandidates = [
    join(projectPath, "CLAUDE.md"),
    join(homedir(), ".claude", "CLAUDE.md"),
  ];
  let claudeMdConfigured = false;
  for (const p of claudeMdCandidates) {
    if (existsSync(p) && fileContainsRtk(p)) {
      signals.push(`referenced in ${p}`);
      claudeMdConfigured = true;
    }
  }

  const settingsPath = join(projectPath, ".claude", "settings.json");
  if (!rtkHook && existsSync(settingsPath) && fileContainsRtk(settingsPath)) {
    signals.push("referenced in .claude/settings.json");
  }

  return { signals, rtkHook, claudeMdConfigured };
}

function fileContainsRtk(filePath: string): boolean {
  try {
    return /\brtk\b/i.test(readFileSync(filePath, "utf-8"));
  } catch {
    return false;
  }
}

function detectRtk(projectPath: string, hooks: Hook[]): Integration {
  const base = {
    name: "RTK (Rust Token Killer)",
    description: "CLI proxy that compresses command output to save tokens",
  };

  const { signals, rtkHook, claudeMdConfigured } = collectRtkSignals(projectPath, hooks);

  if (signals.length === 0) {
    return {
      ...base,
      detected: false,
      status: "warning",
      diagnostics: ["Not detected: no rtk binary, no RTK.md, no rtk hook"],
    };
  }

  const diagnostics: string[] = [];
  let status: Status = "ok";

  if (!isCommandAvailable("rtk")) {
    diagnostics.push("'rtk' binary not found in PATH");
    status = "error";
  }
  // A hook is optional when RTK is configured via CLAUDE.md (the standard approach)
  if (!rtkHook && !claudeMdConfigured) {
    diagnostics.push("No RTK hook configured — integration may be incomplete");
    if (status === "ok") status = "warning";
  }

  return {
    ...base,
    detected: true,
    source: signals.join(", "),
    status,
    diagnostics,
  };
}

export function scanIntegrations(
  projectPath: string,
  mcpServers: McpServer[],
  hooks: Hook[]
): Integration[] {
  const absPath = resolve(projectPath);
  return [
    detectMemPalace(mcpServers, absPath),
    detectCaveman(absPath),
    detectRtk(absPath, hooks),
  ];
}
