import { describe, expect, it } from "vitest";
import { defaultDockerSettings } from "@cbl-log/shared";
import { decodeDockerEnv, encodeDockerEnv } from "./docker-options";

describe("docker engine options", () => {
  it("round-trips the settings the engine needs", () => {
    const env = encodeDockerEnv({ ...defaultDockerSettings(), host: "tcp://h:2375", spoolMaxMb: 8, keepSpoolOnClose: true });
    expect(decodeDockerEnv(env)).toEqual({ host: "tcp://h:2375", spoolMaxBytes: 8 * 1024 * 1024, keepSpoolOnClose: true });
  });

  it("leaves the engine defaults when nothing is set or the variable is broken", () => {
    expect(decodeDockerEnv(undefined)).toEqual({});
    expect(decodeDockerEnv("{ nope")).toEqual({});
    expect(decodeDockerEnv(encodeDockerEnv(defaultDockerSettings()))).toEqual({ spoolMaxBytes: 256 * 1024 * 1024 });
  });
});
