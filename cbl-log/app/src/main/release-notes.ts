// "Notes de version" content: the CHANGELOG.md bundled in the app (so the notes stay readable offline
// and after any update), parsed into one entry per `## [X.Y.Z] — date` section. Pure (no Electron) for tests.
export interface ReleaseEntry {
  version: string;
  date: string;
  /** Raw markdown lines of the section (bullets, paragraphs). */
  lines: string[];
}

/** Sections of CHANGELOG.md, newest first as written in the file. */
export function parseChangelog(markdown: string): ReleaseEntry[] {
  const entries: ReleaseEntry[] = [];
  for (const line of markdown.split(/\r?\n/)) {
    const head = /^##\s+\[(\d+\.\d+\.\d+)\](?:\s+[—-]\s+(\S+))?/.exec(line);
    if (head) entries.push({ version: head[1]!, date: head[2] ?? "", lines: [] });
    else if (entries.length > 0 && line.trim()) entries[entries.length - 1]!.lines.push(line.trim());
  }
  return entries;
}

export interface InlineToken {
  text: string;
  kind: "text" | "strong" | "code";
}

/** Inline markdown (bold, code; links reduced to their text) as tokens: shared by the notes window (HTML) and the update panel (React). */
export function parseInline(text: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  const re = /\*\*([^*]+)\*\*|`([^`]+)`/g;
  const plain = text.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");
  let last = 0;
  for (let m = re.exec(plain); m; m = re.exec(plain)) {
    if (m.index > last) tokens.push({ text: plain.slice(last, m.index), kind: "text" });
    tokens.push(m[1] !== undefined ? { text: m[1], kind: "strong" } : { text: m[2]!, kind: "code" });
    last = m.index + m[0].length;
  }
  if (last < plain.length) tokens.push({ text: plain.slice(last), kind: "text" });
  return tokens;
}

/** Lines of a release body split into bullets and paragraphs (same rule as the notes window). */
export function parseNotes(body: string): { bullets: string[]; paragraphs: string[] } {
  const lines = body.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  return {
    bullets: lines.filter((l) => /^[-*]\s/.test(l)).map((l) => l.replace(/^[-*]\s+/, "")),
    paragraphs: lines.filter((l) => !/^[-*]\s/.test(l)),
  };
}
