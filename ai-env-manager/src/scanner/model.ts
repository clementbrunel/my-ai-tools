import { join, resolve } from "node:path";
import { homedir } from "node:os";
import type { ModelInfo, Status } from "../types.js";
import { parseJsonFile } from "../utils.js";

interface SettingsFile {
  model?: string;
}

export function scanModel(projectPath: string): ModelInfo {
  const absPath = resolve(projectPath);
  let configured: string | null = null;
  let source: string | null = null;

  // 1. Project-level .claude/settings.json
  const projectSettings = parseJsonFile<SettingsFile>(
    join(absPath, ".claude", "settings.json")
  );
  if (projectSettings?.model) {
    configured = projectSettings.model;
    source = ".claude/settings.json";
  }

  // 2. User-level ~/.claude/settings.json (only if not set at project level)
  if (!configured) {
    const userSettings = parseJsonFile<SettingsFile>(
      join(homedir(), ".claude", "settings.json")
    );
    if (userSettings?.model) {
      configured = userSettings.model;
      source = "~/.claude/settings.json";
    }
  }

  // 3. Environment variable
  if (!configured && process.env.ANTHROPIC_MODEL) {
    configured = process.env.ANTHROPIC_MODEL;
    source = "ANTHROPIC_MODEL env var";
  }

  const isSonnet = configured !== null && /sonnet/i.test(configured);
  const diagnostics: string[] = [];
  let status: Status;

  if (configured === null) {
    status = "ok";
    diagnostics.push(
      "No model explicitly configured (will use Claude Code default)"
    );
  } else if (isSonnet) {
    status = "ok";
  } else {
    status = "error";
    diagnostics.push(`Configured model is '${configured}', expected sonnet`);
  }

  return { configured, source, isSonnet, status, diagnostics };
}
