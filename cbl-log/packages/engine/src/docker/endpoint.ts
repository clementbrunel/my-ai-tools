import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { DockerError } from "./errors.js";

/** Where the daemon listens: a named pipe / Unix socket, or a TCP address. */
export type DockerEndpoint = { socketPath: string } | { host: string; port: number };

export const DEFAULT_DOCKER_HOST = "npipe:////./pipe/docker_engine";

export interface ResolveEndpointOptions {
  /** `docker.host` from settings.json: wins over everything else. */
  settingsHost?: string;
  env?: Record<string, string | undefined>;
  /** Home directory holding `.docker` (defaults to the user's). */
  homeDir?: string;
  /** Test hook: reads a file as UTF-8, `undefined` when absent. */
  readFile?: (path: string) => string | undefined;
}

/** Turns `npipe://`, `unix://`, `tcp://` / `http://` into a connectable endpoint. */
export function parseDockerHost(host: string): DockerEndpoint {
  const trimmed = host.trim();
  const m = /^([a-z]+):\/\/(.*)$/i.exec(trimmed);
  if (!m) throw new DockerError("BAD_ENDPOINT", `Invalid Docker host: ${host}`);
  const scheme = m[1]!.toLowerCase();
  const rest = m[2]!;
  if (scheme === "npipe") {
    // npipe:////./pipe/docker_engine -> \.\pipe\docker_engine
    return { socketPath: rest.replace(/\//g, "\\") };
  }
  if (scheme === "unix") return { socketPath: rest };
  if (scheme === "tcp" || scheme === "http") {
    const url = new URL(`http://${rest}`);
    return { host: url.hostname, port: url.port ? Number(url.port) : 2375 };
  }
  throw new DockerError("BAD_ENDPOINT", `Unsupported Docker host scheme "${scheme}" (${host})`);
}

function defaultReadFile(path: string): string | undefined {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return undefined;
  }
}

function parseJson(text: string | undefined): unknown {
  if (text === undefined) return undefined;
  try {
    return JSON.parse(text.replace(/^\uFEFF/, ""));
  } catch {
    return undefined;
  }
}

/** Host of the current Docker CLI context, if any (`default` has no meta file). */
function contextHost(opts: ResolveEndpointOptions, read: (p: string) => string | undefined): string | undefined {
  const env = opts.env ?? process.env;
  const dockerDir = env.DOCKER_CONFIG || join(opts.homeDir ?? homedir(), ".docker");
  const config = parseJson(read(join(dockerDir, "config.json"))) as { currentContext?: string } | undefined;
  const name = env.DOCKER_CONTEXT || config?.currentContext;
  if (!name || name === "default") return undefined;
  const digest = createHash("sha256").update(name).digest("hex");
  const meta = parseJson(read(join(dockerDir, "contexts", "meta", digest, "meta.json"))) as
    | { Endpoints?: { docker?: { Host?: string } } }
    | undefined;
  return meta?.Endpoints?.docker?.Host || undefined;
}

/** Same order as the `docker` CLI: settings -> DOCKER_HOST -> current context -> default pipe. */
export function resolveEndpoint(opts: ResolveEndpointOptions = {}): DockerEndpoint {
  const env = opts.env ?? process.env;
  const read = opts.readFile ?? defaultReadFile;
  const host = opts.settingsHost?.trim() || env.DOCKER_HOST?.trim() || contextHost(opts, read) || DEFAULT_DOCKER_HOST;
  return parseDockerHost(host);
}

/** Name of the Docker CLI context in force ("default" when none): the folder of the spools, the `docker://` authority. */
export function currentContextName(opts: ResolveEndpointOptions = {}): string {
  const env = opts.env ?? process.env;
  const read = opts.readFile ?? defaultReadFile;
  const dockerDir = env.DOCKER_CONFIG || join(opts.homeDir ?? homedir(), ".docker");
  const config = parseJson(read(join(dockerDir, "config.json"))) as { currentContext?: string } | undefined;
  return env.DOCKER_CONTEXT || config?.currentContext || "default";
}
