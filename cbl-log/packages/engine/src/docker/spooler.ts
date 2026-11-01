// LogSpooler: copies the log stream of ONE container (identified by its name) into a local file
// that the engine opens like any other log (architecture § 4.8). The Docker timestamp prefix
// is stripped before writing and remembered in a state file, so every reconnection resumes
// without losing or duplicating a line.
import { mkdir, open, readFile, rename, rm, stat, writeFile, type FileHandle } from "node:fs/promises";
import { join } from "node:path";
import type { DockerClient } from "./client.js";
import { DockerError, toDockerError } from "./errors.js";

export const DEFAULT_INITIAL_TAIL = 5000;
export const DEFAULT_SPOOL_MAX_BYTES = 256 * 1024 * 1024;
export const DEFAULT_FLUSH_MS = 50;
export const DEFAULT_FLUSH_BYTES = 64 * 1024;
export const DEFAULT_MAX_ARCHIVES = 3;

export type SpoolState = "following" | "stopped" | "waiting" | "error";

export interface SpoolerOptions {
  client: DockerClient;
  /** Folder of the spool (one per Docker context). */
  dir: string;
  /** Container name: the spool is `<dir>/<name>.log`. */
  name: string;
  initialTail?: number;
  /** Size at which the spool is rotated (rename + create). */
  maxBytes?: number;
  flushMs?: number;
  flushBytes?: number;
  /** Rotated / recreated spools kept on disk. */
  maxArchives?: number;
  /** First delay before retrying after a lost connection; doubles up to `maxRetryMs`. */
  retryMs?: number;
  maxRetryMs?: number;
  /** How often a stopped or missing container is looked for. */
  pollMs?: number;
  /** Called after each append: the reader can check the file now instead of at its next tick. */
  onWrite?: () => void;
  onState?: (state: SpoolState, message?: string) => void;
  /** Called just before the spool is renamed because the container was recreated. */
  onRecreated?: () => void;
}

interface StateFile {
  containerId?: string;
  /** Last timestamp written, normalized to 9 fractional digits. */
  lastTs?: string;
  /** Lines already written that carry exactly `lastTs`. */
  sameCount: number;
  /** Initial `tail` load done. */
  loaded: boolean;
  /** `since` (unix seconds) used to follow a container whose logs were empty at load time. */
  since?: number;
  archives: string[];
}

const TS_RE = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,9}))?Z /;
const EMPTY = Buffer.alloc(0);
const STATE_SAVE_MS = 500;

const normTs = (date: string, frac: string | undefined): string => `${date}.${(frac ?? "").padEnd(9, "0")}Z`;
const tsToSeconds = (ts: string): number => Math.floor(Date.parse(`${ts.slice(0, 19)}Z`) / 1000);

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) return resolve();
    const done = (): void => {
      clearTimeout(t);
      signal.removeEventListener("abort", done);
      resolve();
    };
    const t = setTimeout(done, ms);
    signal.addEventListener("abort", done);
  });
}

interface Ready {
  promise: Promise<void>;
  resolve: () => void;
  reject: (e: unknown) => void;
  done: boolean;
}

export class LogSpooler {
  readonly path: string;
  private readonly statePath: string;
  private readonly client: DockerClient;
  private readonly dir: string;
  private readonly name: string;
  private readonly initialTail: number;
  private readonly maxBytes: number;
  private readonly flushMs: number;
  private readonly flushBytes: number;
  private readonly maxArchives: number;
  private readonly retryMs: number;
  private readonly maxRetryMs: number;
  private readonly pollMs: number;
  private readonly onWrite: (() => void) | undefined;
  private readonly onState: SpoolerOptions["onState"];
  private readonly onRecreated: (() => void) | undefined;

