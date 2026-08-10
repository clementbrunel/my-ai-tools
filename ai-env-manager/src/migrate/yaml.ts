/**
 * Minimal YAML block-style serializer.
 *
 * The migration output is plain JSON-shaped data (maps, arrays, scalars), so a
 * ~70-line emitter is enough and keeps the tool dependency-free — the rest of
 * ai-env-manager only pulls in chalk and commander.
 */

export type YamlValue =
  | string
  | number
  | boolean
  | null
  | YamlValue[]
  | { [key: string]: YamlValue | undefined };

type YamlScalar = string | number | boolean | null;

/** Words YAML would read back as a boolean/null instead of a string. */
const RESERVED = new Set(["true", "false", "null", "yes", "no", "on", "off", "~"]);

/** Characters that never need quoting, as long as they don't lead the scalar. */
const PLAIN_SAFE = /^[A-Za-z0-9_][A-Za-z0-9_ ./@+-]*$/;

function isScalar(value: unknown): value is YamlScalar {
  return (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  );
}

function isPlainSafe(value: string): boolean {
  if (!PLAIN_SAFE.test(value)) return false;
  if (RESERVED.has(value.toLowerCase())) return false;
  // A numeric-looking string must stay quoted to survive a round-trip as a string
  if (/^-?\d+(\.\d+)?$/.test(value)) return false;
  return !value.endsWith(" ");
}

function quote(value: string): string {
  const escaped = value
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t")
    .replace(/[\u0000-\u001f]/g, (c) => `\\x${c.charCodeAt(0).toString(16).padStart(2, "0")}`);
  return `"${escaped}"`;
}

function formatScalar(value: YamlScalar): string {
  if (value === null) return "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : quote(String(value));
  return isPlainSafe(value) ? value : quote(value);
}

/** Renders a value as block YAML, returning one string per line. */
function emit(value: YamlValue, depth: number): string[] {
  const pad = "  ".repeat(depth);

  if (Array.isArray(value)) {
    if (value.length === 0) return [`${pad}[]`];
    return value.flatMap((item) => {
      if (isScalar(item)) return [`${pad}- ${formatScalar(item)}`];
      const nested = emit(item, depth + 1);
      // "  " of the extra depth is exactly the width of the "- " marker,
      // so the dash can replace it on the first line without shifting anything.
      nested[0] = `${pad}- ${nested[0].slice((depth + 1) * 2)}`;
      return nested;
    });
  }

  const entries = Object.entries(value as Record<string, YamlValue | undefined>).filter(
    ([, v]) => v !== undefined
  );
  if (entries.length === 0) return [`${pad}{}`];

  return entries.flatMap(([key, child]) => {
    const label = `${pad}${formatScalar(key)}:`;
    if (isScalar(child)) return [`${label} ${formatScalar(child)}`];
    const nested = emit(child as YamlValue, depth + 1);
    // Keep empty collections on the key's own line: "mcps: {}" rather than a dangling key
    if (nested.length === 1 && (nested[0].trim() === "{}" || nested[0].trim() === "[]")) {
      return [`${label} ${nested[0].trim()}`];
    }
    return [label, ...nested];
  });
}

/** Serializes a value to block-style YAML, optionally prefixed with `#` comment lines. */
export function toYaml(value: YamlValue, header: string[] = []): string {
  const lines = header.map((line) => (line ? `# ${line}` : "#"));
  return [...lines, ...emit(value, 0), ""].join("\n");
}
