import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import type { Integration, Hook, Status } from "../../types.js";
import { isCommandAvailable } from "../../utils.js";

function fileContainsRtk(filePath: string): boolean {
  try {
    return /\brtk\b/i.test(readFileSync(filePath, "utf-8"));
  } catch {
    return false;
  }
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

export function detectRtk(projectPath: string, hooks: Hook[]): Integration {
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