  private st: StateFile = { sameCount: 0, loaded: false, archives: [] };
  /** State as of the last byte handed to a write: what is safe to persist. */
  private persisted: StateFile = this.st;
  private fh: FileHandle | undefined;
  private size = 0;
  private buf: Buffer[] = [];
  private bufBytes = 0;
  private pending: Buffer = EMPTY;
  private skipRemaining = 0;
  private flushTimer: NodeJS.Timeout | undefined;
  private stateTimer: NodeJS.Timeout | undefined;
  private stateDirty = false;
  private chain: Promise<void> = Promise.resolve();
  private ac = new AbortController();
  private loop: Promise<void> | undefined;
  private tail: number | "all";
  /** Container whose stream ended cleanly: not asked again until it runs again. */
  private endedFor: string | undefined;
  private ready: Ready | undefined;

  constructor(o: SpoolerOptions) {
    this.client = o.client;
    this.dir = o.dir;
    this.name = o.name;
    this.initialTail = o.initialTail ?? DEFAULT_INITIAL_TAIL;
    this.maxBytes = o.maxBytes ?? DEFAULT_SPOOL_MAX_BYTES;
    this.flushMs = o.flushMs ?? DEFAULT_FLUSH_MS;
    this.flushBytes = o.flushBytes ?? DEFAULT_FLUSH_BYTES;
    this.maxArchives = o.maxArchives ?? DEFAULT_MAX_ARCHIVES;
    this.retryMs = o.retryMs ?? 1000;
    this.maxRetryMs = o.maxRetryMs ?? 5000;
    this.pollMs = o.pollMs ?? 1000;
    this.onWrite = o.onWrite;
    this.onState = o.onState;
    this.onRecreated = o.onRecreated;
    this.tail = this.initialTail;
    this.path = join(o.dir, `${o.name}.log`);
    this.statePath = join(o.dir, `${o.name}.state.json`);
  }

  /** Resolves once the initial load is written (the file can be opened); rejects if the container cannot be read. */
  async start(): Promise<void> {
    await mkdir(this.dir, { recursive: true });
    this.st = await this.readState();
    this.persisted = this.st;
    await this.openFile();
    try {
      await this.resume();
    } catch (err) {
      await this.stop({ remove: true });
      throw err;
    }
  }

  /** Stops following. `remove` deletes the spool, its archives and its state. */
  async stop(opts: { remove?: boolean } = {}): Promise<void> {
    await this.pause();
    await this.saveState(true);
    await this.fh?.close().catch(() => {});
    this.fh = undefined;
    if (opts.remove) {
      for (const f of [this.path, this.statePath, ...this.st.archives.map((a) => join(this.dir, a))]) {
        await rm(f, { force: true }).catch(() => {});
      }
    }
  }

  /**
   * "Load more history": the spool is emptied and reloaded with `tail` lines. The caller must have
   * stopped reading the file meanwhile. Resolves once the new content is written.
   */
  async rebuild(tail: number | "all"): Promise<void> {
    await this.pause();
    await this.fh?.close().catch(() => {});
    this.fh = undefined;
    await rm(this.path, { force: true });
    this.st = { sameCount: 0, loaded: false, archives: this.st.archives, ...(this.st.containerId ? { containerId: this.st.containerId } : {}) };
    this.persisted = this.st;
    this.tail = tail;
    this.endedFor = undefined;
    await this.openFile();
    await this.saveState(true);
    await this.resume();
  }

  // ---------------------------------------------------------------------------------------------

  /** Starts the follow loop; resolves when it has loaded the container (rejects if it cannot). */
  private resume(): Promise<void> {
    let resolve!: () => void;
    let reject!: (e: unknown) => void;
    const promise = new Promise<void>((res, rej) => ((resolve = res), (reject = rej)));
    this.ready = { promise, resolve, reject, done: false };
    this.ac = new AbortController();
    this.loop = this.run(this.ac.signal, this.ready);
    return promise;
  }

  private async pause(): Promise<void> {
    this.ac.abort();
    await this.loop;
    this.loop = undefined;
    await this.flush();
  }

  private setState(state: SpoolState, message?: string): void {
    this.onState?.(state, message);
  }

