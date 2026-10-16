// Streaming log generator: never holds the file in memory (10 GB = a few MiB of buffers).
// Output is deterministic for a given (format, seed, size), so a file can be reused between runs.
import { mkdirSync, renameSync, rmSync, statSync } from "node:fs";
import { open } from "node:fs/promises";
import { join } from "node:path";
import { formatBytes } from "./util.js";

export const LOG_FORMATS = ["websphere-basic", "raw"] as const;
export type LogFormat = (typeof LOG_FORMATS)[number];

const BLOCK_BYTES = 4 * 1024 * 1024;

/** mulberry32: tiny seedable PRNG. */
function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pad2 = (n: number): string => (n < 10 ? `0${n}` : String(n));
const pad3 = (n: number): string => (n < 10 ? `00${n}` : n < 100 ? `0${n}` : String(n));

/** `[10/14/26 10:02:11:204 CEST]` (US date order like WebSphere; the zone label is cosmetic: UTC time is used). */
export function formatWebsphereTimestamp(epochMs: number): string {
  const d = new Date(epochMs);
  return `[${pad2(d.getUTCMonth() + 1)}/${pad2(d.getUTCDate())}/${pad2(d.getUTCFullYear() % 100)} ${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}:${pad2(d.getUTCSeconds())}:${pad3(d.getUTCMilliseconds())} CEST]`;
}

interface Component {
  name: string;
  level: string;
  weight: number;
}

// SystemOut/O dominates, with a tail of warnings and errors.
const COMPONENTS: Component[] = [
  { name: "SystemOut", level: "O", weight: 60 },
  { name: "SystemErr", level: "R", weight: 4 },
  { name: "TraceComponent", level: "I", weight: 14 },
  { name: "ApplicationMg", level: "A", weight: 6 },
  { name: "WebContainer", level: "W", weight: 8 },
  { name: "ServletWrappe", level: "E", weight: 3 },
  { name: "ConnectionPool", level: "W", weight: 3 },
  { name: "SecurityMgr", level: "I", weight: 2 },
];
const TOTAL_WEIGHT = COMPONENTS.reduce((n, c) => n + c.weight, 0);

const USERS = ["jdoe", "asmith", "mlopez", "kwang", "svc-batch", "tmartin", "rnoir", "lbernard"];
const TABLES = ["ORDERS", "CUSTOMERS", "INVOICES", "STOCK", "AUDIT_LOG", "SESSIONS"];
const EXCEPTIONS = [
  "java.lang.NullPointerException",
  "java.lang.IllegalStateException: connection already closed",
  "java.sql.SQLException: ORA-00060: deadlock detected while waiting for resource",
  "javax.naming.NameNotFoundException: jdbc/appDS",
  "java.io.IOException: Broken pipe",
];
const FRAMES = [
  "com.acme.orders.service.OrderService.submit(OrderService.java:",
  "com.acme.orders.dao.OrderDao.insert(OrderDao.java:",
  "com.acme.web.filter.AuthFilter.doFilter(AuthFilter.java:",
  "org.springframework.web.servlet.DispatcherServlet.doDispatch(DispatcherServlet.java:",
  "com.ibm.ws.webcontainer.servlet.ServletWrapper.service(ServletWrapper.java:",
  "com.ibm.ws.webcontainer.webapp.WebApp.handleRequest(WebApp.java:",
  "java.lang.Thread.run(Thread.java:",
];
const WORDS = (
  "alpha beta gamma delta request response session queue worker timeout retry connect closed opened " +
  "flush cache miss hit commit rollback batch job start stop heartbeat latency payload header token " +
  "refresh invalid expired accepted rejected pending running failed done"
).split(" ");

/** Produces log lines one at a time (each ends with "\n"; ASCII only so a byte cut never splits a character). */
export class LineGenerator {
  private readonly rand: () => number;
  private readonly pending: string[] = [];
  private clockMs = Date.UTC(2026, 9, 14, 8, 0, 0, 0);
  private stampSecond = -1;
  private stampPrefix = "";
  private readonly threads: string[];

  constructor(
    private readonly format: LogFormat,
    seed = 1,
  ) {
    this.rand = prng(seed);
    this.threads = Array.from({ length: 12 }, () => Math.floor(this.rand() * 0x100).toString(16).padStart(8, "0"));
  }

  next(): string {
    return this.format === "raw" ? this.rawLine() : (this.pending.shift() ?? this.websphereLine());
  }

  private int(max: number): number {
    return Math.floor(this.rand() * max);
  }

  private pick<T>(list: readonly T[]): T {
    return list[this.int(list.length)]!;
  }

  private rawLine(): string {
    const words = 3 + this.int(30);
    let line = "";
    for (let i = 0; i < words; i++) line += (i ? " " : "") + this.pick(WORDS);
    return `${line} ${this.int(100000)}\n`;
  }

  private stamp(): string {
    this.clockMs += this.int(30);
    const second = Math.floor(this.clockMs / 1000);
    if (second !== this.stampSecond) {
      this.stampSecond = second;
      this.stampPrefix = formatWebsphereTimestamp(second * 1000).slice(0, -10); // "[MM/DD/YY HH:MM:SS"
    }
    return `${this.stampPrefix}:${pad3(this.clockMs % 1000)} CEST]`;
  }

