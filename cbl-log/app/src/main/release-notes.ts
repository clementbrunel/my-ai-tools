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
  return `<section class="entry" id="v${e.version}">
  <h2>${e.version}${badge}<span class="date">${escapeHtml(frenchDate(e.date))}</span></h2>
  ${others.join("")}<ul>${bullets.join("")}</ul>
</section>`;
}

/**
 * Window page: one version at a time, starting on the installed one (the latest); the "Plus récente" /
 * "Plus ancienne" buttons (or the arrow keys) step through the history, which therefore never grows a menu.
 */
export function releaseNotesHtml(entries: readonly ReleaseEntry[], current: string, dark: boolean): string {
  const c = themeColors(dark);
  const start = Math.max(0, entries.findIndex((e) => e.version === current));
  const body = entries.length > 0 ? entries.map((e) => entryHtml(e, current)).join("\n") : `<p class="empty">Aucune note disponible.</p>`;
  return `<!doctype html>
<html lang="fr"><head><meta charset="UTF-8" />
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'" />
<title>Notes de version</title>
<style>
  html, body { height: 100%; margin: 0; }
  body { background: ${c.bg}; color: ${c.fg}; font: 13px/1.5 "Segoe UI", system-ui, sans-serif; cursor: default; display: flex; flex-direction: column; }
  header { display: flex; align-items: center; gap: 8px; border-bottom: 1px solid ${c.border}; padding: 10px 16px; }
  header h1 { margin: 0 auto 0 0; font-size: 16px; font-weight: 600; }
  .pos { color: ${c.muted}; font-size: 12px; min-width: 44px; text-align: center; }
  button { font: inherit; color: ${c.fg}; background: transparent; border: 1px solid ${c.border}; border-radius: 4px; padding: 3px 10px; cursor: pointer; }
  button:hover:not(:disabled) { border-color: ${c.accent}; color: ${c.accent}; }
  button:disabled { opacity: 0.4; cursor: default; }
  main { flex: 1; overflow-y: auto; padding: 8px 24px 20px; }
  .entry { display: none; padding-top: 8px; }
  .entry.shown { display: block; }
  .entry h2 { margin: 0 0 8px; font-size: 18px; font-weight: 600; display: flex; align-items: baseline; gap: 8px; }
  .date { margin-left: auto; color: ${c.muted}; font-size: 12px; font-weight: 400; }
  .badge { background: ${c.accent}; color: #fff; border-radius: 9px; padding: 0 8px; font-size: 11px; font-weight: 500; }
  ul { margin: 0 0 8px; padding-left: 20px; }
  li { margin: 4px 0; }
  code { font-family: Consolas, monospace; background: ${dark ? "#1e2329" : "#eef1f4"}; border-radius: 3px; padding: 0 4px; }
  .empty { color: ${c.muted}; }
</style></head>
<body>
<header>
  <h1>Notes de version</h1>
  <button id="older" title="Version plus ancienne (←)">‹ Plus ancienne</button>
  <span class="pos" id="pos"></span>
  <button id="newer" title="Version plus récente (→)">Plus récente ›</button>
</header>
<main id="main">
${body}
</main>
<script>
  var items = Array.prototype.slice.call(document.querySelectorAll(".entry"));
  var i = ${start};
  function show(n) {
    if (items.length === 0) return;
    i = Math.min(Math.max(n, 0), items.length - 1);
    items.forEach(function (el, k) { el.classList.toggle("shown", k === i); });
    document.getElementById("pos").textContent = (i + 1) + " / " + items.length;
    document.getElementById("newer").disabled = i === 0;
    document.getElementById("older").disabled = i === items.length - 1;
    document.getElementById("main").scrollTop = 0;
  }
  document.getElementById("older").onclick = function () { show(i + 1); };
  document.getElementById("newer").onclick = function () { show(i - 1); };
  document.addEventListener("keydown", function (e) {
    if (e.key === "ArrowLeft") show(i + 1);
    else if (e.key === "ArrowRight") show(i - 1);
  });
  show(i);
</script>
</body></html>`;
}
