import { describe, expect, it } from "vitest";
import { baseName, pathKey } from "./path-key";

describe("pathKey", () => {
  it("ignores case and slash flavour", () => {
    expect(pathKey("C:/Logs/App.LOG")).toBe(pathKey("c:\\logs\\app.log"));
  });

  it("distinguishes different files", () => {
    expect(pathKey("C:\\logs\\a.log")).not.toBe(pathKey("C:\\logs\\b.log"));
  });
});

describe("baseName", () => {
  it("returns the last segment", () => {
    expect(baseName("C:\\logs\\app.log")).toBe("app.log");
    expect(baseName("/var/log/app.log")).toBe("app.log");
    expect(baseName("app.log")).toBe("app.log");
  });
});