  private async run(signal: AbortSignal, ready: Ready): Promise<void> {
    let delay = this.retryMs;
    while (!signal.aborted) {
      try {
        const outcome = await this.attempt(signal, ready);
        if (signal.aborted) break;
        delay = this.retryMs;
        if (outcome === "absent" && !ready.done) {
          throw new DockerError("NOT_FOUND", `No Docker container named "${this.name}"`);
        }
        this.setState("stopped");
        await sleep(this.pollMs, signal);
      } catch (err) {
        await this.flush();
        if (signal.aborted) break;
        const e = toDockerError(err);
        if (!ready.done) {
          ready.done = true;
          ready.reject(e);
          return;
        }
        if (e.code === "UNREADABLE") return void this.setState("error", e.message);
        this.setState("waiting", e.message);
        await sleep(delay, signal);
        delay = Math.min(delay * 2, this.maxRetryMs);
      }
    }
    if (!ready.done) {
      ready.done = true;
      ready.resolve(); // stopped before the load finished: the caller is stopping too
    }
  }

  /** One pass: locate the container, load or resume, follow until the stream ends. */
  private async attempt(signal: AbortSignal, ready: Ready): Promise<"ended" | "absent"> {
    const { client, name } = this;
    if (!client.negotiatedApiVersion) await client.connect(signal);
    const found = (await client.listContainers(true, signal)).find((c) => c.names.includes(name));
    if (!found) return "absent";
    if (this.endedFor === found.id && found.state !== "running") return "ended"; // still stopped: nothing new
    const details = await client.inspect(found.id, signal);
    if (details.logDriver === "none") {
      throw new DockerError("UNREADABLE", `Container "${name}" uses log driver "none": it has no logs to read`);
    }
    if (this.st.containerId && this.st.containerId !== found.id) await this.recreated(found.id);
    this.st.containerId = found.id;

    if (!this.st.loaded) {
      const since = Math.floor(Date.now() / 1000) - 1;
      const stream = await client.logs(found.id, { tail: this.tail, timestamps: true, tty: details.tty }, signal);
      await this.consume(stream, signal);
      if (signal.aborted) return "ended";
      this.st.loaded = true;
      if (this.st.lastTs === undefined) this.st.since = since;
      this.persisted = { ...this.st, archives: [...this.st.archives] };
      await this.saveState(true);
    }
    if (!ready.done) {
      ready.done = true;
      ready.resolve();
    }
    this.setState("following");
    this.skipRemaining = this.st.sameCount;
    const since = this.st.lastTs !== undefined ? tsToSeconds(this.st.lastTs) : (this.st.since ?? 0);
    const stream = await client.logs(found.id, { follow: true, timestamps: true, since, tty: details.tty }, signal);
    this.endedFor = undefined;
    await this.consume(stream, signal);
    if (!signal.aborted) this.endedFor = found.id;
    return "ended";
  }

  private async consume(stream: AsyncIterable<Buffer>, signal: AbortSignal): Promise<void> {
    this.pending = EMPTY;
    try {
      for await (const chunk of stream) this.ingest(chunk);
      // clean end of stream (a cut connection throws instead): a last unterminated line is complete
      if (!signal.aborted && this.pending.length > 0) this.ingest(Buffer.from("\n"));
    } finally {
      this.pending = EMPTY;
      await this.flush();
    }
  }

  private ingest(chunk: Buffer): void {
    const data = this.pending.length > 0 ? Buffer.concat([this.pending, chunk]) : chunk;
    let start = 0;
    let nl: number;
    while ((nl = data.indexOf(10, start)) >= 0) {
      this.line(data.subarray(start, nl + 1));
      start = nl + 1;
    }
    this.pending = start < data.length ? Buffer.from(data.subarray(start)) : EMPTY;
  }

  /** Strips the timestamp, drops what was already written (resume after a reconnection). */
  private line(raw: Buffer): void {
    const m = TS_RE.exec(raw.subarray(0, 40).toString("latin1"));
    if (!m) return this.emit(raw);
    const ts = normTs(m[1]!, m[2]);
    const st = this.st;
    if (st.lastTs !== undefined) {
      if (ts < st.lastTs) return;
      if (ts === st.lastTs && this.skipRemaining > 0) {
        this.skipRemaining--;
        return;
      }
    }
    this.skipRemaining = 0;
    if (ts === st.lastTs) st.sameCount++;
    else {
      st.lastTs = ts;
      st.sameCount = 1;
    }
    this.emit(raw.subarray(m[0].length));
  }

