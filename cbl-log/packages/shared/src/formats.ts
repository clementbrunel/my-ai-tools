// Declarative log formats (C-04, architecture 4.4): a regex with named groups splits a line into
// `ts`, `level`, `thread`, `logger`, `msg`; the level can be recovered from the message when the
// format's own level field says nothing (WebSphere SystemOut lines are all type "O").
import { z } from "zod";

export const LEVELS = ["fatal", "error", "warn", "info", "debug", "trace"] as const;
export type Level = (typeof LEVELS)[number];

const levelSchema = z.enum(LEVELS);
/** "none": the value carries no information (e.g. WebSphere type O = plain stdout), try the fallbacks. */
const levelMapSchema = z.record(z.string(), z.union([levelSchema, z.literal("none")]));

export const logFormatSchema = z.object({
  schemaVersion: z.literal(1).default(1),
  id: z.string().min(1),
  name: z.string().default(""),
  /** A line matching this regex votes for the format during auto-detection. */
  detect: z.string(),
  /** Regex with named groups `ts`, `level`, `thread`, `logger`, `msg` (all optional). */
  line: z.string(),
  /** Layout of `ts`: yyyy yy MM M dd d HH H mm ss SSS z (zone abbreviation), other characters literal. */
  timestamp: z.string().optional(),
  /** Day/month order of numeric dates: "auto" decides from the sample (a field above 12 gives it away). */
  dateOrder: z.enum(["mdy", "dmy", "auto"]).default("mdy"),
  /** Value of the `level` group -> normalized level. */
  levels: levelMapSchema.default({}),
  /** Tried on `msg` when the level group is missing or maps to "none"; first match wins. */
  levelFallbacks: z
    .array(z.object({ pattern: z.string(), levels: levelMapSchema.default({}) }))
    .default([]),
  /** "not-line": lines that do not match belong to the previous record (stack traces, SQL, ...). */
  continuation: z.enum(["not-line", "none"]).default("not-line"),
});

export type LogFormat = z.infer<typeof logFormatSchema>;

export type ParseFormatResult = { ok: true; value: LogFormat } | { ok: false; error: string };

/** Parses and validates a user format file; also checks that the regexes compile. */
export function parseLogFormat(text: string): ParseFormatResult {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (err) {
    return { ok: false, error: `Invalid JSON: ${err instanceof Error ? err.message : String(err)}` };
  }
  const result = logFormatSchema.safeParse(json);
  if (!result.success) return { ok: false, error: result.error.message };
  try {
    compileFormat(result.data);
  } catch (err) {
    return { ok: false, error: `Invalid regex: ${err instanceof Error ? err.message : String(err)}` };
  }
  return { ok: true, value: result.data };
}

// -------------------------------------------------------------------------------------------------
// Built-in formats

const JUL_AND_COMMON_LEVELS: Record<string, Level> = {
  FATAL: "fatal",
  SEVERE: "error",
  ERROR: "error",
  WARNING: "warn",
  WARN: "warn",
  INFO: "info",
  CONFIG: "debug",
  DEBUG: "debug",
  FINE: "debug",
  FINER: "trace",
  FINEST: "trace",
  TRACE: "trace",
};

/** WebSphere traditional (SystemOut.log / SystemErr.log) and Liberty (messages.log) text layout. */
export const WEBSPHERE_BASIC: LogFormat = {
  schemaVersion: 1,
  id: "websphere-basic",
  name: "WebSphere",
  detect: "^\\[\\d{1,2}/\\d{1,2}/\\d{2} \\d{1,2}:\\d{2}:\\d{2}:\\d{3} \\S+\\] [0-9a-fA-F]{8} ",
  line: "^\\[(?<ts>[^\\]]+)\\] (?<thread>[0-9a-fA-F]{8}) (?<logger>\\S+)\\s+(?<level>\\S) (?<msg>.*)$",
  timestamp: "M/d/yy H:mm:ss:SSS z",
  dateOrder: "auto",
  levels: {
    F: "fatal",
    E: "error",
    R: "error",
    W: "warn",
    A: "info",
    I: "info",
    // stdout (O) says nothing about severity: the application's own level is in the message
    O: "none",
    C: "debug",
    D: "debug",
    "1": "trace",
    "2": "trace",
    "3": "trace",
  },
  levelFallbacks: [
    // application layout "user|channel|yyyyMMdd|time|LEVEL|logger|..." with java.util.logging / log4j names
    {
      pattern: "^[^|]*\\|[^|]*\\|\\d{8}\\|\\d+\\|(?<level>[A-Z]+)\\|",
      levels: JUL_AND_COMMON_LEVELS,
    },
    // IBM message ids: CWWKZ0001I, WSVR0605W, SESN0066E ...
    { pattern: "\\b[A-Z]{4,5}\\d{4}(?<level>[EWI])\\b", levels: { E: "error", W: "warn", I: "info" } },
  ],
  continuation: "not-line",
};

