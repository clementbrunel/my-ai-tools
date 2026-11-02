import { request, type IncomingMessage } from "node:http";
import { Readable } from "node:stream";
import { resolveEndpoint, type DockerEndpoint } from "./endpoint.js";
import { DockerError, toDockerError } from "./errors.js";
import { LogDemuxer } from "./demux.js";

/** Oldest daemon API we accept (Docker 20.10) and newest one we speak. */
export const MIN_API_VERSION = "1.41";
export const MAX_API_VERSION = "1.47";

/** Read-only client: only these routes are reachable (architecture § 4.8). */
const ALLOWED_ROUTES: readonly RegExp[] = [
  /^\/_ping$/,
  /^\/version$/,
  /^\/containers\/json$/,
  /^\/containers\/[^/]+\/json$/,
  /^\/containers\/[^/]+\/logs$/,
  /^\/events$/,
];

export const CONTAINER_EVENTS = ["create", "start", "die", "stop", "destroy", "rename"] as const;

export interface DockerVersionInfo {
  version: string;
  apiVersion: string;
  minApiVersion?: string;
  os?: string;
}

export interface DockerContainerSummary {
  id: string;
  names: string[];
  image: string;
  state: string;
  status: string;
  created: number;
  labels: Record<string, string>;
}

export interface DockerContainerDetails {
  id: string;
  name: string;
  image: string;
  state: string;
  tty: boolean;
  logDriver: string;
  /** `State.StartedAt`, absent when the container never started. */
  startedAt?: string;
  labels: Record<string, string>;
  composeProject?: string;
  composeService?: string;
}

export interface DockerEvent {
  action: string;
  id: string;
  name?: string;
  /** Previous name, on `rename`. */
  oldName?: string;
  image?: string;
  /** Remaining actor attributes (compose labels, exit code…). */
  attributes: Record<string, string>;
  time: number;
}

export interface LogsOptions {
  tail?: number | "all";
  /** Unix seconds, or a Date. */
  since?: number | Date;
  follow?: boolean;
  timestamps?: boolean;
  /** Skips the `inspect` call when the caller already knows `Config.Tty`. */
  tty?: boolean;
}

export interface DockerClientOptions {
  endpoint?: DockerEndpoint;
  /** `docker.host` from settings.json, used when `endpoint` is not given. */
  settingsHost?: string;
}

/** `1.41` vs `1.5` compared numerically, component by component. */
export function compareApiVersions(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d < 0 ? -1 : 1;
  }
  return 0;
}

type Json = Record<string, any>;

export class DockerClient {
  private readonly endpoint: DockerEndpoint;
  private apiVersion: string | undefined;

  constructor(opts: DockerClientOptions = {}) {
    this.endpoint = opts.endpoint ?? resolveEndpoint({ settingsHost: opts.settingsHost });
  }

  /** API version negotiated by `connect()`. */
  get negotiatedApiVersion(): string | undefined {
    return this.apiVersion;
  }

  /** `GET /_ping` then `GET /version`; picks `min(daemon, MAX_API_VERSION)`, refuses < MIN_API_VERSION. */
  async connect(signal?: AbortSignal): Promise<DockerVersionInfo> {
    const pong = await this.collect("/_ping", undefined, signal);
    if (pong.trim() !== "OK") throw new DockerError("CONNECTION", "Unexpected answer to /_ping: not a Docker daemon?");
    const raw = JSON.parse(await this.collect("/version", undefined, signal)) as Json;
    const apiVersion = String(raw.ApiVersion ?? "");
    if (!apiVersion || compareApiVersions(apiVersion, MIN_API_VERSION) < 0) {
      this.apiVersion = undefined;
      throw new DockerError(
        "API_TOO_OLD",
        `Docker API ${apiVersion || "unknown"} is too old: ${MIN_API_VERSION} or newer is required (Docker 20.10+).`,
      );
    }
    this.apiVersion = compareApiVersions(apiVersion, MAX_API_VERSION) > 0 ? MAX_API_VERSION : apiVersion;
    return {
      version: String(raw.Version ?? ""),
      apiVersion,
      minApiVersion: raw.MinAPIVersion ? String(raw.MinAPIVersion) : undefined,
      os: raw.Os ? String(raw.Os) : undefined,
    };
  }

