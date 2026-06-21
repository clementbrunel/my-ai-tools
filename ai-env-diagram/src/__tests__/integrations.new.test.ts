import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { detectHeadroom } from "../scanner/integrations/headroom.js";
import { detectEcc } from "../scanner/integrations/ecc.js";
import { detectSocratiCode } from "../scanner/integrations/socraticode.js";
import type { McpServer } from "../types.js";

function makeTempDir(): { dir: string; cleanup: () => void } {
  const dir = mkdtempSync(join(tmpdir(), "ai-env-integ-test-"));
  return { dir, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

function mockMcp(name: string): McpServer {
  return {
    name,
    source: "test",
    type: "stdio",
    command: "npx",
    args: [],
    envVars: [],
    commandAvailable: null,
    status: "ok",
    diagnostics: [],
  };
}

// --- detectHeadroom ---

describe("detectHeadroom", () => {
  it("returns detected: false for an empty project with no MCP servers", () => {
    const { dir, cleanup } = makeTempDir();
    try {
      const result = detectHeadroom(dir, []);
      expect(result.detected).toBe(false);
    } finally {
      cleanup();
    }
  });

  it("returns detected: true when an MCP server named 'headroom' is present", () => {
    const { dir, cleanup } = makeTempDir();
    try {
      const result = detectHeadroom(dir, [mockMcp("headroom")]);
      expect(result.detected).toBe(true);
    } finally {
      cleanup();
    }
  });

  it("returns detected: true when .headroom.toml exists at project root", () => {
    const { dir, cleanup } = makeTempDir();
    try {
      writeFileSync(join(dir, ".headroom.toml"), "[headroom]\n");
      const result = detectHeadroom(dir, []);
      expect(result.detected).toBe(true);
    } finally {
      cleanup();
    }
  });
});

// --- detectEcc ---

describe("detectEcc", () => {
  it("returns detected: false for an empty project with no MCP servers", () => {
    const { dir, cleanup } = makeTempDir();
    try {
      const result = detectEcc(dir, []);
      expect(result.detected).toBe(false);
    } finally {
      cleanup();
    }
  });

  it("returns detected: true when an MCP server named 'ecc' is present", () => {
    const { dir, cleanup } = makeTempDir();
    try {
      const result = detectEcc(dir, [mockMcp("ecc")]);
      expect(result.detected).toBe(true);
    } finally {
      cleanup();
    }
  });

  it("returns detected: true when CLAUDE.md references 'ecc'", () => {
    const { dir, cleanup } = makeTempDir();
    try {
      writeFileSync(join(dir, "CLAUDE.md"), "# Project\nUsing ecc for agent setup.\n");
      const result = detectEcc(dir, []);
      expect(result.detected).toBe(true);
    } finally {
      cleanup();
    }
  });
});

// --- detectSocratiCode ---

describe("detectSocratiCode", () => {
  it("returns detected: false for an empty project with no MCP servers", () => {
    const { dir, cleanup } = makeTempDir();
    try {
      const result = detectSocratiCode(dir, []);
      expect(result.detected).toBe(false);
    } finally {
      cleanup();
    }
  });

  it("returns detected: true when an MCP server named 'socraticode' is present", () => {
    const { dir, cleanup } = makeTempDir();
    try {
      const result = detectSocratiCode(dir, [mockMcp("socraticode")]);
      expect(result.detected).toBe(true);
    } finally {
      cleanup();
    }
  });

  it("returns detected: true when .socraticodeignore exists at project root", () => {
    const { dir, cleanup } = makeTempDir();
    try {
      writeFileSync(join(dir, ".socraticodeignore"), "node_modules/\n");
      const result = detectSocratiCode(dir, []);
      expect(result.detected).toBe(true);
    } finally {
      cleanup();
    }
  });
});
