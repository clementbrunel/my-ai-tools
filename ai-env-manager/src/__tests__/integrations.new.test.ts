import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { detectHeadroom } from "../scanner/integrations/headroom.js";
import { detectEcc } from "../scanner/integrations/ecc.js";
import { detectSocratiCode } from "../scanner/integrations/socraticode.js";
import { detectKarpathySkills } from "../scanner/integrations/karpathy-skills.js";
import { detectGraphify } from "../scanner/integrations/graphify.js";
import { detectPonytail } from "../scanner/integrations/ponytail.js";
import { detectCodeBurn } from "../scanner/integrations/codeburn.js";
import { detectOpenwiki } from "../scanner/integrations/openwiki.js";
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

// --- detectKarpathySkills ---

describe("detectKarpathySkills", () => {
  it("returns detected: false for an empty project with no plugin/rule/CLAUDE.md", () => {
    const { dir, cleanup } = makeTempDir();
    try {
      const result = detectKarpathySkills(dir);
      expect(result.detected).toBe(false);
    } finally {
      cleanup();
    }
  });

  it("returns detected: true when the Cursor rule file exists", () => {
    const { dir, cleanup } = makeTempDir();
    try {
      mkdirSync(join(dir, ".cursor", "rules"), { recursive: true });
      writeFileSync(join(dir, ".cursor", "rules", "karpathy-guidelines.mdc"), "# Karpathy guidelines\n");
      const result = detectKarpathySkills(dir);
      expect(result.detected).toBe(true);
    } finally {
      cleanup();
    }
  });

  it("returns detected: true when CLAUDE.md references karpathy", () => {
    const { dir, cleanup } = makeTempDir();
    try {
      writeFileSync(join(dir, "CLAUDE.md"), "# Project\nFollowing the karpathy guidelines for surgical changes.\n");
      const result = detectKarpathySkills(dir);
      expect(result.detected).toBe(true);
    } finally {
      cleanup();
    }
  });
});

// --- detectGraphify ---

describe("detectGraphify", () => {
  it("returns detected: false for an empty project with no MCP servers", () => {
    const { dir, cleanup } = makeTempDir();
    try {
      const result = detectGraphify(dir, []);
      expect(result.detected).toBe(false);
    } finally {
      cleanup();
    }
  });

  it("returns detected: true when an MCP server named 'graphify' is present", () => {
    const { dir, cleanup } = makeTempDir();
    try {
      const result = detectGraphify(dir, [mockMcp("graphify")]);
      expect(result.detected).toBe(true);
    } finally {
      cleanup();
    }
  });

  it("returns detected: true when .claude/skills/graphify/SKILL.md exists", () => {
    const { dir, cleanup } = makeTempDir();
    try {
      mkdirSync(join(dir, ".claude", "skills", "graphify"), { recursive: true });
      writeFileSync(join(dir, ".claude", "skills", "graphify", "SKILL.md"), "# Graphify\n");
      const result = detectGraphify(dir, []);
      expect(result.detected).toBe(true);
    } finally {
      cleanup();
    }
  });

  it("warns when detected but no graph has been built yet", () => {
    const { dir, cleanup } = makeTempDir();
    try {
      writeFileSync(join(dir, ".graphifyignore"), "node_modules/\n");
      const result = detectGraphify(dir, []);
      expect(result.detected).toBe(true);
      expect(result.status).toBe("warning");
      expect(result.diagnostics.some((d) => d.includes("No graph built yet"))).toBe(true);
    } finally {
      cleanup();
    }
  });
});

// --- detectPonytail ---

