import { describe, it, expect } from "vitest";
import { renderConsole } from "../diagram/console.js";
import { renderMarkdown } from "../diagram/markdown.js";
import type { ScanResult } from "../types.js";

const base: ScanResult = {
  projectPath: "/test/project",
  model: { configured: "claude-sonnet-4-6", source: "~/.claude/settings.json", isSonnet: true, status: "ok", diagnostics: [] },
  mcpServers: [],
  contextFiles: [],
  hooks: [],
  integrations: [],
  envVarSummary: { total: 0, set: 0, missing: 0, missingList: [], setList: [] },
};

function withMcp(overrides: Partial<ScanResult["mcpServers"][number]>): ScanResult {
  return {
    ...base,
    mcpServers: [{
      name: "github",
      source: "~/.claude/settings.json",
      type: "stdio",
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-github"],
      envVars: [{ name: "GITHUB_TOKEN", isSet: true, isApiKey: true }],
      commandAvailable: true,
      status: "ok",
      diagnostics: [],
      ...overrides,
    }],
    envVarSummary: { total: 1, set: 1, missing: 0, missingList: [], setList: ["GITHUB_TOKEN"] },
  };
}

// --- renderConsole ---

describe("renderConsole", () => {
  it("includes MODEL section", () => {
    const out = renderConsole(base);
    expect(out).toContain("MODEL");
    expect(out).toContain("claude-sonnet-4-6");
  });

  it("shows 'All N components OK' when no issues", () => {
    const out = renderConsole(base);
    expect(out).toContain("components OK");
  });

  it("shows MCP server name and type", () => {
    const out = renderConsole(withMcp({}));
    expect(out).toContain("github");
    expect(out).toContain("stdio");
  });

  it("shows error summary when MCP server has error status", () => {
    const out = renderConsole(withMcp({ status: "error", diagnostics: ["command not found: npx"] }));
    expect(out).toContain("error(s)");
    expect(out).toContain("command not found: npx");
  });

  it("shows warning summary when MCP server has warning status", () => {
    const out = renderConsole(withMcp({ status: "warning", diagnostics: ["optional var missing"] }));
    expect(out).toContain("warning(s)");
  });

  it("omits Diagnostic column when no server has diagnostics", () => {
    const out = renderConsole(withMcp({}));
    expect(out).not.toContain("Diagnostic");
  });

  it("shows Diagnostic column when a server has diagnostics", () => {
    const out = renderConsole(withMcp({ status: "error", diagnostics: ["missing token"] }));
    expect(out).toContain("Diagnostic");
    expect(out).toContain("missing token");
  });

  it("shows env vars with Note before Status columns", () => {
    const out = renderConsole(withMcp({}));
    const notePos = out.indexOf("Note");
    const statusPos = out.lastIndexOf("Status");
    expect(notePos).toBeLessThan(statusPos);
  });
});

// --- renderMarkdown ---

describe("renderMarkdown", () => {
  it("includes project path in heading", () => {
    const out = renderMarkdown(base);
    expect(out).toContain("/test/project");
  });

  it("renders overall status badge", () => {
    const out = renderMarkdown(base);
    expect(out).toMatch(/img\.shields\.io\/badge\/ok/);
  });

  it("renders warning badge when context file has warning", () => {
    const result: ScanResult = {
      ...base,
      contextFiles: [{
        path: "/test/project/CLAUDE.md",
        exists: true,
        sizeBytes: 2048,
        estimatedTokens: 512,
        scope: "project",
        status: "warning",
      }],
    };
    const out = renderMarkdown(result);
    expect(out).toMatch(/img\.shields\.io\/badge\/warning/);
  });

  it("renders Model table with Configured/Source/Status columns", () => {
    const out = renderMarkdown(base);
    expect(out).toContain("| Configured | Source | Status |");
    expect(out).toContain("claude-sonnet-4-6");
  });

  it("omits Diagnostic column when no MCP server has diagnostics", () => {
    const out = renderMarkdown(withMcp({}));
    expect(out).not.toContain("Diagnostic");
  });

  it("shows Diagnostic column when a server has diagnostics", () => {
    const out = renderMarkdown(withMcp({ status: "error", diagnostics: ["bad token"] }));
    expect(out).toContain("Diagnostic");
    expect(out).toContain("bad token");
  });

  it("renders env vars with Note before Status columns", () => {
    const out = renderMarkdown(withMcp({}));
    const envSection = out.slice(out.indexOf("## Env Vars"));
    const notePos = envSection.indexOf("Note");
    const statusPos = envSection.indexOf("Status");
    expect(notePos).toBeGreaterThan(-1);
    expect(notePos).toBeLessThan(statusPos);
  });

  it("renders Errors section when model has error", () => {
    const result: ScanResult = {
      ...base,
      model: { ...base.model, status: "error", diagnostics: ["unsupported model: gpt-4"] },
    };
    const out = renderMarkdown(result);
    expect(out).toContain("## Errors");
    expect(out).toContain("unsupported model: gpt-4");
  });

  it("renders Warnings section when MCP server has warning", () => {
    const out = renderMarkdown(withMcp({ status: "warning", diagnostics: ["optional var missing"] }));
    expect(out).toContain("## Warnings");
    expect(out).toContain("optional var missing");
  });

  it("omits Errors and Warnings sections when all ok", () => {
    const out = renderMarkdown(base);
    expect(out).not.toContain("## Errors");
    expect(out).not.toContain("## Warnings");
  });
});
