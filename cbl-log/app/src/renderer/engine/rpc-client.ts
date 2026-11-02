import type { DockerListResult, EngineMessage, EngineOp, EngineRequestMap, TabEvent, TabId } from "@cbl-log/shared";

/** Minimal port surface, implemented by a DOM MessagePort (see client.ts) or a node one in tests. */
export interface MinimalPort {
  postMessage(msg: unknown): void;
  onMessage(handler: (msg: unknown) => void): () => void;
}

export class EngineRequestError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "EngineRequestError";
  }
}

interface Pending {
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

export const DEFAULT_REQUEST_TIMEOUT_MS = 10_000;

/** Request/response correlation and event routing over a port. No DOM dependency. */
export class RpcClient {
  private nextId = 1;
  private readonly pending = new Map<number, Pending>();
  private readonly tabListeners = new Map<TabId, Set<(event: TabEvent) => void>>();
  private readonly anyListeners = new Set<(tabId: TabId, event: TabEvent) => void>();
  private readonly dockerListeners = new Set<(snapshot: DockerListResult) => void>();
  private readonly detach: () => void;

  constructor(
    private readonly port: MinimalPort,
    private readonly timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
  ) {
    this.detach = port.onMessage((msg) => this.onMessage(msg as EngineMessage));
  }

  request<K extends EngineOp>(op: K, params: EngineRequestMap[K]["params"]): Promise<EngineRequestMap[K]["result"]> {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new EngineRequestError("TIMEOUT", `Engine request "${op}" timed out after ${this.timeoutMs} ms`));
      }, this.timeoutMs);
      this.pending.set(id, { resolve: resolve as (v: unknown) => void, reject, timer });
      this.port.postMessage({ kind: "request", id, op, params });
    });
  }

  onTabEvent(tabId: TabId, cb: (event: TabEvent) => void): () => void {
    let set = this.tabListeners.get(tabId);
    if (!set) this.tabListeners.set(tabId, (set = new Set()));
    set.add(cb);
    return () => {
      set.delete(cb);
      if (set.size === 0) this.tabListeners.delete(tabId);
    };
  }

  onAnyEvent(cb: (tabId: TabId, event: TabEvent) => void): () => void {
    this.anyListeners.add(cb);
    return () => this.anyListeners.delete(cb);
  }

  /** Container list pushed by the engine after `dockerSubscribe`. */
  onDockerContainers(cb: (snapshot: DockerListResult) => void): () => void {
    this.dockerListeners.add(cb);
    return () => this.dockerListeners.delete(cb);
  }

  /** Rejects every in-flight request and stops listening. */
  dispose(): void {
    this.detach();
    for (const [id, p] of this.pending) {
      clearTimeout(p.timer);
      p.reject(new EngineRequestError("DISCONNECTED", "Engine connection closed"));
      this.pending.delete(id);
    }
    this.tabListeners.clear();
    this.anyListeners.clear();
    this.dockerListeners.clear();
  }

  private onMessage(msg: EngineMessage): void {
    if (!msg || typeof msg !== "object") return;
    if (msg.kind === "response") {
      const p = this.pending.get(msg.id);
      if (!p) return;
      this.pending.delete(msg.id);
      clearTimeout(p.timer);
      if (msg.ok) p.resolve(msg.result);
      else p.reject(new EngineRequestError(msg.error.code, msg.error.message));
    } else if (msg.kind === "dockerContainers") {
      const { kind: _kind, ...snapshot } = msg;
      for (const cb of [...this.dockerListeners]) cb(snapshot);
    } else if (msg.kind === "event") {
      for (const cb of [...(this.tabListeners.get(msg.tabId) ?? [])]) cb(msg.event);
      for (const cb of [...this.anyListeners]) cb(msg.tabId, msg.event);
    }
  }
}