/** Spring Boot / Logback default layout: proves the engine is not WebSphere-specific. */
export const SPRING_BOOT: LogFormat = {
  schemaVersion: 1,
  id: "spring-boot",
  name: "Spring Boot",
  detect: "^\\d{4}-\\d{2}-\\d{2}[ T]\\d{2}:\\d{2}:\\d{2}",
  line: "^(?<ts>\\d{4}-\\d{2}-\\d{2}[ T]\\d{2}:\\d{2}:\\d{2}(?:[.,]\\d+)?)\\s+(?<level>[A-Z]+)\\s+\\d+\\s+---\\s+\\[(?<thread>[^\\]]+)\\]\\s+(?<logger>\\S+)\\s*:\\s(?<msg>.*)$",
  timestamp: "yyyy-MM-dd HH:mm:ss.SSS",
  dateOrder: "mdy",
  levels: JUL_AND_COMMON_LEVELS,
  levelFallbacks: [],
  continuation: "not-line",
};

export const BUILTIN_FORMATS: readonly LogFormat[] = [WEBSPHERE_BASIC, SPRING_BOOT];

// -------------------------------------------------------------------------------------------------
// Compilation and line parsing

/** Only this many leading characters of a line are parsed (keeps a 64 KB line cheap). */
export const MAX_PARSED_CHARS = 4000;

export interface CompiledFormat {
  format: LogFormat;
  detect: RegExp;
  line: RegExp;
  fallbacks: { regex: RegExp; levels: Record<string, Level | "none"> }[];
}

export function compileFormat(format: LogFormat): CompiledFormat {
  return {
    format,
    detect: new RegExp(format.detect),
    line: new RegExp(format.line),
    fallbacks: format.levelFallbacks.map((f) => ({ regex: new RegExp(f.pattern), levels: f.levels })),
  };
}

export interface ParsedLine {
  ts?: string;
  level?: Level;
  thread?: string;
  logger?: string;
  msg: string;
}

function lookupLevel(levels: Record<string, Level | "none">, raw: string | undefined): Level | "none" | undefined {
  if (raw === undefined) return undefined;
  return levels[raw] ?? levels[raw.toUpperCase()];
}

/** Splits a line according to the format; undefined when the line is not the head of a record. */
export function parseLine(compiled: CompiledFormat, text: string): ParsedLine | undefined {
  const sample = text.length > MAX_PARSED_CHARS ? text.slice(0, MAX_PARSED_CHARS) : text;
  const match = compiled.line.exec(sample);
  if (!match) return undefined;
  const g = match.groups ?? {};
  const msg = g["msg"] ?? "";
  let level = lookupLevel(compiled.format.levels, g["level"]);
  if (level === undefined || level === "none") {
    level = undefined;
    for (const fallback of compiled.fallbacks) {
      const hit = fallback.regex.exec(msg);
      const found = lookupLevel(fallback.levels, hit?.groups?.["level"]);
      if (found && found !== "none") {
        level = found;
        break;
      }
    }
  }
  const parsed: ParsedLine = { msg };
  if (g["ts"] !== undefined) parsed.ts = g["ts"];
  if (level) parsed.level = level;
  if (g["thread"] !== undefined) parsed.thread = g["thread"];
  if (g["logger"] !== undefined) parsed.logger = g["logger"];
  return parsed;
}

// -------------------------------------------------------------------------------------------------
// Auto-detection

/** Lines examined to recognize a format. */
export const DETECT_SAMPLE_LINES = 100;
/** A format needs at least this share of the non-empty sample lines (or 3 lines) to be chosen. */
const DETECT_MIN_SHARE = 0.1;

/**
 * Picks the built-in or user format that matches most of the first lines (`detect` regex, confirmed
 * by `line`). undefined = unknown format, the tab stays "raw". Ties go to the earlier format.
 */
export function detectFormat(lines: readonly string[], formats: readonly CompiledFormat[]): CompiledFormat | undefined {
  const sample = lines.slice(0, DETECT_SAMPLE_LINES).filter((l) => l.trim() !== "");
  if (sample.length === 0) return undefined;
  let best: CompiledFormat | undefined;
  let bestScore = 0;
  for (const compiled of formats) {
    let score = 0;
    for (const text of sample) {
      const head = text.length > MAX_PARSED_CHARS ? text.slice(0, MAX_PARSED_CHARS) : text;
      if (compiled.detect.test(head) && compiled.line.test(head)) score++;
    }
    if (score > bestScore) {
      best = compiled;
      bestScore = score;
    }
  }
  return best && (bestScore >= 3 || bestScore >= sample.length * DETECT_MIN_SHARE || bestScore === sample.length) ? best : undefined;
}

// -------------------------------------------------------------------------------------------------
// Timestamps