  private emit(line: Buffer): void {
    this.buf.push(line);
    this.bufBytes += line.length;
    // state as of this line: what `write` persists once the bytes are on disk
    this.pendingState = { ...this.st, archives: [...this.st.archives] };
    if (this.bufBytes >= this.flushBytes) void this.flush();
    else this.flushTimer ??= setTimeout(() => void this.flush(), this.flushMs);
  }

  private pendingState: StateFile | undefined;

  /** Writes the buffered lines (serialized with any write in progress). Never rejects. */
  private flush(): Promise<void> {
    if (this.flushTimer) clearTimeout(this.flushTimer);
    this.flushTimer = undefined;
    this.chain = this.chain
      .then(() => this.write())
      .catch((err) => {
        this.setState("error", err instanceof Error ? err.message : String(err));
        this.ac.abort();
      });
    return this.chain;
  }

  private async write(): Promise<void> {
    if (this.bufBytes === 0 || !this.fh) return;
    const data = Buffer.concat(this.buf);
    const snapshot = this.pendingState ?? this.st;
    this.buf = [];
    this.bufBytes = 0;
    if (this.size > 0 && this.size + data.length > this.maxBytes) await this.rotate(`r${Date.now().toString(36)}`);
    await this.fh.write(data);
    this.size += data.length;
    this.persisted = { ...snapshot, archives: [...this.st.archives] };
    void this.saveState(false);
    this.onWrite?.();
  }

  /** rename + create: the reader sees a rolling. */
  private async rotate(tag: string): Promise<void> {
    await this.fh?.close();
    this.fh = undefined;
    const archive = `${this.name}.${tag}.log`;
    await rename(this.path, join(this.dir, archive));
    this.st.archives.push(archive);
    await this.openFile();
    for (const old of this.st.archives.splice(0, Math.max(0, this.st.archives.length - this.maxArchives))) {
      await rm(join(this.dir, old), { force: true }).catch(() => {});
    }
  }

  /** The name now belongs to a new container: the old spool becomes an archive, the new one starts empty. */
  private async recreated(newId: string): Promise<void> {
    await this.flush();
    const oldId = this.st.containerId ?? "unknown";
    if (this.size > 0) {
      this.onRecreated?.();
      await this.rotate(oldId.slice(0, 12));
    }
    this.st = { sameCount: 0, loaded: false, containerId: newId, archives: this.st.archives };
    this.persisted = this.st;
    this.pendingState = undefined;
    this.tail = this.initialTail;
    this.endedFor = undefined;
    this.stateDirty = true;
    await this.saveState(true);
  }

  private async openFile(): Promise<void> {
    this.fh = await open(this.path, "a");
    this.size = (await stat(this.path)).size;
  }

  private async readState(): Promise<StateFile> {
    const fresh: StateFile = { sameCount: 0, loaded: false, archives: [] };
    try {
      const s = JSON.parse(await readFile(this.statePath, "utf8")) as Partial<StateFile>;
      const exists = await stat(this.path).then(() => true, () => false);
      return exists ? { ...fresh, ...s, archives: s.archives ?? [] } : fresh;
    } catch {
      return fresh;
    }
  }

  /** Persists what has really been written; throttled unless `force`. */
  private async saveState(force: boolean): Promise<void> {
    this.stateDirty = true;
    if (!force) {
      this.stateTimer ??= setTimeout(() => {
        this.stateTimer = undefined;
        void this.saveState(true);
      }, STATE_SAVE_MS);
      return;
    }
    if (this.stateTimer) clearTimeout(this.stateTimer);
    this.stateTimer = undefined;
    if (!this.stateDirty) return;
    this.stateDirty = false;
    await writeFile(this.statePath, JSON.stringify(this.persisted), "utf8").catch(() => {});
  }
}

/** Removes everything left in the spool folder by a previous run (called at startup, before any tab exists). */
export async function purgeSpools(root: string): Promise<void> {
  await rm(root, { recursive: true, force: true }).catch(() => {});
}
