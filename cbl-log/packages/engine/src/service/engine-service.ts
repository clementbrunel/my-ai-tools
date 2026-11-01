// Engine request handler: owns one Tailer per open tab and speaks the protocol of
// @cbl-log/shared over any message port. Pure Node (no Electron): the host provides a PortLike.
import { randomUUID } from "node:crypto";
import { open, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  FilterEvaluator,
  MAX_ROWS_PER_REQUEST,
  compileFormat,
  isFilterActive,
  type Encoding,
  type EngineEvent,
  type EngineMessage,
  type EngineOp,
  type EngineRequest,
  type EngineRequestMap,
  type EngineResponse,
  type FilterLocateParams,
  type FilterLocation,
  type DockerListResult,
  type DockerLoadMoreParams,
  type DockerLoadMoreResult,
  type FilterStarted,
  type GetRowsParams,
  type OpenParams,
  type RowsResult,
  type SearchHit,
  type SearchNextParams,
  type SearchParams,
  type SearchStarted,
  type SetFilterParams,
  type TabEvent,
  type TabHistory,
  type TabId,
  type TabInfo,
} from "@cbl-log/shared";
import { detectEncoding, isUtf16, looksBinary } from "../source/encoding.js";
import { SourceError, toSourceError } from "../source/source.js";
import { FilterSession, type FilterSessionOptions } from "../filter/session.js";
import { SearchSession, type SearchSessionOptions } from "../search/session.js";
import { findArchives, type ArchiveFile, type ArchiveScan } from "../tail/archives.js";
import { Tailer } from "../tail/tailer.js";
import { DockerClient } from "../docker/client.js";
import { DockerError } from "../docker/errors.js";
import { currentContextName } from "../docker/endpoint.js";
import { ContainerWatcher } from "../docker/watcher.js";
import { LogSpooler, purgeSpools, type SpoolerOptions } from "../docker/spooler.js";

/** Minimal message port: adapters wrap MessagePortMain (Electron) or node:worker_threads ports. */
export interface PortLike {
  postMessage(msg: unknown): void;
  /** Subscribes to incoming messages; returns the unsubscribe function. */
  onMessage(handler: (msg: unknown) => void): () => void;
}

export interface EngineServiceOptions {
  /** Files larger than this are indexed in a worker thread (default 64 MiB). */
  indexWithWorkerAboveBytes?: number;
  /** Tuning of the search pool (tests shrink the slices and the stall delay). */
  search?: SearchSessionOptions;
  /** Same for the filter pool. */
  filter?: FilterSessionOptions;
  docker?: EngineDockerOptions;
}

export interface EngineDockerOptions {
  /** Default: a client on the endpoint resolved from `host`, DOCKER_HOST and the current context. */
  client?: DockerClient;
  /** `docker.host` of settings.json. */
  host?: string;
  /** Folder of the spools (default `%LOCALAPPDATA%/cbl-log/docker`). */
  spoolRoot?: string;
  /** Lines loaded when a container is opened (default 5 000). */
  initialTail?: number;
  /** Size at which a spool is rotated (default 256 MiB). */
  spoolMaxBytes?: number;
  /** Keep the spool when the tab is closed (and leftovers at the next start). */
  keepSpoolOnClose?: boolean;
  /** Timing overrides (tests). */
  spooler?: Pick<SpoolerOptions, "flushMs" | "flushBytes" | "retryMs" | "maxRetryMs" | "pollMs" | "maxArchives">;
  watcher?: { throttleMs?: number; retryMs?: number };
}

export const DEFAULT_WORKER_THRESHOLD_BYTES = 64 * 1024 * 1024;
const SNIFF_BYTES = 4096;
const INDEXING_THROTTLE_MS = 100;
const HOUR_MS = 3_600_000;

interface Tab {
  tailer: Tailer;
  /** Docker tab: the writer of the file the tailer follows. */
  spooler?: LogSpooler;
  /** Docker tab: `context/name`. */
  dockerKey?: string;
  encoding: Encoding;
  openId?: string;
  search?: SearchSession;
  filter?: FilterSession;
  /** Port that opened the tab: the only one receiving its events. */
  port: PortLike;
  unsubscribe: () => void;
}

type Handler<K extends EngineOp> = (
  params: EngineRequestMap[K]["params"],
  port: PortLike,
) => Promise<EngineRequestMap[K]["result"]>;

