// Follow scenarios: a writer process appends lines, Tailer instances follow the files (NF-04, NF-11).
import { fork } from "node:child_process";
import { copyFile, rm, writeFile } from "node:fs/promises";
import { monitorEventLoopDelay } from "node:perf_hooks";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Tailer } from "../src/index.js";
import { generateLogFile, type LogFormat } from "./generator.js";
import { ENGINE_RSS_TARGET_MIB } from "./read-scenarios.js";
import { atMost, info, type Measure } from "./report.js";
import { gc, mib, percentile, PROBE_LINE, round, sleep, wallMs } from "./util.js";

const WRITER = fileURLToPath(new URL("./writer.js", import.meta.url));
const SETTLE_TIMEOUT_MS = 10_000;

/** Latency budget between the write and the `rows` event (NF-04). */
export const LATENCY_TARGET_MS = 250;
/** Main-thread stall budget (internal target: three 60 fps frames). */
export const LOOP_LAG_TARGET_MS = 50;

function runWriter(files: string[], rate: number, seconds: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = fork(WRITER, ["--files", files.join(","), "--rate", String(rate), "--seconds", String(seconds)], { execArgv: [] });
    let written = -1;
    child.on("message", (msg: { type: string; written?: number }) => {
      if (msg.type === "done") written = msg.written ?? 0;
    });
    child.on("error", reject);
    child.on("exit", (code) => (code === 0 && written >= 0 ? resolve(written) : reject(new Error(`Writer exited with code ${code}`))));
  });
}

/** Reads every new row of a tailer like the UI does and times it against the write timestamp in the line. */
class Probe {
  readonly latencies: number[] = [];
  received = 0;
  outOfOrder = 0;
  private expectedSeq = 0;
  private nextRow = 0;
  private readonly announced: { total: number; at: number }[] = [];
  private announcedAt = 0;
  private busy: Promise<void> = Promise.resolve();
  private readonly unsubscribe: () => void;
  eventCount = 0;
  private armed = false;

  constructor(private readonly tailer: Tailer) {
    this.unsubscribe = tailer.on((event) => {
      if (event.type !== "rows" || !this.armed) return;
      this.eventCount++;
      this.announced.push({ total: event.total, at: wallMs() });
      this.pump();
    });
  }

  /** Ignores everything already in the file: only rows written from now on are probed. */
  arm(): void {
    this.nextRow = this.tailer.totalRows;
    this.armed = true;
  }

  pump(): void {
    this.busy = this.busy.then(async () => {
      // the last line may still be growing: leave it for the next pump
      const limit = this.tailer.totalRows - (this.tailer.isLastLineOpen ? 1 : 0);
      if (limit <= this.nextRow) return;
      const lines = await this.tailer.getLines(this.nextRow, limit - this.nextRow);
      for (const line of lines) {
        const match = PROBE_LINE.exec(line.text);
        if (!match) continue;
        const seq = Number(match[1]);
        if (seq === this.expectedSeq) this.expectedSeq++;
        else {
          this.outOfOrder++;
          this.expectedSeq = seq + 1;
        }
        // the first `rows` event that counted this row
        while (this.announcedAt < this.announced.length && this.announced[this.announcedAt]!.total <= line.lineNo) this.announcedAt++;
        const at = this.announced[this.announcedAt]?.at ?? wallMs();
        this.latencies.push(Math.max(0, at - Number(match[2])));
        this.received++;
      }
      if (lines.length > 0) this.nextRow = lines[lines.length - 1]!.lineNo + 1;
    });
  }

  settled(): Promise<void> {
    return this.busy;
  }

  dispose(): void {
    this.unsubscribe();
  }
}

async function waitForReceived(probes: Probe[], expected: number): Promise<void> {
  const deadline = Date.now() + SETTLE_TIMEOUT_MS;
  for (;;) {
    for (const p of probes) p.pump();
    await Promise.all(probes.map((p) => p.settled()));
    if (probes.every((p) => p.received >= expected) || Date.now() > deadline) return;
    await sleep(50);
  }
}

export interface FollowOptions {
  dir: string;
  rates: number[];
  seconds: number;
  log: (message: string) => void;
}

