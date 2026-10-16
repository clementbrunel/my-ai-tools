// Read-side scenarios on one big file: end-of-file display (NF-01), indexing throughput (NF-03),
// memory (NF-02) and random getLines latency.
import { FileSource, LineIndex, detectEncoding, readTail } from "../src/index.js";
import { atLeast, atMost, info, type Measure } from "./report.js";
import { gc, mib, percentile, round } from "./util.js";

export const TAIL_LINES = 500;
export const TAIL_TARGET_MS = 1000;
export const INDEX_TARGET_MIB_S = 300;
/** NF-02 (400 MiB) minus the ~150 MiB Electron base. */
export const ENGINE_RSS_TARGET_MIB = 250;
/** Internal target: a page of lines must come back within a few frames while scrolling. */
export const GET_LINES_TARGET_MS = 50;
const TAIL_RUNS = 5;
const GET_LINES_SAMPLES = 2000;
const GET_LINES_PAGE = 60;

interface MemorySnapshot {
  rss: number;
  heapUsed: number;
  external: number;
}

function snapshot(): MemorySnapshot {
  gc();
  const m = process.memoryUsage();
  return { rss: m.rss, heapUsed: m.heapUsed, external: m.external };
}

/** NF-01: from "open the file" to "the last 500 lines are decoded", as the app does it. */
export async function benchTail(path: string): Promise<Measure[]> {
  const times: number[] = [];
  let lines = 0;
  for (let run = 0; run < TAIL_RUNS; run++) {
    const t0 = performance.now();
    const source = await FileSource.open(path);
    try {
      const encoding = detectEncoding(await source.readAt(0, 4096));
      const tail = await readTail(source, encoding, TAIL_LINES);
      lines = tail.lines.length;
      times.push(performance.now() - t0);
    } finally {
      await source.close();
    }
  }
  const scenario = "open + readTail";
  return [
    atMost("NF-01", scenario, `end of file visible (${TAIL_LINES} lines), worst of ${TAIL_RUNS}`, round(Math.max(...times)), "ms", TAIL_TARGET_MS),
    info(scenario, "median", round(percentile(times, 50)), "ms"),
    info(scenario, "lines returned", lines, "lines"),
  ];
}

export interface IndexedFile {
  source: FileSource;
  index: LineIndex;
  measures: Measure[];
  before: MemorySnapshot;
  afterIndex: MemorySnapshot;
}

/** NF-03: full indexing in a worker thread. The returned index is reused by the memory and getLines scenarios. */
export async function benchIndex(path: string, sizeBytes: number, before: MemorySnapshot): Promise<IndexedFile> {
  const source = await FileSource.open(path);
  const encoding = detectEncoding(await source.readAt(0, 4096));
  const index = new LineIndex(source, encoding);
  const t0 = performance.now();
  await index.indexWithWorker();
  const seconds = (performance.now() - t0) / 1000;
  const afterIndex = snapshot();
  const throughput = mib(sizeBytes) / seconds;
  const scenario = "index (worker)";
  return {
    source,
    index,
    before,
    afterIndex,
    measures: [
      atLeast("NF-03", scenario, "indexing throughput", round(throughput, 0), "MiB/s", INDEX_TARGET_MIB_S),
      info(scenario, "duration", round(seconds, 2), "s"),
      info(scenario, "lines indexed", index.lineCount, "lines"),
      info(scenario, "checkpoints", index.checkpoints.count, "checkpoints"),
    ],
  };
}

/** Random page reads on the indexed file (p50/p95): this is what scrolling costs. */
export async function benchGetLines(indexed: IndexedFile): Promise<Measure[]> {
  const { index } = indexed;
  const times: number[] = [];
  const maxStart = Math.max(0, index.lineCount - GET_LINES_PAGE);
  for (let i = 0; i < GET_LINES_SAMPLES; i++) {
    const first = Math.floor(Math.random() * (maxStart + 1));
    const t0 = performance.now();
    const lines = await index.getLines(first, GET_LINES_PAGE);
    times.push(performance.now() - t0);
    if (lines.length === 0) throw new Error(`getLines(${first}, ${GET_LINES_PAGE}) returned nothing`);
  }
  const scenario = `getLines x${GET_LINES_PAGE} (random)`;
  return [
    atMost("internal", scenario, "latency p95", round(percentile(times, 95), 2), "ms", GET_LINES_TARGET_MS),
    info(scenario, "latency p50", round(percentile(times, 50), 2), "ms"),
    info(scenario, "latency p99", round(percentile(times, 99), 2), "ms"),
    info(scenario, "latency max", round(Math.max(...times), 2), "ms"),
  ];
}

/** NF-02: process memory around open + index + random reads. Must not grow with the file size. */
export function memoryMeasures(indexed: IndexedFile, sizeBytes: number): Measure[] {
  const after = snapshot();
  const { before, afterIndex } = indexed;
  const scenario = "memory";
  const indexBytes = indexed.index.checkpoints.byteLength;
  return [
    info(scenario, "RSS before", round(mib(before.rss)), "MiB"),
    info(scenario, "heap used before", round(mib(before.heapUsed)), "MiB"),
    info(scenario, "RSS after indexing", round(mib(afterIndex.rss)), "MiB"),
    atMost("NF-02", scenario, "RSS after indexing and random reads", round(mib(after.rss)), "MiB", ENGINE_RSS_TARGET_MIB),
    info(scenario, "heap used after", round(mib(after.heapUsed)), "MiB"),
    info(scenario, "external memory after (Buffers, block cache)", round(mib(after.external)), "MiB"),
    info(scenario, "peak RSS of the process", round(process.resourceUsage().maxRSS / 1024), "MiB"),
    info(scenario, "checkpoint store (the only structure growing with the file)", round(mib(indexBytes), 2), "MiB"),
    info(scenario, "checkpoint store per GiB of log", round(mib(indexBytes) / (sizeBytes / 1024 ** 3), 2), "MiB/GiB"),
  ];
}

export { snapshot as memorySnapshot };