  private message(): string {
    switch (this.int(8)) {
      case 0:
        return `Request ${this.int(10_000_000)} processed in ${this.int(900)} ms for user ${this.pick(USERS)}`;
      case 1:
        return `SQL executed on ${this.pick(TABLES)}: ${this.int(5000)} rows in ${this.int(300)} ms`;
      case 2:
        return `Session ${this.int(0x7fffffff).toString(16)} created for ${this.pick(USERS)} from 10.${this.int(255)}.${this.int(255)}.${this.int(255)}`;
      case 3:
        return `Cache ${this.rand() < 0.8 ? "hit" : "miss"} for key ${this.pick(TABLES).toLowerCase()}:${this.int(1_000_000)}`;
      case 4:
        return `Batch job ${this.int(500)} step ${this.int(12)} finished, ${this.int(100000)} records, status=${this.rand() < 0.95 ? "OK" : "RETRY"}`;
      case 5:
        return `Heartbeat from node ${this.int(16)} (${this.int(1000)} ms since last message, queue depth ${this.int(2000)})`;
      case 6:
        return `Transaction ${this.int(0x7fffffff).toString(16)} ${this.rand() < 0.9 ? "committed" : "rolled back"} after ${this.int(2000)} ms`;
      default: {
        let text = "";
        const words = 4 + this.int(14);
        for (let i = 0; i < words; i++) text += (i ? " " : "") + this.pick(WORDS);
        return text;
      }
    }
  }

  private websphereLine(): string {
    let r = this.int(TOTAL_WEIGHT);
    let component = COMPONENTS[0]!;
    for (const c of COMPONENTS) {
      if ((r -= c.weight) < 0) {
        component = c;
        break;
      }
    }
    const head = `${this.stamp()} ${this.pick(this.threads)} ${component.name.padEnd(13)} ${component.level} `;
    // errors always carry a stack trace; about 1 other line in 400 opens one too
    if (component.level === "E" || component.level === "R" || this.rand() < 1 / 400) this.queueStackTrace();
    return `${head}${this.message()}\n`;
  }

  private queueStackTrace(): void {
    this.pending.push(`${this.pick(EXCEPTIONS)}\n`);
    const depth = 5 + this.int(20);
    for (let i = 0; i < depth; i++) this.pending.push(`\tat ${this.pick(FRAMES)}${1 + this.int(900)})\n`);
    if (this.rand() < 0.3) {
      this.pending.push(`Caused by: ${this.pick(EXCEPTIONS)}\n`);
      for (let i = 0; i < 3; i++) this.pending.push(`\tat ${this.pick(FRAMES)}${1 + this.int(900)})\n`);
      this.pending.push(`\t... ${1 + this.int(40)} more\n`);
    }
  }
}

export interface GenerateOptions {
  dir: string;
  format: LogFormat;
  sizeBytes: number;
  seed?: number;
  /** Regenerate even if a file of the right size already exists. */
  force?: boolean;
  onProgress?: (written: number, total: number) => void;
}

export interface GenerateResult {
  path: string;
  sizeBytes: number;
  reused: boolean;
  durationMs: number;
}

export function logFileName(format: LogFormat, sizeBytes: number, seed = 1): string {
  return `${format}-${sizeBytes}${seed === 1 ? "" : `-s${seed}`}.log`;
}

/**
 * Writes `sizeBytes` bytes exactly (the last line may be cut, but is always terminated).
 * The file is written under a ".partial" name and renamed at the end, so an interrupted
 * generation is never mistaken for a complete file.
 */
export async function generateLogFile(options: GenerateOptions): Promise<GenerateResult> {
  const { dir, format, sizeBytes, seed = 1 } = options;
  mkdirSync(dir, { recursive: true });
  const path = join(dir, logFileName(format, sizeBytes, seed));
  const partial = `${path}.partial`;
  const started = performance.now();

  rmSync(partial, { force: true });
  if (!options.force) {
    try {
      if (statSync(path).size === sizeBytes) return { path, sizeBytes, reused: true, durationMs: 0 };
    } catch {
      // does not exist yet
    }
  }
  rmSync(path, { force: true });

  const generator = new LineGenerator(format, seed);
  const handle = await open(partial, "w");
  try {
    let written = 0;
    while (written < sizeBytes) {
      let text = "";
      while (text.length < BLOCK_BYTES) text += generator.next();
      let block = Buffer.from(text, "latin1");
      if (written + block.length > sizeBytes) {
        block = block.subarray(0, sizeBytes - written);
        block[block.length - 1] = 0x0a;
      }
      await handle.write(block);
      written += block.length;
      options.onProgress?.(written, sizeBytes);
    }
  } finally {
    await handle.close();
  }
  renameSync(partial, path);
  return { path, sizeBytes, reused: false, durationMs: performance.now() - started };
}

export function describeGenerated(result: GenerateResult): string {
  return result.reused
    ? `reusing ${result.path} (${formatBytes(result.sizeBytes)})`
    : `generated ${result.path} (${formatBytes(result.sizeBytes)}) in ${(result.durationMs / 1000).toFixed(1)} s`;
}
