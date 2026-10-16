// Engine benchmark entry point. Usage: npm run bench -- --size 10G [--only index,follow] [--json out.json]
import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runFollow, runMultiLog } from "./follow.js";
import { describeGenerated, generateLogFile, LOG_FORMATS, type LogFormat } from "./generator.js";
import { benchGetLines, benchIndex, benchTail, memoryMeasures, memorySnapshot, type IndexedFile } from "./read-scenarios.js";
import { makeMeta, renderTable, summarize, writeJson, type Measure } from "./report.js";
import { formatBytes, parseSize } from "./util.js";

const SCENARIOS = ["tail", "index", "memory", "lines", "follow", "multi"] as const;
type Scenario = (typeof SCENARIOS)[number];

const HELP = `cbl-log engine benchmark

Usage: npm run bench -- [options]

  --size <n>          log size to generate/reuse: 200M, 1G, 10G (default 1G)
  --format <f>        websphere-basic | raw (default websphere-basic)
  --dir <path>        output folder (default <tmpdir>/cbl-log-bench)
  --force             regenerate the log even if a file of the right size exists
  --generate-only     only generate the log, then exit
  --only <list>       comma-separated scenarios: ${SCENARIOS.join(", ")}
                        tail    open + readTail (NF-01)
                        index   full indexing in a worker (NF-03)
                        memory  RSS / heap around indexing and reads (NF-02)
                        lines   random getLines latency
                        follow  writer at 1000 then 10000 lines/s (NF-04)
                        multi   8 tailers at 1000 lines/s each (NF-11)
  --duration <s>      seconds per follow / multi run (default 10)
  --rates <list>      follow rates in lines/s (default 1000,10000)
  --multi-files <n>   number of tailers for "multi" (default 8)
  --multi-total <n>   total size of the pre-existing content of the "multi" files (default 1G; 10G for the full NF-11)
  --seed <n>          generator seed (default 1)
  --json <file>       also write the results as JSON
  --help
`;

interface Options {
  size: number;
  format: LogFormat;
  dir: string;
  force: boolean;
  generateOnly: boolean;
  only: Set<Scenario>;
  duration: number;
  rates: number[];
  multiFiles: number;
  multiTotal: number;
  seed: number;
  json: string | undefined;
}

function parseArgs(argv: string[]): Options | undefined {
  const values = new Map<string, string>();
  const flags = new Set<string>();
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (!arg.startsWith("--")) throw new Error(`Unexpected argument: ${arg}`);
    const name = arg.slice(2);
    if (name === "help" || name === "force" || name === "generate-only") flags.add(name);
    else {
      const value = argv[++i];
      if (value === undefined) throw new Error(`Missing value for ${arg}`);
      values.set(name, value);
    }
  }
  if (flags.has("help")) return undefined;

  const format = (values.get("format") ?? "websphere-basic") as LogFormat;
  if (!LOG_FORMATS.includes(format)) throw new Error(`Unknown format "${format}" (${LOG_FORMATS.join(", ")})`);
  const only = new Set<Scenario>();
  for (const name of (values.get("only") ?? SCENARIOS.join(",")).split(",")) {
    if (!SCENARIOS.includes(name as Scenario)) throw new Error(`Unknown scenario "${name}" (${SCENARIOS.join(", ")})`);
    only.add(name as Scenario);
  }
  const positive = (name: string, fallback: string): number => {
    const n = Number(values.get(name) ?? fallback);
    if (!(n > 0)) throw new Error(`--${name} must be a positive number`);
    return n;
  };
  return {
    size: parseSize(values.get("size") ?? "1G"),
    format,
    dir: resolve(values.get("dir") ?? join(tmpdir(), "cbl-log-bench")),
    force: flags.has("force"),
    generateOnly: flags.has("generate-only"),
    only,
    duration: positive("duration", "10"),
    rates: (values.get("rates") ?? "1000,10000").split(",").map(Number),
    multiFiles: positive("multi-files", "8"),
    multiTotal: parseSize(values.get("multi-total") ?? "1G"),
    seed: positive("seed", "1"),
    json: values.get("json"),
  };
}

const log = (message: string): void => console.log(`[bench] ${message}`);

async function main(): Promise<number> {
  const options = parseArgs(process.argv.slice(2));
  if (!options) {
    console.log(HELP);
    return 0;
  }
  const { only } = options;
  mkdirSync(options.dir, { recursive: true });

  const needsBigFile = options.generateOnly || ["tail", "index", "memory", "lines"].some((s) => only.has(s as Scenario));
  let path = "";
  if (needsBigFile) {
    log(`log file: ${options.format}, ${formatBytes(options.size)}`);
    if (!options.generateOnly) {
      // Generate in a child process: the generator's buffers would otherwise inflate this process's RSS baseline.
      const args = [...process.argv.slice(2), "--generate-only"];
      const child = spawnSync(process.execPath, [fileURLToPath(import.meta.url), ...args], { stdio: "inherit" });
      if (child.status !== 0) throw new Error("Log generation failed");
    }
    let lastPct = -1;
    const generated = await generateLogFile({
      dir: options.dir,
      format: options.format,
      sizeBytes: options.size,
      seed: options.seed,
      force: options.force && options.generateOnly,
      onProgress: (written, total) => {
        const pct = Math.floor((written / total) * 10) * 10;
        if (pct !== lastPct) {
          lastPct = pct;
          log(`generating ${pct}% (${formatBytes(written)})`);
        }
      },
    });
    path = generated.path;
    log(describeGenerated(generated));
    if (options.generateOnly) return 0;
  }

  const results: Measure[] = [];
  const baseline = memorySnapshot();

  if (only.has("tail")) {
    log("tail: open + readTail ...");
    results.push(...(await benchTail(path)));
  }

  let indexed: IndexedFile | undefined;
  if (only.has("index") || only.has("memory") || only.has("lines")) {
    log("index: full indexing in a worker thread ...");
    indexed = await benchIndex(path, options.size, baseline);
    if (only.has("index")) results.push(...indexed.measures);
  }
  if (indexed && only.has("lines")) {
    log("lines: random getLines ...");
    results.push(...(await benchGetLines(indexed)));
  }
  if (indexed && only.has("memory")) results.push(...memoryMeasures(indexed, options.size));
  if (indexed) {
    await indexed.source.close();
    indexed = undefined;
  }

  if (only.has("follow")) results.push(...(await runFollow({ dir: options.dir, rates: options.rates, seconds: options.duration, log })));
  if (only.has("multi")) {
    results.push(
      ...(await runMultiLog({
        dir: options.dir,
        files: options.multiFiles,
        rate: 1000,
        seconds: options.duration,
        seedBytesPerFile: Math.floor(options.multiTotal / options.multiFiles),
        format: options.format,
        log,
      })),
    );
  }

  console.log(`\n${renderTable(results)}\n`);
  const { passed, failed } = summarize(results);
  console.log(`${passed} target(s) met, ${failed} missed.`);

  if (options.json) {
    const report = {
      meta: makeMeta({ ...options, only: [...options.only], json: undefined, logFile: path || undefined }),
      results,
    };
    writeJson(resolve(options.json), report);
    log(`JSON written to ${resolve(options.json)}`);
  }
  return failed > 0 ? 1 : 0;
}

main().then(
  (code) => process.exit(code),
  (err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(2);
  },
);
