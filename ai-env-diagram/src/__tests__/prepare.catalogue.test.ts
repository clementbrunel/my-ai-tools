import { describe, it, expect } from "vitest";
import { getToolById, getConflicts, suggestMissing } from "../prepare/catalogue.js";
import type { ToolId } from "../prepare/catalogue.js";

// --- getToolById ---

describe("getToolById", () => {
  it("returns the tool for a known id", () => {
    const tool = getToolById("rtk");
    expect(tool).toBeDefined();
    expect(tool!.id).toBe("rtk");
    expect(tool!.name).toContain("RTK");
  });

  it("returns undefined for an unknown id", () => {
    expect(getToolById("nonexistent")).toBeUndefined();
  });
});

// --- suggestMissing ---

describe("suggestMissing", () => {
  it("suggests defaults for both groups when nothing is detected", () => {
    const result = suggestMissing([]);
    expect(result).toContain("caveman");   // default for token group
    expect(result).toContain("mempalace"); // default for memory group
    expect(result).toHaveLength(2);
  });

  it("does not suggest a token tool when one is already detected", () => {
    const result = suggestMissing(["Caveman"]);
    expect(result).not.toContain("caveman");
    expect(result).not.toContain("rtk");
    expect(result).not.toContain("headroom");
    expect(result).toContain("mempalace");
  });

  it("does not suggest a memory tool when one is already detected", () => {
    const result = suggestMissing(["MemPalace"]);
    expect(result).not.toContain("mempalace");
    expect(result).not.toContain("socraticode");
    expect(result).toContain("caveman");
  });

  it("returns empty array when all groups are covered", () => {
    const result = suggestMissing(["Caveman", "MemPalace"]);
    expect(result).toHaveLength(0);
  });

  it("ignores unknown integration names without crashing", () => {
    const result = suggestMissing(["UnknownTool", "AnotherFakeTool"]);
    expect(result).toContain("caveman");
    expect(result).toContain("mempalace");
  });
});

// --- getConflicts ---

describe("getConflicts", () => {
  it("detects conflict when two token-group tools are selected", () => {
    const conflicts = getConflicts(["rtk", "headroom"] as ToolId[]);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].group.id).toBe("token");
    expect(conflicts[0].picks).toContain("rtk");
    expect(conflicts[0].picks).toContain("headroom");
  });

  it("reports no conflict when one tool per group is selected", () => {
    const conflicts = getConflicts(["rtk", "mempalace"] as ToolId[]);
    expect(conflicts).toHaveLength(0);
  });

  it("detects ecc + caveman conflict", () => {
    const conflicts = getConflicts(["ecc", "caveman"] as ToolId[]);
    const eccConflict = conflicts.find((c) => c.group.id === "ecc-caveman");
    expect(eccConflict).toBeDefined();
  });

  it("reports no conflict for ecc alone", () => {
    const conflicts = getConflicts(["ecc"] as ToolId[]);
    expect(conflicts).toHaveLength(0);
  });

  it("reports no conflict for empty selection", () => {
    const conflicts = getConflicts([] as ToolId[]);
    expect(conflicts).toHaveLength(0);
  });
});
