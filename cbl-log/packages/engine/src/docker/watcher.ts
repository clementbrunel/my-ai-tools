// ContainerWatcher: keeps the container list up to date from /containers/json and /events, and
// tells its listeners (throttled) whenever it changed or Docker became (un)available.
import type { DockerContainerInfo, DockerListResult } from "@cbl-log/shared";
import type { DockerClient, DockerContainerSummary, DockerVersionInfo } from "./client.js";
import { toDockerError, type DockerError } from "./errors.js";

export type WatcherSnapshot = DockerListResult;

export interface ContainerWatcherOptions {
  client: DockerClient;
  /** Minimum delay between two refreshes (default 300 ms). */
  throttleMs?: number;
  /** Delay before reconnecting the event stream (default 2 s). */
  retryMs?: number;
  /** Docker context reported in the snapshots (default "default"). */
  context?: string;
}

export class ContainerWatcher {
  private readonly client: DockerClient;
  private readonly throttleMs: number;
  private readonly retryMs: number;
  private readonly listeners = new Set<(s: WatcherSnapshot) => void>();
  /** Driver and start time per container, inspected again when its state changes. */
  private readonly details = new Map<string, { state: string; logDriver: string | undefined; startedAt: string | undefined }>();
  private readonly context: string;
  private versionInfo: DockerVersionInfo | undefined;
  private current: WatcherSnapshot = { status: "unavailable", containers: [] };
  private ac: AbortController | undefined;
  private timer: NodeJS.Timeout | undefined;
  private refreshing: Promise<void> | undefined;
  private last = "";

  constructor(options: ContainerWatcherOptions) {
    this.client = options.client;
    this.throttleMs = options.throttleMs ?? 300;
    this.retryMs = options.retryMs ?? 2000;
    this.context = options.context ?? "default";
  }

  get snapshot(): WatcherSnapshot {
    return this.current;
  }

  /** Subscribes; the first listener starts the watching, the last one to leave stops it. */
  subscribe(listener: (s: WatcherSnapshot) => void): () => void {
    this.listeners.add(listener);
    if (!this.ac) void this.start();
    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0) this.stop();
    };
  }

  /** One-off list (does not start the watching). */
  async list(): Promise<WatcherSnapshot> {
    await this.refresh();
    return this.current;
  }

  stop(): void {
    this.ac?.abort();
    this.ac = undefined;
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
  }

  private async start(): Promise<void> {
    const ac = (this.ac = new AbortController());
    while (!ac.signal.aborted) {
      await this.refresh();
      if (this.current.status === "connected") {
        try {
          this.scheduleRefresh(); // covers what happened between the list and the connection of the stream
          for await (const _ of this.client.events(ac.signal)) this.scheduleRefresh();
        } catch {
          // stream cut: the refresh below reports the daemon as unavailable if it is gone
        }
      }
      if (ac.signal.aborted) break;
      await new Promise((r) => setTimeout(r, this.retryMs));
    }
  }

  private scheduleRefresh(): void {
    this.timer ??= setTimeout(() => {
      this.timer = undefined;
      void this.refresh();
    }, this.throttleMs);
  }

  private refresh(): Promise<void> {
    this.refreshing ??= this.doRefresh().finally(() => (this.refreshing = undefined));
    return this.refreshing;
  }

  private async doRefresh(): Promise<void> {
    let next: WatcherSnapshot;
    try {
      if (!this.client.negotiatedApiVersion) this.versionInfo = await this.client.connect();
      const list = await this.client.listContainers(true);
      const containers = await Promise.all(list.map((c) => this.describe(c)));
      containers.sort((a, b) => a.name.localeCompare(b.name));
      for (const id of this.details.keys()) if (!list.some((c) => c.id === id)) this.details.delete(id);
      next = {
        status: "connected",
        context: this.context,
        ...(this.versionInfo ? { version: this.versionInfo.version, apiVersion: this.client.negotiatedApiVersion ?? this.versionInfo.apiVersion } : {}),
        containers,
      };
    } catch (err) {
      const e = toDockerError(err);
      next = { status: "unavailable", error: e.message, errorCode: errorKind(e), context: this.context, containers: [] };
    }
    this.current = next;
    const key = JSON.stringify(next);
    if (key === this.last) return;
    this.last = key;
    for (const l of [...this.listeners]) l(next);
  }

  private async describe(c: DockerContainerSummary): Promise<DockerContainerInfo> {
    let known = this.details.get(c.id);
    if (!known || known.state !== c.state) {
      try {
        const d = await this.client.inspect(c.id);
        known = { state: c.state, logDriver: d.logDriver, startedAt: d.startedAt };
        this.details.set(c.id, known);
      } catch {
        known = undefined; // removed meanwhile: shown as readable, the next refresh drops it
      }
    }
    const driver = known?.logDriver;
    const project = c.labels["com.docker.compose.project"];
    const service = c.labels["com.docker.compose.service"];
    return {
      id: c.id,
      name: c.names[0] ?? c.id.slice(0, 12),
      image: c.image,
      state: c.state,
      status: c.status,
      ...(project ? { composeProject: project } : {}),
      ...(service ? { composeService: service } : {}),
      ...(driver ? { logDriver: driver } : {}),
      ...(known?.startedAt ? { startedAt: known.startedAt } : {}),
      readable: driver !== "none",
    };
  }
}

function errorKind(e: DockerError): "NOT_RUNNING" | "ACCESS_DENIED" | "API_TOO_OLD" | "OTHER" {
  return e.code === "NOT_RUNNING" || e.code === "ACCESS_DENIED" || e.code === "API_TOO_OLD" ? e.code : "OTHER";
}