describe("detectPonytail", () => {
  const originalMode = process.env.PONYTAIL_DEFAULT_MODE;

  afterEach(() => {
    if (originalMode === undefined) delete process.env.PONYTAIL_DEFAULT_MODE;
    else process.env.PONYTAIL_DEFAULT_MODE = originalMode;
  });

  it("returns detected: false for an empty project with no plugin/rule/config/env", () => {
    delete process.env.PONYTAIL_DEFAULT_MODE;
    const { dir, cleanup } = makeTempDir();
    try {
      const result = detectPonytail(dir);
      expect(result.detected).toBe(false);
    } finally {
      cleanup();
    }
  });

  it("returns detected: true when a Cursor rule file exists", () => {
    delete process.env.PONYTAIL_DEFAULT_MODE;
    const { dir, cleanup } = makeTempDir();
    try {
      mkdirSync(join(dir, ".cursor", "rules"), { recursive: true });
      writeFileSync(join(dir, ".cursor", "rules", "ponytail.mdc"), "# Ponytail\n");
      const result = detectPonytail(dir);
      expect(result.detected).toBe(true);
    } finally {
      cleanup();
    }
  });

  it("returns detected: true when CLAUDE.md references ponytail", () => {
    delete process.env.PONYTAIL_DEFAULT_MODE;
    const { dir, cleanup } = makeTempDir();
    try {
      writeFileSync(join(dir, "CLAUDE.md"), "# Project\nUsing ponytail to avoid over-engineering.\n");
      const result = detectPonytail(dir);
      expect(result.detected).toBe(true);
    } finally {
      cleanup();
    }
  });

  it("returns detected: true when PONYTAIL_DEFAULT_MODE is set", () => {
    process.env.PONYTAIL_DEFAULT_MODE = "full";
    const { dir, cleanup } = makeTempDir();
    try {
      const result = detectPonytail(dir);
      expect(result.detected).toBe(true);
    } finally {
      cleanup();
    }
  });
});

// --- detectCodeBurn ---

describe("detectCodeBurn", () => {
  it("returns detected: false when no MCP server, binary, or config file is present", () => {
    const result = detectCodeBurn([]);
    expect(result.detected).toBe(false);
  });

  it("returns detected: true when an MCP server named 'codeburn' is present", () => {
    const result = detectCodeBurn([mockMcp("codeburn")]);
    expect(result.detected).toBe(true);
  });
});

// --- detectOpenwiki ---

describe("detectOpenwiki", () => {
  it("returns detected: false for an empty project", () => {
    const { dir, cleanup } = makeTempDir();
    try {
      const result = detectOpenwiki(dir);
      expect(result.detected).toBe(false);
    } finally {
      cleanup();
    }
  });

  it("returns detected: true when openwiki/INSTRUCTIONS.md exists", () => {
    const { dir, cleanup } = makeTempDir();
    try {
      mkdirSync(join(dir, "openwiki"), { recursive: true });
      writeFileSync(join(dir, "openwiki", "INSTRUCTIONS.md"), "# Scope\n");
      const result = detectOpenwiki(dir);
      expect(result.detected).toBe(true);
      expect(result.source).toContain("openwiki/INSTRUCTIONS.md");
    } finally {
      cleanup();
    }
  });

  it("returns detected: true when .openwikiignore exists at project root", () => {
    const { dir, cleanup } = makeTempDir();
    try {
      writeFileSync(join(dir, ".openwikiignore"), "node_modules/\n");
      const result = detectOpenwiki(dir);
      expect(result.detected).toBe(true);
    } finally {
      cleanup();
    }
  });

  it("returns detected: true when the CI update workflow is present", () => {
    const { dir, cleanup } = makeTempDir();
    try {
      mkdirSync(join(dir, ".github", "workflows"), { recursive: true });
      writeFileSync(join(dir, ".github", "workflows", "openwiki-update.yml"), "name: openwiki\n");
      const result = detectOpenwiki(dir);
      expect(result.detected).toBe(true);
    } finally {
      cleanup();
    }
  });

  it("returns detected: true when CLAUDE.md references openwiki", () => {
    const { dir, cleanup } = makeTempDir();
    try {
      writeFileSync(join(dir, "CLAUDE.md"), "# Project\nSee the openwiki/ directory for the wiki.\n");
      const result = detectOpenwiki(dir);
      expect(result.detected).toBe(true);
    } finally {
      cleanup();
    }
  });

  it("diagnoses a missing wiki when only .openwikiignore is present", () => {
    const { dir, cleanup } = makeTempDir();
    try {
      writeFileSync(join(dir, ".openwikiignore"), "node_modules/\n");
      const result = detectOpenwiki(dir);
      expect(result.detected).toBe(true);
      expect(result.status).not.toBe("ok");
      expect(result.diagnostics.some((d) => d.includes("No wiki generated yet"))).toBe(true);
    } finally {
      cleanup();
    }
  });
});
