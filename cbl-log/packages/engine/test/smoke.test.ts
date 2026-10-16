import { describe, expect, it } from "vitest";
import { engineInfo } from "../src/index";

describe("engine", () => {
  it("expose son nom", () => {
    expect(engineInfo().name).toBe("@cbl-log/engine");
  });
});
