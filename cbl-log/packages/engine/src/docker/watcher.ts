// ContainerWatcher: keeps the container list up to date from /containers/json and /events, and
// tells its listeners (throttled) whenever it changed or Docker became (un)available.
import type { DockerContainerInfo, DockerListResult } from "@cbl-log/shared";
import type { DockerClient, DockerContainerSummary } from "./client.js";
import { toDockerError } from "./errors.js";

export type WatcherSnapshot = DockerListResult;

export interface ContainerWatcherOptions {
  client: DockerClient;
  /** Minimum delay between two refreshes (default 300 ms). */
  throttleMs?: number;
  /** Delay before reconnecting the event stream (default 2 s). */
  retryMs?: number;
}

export class ContainerWatcher {
  private readonly client: DockerClient;
  private readonly throttleMs: number;
  private readonly retryMs: number;
  private readonly listeners = new Set<(s: WatcherSnapshot) => void>();
  private readonly drivers = new Map<string, string>();
  private current: WatcherSnapshot = { status: "unavailable", containers: [] };
  private ac: AbortController | undefined;
  private timer: NodeJS.Timeout | undefined;
  private refreshing: Promise<void> | undefined;
  private last = "";

  constructor(options: ContainerWatcherOptions) {
    this.client = options.client;
    this.throttleMs = options.throttleMs ?? 300;
    this.retryMs = options.retryMs ?? 2000;
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
      if (!this.client.negotiatedApiVersion) await this.client.connect();
      const list = await this.client.listContainers(true);
      const containers = await Promise.all(list.map((c) => this.describe(c)));
      containers.sort((a, b) => a.name.localeCompare(b.name));
      next = { status: "connected", containers };
    } catch (err) {
      next = { status: "unavailable", error: toDockerError(err).message, containers: [] };
    }
    this.current = next;
    const key = JSON.stringify(next);
    if (key === this.last) return;
    this.last = key;
    for (const l of [...this.listeners]) l(next);
  }

  private async describe(c: DockerContainerSummary): Promise<DockerContainerInfo> {
    let driver = this.drivers.get(c.id);
    if (driver === undefined) {
      try {
        driver = (await this.client.inspect(c.id)).logDriver;
        this.drivers.set(c.id, driver);
      } catch {
        driver = undefined; // removed meanwhile: shown as readable, the next refresh drops it
      }
    }
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
      readable: driver !== "none",
    };
  }
}