/** Zone abbreviation -> offset from UTC in minutes. Extendable through settings. */
export const DEFAULT_ZONE_OFFSETS: Readonly<Record<string, number>> = {
  UTC: 0,
  GMT: 0,
  Z: 0,
  WET: 0,
  WEST: 60,
  BST: 60,
  CET: 60,
  CEST: 120,
  EET: 120,
  EEST: 180,
  EST: -300,
  EDT: -240,
  CST: -360,
  CDT: -300,
  MST: -420,
  MDT: -360,
  PST: -480,
  PDT: -420,
};

export type DateOrder = "mdy" | "dmy";

/**
 * Decides the day/month order of numeric `a/b/yy` dates from samples: a first field above 12 means
 * day first, a second field above 12 means month first. undefined while every date is ambiguous.
 */
export function detectDateOrder(timestamps: readonly string[]): DateOrder | undefined {
  for (const ts of timestamps) {
    const m = /^(\d{1,2})[/.-](\d{1,2})[/.-]\d{2,4}/.exec(ts.trim());
    if (!m) continue;
    if (Number(m[1]) > 12) return "dmy";
    if (Number(m[2]) > 12) return "mdy";
  }
  return undefined;
}

const TOKEN = /yyyy|yy|MM|M|dd|d|HH|H|mm|ss|SSS|z|[^yMdHmsSz]+/g;

interface TimestampOptions {
  order?: DateOrder;
  zoneOffsets?: Readonly<Record<string, number>>;
  /** Read the clock as written, whatever its zone (to compare with a time typed by the user). */
  ignoreZone?: boolean;
}

/**
 * Parses `ts` laid out like `pattern` into milliseconds since the epoch (UTC), or undefined when it
 * does not fit. Two-digit years are 20xx. `order: "dmy"` swaps the first two numeric date tokens
 * of an M/d pattern.
 */
export function parseTimestamp(ts: string, pattern: string, options: TimestampOptions = {}): number | undefined {
  let tokens: string[] = pattern.match(TOKEN) ?? [];
  if (options.order === "dmy") {
    const first = tokens.findIndex((t) => t === "M" || t === "MM");
    const second = tokens.findIndex((t) => t === "d" || t === "dd");
    if (first !== -1 && second !== -1 && first < second) {
      tokens = [...tokens];
      [tokens[first], tokens[second]] = [tokens[second]!, tokens[first]!];
    }
  }
  const fields: string[] = [];
  const source = tokens
    .map((token) => {
      switch (token) {
        case "yyyy":
          fields.push("year");
          return "(\\d{4})";
        case "yy":
          fields.push("year2");
          return "(\\d{2})";
        case "MM":
        case "M":
          fields.push("month");
          return "(\\d{1,2})";
        case "dd":
        case "d":
          fields.push("day");
          return "(\\d{1,2})";
        case "HH":
        case "H":
          fields.push("hour");
          return "(\\d{1,2})";
        case "mm":
          fields.push("minute");
          return "(\\d{2})";
        case "ss":
          fields.push("second");
          return "(\\d{2})";
        case "SSS":
          fields.push("ms");
          return "(\\d{1,6})";
        case "z":
          fields.push("zone");
          return "([A-Za-z]+|[+-]\\d{2}:?\\d{2})";
        default:
          return token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      }
    })
    .join("");
  const match = new RegExp(`^${source}$`).exec(ts.trim());
  if (!match) return undefined;

  const v: Record<string, string> = {};
  fields.forEach((name, i) => (v[name] = match[i + 1]!));
  const year = v["year"] !== undefined ? Number(v["year"]) : 2000 + Number(v["year2"] ?? 0);
  const month = Number(v["month"] ?? 1);
  const day = Number(v["day"] ?? 1);
  if (month < 1 || month > 12 || day < 1 || day > 31) return undefined;
  const ms = v["ms"] !== undefined ? Math.round(Number(`0.${v["ms"]}`) * 1000) : 0;
  let offsetMinutes = 0;
  const zone = v["zone"];
  if (zone !== undefined && !options.ignoreZone) {
    const numeric = /^([+-])(\d{2}):?(\d{2})$/.exec(zone);
    if (numeric) offsetMinutes = (numeric[1] === "-" ? -1 : 1) * (Number(numeric[2]) * 60 + Number(numeric[3]));
    else {
      const known = { ...DEFAULT_ZONE_OFFSETS, ...options.zoneOffsets }[zone.toUpperCase()] ?? { ...DEFAULT_ZONE_OFFSETS, ...options.zoneOffsets }[zone];
      if (known === undefined) return undefined;
      offsetMinutes = known;
    }
  }
  return Date.UTC(year, month - 1, day, Number(v["hour"] ?? 0), Number(v["minute"] ?? 0), Number(v["second"] ?? 0), ms) - offsetMinutes * 60_000;
}