export class EngineService {
  private readonly threshold: number;
  private readonly searchOptions: SearchSessionOptions;
  private readonly filterOptions: FilterSessionOptions;
  private readonly tabs = new Map<TabId, Tab>();
  private readonly detachers = new Set<() => void>();
  private readonly dockerOptions: EngineDockerOptions;
  private dockerClient: DockerClient | undefined;
  private watcher: ContainerWatcher | undefined;
  private readonly dockerSubs = new Map<PortLike, () => void>();
  private purged: Promise<void> | undefined;

  constructor(options: EngineServiceOptions = {}) {
    this.threshold = options.indexWithWorkerAboveBytes ?? DEFAULT_WORKER_THRESHOLD_BYTES;
    this.searchOptions = options.search ?? {};
    this.filterOptions = options.filter ?? {};
    this.dockerOptions = options.docker ?? {};
  }

  /** Starts serving requests received on `port`. Returns a function that detaches it. */
  attach(port: PortLike): () => void {
    const off = port.onMessage((msg) => void this.handle(msg, port));
    const detach = (): void => {
      off();
      this.detachers.delete(detach);
      this.dockerSubs.get(port)?.();
      this.dockerSubs.delete(port);
      for (const [tabId, tab] of [...this.tabs]) if (tab.port === port) void this.closeTab(tabId);
    };
    this.detachers.add(detach);
    return detach;
  }

  async dispose(): Promise<void> {
    for (const detach of [...this.detachers]) detach();
    await Promise.all([...this.tabs.keys()].map((id) => this.closeTab(id)));
    this.watcher?.stop();
  }

  private readonly handlers: { [K in EngineOp]: Handler<K> } = {
    open: (params, port) => this.openTab(params, port),
    getRows: (params) => this.getRows(params),
    close: (params) => this.closeTab(params.tabId),
    search: (params, port) => this.startSearch(params, port),
    searchNext: (params) => this.searchNext(params),
    setFilter: (params, port) => this.startFilter(params, port),
    filterLocate: (params) => this.filterLocate(params),
    dockerList: () => this.dockerList(),
    dockerSubscribe: (_params, port) => this.dockerSubscribe(port),
    dockerLoadMore: (params) => this.dockerLoadMore(params),
  };

  private async handle(msg: unknown, port: PortLike): Promise<void> {
    if (!isRequest(msg)) return;
    let response: EngineResponse;
    try {
      const handler = (this.handlers as Partial<Record<string, Handler<EngineOp>>>)[msg.op];
      if (!handler) throw new SourceError("UNKNOWN", "", `Unknown request: ${String(msg.op)}`);
      response = { kind: "response", id: msg.id, ok: true, result: await handler(msg.params as never, port) };
    } catch (err) {
      const code = err instanceof SourceError ? err.code : err instanceof DockerError ? `DOCKER_${err.code}` : "UNKNOWN";
      const message = err instanceof Error ? err.message : String(err);
      response = { kind: "response", id: msg.id, ok: false, error: { code, message } };
    }
    this.send(port, response);
  }

  private send(port: PortLike, msg: EngineMessage): void {
    try {
      port.postMessage(msg);
    } catch {
      // port closed: nothing to notify
    }
  }

  private async openTab(params: OpenParams, port: PortLike): Promise<TabInfo> {
    if (params.docker) return this.openDockerTab(params, port);
    const { path } = params;
    if (typeof path !== "string" || path === "") throw new SourceError("ENOENT", String(path), "Missing file path");
    return this.openAt(randomUUID(), path, params, port, "file");
  }

  /** Starts the spooler of a container, then follows its spool file like any other log. */
  private async openDockerTab(params: OpenParams, port: PortLike): Promise<TabInfo> {
    const { context, name, initialTail } = params.docker!;
    if (!context || !name) throw new SourceError("UNKNOWN", "", "Missing Docker context or container name");
    const key = `${context}/${name}`;
    if ([...this.tabs.values()].some((t) => t.dockerKey === key)) {
      throw new SourceError("UNKNOWN", "", `Container already open: ${key}`);
    }
    const o = this.dockerOptions;
    const root = o.spoolRoot ?? join(process.env["LOCALAPPDATA"] ?? tmpdir(), "cbl-log", "docker");
    if (!o.keepSpoolOnClose) await (this.purged ??= purgeSpools(root));
    const tabId = randomUUID();
    const ref: { tab?: Tab; last: { state: "following" | "stopped" | "waiting" | "error"; message?: string | undefined } } = {
      last: { state: "following" },
    };
    const spooler = new LogSpooler({
      client: (this.dockerClient ??= o.client ?? new DockerClient(o.host ? { settingsHost: o.host } : {})),
      dir: join(root, fileSafe(context)),
      name: fileSafe(name),
      ...(o.spoolMaxBytes !== undefined ? { maxBytes: o.spoolMaxBytes } : {}),
      initialTail: initialTail ?? o.initialTail ?? 5000,
      ...o.spooler,
      onWrite: () => ref.tab?.tailer.poke(),
      onRecreated: () => ref.tab?.tailer.expectRoll("recreated"),
      onState: (state, message) => {
        ref.last = { state, message };
        if (ref.tab) this.emitEvent(ref.tab.port, tabId, { type: "state", state, ...(message ? { message } : {}) });
      },
    });
    await spooler.start(); // throws a DockerError: Docker down, container missing or unreadable
    try {
      const info = await this.openAt(tabId, spooler.path, { ...params, encoding: params.encoding ?? "utf-8" }, port, "docker", {
        spooler,
        dockerKey: key,
      });
      ref.tab = this.tabs.get(tabId);
      this.emitEvent(port, tabId, { type: "state", state: ref.last.state, ...(ref.last.message ? { message: ref.last.message } : {}) });
      return info;
    } catch (err) {
      await spooler.stop({ remove: !o.keepSpoolOnClose });
      throw err;
    }
  }

