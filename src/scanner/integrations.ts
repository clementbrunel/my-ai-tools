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

function detectMemPalace(mcpServers: McpServer[]): Integration {
  const diagnostics: string[] = [];
  const match = mcpServers.find((s) =>
    /mem.?palace/i.test(s.name) ||
    (s.command ? /mem.?palace/i.test(s.command) : false) ||
    (s.args ? s.args.some((a) => /mem.?palace/i.test(a)) : false)
  );

  if (!match) {
    return {
      name: "MemPalace",
      description: "Long-term memory MCP server",
      detected: false,
      status: "warning",
      diagnostics: ["Not configured as an MCP server in this project"],
    };
  }

  const commandOk = isCommandAvailable("mempalace");
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
  };
}

function detectCaveman(projectPath: string): Integration {
  const skillDir = findSkillDir(projectPath, "caveman");
  const diagnostics: string[] = [];

  if (!skillDir) {
    // Also check case-insensitive match among installed skills
    const skills = listSkills(projectPath);
    const match = skills.find((s) => s.includes("caveman"));
    if (!match) {
      return {
        name: "Caveman",
        description: "Token-reduction skill (concise output)",
        detected: false,
        status: "warning",
        diagnostics: ["Caveman skill not found in ~/.claude/skills or .claude/skills"],
      };
    }
  }

  // Check for SKILL.md or skill.md inside
  let hasSkillFile = false;
  if (skillDir) {
    for (const entry of readdirSync(skillDir)) {
      if (/^skill\.md$/i.test(entry)) {
        hasSkillFile = true;
        break;
      }
    }
    if (!hasSkillFile) {
      diagnostics.push("Skill directory found but no SKILL.md file inside");
    }
  }

  return {
    name: "Caveman",
    description: "Token-reduction skill (concise output)",
    detected: true,
    source: skillDir ?? undefined,
    status: hasSkillFile ? "ok" : "warning",
    diagnostics,
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
    detectMemPalace(mcpServers),
    detectCaveman(absPath),
    detectRtk(absPath, hooks),
  ];
}
