import type { Status } from "../types.js";

export const STATUS_LABEL: Record<Status, string> = {
  ok: "ok",
  warning: "warning",
  error: "error",
  outdated: "outdated",
};

export const STATUS_RANK: Record<Status, number> = { ok: 0, outdated: 1, warning: 2, error: 3 };

export function worstStatus(statuses: Status[]): Status {
  return statuses.reduce(
    (worst, s) => STATUS_RANK[s] > STATUS_RANK[worst] ? s : worst,
    "ok" as Status
  );
}

export function formatTokens(tokens: number): string {
  if (tokens < 1000) return `${tokens}t`;
  return `${(tokens / 1000).toFixed(1)}kt`;
}

export function extractProvider(command: string): string {
  const exe = command.replace(/\\/g, "/").trim().replace(/^"/, "").split(/\s+/)[0];
  const base = (exe.split("/").pop() ?? exe).replace(/\.[^.]+$/, "");
  return base;
}

export function shortSource(source: string): string {
  return source.replace(/\\/g, "/").replace(/^.*\/(\.claude|\.mcp)/, "~/$1");
}
