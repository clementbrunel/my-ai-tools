import { existsSync, statSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import type { Integration } from "../../types.js";
import { detectPlugin } from "../../utils.js";

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
  const pluginResult = detectPlugin(/caveman/i, "caveman");
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

export function detectCaveman(projectPath: string): Integration {
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
