import { describe, expect, it } from "vitest";
import { dockerUri, parseDockerUri } from "@cbl-log/shared";

describe("docker:// URI", () => {
  it("round-trips a container reference", () => {
    expect(dockerUri({ context: "desktop-linux", name: "shop-web-1" })).toBe("docker://desktop-linux/shop-web-1");
    expect(parseDockerUri("docker://desktop-linux/shop-web-1")).toEqual({ context: "desktop-linux", name: "shop-web-1" });
  });

  it("ignores anything that is not a complete container URI", () => {
    for (const bad of ["C:\logs\a.log", "docker://", "docker://ctx", "docker://ctx/", "docker:///name"]) expect(parseDockerUri(bad)).toBeUndefined();
  });
});