  /** Opens `path` in a new tab: encoding / binary checks, tailer, initial indexing. */
  private async openAt(
    tabId: TabId,
    path: string,
    params: OpenParams,
    port: PortLike,
    source: TabInfo["source"],
    docker?: Pick<Tab, "spooler" | "dockerKey">,
  ): Promise<TabInfo> {
    const size = await sizeOf(path);
    const sniffed = await sniff(path);
    const encoding: Encoding = params.encoding ?? detectEncoding(sniffed);
    if (!isUtf16(encoding) && looksBinary(sniffed)) throw new SourceError("BINARY", path, `Binary file: ${path}`);

    // a Docker spool has no archives next to it
    const hours = source === "file" && Number(params.historyHours) > 0 ? Number(params.historyHours) : 0;
    const scan: ArchiveScan =
      hours > 0 ? await findArchives(path, { pattern: params.archivePattern, since: Date.now() - hours * HOUR_MS }) : { loaded: [], skipped: 0 };
    const totalBytes = scan.loaded.reduce((n, a) => n + a.size, size);
    const showProgress = totalBytes > this.threshold;
    const tab: Tab = {
      tailer: undefined as unknown as Tailer,
      port,
      unsubscribe: () => {},
      encoding,
      ...(params.openId ? { openId: params.openId } : {}),
      ...docker,
    };
    const emitIndexing = this.wireTailer(tabId, tab, path, { size, history: scan.loaded });
    this.tabs.set(tabId, tab);
    try {
      await tab.tailer.start();
    } catch (err) {
      await this.closeTab(tabId);
      throw toSourceError(err, path);
    }
    if (showProgress) emitIndexing(1, true);
    if (tab.tailer.phase === "missing" || tab.tailer.phase === "error") {
      await this.closeTab(tabId);
      throw new SourceError("ENOENT", path, `File not readable: ${path}`);
    }
    const info: TabInfo = { tabId, source, path, encoding, sizeBytes: size, totalRows: tab.tailer.totalRows, lineEnding: "unknown" };
    if (hours > 0) info.history = historyOf(tab.tailer, scan, hours);
    return info;
  }

  /**
   * Creates the tailer of a tab and forwards its events (keeping search and filter in step).
   * `initial`: the file's size and the archives loaded before it, indexed with one progress for the
   * whole stream (large files in a worker); absent: plain indexing, no progress.
   * Returns the throttled emitter of `indexing` events.
   */
  private wireTailer(
    tabId: TabId,
    tab: Tab,
    path: string,
    initial?: { size: number; history: readonly ArchiveFile[] },
  ): (progress: number, force?: boolean) => void {
    const port = tab.port;
    let lastIndexingAt = 0;
    const emitIndexing = (progress: number, force = false): void => {
      const now = Date.now();
      if (!force && now - lastIndexingAt < INDEXING_THROTTLE_MS) return;
      lastIndexingAt = now;
      this.emitEvent(port, tab.openId ?? tabId, { type: "indexing", progress, provisional: false });
    };
    const sizes = new Map<string, number>((initial?.history ?? []).map((a) => [a.path, a.size]));
    if (initial) sizes.set(path, initial.size);
    const totalBytes = [...sizes.values()].reduce((a, b) => a + b, 0);
    const showProgress = totalBytes > this.threshold;
    const ratio = (bytes: number): number => (totalBytes > 0 ? Math.min(1, bytes / totalBytes) : 1);
    let doneBytes = 0;
    tab.tailer = new Tailer({
      path,
      encoding: tab.encoding,
      history: (initial?.history ?? []).map((a) => a.path),
      initialIndexer: initial
        ? async (index, file) => {
            const fileSize = sizes.get(file) ?? 0;
            if (fileSize > this.threshold) {
              await index.indexWithWorker({ onProgress: (p) => showProgress && emitIndexing(ratio(doneBytes + p.bytesRead)) });
            } else {
              await index.appendFrom();
            }
            doneBytes += fileSize;
            if (showProgress) emitIndexing(ratio(doneBytes));
          }
        : undefined,
    });
    tab.unsubscribe = tab.tailer.on((event) => {
      // a Docker tab's state is the spooler's (following / stopped / waiting), not the file's
      if (tab.spooler && event.type === "state" && event.state === "following") return;
      this.emitEvent(port, tabId, event);
      // keep the search and the filter of the tab in step with the file
      if (event.type === "rows") {
        tab.search?.extend();
        tab.filter?.extend();
      } else if (event.type === "rolled") {
        tab.search?.restart();
        tab.filter?.restart();
      }
    });
    return emitIndexing;
  }

