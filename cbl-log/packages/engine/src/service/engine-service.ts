// Engine request handler: owns one Tailer per open tab and speaks the protocol of
// @cbl-log/shared over any message port. Pure Node (no Electron): the host provides a PortLike.
import { randomUUID } from "node:crypto";
import { open, stat } from "node:fs/promises";
import {
  MAX_ROWS_PER_REQUEST,
  type Encoding,
  type EngineEvent,
  type EngineMessage,
  type EngineOp,
  type EngineRequest,
  type EngineRequestMap,
  type EngineResponse,
  type OpenParams,
  type RowsResult,
  type SearchHit,
  type SearchNextParams,
  type SearchParams,
  type SearchStarted,
  type TabEvent,
  type TabId,
  type TabInfo,
} from "@cbl-log/shared";
import { detectEncoding, isUtf16, looksBinary } from "../source/encoding.js";
import { SourceError, toSourceError } from "../source/source.js";
import { SearchSession, type SearchSessionOptions } from "../search/session.js";
import { Tailer } from "../tail/tailer.js";

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
}

export const DEFAULT_WORKER_THRESHOLD_BYTES = 64 * 1024 * 1024;
const SNIFF_BYTES = 4096;
const INDEXING_THROTTLE_MS = 100;

interface Tab {
  tailer: Tailer;
  search?: SearchSession;
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
  private readonly tabs = new Map<TabId, Tab>();
  private readonly detachers = new Set<() => void>();

  constructor(options: EngineServiceOptions = {}) {
    this.threshold = options.indexWithWorkerAboveBytes ?? DEFAULT_WORKER_THRESHOLD_BYTES;
    this.searchOptions = options.search ?? {};
  }

  /** Starts serving requests received on `port`. Returns a function that detaches it. */
  attach(port: PortLike): () => void {
    const off = port.onMessage((msg) => void this.handle(msg, port));
    const detach = (): void => {
      off();
      this.detachers.delete(detach);
      for (const [tabId, tab] of [...this.tabs]) if (tab.port === port) void this.closeTab(tabId);
    };
    this.detachers.add(detach);
    return detach;
  }

  async dispose(): Promise<void> {
    for (const detach of [...this.detachers]) detach();
    await Promise.all([...this.tabs.keys()].map((id) => this.closeTab(id)));
  }

  private readonly handlers: { [K in EngineOp]: Handler<K> } = {
    open: (params, port) => this.openTab(params, port),
    getRows: (params) => this.getRows(params.tabId, params.first, params.count),
    close: (params) => this.closeTab(params.tabId),
    search: (params, port) => this.startSearch(params, port),
    searchNext: (params) => this.searchNext(params),
  };

  private async handle(msg: unknown, port: PortLike): Promise<void> {
    if (!isRequest(msg)) return;
    let response: EngineResponse;
    try {
      const handler = (this.handlers as Partial<Record<string, Handler<EngineOp>>>)[msg.op];
      if (!handler) throw new SourceError("UNKNOWN", "", `Unknown request: ${String(msg.op)}`);
      response = { kind: "response", id: msg.id, ok: true, result: await handler(msg.params as never, port) };
    } catch (err) {
      const code = err instanceof SourceError ? err.code : "UNKNOWN";
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
    const { path } = params;
    if (typeof path !== "string" || path === "") throw new SourceError("ENOENT", String(path), "Missing file path");

    const size = await sizeOf(path);
    const sniffed = await sniff(path);
    const encoding: Encoding = params.encoding ?? detectEncoding(sniffed);
    if (!isUtf16(encoding) && looksBinary(sniffed)) throw new SourceError("BINARY", path, `Binary file: ${path}`);

    const tabId = randomUUID();
    const useWorker = size > this.threshold;
    let lastIndexingAt = 0;
    const emitIndexing = (progress: number, force = false): void => {
      const now = Date.now();
      if (!force && now - lastIndexingAt < INDEXING_THROTTLE_MS) return;
      lastIndexingAt = now;
      this.emitEvent(port, tabId, { type: "indexing", progress, provisional: false });
    };

    const tailer = new Tailer({
      path,
      encoding,
      initialIndexer: useWorker
        ? (index) =>
            index.indexWithWorker({
              onProgress: (p) => emitIndexing(p.totalBytes > 0 ? Math.min(1, p.bytesRead / p.totalBytes) : 1),
            })
        : undefined,
    });
    const tab: Tab = { tailer, port, unsubscribe: () => {} };
    tab.unsubscribe = tailer.on((event) => {
      this.emitEvent(port, tabId, event);
      // keep the search of the tab in step with the file
      if (event.type === "rows") tab.search?.extend();
      else if (event.type === "rolled") tab.search?.restart();
    });
    this.tabs.set(tabId, tab);
    try {
      await tailer.start();
    } catch (err) {
      await this.closeTab(tabId);
      throw toSourceError(err, path);
    }
    if (useWorker) emitIndexing(1, true);
    if (tailer.phase === "missing" || tailer.phase === "error") {
      await this.closeTab(tabId);
      throw new SourceError("ENOENT", path, `File not readable: ${path}`);
    }
    return { tabId, path, encoding, sizeBytes: size, totalRows: tailer.totalRows, lineEnding: "unknown" };
  }

  private async getRows(tabId: TabId, first: number, count: number): Promise<RowsResult> {
    const { tailer } = this.requireTab(tabId);
    const total = tailer.totalRows;
    const start = Math.max(0, Math.floor(Number(first) || 0));
    const n = Math.min(MAX_ROWS_PER_REQUEST, Math.max(0, Math.floor(Number(count) || 0)), Math.max(0, total - start));
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
    tab.unsubscribe();
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
async function sizeOf(path: string): Promise<number> {
  try {
    const info = await stat(path);
    if (info.isDirectory()) throw new SourceError("EISDIR", path, `${path} is a directory`);
    return info.size;
  } catch (err) {
    throw toSourceError(err, path);
  }
}
