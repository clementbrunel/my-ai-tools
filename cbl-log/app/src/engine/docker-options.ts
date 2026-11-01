// settings.json `docker` section -> options of the engine process. The main process hands them over in an
// environment variable when it forks the engine, so changing them needs a restart of the app.
import type { DockerSettings } from "@cbl-log/shared";
import type { EngineDockerOptions } from "@cbl-log/engine";

export const DOCKER_ENV = "CBL_LOG_DOCKER";

export function encodeDockerEnv(docker: DockerSettings): string {
  return JSON.stringify({
    ...(docker.host ? { host: docker.host } : {}),
    spoolMaxMb: docker.spoolMaxMb,
    keepSpoolOnClose: docker.keepSpoolOnClose,
  });
}

/** Engine options from the environment variable; anything unusable falls back to the engine defaults. */
export function decodeDockerEnv(text: string | undefined): EngineDockerOptions {
  if (!text) return {};
  try {
    const raw = JSON.parse(text) as Partial<{ host: unknown; spoolMaxMb: unknown; keepSpoolOnClose: unknown }>;
    return {
      ...(typeof raw.host === "string" && raw.host ? { host: raw.host } : {}),
      ...(typeof raw.spoolMaxMb === "number" && raw.spoolMaxMb > 0 ? { spoolMaxBytes: Math.floor(raw.spoolMaxMb) * 1024 * 1024 } : {}),
      ...(raw.keepSpoolOnClose === true ? { keepSpoolOnClose: true } : {}),
    };
  } catch {
    return {};
  }
}