  private async dockerList(): Promise<DockerListResult> {
    return this.containerWatcher().list();
  }

  private async dockerSubscribe(port: PortLike): Promise<DockerListResult> {
    const watcher = this.containerWatcher();
    if (!this.dockerSubs.has(port)) {
      this.dockerSubs.set(
        port,
        watcher.subscribe((snapshot) => this.send(port, { kind: "dockerContainers", ...snapshot })),
      );
    }
    return watcher.list();
  }

  private containerWatcher(): ContainerWatcher {
    const o = this.dockerOptions;
    this.dockerClient ??= o.client ?? new DockerClient(o.host ? { settingsHost: o.host } : {});
    return (this.watcher ??= new ContainerWatcher({ client: this.dockerClient, context: currentContextName(o.host ? { settingsHost: o.host } : {}), ...o.watcher }));
  }

  /** "Load more history": the spool is rebuilt with a bigger `tail` and the tab re-indexed in place. */
  private async dockerLoadMore(params: DockerLoadMoreParams): Promise<DockerLoadMoreResult> {
    const tab = this.requireTab(params.tabId);
    const spooler = tab.spooler;
    if (!spooler) throw new SourceError("UNKNOWN", "", "Not a Docker tab");
    const before = tab.tailer.totalRows;
    tab.unsubscribe();
    await tab.tailer.close();
    try {
      await spooler.rebuild(params.tail);
    } finally {
      this.wireTailer(params.tabId, tab, spooler.path);
      await tab.tailer.start();
      tab.search?.restart();
      tab.filter?.restart();
    }
    const totalRows = tab.tailer.totalRows;
    return { tabId: params.tabId, totalRows, addedBefore: Math.max(0, totalRows - before) };
  }

  private async getRows(params: GetRowsParams): Promise<RowsResult> {
    const { tailer, filter } = this.requireTab(params.tabId);
    const start = Math.max(0, Math.floor(Number(params.first) || 0));
    const wanted = Math.min(MAX_ROWS_PER_REQUEST, Math.max(0, Math.floor(Number(params.count) || 0)));
    if (params.filterId !== undefined) {
      // the filter was replaced or removed meanwhile: nothing to show for the old one
      if (!filter || filter.id !== params.filterId) return { first: start, rows: [], total: 0 };
      const { rows, total } = await filter.rows(start, wanted);
      return { first: start, rows, total };
    }
    const total = tailer.totalRows;
    const n = Math.min(wanted, Math.max(0, total - start));
    if (n === 0) return { first: start, rows: [], total };
    const lines = await tailer.getLines(start, n);
    return {
      first: start,
      rows: lines.map((l) => ({ lineNo: l.lineNo, text: l.text, truncated: l.truncated })),
      total: tailer.totalRows,
    };
  }

  private async startSearch(params: SearchParams, port: PortLike): Promise<SearchStarted> {
    const tab = this.requireTab(params.tabId);
    tab.search?.dispose();
    tab.search = undefined;
    const { query } = params;
    if (!query || query.pattern === "") return { searchId: null };
    if (query.isRegex) {
      try {
        new RegExp(query.pattern);
      } catch (err) {
        throw new SourceError("BAD_QUERY", "", err instanceof Error ? err.message : String(err));
      }
    }
    const session = new SearchSession(
      query,
      () => tab.tailer.currentTarget,
      (event) => this.emitEvent(port, params.tabId, event),
      this.searchOptions,
    );
    tab.search = session;
    session.start();
    return { searchId: session.id };
  }

