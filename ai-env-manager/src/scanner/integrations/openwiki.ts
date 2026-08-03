import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import type { Integration, Status } from "../../types.js";
import { isCommandAvailable } from "../../utils.js";

const OPENWIKI_BASE = {
  name: "OpenWiki",
  description: "CLI that generates and maintains a Markdown wiki of the codebase, read by agents as memory",
} as const;

// Any one of these lets openwiki call an LLM; ~/.openwiki/.env can hold them too.
const PROVIDER_ENV_VARS = [
  "ANTHROPIC_API_KEY",
  "OPENAI_API_KEY",
  "GEMINI_API_KEY",
  "OPENROUTER_API_KEY",
];

function fileMentionsOpenwiki(filePath: string): boolean {
  try {
    return /openwiki/i.test(readFileSync(filePath, "utf-8"));
  } catch {
    return false;
  }
}

function collectOpenwikiSignals(projectPath: string): {
  signals: string[];
  hasWiki: boolean;
  hasCredentials: boolean;
} {
  const signals: string[] = [];

  if (isCommandAvailable("openwiki")) signals.push("binary in PATH");

  // Generated wiki: the directory alone is generic, INSTRUCTIONS.md is openwiki-specific.
  const wikiInstructions = join(projectPath, "openwiki", "INSTRUCTIONS.md");
  const wikiLangsmith = join(projectPath, "openwiki", ".langsmith.json");
  const hasWiki = existsSync(wikiInstructions) || existsSync(wikiLangsmith);
  if (existsSync(wikiInstructions)) signals.push("openwiki/INSTRUCTIONS.md");
  if (existsSync(wikiLangsmith)) signals.push("openwiki/.langsmith.json");

  if (existsSync(join(projectPath, ".openwikiignore"))) {
    signals.push(".openwikiignore at project root");
  }

  const workflow = join(projectPath, ".github", "workflows", "openwiki-update.yml");
  if (existsSync(workflow)) signals.push(".github/workflows/openwiki-update.yml");

  // openwiki rewrites a pointer section into the agent memory files.
  for (const name of ["CLAUDE.md", "AGENTS.md"]) {
    const p = join(projectPath, name);
    if (existsSync(p) && fileMentionsOpenwiki(p)) signals.push(`referenced in ${name}`);
  }

  const homeEnv = join(homedir(), ".openwiki", ".env");
  const hasHomeEnv = existsSync(homeEnv);
  if (hasHomeEnv) signals.push("~/.openwiki/.env");

  if (existsSync(join(homedir(), ".openwiki", "wiki"))) {
    signals.push("~/.openwiki/wiki (personal mode)");
  }

  const hasCredentials =
    hasHomeEnv || PROVIDER_ENV_VARS.some((v) => (process.env[v] ?? "").length > 0);

  return { signals, hasWiki, hasCredentials };
}

export function detectOpenwiki(projectPath: string): Integration {
  const { signals, hasWiki, hasCredentials } = collectOpenwikiSignals(projectPath);

  if (signals.length === 0) {
    return {
      ...OPENWIKI_BASE,
      detected: false,
      status: "warning",
      diagnostics: [
        "Not detected: no openwiki binary, no openwiki/INSTRUCTIONS.md, no .openwikiignore, no ~/.openwiki",
      ],
    };
  }

  const diagnostics: string[] = [];
  let status: Status = "ok";

  if (!isCommandAvailable("openwiki")) {
    diagnostics.push("'openwiki' binary not found in PATH — install with 'npm install -g openwiki'");
    status = "error";
  }
  if (!hasWiki) {
    diagnostics.push("No wiki generated yet — run 'openwiki --init' to build openwiki/");
    if (status === "ok") status = "warning";
  }
  if (!hasCredentials) {
    diagnostics.push(
      `No LLM provider credentials found (~/.openwiki/.env or one of ${PROVIDER_ENV_VARS.join(", ")})`
    );
    if (status === "ok") status = "warning";
  }

  return {
    ...OPENWIKI_BASE,
    detected: true,
    source: signals.join(", "),
    status,
    diagnostics,
  };
}
