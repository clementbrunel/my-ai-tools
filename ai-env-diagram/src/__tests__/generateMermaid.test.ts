import { describe, it, expect } from "vitest";
import { generateMermaid } from "../diagram/mermaid.js";
import type { ScanResult } from "../types.js";

function makeResult(overrides: Partial<ScanResult> = {}): ScanResult {
  return {
    projectPath: "/fake/project",
    model: {
      configured: null,
      source: null,
      isSonnet: false,
      status: "ok",
      diagnostics: [],
    },
    mcpServers: [],
    contextFiles: [],
    hooks: [],
    integrations: [],
    envVarSummary: { total: 0, set: 0, missing: 0, missingList: [], setList: [] },
    ...overrides,
  };
}

describe("generateMermaid", () => {
  it("outputs a mermaid code block", () => {
    const out = generateMermaid(makeResult());
    expect(out).toContain("```mermaid");
    expect(out).toContain("graph LR");
    expect(out).toContain("Claude[");
  });

  it("includes MCP server node", () => {
    const out = generateMermaid(
      makeResult({
        mcpServers: [
          {
            name: "github",
            source: "~/.claude/claude_desktop_config.json",
            type: "stdio",
            command: "npx",
            args: ["-y", "@modelcontextprotocol/server-github"],
            envVars: [],
            commandAvailable: true,
            status: "ok",
            diagnostics: [],
          },
        ],
      })
    );
    expect(out).toContain("mcp_github");
    expect(out).toContain("subgraph MCP_Servers");
  });

  it("groups MCP hooks into nested subgraph", () => {
    const out = generateMermaid(
      makeResult({
        mcpServers: [
          {
            name: "github",
            source: "~/.claude/claude_desktop_config.json",
            type: "stdio",
            command: "npx",
            args: [],
            envVars: [],
            commandAvailable: true,
            status: "ok",
            diagnostics: [],
          },
        ],
        hooks: [
          {
            event: "PreToolUse",
            matcher: "mcp__github__search_repositories",
            mcpServer: "github",
            mcpTool: "search_repositories",
            type: "command",
            command: "echo hi",
            source: ".claude/settings.json",
            scriptExists: null,
            status: "ok",
            diagnostics: [],
          },
        ],
      })
    );
    // Provider node for "echo" command
    expect(out).toContain("hookprov_echo");
    expect(out).toContain("subgraph Hooks");
  });

  it("renders generic hooks without MCP subgraph", () => {
    const out = generateMermaid(
      makeResult({
        hooks: [
          {
            event: "SessionStart",
            matcher: "*",
            mcpServer: undefined,
            mcpTool: undefined,
            type: "command",
            command: "echo start",
            source: ".claude/settings.json",
            scriptExists: null,
            status: "ok",
            diagnostics: [],
          },
        ],
      })
    );
    // Provider node for "echo" command
    expect(out).toContain("hookprov_echo");
    expect(out).toContain("1 hooks");
  });

  it("shows warning status on context file node", () => {
    const out = generateMermaid(
      makeResult({
        contextFiles: [
          {
            path: "/fake/CLAUDE.md",
            exists: true,
            sizeBytes: 2048,
            estimatedTokens: 600,
            scope: "project",
            status: "warning",
          },
        ],
      })
    );
    expect(out).toContain(":::warning");
  });

  it("shows outdated status on MCP server", () => {
    const out = generateMermaid(
      makeResult({
        mcpServers: [
          {
            name: "mempalace",
            source: "~/.claude/settings.json",
            type: "stdio",
            command: "uvx",
            args: [],
            envVars: [],
            commandAvailable: true,
            status: "outdated",
            diagnostics: ["New version available"],
          },
        ],
      })
    );
    expect(out).toContain(":::outdated");
    expect(out).toContain("🔄");
  });
});