  private async startFilter(params: SetFilterParams, port: PortLike): Promise<FilterStarted> {
    const tab = this.requireTab(params.tabId);
    tab.filter?.dispose();
    tab.filter = undefined;
    const { filter } = params;
    if (!isFilterActive(filter)) return { filterId: null };
    const format = params.format ?? null;
    if (filter.levels !== undefined && !format) throw new SourceError("BAD_QUERY", "", "Level filter needs a log format");
    try {
      new FilterEvaluator(filter, format ? compileFormat(format) : undefined);
    } catch (err) {
      throw new SourceError("BAD_QUERY", "", err instanceof Error ? err.message : String(err));
    }
    const session = new FilterSession(
      filter,
      format,
      () => tab.tailer.currentTarget,
      (first, count) => tab.tailer.getLines(first, count),
      (event) => this.emitEvent(port, params.tabId, event),
      this.filterOptions,
    );
    tab.filter = session;
    session.start();
    return { filterId: session.id };
  }

  private async filterLocate(params: FilterLocateParams): Promise<FilterLocation> {
    const tab = this.requireTab(params.tabId);
    const session = tab.filter;
    if (!session || session.id !== params.filterId) return { position: 0, exact: false, covered: true };
    const startRow = tab.tailer.currentTarget?.startRow ?? 0;
    return session.locate(Math.max(0, Math.floor(Number(params.row) || 0) - startRow));
  }

  private async searchNext(params: SearchNextParams): Promise<SearchHit> {
    const session = this.requireTab(params.tabId).search;
    if (!session || session.id !== params.searchId) {
      return { row: null, ordinal: null, matches: 0, done: true, wrapped: false };
    }
    return session.next(params.fromRow, params.dir);
  }

  private async closeTab(tabId: TabId): Promise<void> {
    const tab = this.tabs.get(tabId);
    if (!tab) return;
    this.tabs.delete(tabId);
    tab.search?.dispose();
    tab.filter?.dispose();
    tab.unsubscribe();
    await tab.spooler?.stop({ remove: !this.dockerOptions.keepSpoolOnClose }); // cuts the stream first
    await tab.tailer.close();
  }

  private requireTab(tabId: TabId): Tab {
    const tab = this.tabs.get(tabId);
    if (!tab) throw new SourceError("UNKNOWN", "", `Unknown tab: ${String(tabId)}`);
    return tab;
  }

  private emitEvent(port: PortLike, tabId: TabId, event: TabEvent): void {
    const msg: EngineEvent = { kind: "event", tabId, event };
    this.send(port, msg);
  }
}

function isRequest(msg: unknown): msg is EngineRequest {
  const m = msg as Partial<EngineRequest> | null;
  return !!m && typeof m === "object" && m.kind === "request" && typeof m.id === "number" && typeof m.op === "string";
}

/** First bytes of the file, used for encoding and binary detection; throws a typed error. */
async function sniff(path: string): Promise<Buffer> {
  try {
    const handle = await open(path, "r");
    try {
      const buf = Buffer.alloc(SNIFF_BYTES);
      const { bytesRead } = await handle.read(buf, 0, SNIFF_BYTES, 0);
      return buf.subarray(0, bytesRead);
    } finally {
      await handle.close();
    }
  } catch (err) {
    throw toSourceError(err, path);
  }
}

/** Size of a regular file; typed errors for a missing file or a directory. */
/** Archives that made it into the tab (an unreadable one is skipped by the tailer). */
function historyOf(tailer: Tailer, scan: ArchiveScan, hours: number): TabHistory {
  const mtimes = new Map(scan.loaded.map((a) => [a.path, a.mtimeMs]));
  const files = tailer.segments
    .filter((seg) => seg.startedBy === "history")
    .map((seg) => ({ path: seg.path, startRow: seg.startRow, rowCount: seg.rowCount, mtimeMs: mtimes.get(seg.path) ?? 0 }));
  return { files, skipped: scan.skipped, hours };
}

async function sizeOf(path: string): Promise<number> {
  try {
    const info = await stat(path);
    if (info.isDirectory()) throw new SourceError("EISDIR", path, `${path} is a directory`);
    return info.size;
  } catch (err) {
    throw toSourceError(err, path);
  }
}

/** Folder / file name made of a Docker context or container name. */
function fileSafe(name: string): string {
  return name.replace(/[<>:"/\\|?*\x00-\x1f]/g, "_");
}
