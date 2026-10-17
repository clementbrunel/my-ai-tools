// Small helpers shared by the config stores. Electron-free, so they can be tested.
import { mkdir, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

/** Pretty-printed JSON text of a config value, as written to disk. */
export const toJsonText = (value: unknown): string => `${JSON.stringify(value, null, 2)}\n`;

/** Writes a file atomically (temp file + rename), creating its directory; returns the text written. */
export async function writeJsonAtomic(path: string, value: unknown): Promise<string> {
  const text = toJsonText(value);
  await mkdir(dirname(path), { recursive: true });
  const temp = `${path}.tmp`;
  await writeFile(temp, text, "utf8");
  await rename(temp, path);
  return text;
}
