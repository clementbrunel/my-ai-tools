// User log formats: one `<id>.json` per format in the `formats` folder of the user data directory.
// Built-in formats live in code (@cbl-log/shared); a file here adds to them or overrides one by id.
import { mkdir, readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { parseLogFormat, type LogFormat } from "@cbl-log/shared";

export interface LoadedFormats {
  formats: LogFormat[];
  /** Files skipped (invalid JSON, schema or regex): reported, never fatal. */
  warnings: string[];
}

export async function loadFormats(dir: string): Promise<LoadedFormats> {
  await mkdir(dir, { recursive: true });
  const formats: LogFormat[] = [];
  const warnings: string[] = [];
  for (const name of (await readdir(dir)).filter((n) => n.toLowerCase().endsWith(".json")).sort()) {
    try {
      const parsed = parseLogFormat(await readFile(join(dir, name), "utf8"));
      if (parsed.ok) formats.push(parsed.value);
      else warnings.push(`${name}: ${parsed.error}`);
    } catch (err) {
      warnings.push(`${name}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return { formats, warnings };
}
