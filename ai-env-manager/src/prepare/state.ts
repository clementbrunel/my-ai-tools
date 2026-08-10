import { writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseJsonFile } from "../utils.js";
import { CATALOGUE, getToolById } from "./catalogue.js";
import type { ToolId } from "./catalogue.js";

/** Records, per project, which catalogue tools were requested — read back by `verify`. */
export const STATE_FILE = ".ai-env-manager.json";

interface StateFile {
  requested?: string[];
  updatedAt?: string;
}

export function stateFilePath(projectPath: string): string {
  return join(resolve(projectPath), STATE_FILE);
}

export function readRequestedTools(projectPath: string): ToolId[] {
  const state = parseJsonFile<StateFile>(stateFilePath(projectPath));
  if (!state?.requested) return [];
  const valid = new Set<string>(CATALOGUE.map((t) => t.id));
  return state.requested.filter((id): id is ToolId => valid.has(id));
}

/**
 * Merges `ids` into the recorded list. A newly requested tool evicts the previously
 * recorded tools of its conflict group, so switching (e.g. rtk → caveman) doesn't
 * leave the old pick behind as a permanently failing check.
 */
export function recordRequestedTools(projectPath: string, ids: ToolId[]): string {
  const newGroups = new Set(
    ids.map((id) => getToolById(id)?.conflictGroup).filter((g): g is string => g !== undefined)
  );
  const kept = readRequestedTools(projectPath).filter((id) => {
    if (ids.includes(id)) return false; // re-added below, keeps the requested order
    const group = getToolById(id)?.conflictGroup;
    return !(group && newGroups.has(group));
  });

  const path = stateFilePath(projectPath);
  const payload: StateFile = {
    requested: [...kept, ...ids],
    updatedAt: new Date().toISOString(),
  };
  writeFileSync(path, `${JSON.stringify(payload, null, 2)}\n`, "utf-8");
  return path;
}
