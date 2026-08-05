import { describe, it, expect } from "vitest";
import { toYaml } from "../migrate/yaml.js";

describe("toYaml scalars", () => {
  it("leaves plain-safe strings unquoted", () => {
    expect(toYaml({ name: "github-mcp" })).toBe("name: github-mcp\n");
  });

  it("quotes strings that YAML would read back as a boolean", () => {
    expect(toYaml({ value: "yes" })).toBe('value: "yes"\n');
  });

  it("quotes numeric-looking strings so they stay strings", () => {
    expect(toYaml({ version: "1.0" })).toBe('version: "1.0"\n');
  });

  it("quotes env var placeholders", () => {
    expect(toYaml({ token: "${GITHUB_TOKEN}" })).toBe('token: "${GITHUB_TOKEN}"\n');
  });

  it("escapes quotes, backslashes and newlines", () => {
    expect(toYaml({ s: 'a"b\\c\nd' })).toBe('s: "a\\"b\\\\c\\nd"\n');
  });

  it("renders numbers, booleans and null unquoted", () => {
    expect(toYaml({ n: 42, b: true, z: null })).toBe("n: 42\nb: true\nz: null\n");
  });
});

describe("toYaml collections", () => {
  it("renders a nested map with indentation", () => {
    expect(toYaml({ settings: { model: { name: "sonnet" } } })).toBe(
      "settings:\n  model:\n    name: sonnet\n"
    );
  });

  it("renders a list of scalars", () => {
    expect(toYaml({ args: ["-y", "pkg"] })).toBe('args:\n  - "-y"\n  - pkg\n');
  });

  it("renders a list of maps with the dash aligned on the first key", () => {
    expect(toYaml({ files: [{ path: "a", scope: "project" }, { path: "b", scope: "user" }] })).toBe(
      "files:\n  - path: a\n    scope: project\n  - path: b\n    scope: user\n"
    );
  });

  it("keeps empty collections on the key's own line", () => {
    expect(toYaml({ mcps: {}, notes: [] })).toBe("mcps: {}\nnotes: []\n");
  });

  it("skips undefined values instead of emitting them", () => {
    expect(toYaml({ a: 1, b: undefined, c: 2 })).toBe("a: 1\nc: 2\n");
  });

  it("renders a map whose values are all undefined as an empty map", () => {
    expect(toYaml({ outer: { a: undefined } })).toBe("outer: {}\n");
  });

  it("prefixes header lines as comments", () => {
    expect(toYaml({ a: 1 }, ["generated", ""])).toBe("# generated\n#\na: 1\n");
  });
});
