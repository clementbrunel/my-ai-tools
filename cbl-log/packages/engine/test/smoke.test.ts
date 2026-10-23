import { describe, expect, it } from "vitest";
import { engineInfo } from "../src/index";

describe("engine", () => {
  it("exposes its name", () => {
    expect(engineInfo().name).toBe("@cbl-log/engine");
  });
});