  async listContainers(all = false, signal?: AbortSignal): Promise<DockerContainerSummary[]> {
    const rows = JSON.parse(await this.collect(this.versionedPath("/containers/json"), { all: all ? "1" : "0" }, signal)) as Json[];
    return rows.map((c) => ({
      id: String(c.Id),
      names: ((c.Names ?? []) as string[]).map((n) => n.replace(/^\//, "")),
      image: String(c.Image ?? ""),
      state: String(c.State ?? ""),
      status: String(c.Status ?? ""),
      created: Number(c.Created ?? 0),
      labels: (c.Labels ?? {}) as Record<string, string>,
    }));
  }

  async inspect(id: string, signal?: AbortSignal): Promise<DockerContainerDetails> {
    const c = JSON.parse(await this.collect(this.versionedPath(`/containers/${encodeURIComponent(id)}/json`), undefined, signal)) as Json;
    const labels = (c.Config?.Labels ?? {}) as Record<string, string>;
    return {
      id: String(c.Id),
      name: String(c.Name ?? "").replace(/^\//, ""),
      image: String(c.Config?.Image ?? c.Image ?? ""),
      state: String(c.State?.Status ?? ""),
      tty: c.Config?.Tty === true,
      logDriver: String(c.HostConfig?.LogConfig?.Type ?? ""),
      ...(c.State?.StartedAt && !String(c.State.StartedAt).startsWith("0001-") ? { startedAt: String(c.State.StartedAt) } : {}),
      labels,
      composeProject: labels["com.docker.compose.project"],
      composeService: labels["com.docker.compose.service"],
    };
  }

  /** Container lifecycle events until `signal` aborts; throws if the daemon cuts the connection. */
  async *events(signal?: AbortSignal): AsyncGenerator<DockerEvent> {
    const filters = JSON.stringify({ type: ["container"], event: [...CONTAINER_EVENTS] });
    const res = await this.open("GET", this.versionedPath("/events"), { filters }, signal);
    let rest = "";
    try {
      for await (const chunk of res) {
        rest += (chunk as Buffer).toString("utf8");
        let nl: number;
        while ((nl = rest.indexOf("\n")) >= 0) {
          const line = rest.slice(0, nl).trim();
          rest = rest.slice(nl + 1);
          if (line) yield parseEvent(JSON.parse(line) as Json);
        }
      }
    } catch (err) {
      if (signal?.aborted) return;
      throw toDockerError(err);
    }
    if (!signal?.aborted) throw new DockerError("CONNECTION", "Docker event stream closed");
  }

  /**
   * Log bytes of a container, stdout and stderr interleaved (demultiplexed unless it has a TTY).
   * Ends when the container stops (no `follow`) or `signal` aborts.
   */
  async logs(id: string, opts: LogsOptions = {}, signal?: AbortSignal): Promise<Readable> {
    const tty = opts.tty ?? (await this.inspect(id, signal)).tty;
    const query: Record<string, string> = { stdout: "1", stderr: "1" };
    if (opts.follow) query.follow = "1";
    if (opts.timestamps) query.timestamps = "1";
    if (opts.tail !== undefined) query.tail = String(opts.tail);
    if (opts.since !== undefined) {
      query.since = String(opts.since instanceof Date ? Math.floor(opts.since.getTime() / 1000) : opts.since);
    }
    const res = await this.open("GET", this.versionedPath(`/containers/${encodeURIComponent(id)}/logs`), query, signal);
    const out: Readable = tty ? new Readable({ read() {} }) : new LogDemuxer();
    const write = (b: Buffer): void => {
      if (out instanceof LogDemuxer) out.write(b);
      else out.push(b);
    };
    const end = (): void => {
      if (out instanceof LogDemuxer) out.end();
      else out.push(null);
    };
    res.on("data", write);
    res.on("end", end);
    res.on("error", (e) => (signal?.aborted ? end() : out.destroy(toDockerError(e))));
    res.on("close", () => {
      if (res.complete) return;
      if (signal?.aborted) end();
      else out.destroy(new DockerError("CONNECTION", "Docker log stream closed unexpectedly"));
    });
    out.on("close", () => res.destroy());
    return out;
  }

  /**
   * Single entry point to the daemon. Read-only by construction: anything but `GET` on a
   * whitelisted route is refused before a socket is touched.
   */
  request(method: string, path: string, query?: Record<string, string>, signal?: AbortSignal): Promise<IncomingMessage> {
    return this.open(method, path, query, signal);
  }

  private versionedPath(route: string): string {
    if (!this.apiVersion) throw new DockerError("CONNECTION", "Docker client not connected: call connect() first");
    return `/v${this.apiVersion}${route}`;
  }

  private async collect(path: string, query: Record<string, string> | undefined, signal?: AbortSignal): Promise<string> {
    const res = await this.open("GET", path, query, signal);
    try {
      const chunks: Buffer[] = [];
      for await (const c of res) chunks.push(c as Buffer);
      return Buffer.concat(chunks).toString("utf8");
    } catch (err) {
      throw toDockerError(err);
    }
  }

  private open(method: string, path: string, query?: Record<string, string>, signal?: AbortSignal): Promise<IncomingMessage> {
    if (method !== "GET") {
      return Promise.reject(new DockerError("FORBIDDEN", `Docker client is read-only: ${method} refused`));
    }
    const route = path.replace(/^\/v\d+(\.\d+)*(?=\/)/, "");
    if (!ALLOWED_ROUTES.some((re) => re.test(route))) {
      return Promise.reject(new DockerError("FORBIDDEN", `Docker route not allowed: ${route}`));
    }
    const qs = query && Object.keys(query).length > 0 ? `?${new URLSearchParams(query)}` : "";
    return new Promise((resolve, reject) => {
      const req = request({ ...this.endpoint, path: path + qs, method: "GET", signal, agent: false }, (res) => {
        const status = res.statusCode ?? 0;
        if (status >= 200 && status < 300) return resolve(res);
        const chunks: Buffer[] = [];
        res.on("data", (c: Buffer) => chunks.push(c));
        res.on("end", () => {
          let msg = Buffer.concat(chunks).toString("utf8");
          try {
            msg = (JSON.parse(msg) as Json).message ?? msg;
          } catch {
            /* plain-text body */
          }
          reject(new DockerError("HTTP", `Docker answered ${status}: ${msg}`.trim(), status));
        });
        res.on("error", (e) => reject(toDockerError(e)));
      });
      req.on("error", (e) => reject(toDockerError(e)));
      req.end();
    });
  }
}

function parseEvent(e: Json): DockerEvent {
  const { name, image, oldName, ...attributes } = (e.Actor?.Attributes ?? {}) as Record<string, string>;
  return {
    action: String(e.Action ?? e.status ?? ""),
    id: String(e.Actor?.ID ?? e.id ?? ""),
    name,
    oldName: oldName?.replace(/^\//, ""),
    image,
    attributes,
    time: Number(e.time ?? 0),
  };
}
