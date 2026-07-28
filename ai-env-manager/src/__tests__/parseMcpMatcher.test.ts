import { describe, it, expect } from "vitest";
import { parseMcpMatcher } from "../scanner/hooks.js";

describe("parseMcpMatcher", () => {
  it("returns empty for non-mcp matcher", () => {
    expect(parseMcpMatcher("*")).toEqual({});
    expect(parseMcpMatcher("Bash")).toEqual({});
    expect(parseMcpMatcher("")).toEqual({});
  });

  it("parses server + tool", () => {
    expect(parseMcpMatcher("mcp__github__search_repositories")).toEqual({
      mcpServer: "github",
      mcpTool: "search_repositories",
    });
  });

  it("parses server only (2 parts)", () => {
    expect(parseMcpMatcher("mcp__github")).toEqual({
      mcpServer: "github",
    });
  });

  it("handles tool names with double underscores", () => {
    expect(parseMcpMatcher("mcp__MCP_DOCKER__browser_navigate")).toEqual({
      mcpServer: "MCP_DOCKER",
      mcpTool: "browser_navigate",
    });
  });

  it("handles deeply nested tool (underscore in tool name)", () => {
    // mcp__server__tool__subtool → mcpTool = "tool__subtool"
    expect(parseMcpMatcher("mcp__srv__tool__sub")).toEqual({
      mcpServer: "srv",
      mcpTool: "tool__sub",
    });
  });

  it("returns empty for bare mcp__ prefix", () => {
    expect(parseMcpMatcher("mcp__")).toEqual({});
  });
});
