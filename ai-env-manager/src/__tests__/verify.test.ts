import { describe, it, expect } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { verifyTools } from "../verify/index.js";
import { readRequestedTools, recordRequestedTools, stateFilePath } from "../prepare/state.js";
import { CATALOGUE, TOOL_TO_INTEGRATION, parseToolIds } from "../prepare/catalogue.js";
import type { ToolId } from "../prepare/catalogue.js";
import type { Integration, ScanResult, Status } from "../types.js";

function integration(id: ToolId, detected: boolean, status: Status, diagnostics: string[] = []): Integration {
  return {
    name: TOOL_TO_INTEGRATION[id],
    description: "",
    detected,
    status,
    source: detected ? "test fixture" : undefined,
    diagnostics,
  };
}

function scan(integrations: Integration[]): ScanResult {
  return {
    projectPath: "/tmp/project",
    model: { configured: null, source: null, isSonnet: false, status: "ok", diagnostics: [] },
    mcpServers: [],
    contextFiles: [],
    hooks: [],
    integrations,
    envVarSummary: { total: 0, set: 0, missing: 0, missingList: [], setList: [] },
  };
}

function tmpProject(): string {
  return mkdtempSync(join(tmpdir(), "ai-env-verify-"));
}

// --- verifyTools ---

describe("verifyTools", () => {
  it("marks a detected, healthy tool as ok", () => {
    const report = verifyTools(scan([integration("caveman", true, "ok")]), ["caveman"]);
    expect(report.results[0].verdict).toBe("ok");
    expect(report.results[0].source).toBe("test fixture");
    expect(report.results[0].remainingSteps).toHaveLength(0);
    expect(report.ok).toBe(true);
  });

  it("marks a detected but degraded tool as incomplete and keeps its diagnostics", () => {
    const scanResult = scan([integration("graphify", true, "warning", ["No graph built yet"])]);
    const report = verifyTools(scanResult, ["graphify"]);
    expect(report.results[0].verdict).toBe("incomplete");
    expect(report.results[0].diagnostics).toContain("No graph built yet");
    expect(report.ok).toBe(false);
  });

  it("treats an error status as incomplete rather than missing", () => {
    const report = verifyTools(scan([integration("rtk", true, "error", ["binary not in PATH"])]), ["rtk"]);
    expect(report.results[0].verdict).toBe("incomplete");
  });

  it("marks an undetected tool as missing and lists its install steps", () => {
    const report = verifyTools(scan([integration("mempalace", false, "warning")]), ["mempalace"]);
    const result = report.results[0];
    expect(result.verdict).toBe("missing");
    expect(result.source).toBeUndefined();
    expect(result.remainingSteps.length).toBeGreaterThan(0);
    expect(report.ok).toBe(false);
  });

  it("reports missing when the scan has no matching integration at all", () => {
    const report = verifyTools(scan([]), ["ponytail"]);
    expect(report.results[0].verdict).toBe("missing");
  });

  it("counts each verdict across several tools", () => {
    const scanResult = scan([
      integration("caveman", true, "ok"),
      integration("graphify", true, "warning", ["half configured"]),
      integration("mempalace", false, "warning"),
    ]);
    const report = verifyTools(scanResult, ["caveman", "graphify", "mempalace"]);
    expect(report.counts).toEqual({ ok: 1, incomplete: 1, missing: 1 });
    expect(report.ok).toBe(false);
  });

  it("is ok on an empty request list", () => {
    const report = verifyTools(scan([]), []);
    expect(report.ok).toBe(true);
    expect(report.results).toHaveLength(0);
  });

  // Without a mapping, a catalogue tool would be reported as permanently missing.
  it("has a scanner integration mapped for every catalogue tool", () => {
    for (const tool of CATALOGUE) {
      expect(TOOL_TO_INTEGRATION[tool.id]).toBeDefined();
    }
  });
});

// --- parseToolIds ---

describe("parseToolIds", () => {
  it("splits, trims and de-duplicates known ids", () => {
    expect(parseToolIds(" rtk , mempalace ,rtk").ids).toEqual(["rtk", "mempalace"]);
  });

  it("separates unknown ids", () => {
    const { ids, unknown } = parseToolIds("rtk,nope");
    expect(ids).toEqual(["rtk"]);
    expect(unknown).toEqual(["nope"]);
  });

  it("ignores empty segments", () => {
    expect(parseToolIds("rtk,,").ids).toEqual(["rtk"]);
  });
});

// --- state file ---

describe("requested-tools state file", () => {
  it("returns an empty list when no state file exists", () => {
    const dir = tmpProject();
    try {
      expect(readRequestedTools(dir)).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("records and reads back the requested tools", () => {
    const dir = tmpProject();
    try {
      recordRequestedTools(dir, ["rtk", "mempalace"]);
      expect(readRequestedTools(dir)).toEqual(["rtk", "mempalace"]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("keeps tools from other conflict groups when recording again", () => {
    const dir = tmpProject();
    try {
      recordRequestedTools(dir, ["rtk", "mempalace"]);
      recordRequestedTools(dir, ["codeburn"]);
      expect(readRequestedTools(dir)).toEqual(["rtk", "mempalace", "codeburn"]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("replaces a previous pick from the same conflict group", () => {
    const dir = tmpProject();
    try {
      recordRequestedTools(dir, ["rtk"]);
      recordRequestedTools(dir, ["caveman"]);
      expect(readRequestedTools(dir)).toEqual(["caveman"]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("does not duplicate a tool recorded twice", () => {
    const dir = tmpProject();
    try {
      recordRequestedTools(dir, ["codeburn"]);
      recordRequestedTools(dir, ["codeburn"]);
      expect(readRequestedTools(dir)).toEqual(["codeburn"]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("drops unknown ids found in a hand-edited state file", () => {
    const dir = tmpProject();
    try {
      writeFileSync(stateFilePath(dir), JSON.stringify({ requested: ["rtk", "bogus"] }), "utf-8");
      expect(readRequestedTools(dir)).toEqual(["rtk"]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("returns an empty list for a malformed state file", () => {
    const dir = tmpProject();
    try {
      writeFileSync(stateFilePath(dir), "{ not json", "utf-8");
      expect(readRequestedTools(dir)).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
