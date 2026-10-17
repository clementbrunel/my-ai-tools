// Highlighting rules (H-01..H-05): ordered, first match wins for the line scope, earlier rules win on
// overlapping fragments. Colors are `#rrggbb`; backgrounds are drawn translucent by the renderer so
// that the same rules read well in light and dark themes.
import { z } from "zod";

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/);

export const highlightRuleSchema = z.object({
  id: z.string().min(1),
  name: z.string().default(""),
  pattern: z.string(),
  /** false: `pattern` is a literal substring. */
  isRegex: z.boolean().default(false),
  caseSensitive: z.boolean().default(false),
  fg: hexColor.optional(),
  bg: hexColor.optional(),
  /** "line": the whole line is colored; "fragment": only the matching text. */
  scope: z.enum(["line", "fragment"]).default("line"),
  enabled: z.boolean().default(true),
});

export const ruleSetSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().min(1),
  name: z.string().default(""),
  rules: z.array(highlightRuleSchema),
});

export type HighlightRule = z.infer<typeof highlightRuleSchema>;
export type RuleSet = z.infer<typeof ruleSetSchema>;

export type ParseRuleSetResult = { ok: true; value: RuleSet } | { ok: false; error: string };

/** Parses and validates the content of a rule-set file; never throws. */
export function parseRuleSet(text: string): ParseRuleSetResult {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (err) {
    return { ok: false, error: `Invalid JSON: ${err instanceof Error ? err.message : String(err)}` };
  }
  const result = ruleSetSchema.safeParse(json);
  return result.success ? { ok: true, value: result.data } : { ok: false, error: result.error.message };
}

const rule = (id: string, name: string, pattern: string, extra: Partial<HighlightRule>): HighlightRule => ({
  id,
  name,
  pattern,
  isRegex: true,
  caseSensitive: true,
  scope: "line",
  enabled: true,
  ...extra,
});

/** Rules shipped by default (H-03), including the IBM/WebSphere message ids ending in E / W. */
export function createDefaultRuleSet(): RuleSet {
  return {
    schemaVersion: 1,
    id: "default",
    name: "Défaut",
    rules: [
      rule("error", "ERROR", "\\b(ERROR|SEVERE|FATAL)\\b", { bg: "#d93025" }),
      rule("ibm-error", "IBM …E", "\\b[A-Z]{4,5}\\d{4}E\\b", { bg: "#d93025" }),
      rule("exception", "Exception", "[\\w.$]*Exception\\b", { bg: "#d93025", scope: "fragment" }),
      rule("caused-by", "Caused by", "Caused by:", { bg: "#d93025", scope: "fragment" }),
      rule("warn", "WARN", "\\b(WARN|WARNING)\\b", { bg: "#f29900" }),
      rule("ibm-warn", "IBM …W", "\\b[A-Z]{4,5}\\d{4}W\\b", { bg: "#f29900" }),
      rule("info", "INFO", "\\bINFO\\b", { bg: "#1a73e8", scope: "fragment" }),
      rule("debug", "DEBUG", "\\b(DEBUG|TRACE)\\b", { fg: "#80868b", scope: "fragment" }),
    ],
  };
}
