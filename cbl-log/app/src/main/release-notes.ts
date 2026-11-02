// "Notes de version" window content: the CHANGELOG.md bundled in the app (so the notes stay readable offline
// and after any update), parsed into one entry per `## [X.Y.Z] — date` section. Pure (no Electron) for tests.
import { themeColors } from "./brand-pages";

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

const escapeHtml = (text: string): string =>
  text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Inline markdown (bold, code, links reduced to their text) on an already escaped line. */
const inline = (text: string): string =>
  escapeHtml(text)
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");

const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
function frenchDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${Number(m[3])} ${MONTHS[Number(m[2]) - 1] ?? ""} ${m[1]}` : iso;
}

function entryHtml(e: ReleaseEntry, current: string): string {
  const bullets = e.lines.filter((l) => /^[-*]\s/.test(l)).map((l) => `<li>${inline(l.replace(/^[-*]\s+/, ""))}</li>`);
  const others = e.lines.filter((l) => !/^[-*]\s/.test(l)).map((l) => `<p>${inline(l)}</p>`);
  const badge = e.version === current ? `<span class="badge">installée</span>` : "";
  return `<section class="entry${e.version === current ? " current" : ""}" id="v${e.version}">
  <h2>${e.version}${badge}<span class="date">${escapeHtml(frenchDate(e.date))}</span></h2>
  ${others.join("")}<ul>${bullets.join("")}</ul>
</section>`;
}

/**
 * Window page. `onlyCurrent`: just the section of the installed version ("Nouveautés de cette version");
 * otherwise the whole history, the installed version highlighted.
 */
export function releaseNotesHtml(entries: readonly ReleaseEntry[], current: string, dark: boolean, onlyCurrent = false): string {
  const c = themeColors(dark);
  const shown = onlyCurrent ? entries.filter((e) => e.version === current) : entries;
  const body = shown.length > 0 ? shown.map((e) => entryHtml(e, current)).join("\n") : `<p class="empty">Aucune note disponible pour la version ${escapeHtml(current)}.</p>`;
  const title = onlyCurrent ? `Nouveautés de la version ${escapeHtml(current)}` : "Historique des versions";
  return `<!doctype html>
<html lang="fr"><head><meta charset="UTF-8" />
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'" />
<title>${title}</title>
<style>
  html, body { margin: 0; }
  body { background: ${c.bg}; color: ${c.fg}; font: 13px/1.5 "Segoe UI", system-ui, sans-serif; cursor: default; }
  header { position: sticky; top: 0; background: ${c.bg}; border-bottom: 1px solid ${c.border}; padding: 14px 24px 10px; }
  header h1 { margin: 0; font-size: 18px; font-weight: 600; }
  header p { margin: 2px 0 0; color: ${c.muted}; font-size: 12px; }
  main { padding: 8px 24px 24px; }
  .entry { padding: 12px 0 4px; border-bottom: 1px solid ${c.border}; }
  .entry:last-child { border-bottom: 0; }
  .entry h2 { margin: 0 0 6px; font-size: 15px; font-weight: 600; display: flex; align-items: baseline; gap: 8px; }
  .date { margin-left: auto; color: ${c.muted}; font-size: 12px; font-weight: 400; }
  .badge { background: ${c.accent}; color: #fff; border-radius: 9px; padding: 0 8px; font-size: 11px; font-weight: 500; }
  .current h2 { color: ${c.accent}; }
  ul { margin: 0 0 8px; padding-left: 20px; }
  li { margin: 4px 0; }
  code { font-family: Consolas, monospace; background: ${dark ? "#1e2329" : "#eef1f4"}; border-radius: 3px; padding: 0 4px; }
  .empty { color: ${c.muted}; }
</style></head>
<body>
<header><h1>${title}</h1><p>${onlyCurrent ? "Menu Aide › Historique des versions pour les précédentes." : `${shown.length} versions · installée : ${escapeHtml(current)}`}</p></header>
<main>
${body}
</main>
</body></html>`;
}
