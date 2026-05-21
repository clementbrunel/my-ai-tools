import { describe, it, expect } from "vitest";
import { scanHooks, parseMcpMatcher } from "../scanner/hooks.js";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

// Creates a temp project dir with .claude/settings.json containing the given hooks config.
function makeTempProject(hooksConfig: object): { dir: string; cleanup: () => void } {
  const dir = mkdtempSync(join(tmpdir(), "ai-env-test-"));
  mkdirSync(join(dir, ".claude"));
  writeFileSync(join(dir, ".claude", "settings.json"), JSON.stringify({ hooks: hooksConfig }));
  return { dir, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

describe("scanHooks (project-level fixture)", () => {
  it("returns empty array for project with no hooks", () => {
    const { dir, cleanup } = makeTempProject({});
    try {
      const hooks = scanHooks(dir);
      // Only project-level hooks; user-level may add results — filter by source
      const projectHooks = hooks.filter((h) => h.source === ".claude/settings.json");
      expect(projectHooks).toHaveLength(0);
    } finally {
      cleanup();
    }
  });

  it("parses a simple generic hook", () => {
    const { dir, cleanup } = makeTempProject({
      SessionStart: [{ matcher: "*", hooks: [{ type: "command", command: "echo hi" }] }],
    });
    try {
      const hooks = scanHooks(dir).filter((h) => h.source === ".claude/settings.json");
      expect(hooks).toHaveLength(1);
      expect(hooks[0].event).toBe("SessionStart");
      expect(hooks[0].matcher).toBe("*");
      expect(hooks[0].mcpServer).toBeUndefined();
      expect(hooks[0].mcpTool).toBeUndefined();
    } finally {
      cleanup();
    }
  });

  it("parses MCP-targeted hooks and sets mcpServer + mcpTool", () => {
    const { dir, cleanup } = makeTempProject({
      PreToolUse: [
        {
          matcher: "mcp__github__search_repositories",
          hooks: [{ type: "command", command: "echo before-gh" }],
        },
      ],
    });
    try {
      const hooks = scanHooks(dir).filter((h) => h.source === ".claude/settings.json");
      expect(hooks).toHaveLength(1);
      expect(hooks[0].mcpServer).toBe("github");
      expect(hooks[0].mcpTool).toBe("search_repositories");
    } finally {
      cleanup();
    }
  });

  it("parses multiple hooks across events", () => {
    const { dir, cleanup } = makeTempProject({
      PreToolUse: [
        { matcher: "mcp__srv__tool", hooks: [{ type: "command", command: "echo a" }] },
      ],
      PostToolUse: [
        { matcher: "*", hooks: [{ type: "command", command: "echo b" }] },
      ],
    });
    try {
      const hooks = scanHooks(dir).filter((h) => h.source === ".claude/settings.json");
      expect(hooks).toHaveLength(2);
      const pre = hooks.find((h) => h.event === "PreToolUse");
      const post = hooks.find((h) => h.event === "PostToolUse");
      expect(pre?.mcpServer).toBe("srv");
      expect(post?.mcpServer).toBeUndefined();
    } finally {
      cleanup();
    }
  });

  it("marks hook as error when command is a non-existent path", () => {
    const { dir, cleanup } = makeTempProject({
      SessionStart: [
        {
          matcher: "*",
          hooks: [{ type: "command", command: "/non/existent/script.sh" }],
        },
      ],
    });
    try {
      const hooks = scanHooks(dir).filter((h) => h.source === ".claude/settings.json");
      expect(hooks[0].status).toBe("error");
      expect(hooks[0].diagnostics[0]).toMatch(/not found/i);
    } finally {
      cleanup();
    }
  });
});
