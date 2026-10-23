// Measure model + console table + JSON output.
import { writeFileSync } from "node:fs";
import { cpus, totalmem } from "node:os";

export interface Measure {
  /** Requirement the measure relates to (NF-01..NF-05, NF-11) or "info". */
  req: string;
  scenario: string;
  label: string;
  value: number;
  unit: string;
  /** Human-readable target, e.g. "< 1000 ms". Absent for purely informative measures. */
  target?: string;
  /** true/false when a target exists, undefined for informative measures. */
  pass?: boolean;
}

export interface BenchReport {
  meta: {
    date: string;
    node: string;
    platform: string;
    cpu: string;
    cores: number;
    ramGiB: number;
    options: Record<string, unknown>;
  };
  results: Measure[];
}

export function makeMeta(options: Record<string, unknown>): BenchReport["meta"] {
  const cpu = cpus();
  return {
    date: new Date().toISOString(),
    node: process.version,
    platform: `${process.platform}-${process.arch}`,
    cpu: cpu[0]?.model.trim() ?? "unknown",
    cores: cpu.length,
    ramGiB: Math.round((totalmem() / 1024 ** 3) * 10) / 10,
    options,
  };
}

/** Builds a measure that must stay below `max`. */
export function atMost(req: string, scenario: string, label: string, value: number, unit: string, max: number): Measure {
  return { req, scenario, label, value, unit, target: `<= ${max} ${unit}`, pass: value <= max };
}

/** Builds a measure that must reach `min`. */
export function atLeast(req: string, scenario: string, label: string, value: number, unit: string, min: number): Measure {
  return { req, scenario, label, value, unit, target: `>= ${min} ${unit}`, pass: value >= min };
}

export function info(scenario: string, label: string, value: number, unit: string): Measure {
  return { req: "info", scenario, label, value, unit };
}

function formatValue(value: number): string {
  if (!Number.isFinite(value)) return String(value);
  return Number.isInteger(value) ? value.toLocaleString("en-US") : value.toLocaleString("en-US", { maximumFractionDigits: 1 });
}

export function renderTable(results: readonly Measure[]): string {
  const rows = results.map((m) => ({
    req: m.req,
    scenario: m.scenario,
    label: m.label,
    value: `${formatValue(m.value)} ${m.unit}`,
    target: m.target ?? "-",
    verdict: m.pass === undefined ? "" : m.pass ? "OK" : "FAIL",
  }));
  const header = { req: "Req", scenario: "Scenario", label: "Measure", value: "Value", target: "Target", verdict: "" };
  const keys = Object.keys(header) as (keyof typeof header)[];
  const widths = keys.map((k) => Math.max(header[k].length, ...rows.map((r) => r[k].length)));
  const line = (r: typeof header): string => keys.map((k, i) => r[k].padEnd(widths[i]!)).join("  ").trimEnd();
  const rule = widths.map((w) => "-".repeat(w)).join("  ");
  const lines = [line(header), rule];
  let lastScenario = "";
  for (const r of rows) {
    if (lastScenario && r.scenario !== lastScenario) lines.push("");
    lastScenario = r.scenario;
    lines.push(line(r).replace(/ OK$/, " ✅").replace(/ FAIL$/, " ❌"));
  }
  return lines.join("\n");
}

export function summarize(results: readonly Measure[]): { passed: number; failed: number } {
  return {
    passed: results.filter((m) => m.pass === true).length,
    failed: results.filter((m) => m.pass === false).length,
  };
}

export function writeJson(path: string, report: BenchReport): void {
  writeFileSync(path, `${JSON.stringify(report, null, 2)}\n`);
}
