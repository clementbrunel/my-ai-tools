import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import type { Integration, Status } from "../../types.js";
import { isCommandAvailable } from "../../utils.js";

const CODEALMANAC_BASE = {
  name: "CodeAlmanac",
  description: "Codebase wiki maintained by AI agents — plain Markdown in the repo, indexed locally",
} as const;

function fileMentionsCodealmanac(filePath: string): boolean {
  try {
    return /codealmanac/i.test(readFileSync(filePath, "utf-8"));
  } catch {
    return false;
  }
}

function collectCodealmanacSignals(projectPath: string): {
  signals: string[];
  hasWiki: boolean;
  hasSetup: boolean;
} {
  const signals: string[] = [];

  if (isCommandAvailable("codealmanac")) signals.push("binary in PATH");

  // `codealmanac init` scaffolds almanac/ — the directory alone is generic,
  // topics.yaml is the codealmanac-specific marker.
  const topics = join(projectPath, "almanac", "topics.yaml");
  const wikiReadme = join(projectPath, "almanac", "README.md");
  const hasWiki = existsSync(topics) || existsSync(wikiReadme);
  if (existsSync(topics)) signals.push("almanac/topics.yaml");
  else if (existsSync(wikiReadme)) signals.push("almanac/README.md");

  if (existsSync(join(projectPath, ".almanac.yaml"))) {
    signals.push(".almanac.yaml at project root");
  }

  // `codealmanac setup` installs agent instructions into the memory files.
  for (const name of ["CLAUDE.md", "AGENTS.md"]) {
    const p = join(projectPath, name);
    if (existsSync(p) && fileMentionsCodealmanac(p)) signals.push(`referenced in ${name}`);
  }

  const homeConfig = join(homedir(), ".codealmanac", "config.toml");
  const hasSetup = existsSync(homeConfig);
  if (hasSetup) signals.push("~/.codealmanac/config.toml");

  if (existsSync(join(homedir(), ".codealmanac", "codealmanac.db"))) {
    signals.push("~/.codealmanac/codealmanac.db (local index)");
  }

  return { signals, hasWiki, hasSetup };
}

export function detectCodealmanac(projectPath: string): Integration {
  const { signals, hasWiki, hasSetup } = collectCodealmanacSignals(projectPath);

  if (signals.length === 0) {
    return {
      ...CODEALMANAC_BASE,
      detected: false,
      status: "warning",
      diagnostics: [
        "Not detected: no codealmanac binary, no almanac/topics.yaml, no .almanac.yaml, no ~/.codealmanac",
      ],
    };
  }

  const diagnostics: string[] = [];
  let status: Status = "ok";

  if (!isCommandAvailable("codealmanac")) {
    diagnostics.push(
      "'codealmanac' binary not found in PATH — install with 'uv tool install codealmanac@latest'"
    );
    status = "error";
  }
  if (!hasSetup) {
    diagnostics.push(
      "No ~/.codealmanac/config.toml — run 'codealmanac setup' to pick a runner and install the agent instructions"
    );
    if (status === "ok") status = "warning";
  }
  if (!hasWiki) {
    diagnostics.push("No wiki in this project yet — run 'codealmanac init' to scaffold almanac/");
    if (status === "ok") status = "warning";
  }

  return {
    ...CODEALMANAC_BASE,
    detected: true,
    source: signals.join(", "),
    status,
    diagnostics,
  };
}