/** NF-04: one writer at each rate, followed by one Tailer. */
export async function runFollow(options: FollowOptions): Promise<Measure[]> {
  const out: Measure[] = [];
  for (const rate of options.rates) {
    const scenario = `follow ${rate}/s`;
    options.log(`follow: ${rate} lines/s for ${options.seconds} s ...`);
    const path = join(options.dir, `follow-${rate}.log`);
    await writeFile(path, "");
    const tailer = new Tailer({ path });
    const probe = new Probe(tailer);
    const loop = monitorEventLoopDelay({ resolution: 10 });
    try {
      await tailer.start();
      probe.arm();
      loop.enable();
      const written = await runWriter([path], rate, options.seconds);
      await waitForReceived([probe], written);
      loop.disable();

      const lost = written - probe.received;
      const lag = Math.max(0, loop.percentile(99) / 1e6 - 10);
      out.push(
        atMost("NF-04", scenario, "write->rows latency p95", round(percentile(probe.latencies, 95)), "ms", LATENCY_TARGET_MS),
        info(scenario, "write->rows latency p50", round(percentile(probe.latencies, 50)), "ms"),
        info(scenario, "write->rows latency max", round(probe.latencies.reduce((m, v) => Math.max(m, v), 0)), "ms"),
        atMost("NF-04", scenario, "lines lost", lost, "lines", 0),
        info(scenario, "lines written", written, "lines"),
        info(scenario, "out-of-order or duplicated lines", probe.outOfOrder, "lines"),
        info(scenario, "rows events per second", round(probe.eventCount / options.seconds), "events/s"),
        atMost("NF-04", scenario, "event-loop lag p99", round(lag), "ms", LOOP_LAG_TARGET_MS),
      );
    } finally {
      loop.disable();
      probe.dispose();
      await tailer.stop();
      await rm(path, { force: true });
    }
  }
  return out;
}

export interface MultiLogOptions {
  dir: string;
  files: number;
  rate: number;
  seconds: number;
  /** Size of each file before following starts (0 = empty files). */
  seedBytesPerFile: number;
  format: LogFormat;
  log: (message: string) => void;
}

/** NF-11: N tailers at the same time, each fed at `rate` lines/s. */
export async function runMultiLog(options: MultiLogOptions): Promise<Measure[]> {
  const scenario = `multi-log ${options.files}x${options.rate}/s`;
  const paths = Array.from({ length: options.files }, (_, i) => join(options.dir, `multi-${i}.log`));
  options.log(`multi-log: ${options.files} tailers, ${options.rate} lines/s each, ${options.seconds} s, seed ${mib(options.seedBytesPerFile * options.files).toFixed(0)} MiB in total ...`);

  if (options.seedBytesPerFile > 0) {
    const seed = await generateLogFile({ dir: options.dir, format: options.format, sizeBytes: options.seedBytesPerFile, seed: 7 });
    await Promise.all(paths.map((p) => copyFile(seed.path, p)));
  } else {
    await Promise.all(paths.map((p) => writeFile(p, "")));
  }

  const tailers = paths.map((path) => new Tailer({ path, initialIndexer: (index) => index.indexWithWorker() }));
  const probes = tailers.map((t) => new Probe(t));
  const loop = monitorEventLoopDelay({ resolution: 10 });
  try {
    const readyStart = performance.now();
    await Promise.all(tailers.map((t) => t.start()));
    const readyMs = performance.now() - readyStart;
    probes.forEach((p) => p.arm());
    await sleep(500);
    gc();
    const rssBefore = process.memoryUsage().rss;

    loop.enable();
    const written = await runWriter(paths, options.rate, options.seconds);
    await waitForReceived(probes, written);
    loop.disable();
    gc();
    const mem = process.memoryUsage();

    const latencies = probes.flatMap((p) => p.latencies);
    const received = probes.reduce((n, p) => n + p.received, 0);
    const lost = written * options.files - received;
    const lag = Math.max(0, loop.percentile(99) / 1e6 - 10);
    return [
      info(scenario, "time to open and index all files", round(readyMs), "ms"),
      atMost("NF-11", scenario, "write->rows latency p95 (all tailers)", round(percentile(latencies, 95)), "ms", LATENCY_TARGET_MS),
      info(scenario, "write->rows latency p50", round(percentile(latencies, 50)), "ms"),
      info(scenario, "write->rows latency max", round(latencies.reduce((m, v) => Math.max(m, v), 0)), "ms"),
      atMost("NF-11", scenario, "lines lost (all tailers)", lost, "lines", 0),
      atMost("NF-11", scenario, "event-loop lag p99", round(lag), "ms", LOOP_LAG_TARGET_MS),
      info(scenario, "RSS before writing", round(mib(rssBefore)), "MiB"),
      atMost("NF-11", scenario, "RSS after writing", round(mib(mem.rss)), "MiB", ENGINE_RSS_TARGET_MIB),
      info(scenario, "heap used after writing", round(mib(mem.heapUsed)), "MiB"),
    ];
  } finally {
    loop.disable();
    probes.forEach((p) => p.dispose());
    await Promise.all(tailers.map((t) => t.stop()));
    await Promise.all(paths.map((p) => rm(p, { force: true })));
  }
}
