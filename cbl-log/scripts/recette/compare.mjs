// Compares the acceptance runs kept in docs/recette/history.jsonl:
//   - over time: the latest run of a source (file / docker) against the one before it;
//   - across sources: latest Docker run against latest file run, on the equivalent scenarios.
//
//   node scripts/recette/compare.mjs [--history docs/recette/history.jsonl] [--out docs/recette/comparaison.md]
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

/** Docker scenario → equivalent file scenario (same data, rate and thresholds). */
export const TWINS = { d1: "r1", d2: "r2", d2b: "r2b", d3: "r3-rename", d4: "r8" };

/** Metrics worth comparing: key in `values`, label, unit, which scenarios have it. */
const METRICS = [
  { key: "open_ms", label: "ouverture → affichage", unit: "ms", ids: ["r1", "d1"] },
  { key: "lat_p50", label: "latence écriture → affichage, p50", unit: "ms", ids: ["r2", "d2", "r2b", "d2b"] },
  { key: "lat_p95", label: "latence écriture → affichage, p95", unit: "ms", ids: ["r2", "d2", "r2b", "d2b", "r8", "d4"] },
  { key: "frame_p99", label: "durée des images, p99", unit: "ms", ids: ["r2", "d2", "r2b", "d2b", "r8", "d4"] },
  { key: "cpu_engine_pct", label: "CPU du moteur (% d'un cœur)", unit: "%", ids: ["r2", "d2", "r2b", "d2b", "r8", "d4"] },
  { key: "cpu_total_pct", label: "CPU de toute l'appli (% d'un cœur)", unit: "%", ids: ["r2", "d2", "r2b", "d2b", "r8", "d4"] },
  { key: "mem_mib", label: "mémoire privée", unit: "Mio", ids: ["r1", "d1", "r2", "d2", "r2b", "d2b", "r8", "d4"] },
  { key: "merge_first_ms", label: "« Tout » : clic → première page", unit: "ms", ids: ["m1", "m1b"] },
  { key: "merge_full_ms", label: "« Tout » : clic → fusion complète", unit: "ms", ids: ["m1", "m1b"] },
  { key: "toggle_ms", label: "« Tout » : refusion (source décochée)", unit: "ms", ids: ["m1", "m1b"] },
  { key: "engine_mem_mib", label: "mémoire du moteur", unit: "Mio", ids: ["m1", "m1b", "m3", "m4"] },
  { key: "lat_p50", label: "« Tout » : délai d'apparition, p50", unit: "ms", ids: ["m3"] },
  { key: "lat_p95", label: "« Tout » : délai d'apparition, p95", unit: "ms", ids: ["m3"] },
  { key: "frame_p99", label: "« Tout » : durée des images, p99", unit: "ms", ids: ["m1", "m1b", "m3"] },
  { key: "cpu_engine_pct", label: "« Tout » : CPU du moteur (% d'un cœur)", unit: "%", ids: ["m3"] },
  { key: "search_first_ms", label: "« Tout » : recherche, premiers résultats", unit: "ms", ids: ["m4"] },
  { key: "search_full_ms", label: "« Tout » : recherche, compteur stabilisé", unit: "ms", ids: ["m4"] },
  { key: "filter_first_ms", label: "« Tout » : filtre, premières lignes", unit: "ms", ids: ["m4"] },
  { key: "filter_full_ms", label: "« Tout » : filtre, barre d'état stabilisée", unit: "ms", ids: ["m4"] },
  { key: "missing", label: "lignes manquantes", unit: "", ids: ["r3-rename", "d3", "r8", "d4"] },
];

const num = (re, text) => {
  const m = re.exec(text ?? "");
  return m ? Number(m[1].replace(",", ".")) : undefined;
};

/** Numbers of a record written before `values` existed (first file run), read back from its report strings. */
function legacyValues(id, measures) {
  const out = {};
  const set = (k, v) => v !== undefined && (out[k] = v);
  if (id === "r1") {
    set("open_ms", num(/→ ~(\d+) ms/, measures["ouverture → fin affichée"]));
    set("mem_mib", num(/^(\d+) Mio/, measures["mémoire privée, au repos"]));
  } else if (id === "r2") {
    set("lat_p50", num(/p50 (\d+)/, measures["latence écriture → affichage"]));
    set("lat_p95", num(/p95 (\d+)/, measures["latence écriture → affichage"]));
    set("frame_p99", num(/p99 ([\d.]+)/, measures["durée des images"]));
    set("mem_mib", num(/^(\d+) Mio/, measures["mémoire privée"]));
  } else if (id === "r8") {
    set("frame_p99", num(/p99 ([\d.]+)/, measures["durée des images (onglet actif)"]));
    set("mem_mib", num(/→ (\d+) Mio/, measures["mémoire privée, avant → pendant/après"]));
  } else if (id === "r3-rename") {
    set("missing", num(/manquantes : (\d+)/, measures["lignes comptées par l'onglet"]));
  }
  return out;
}

export function readHistory(file) {
  if (!existsSync(file)) return [];
  return readFileSync(file, "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((l) => JSON.parse(l))
    .map((run) => ({
      ...run,
      source: run.source ?? "file",
      results: run.results.map((r) => ({ ...r, values: r.values ?? legacyValues(r.id, r.measures ?? {}) })),
    }));
}

/** Runs of a source that contain the scenario, oldest first. */
const runsWith = (history, source, id) => history.filter((run) => run.source === source && run.results.some((r) => r.id === id));
const valueOf = (run, id, key) => run?.results.find((r) => r.id === id)?.values?.[key];

const show = (v, unit) => (v === undefined ? "—" : `${Number.isInteger(v) ? v : v.toFixed(1)}${unit ? ` ${unit}` : ""}`);
function delta(from, to, unit) {
  if (from === undefined || to === undefined) return "—";
  const d = to - from;
  if (d === 0) return "=";
  const pct = from !== 0 ? ` (${d > 0 ? "+" : ""}${((d / from) * 100).toFixed(0)} %)` : "";
  return `${d > 0 ? "+" : ""}${Number.isInteger(d) ? d : d.toFixed(1)}${unit ? ` ${unit}` : ""}${pct}`;
}
const stamp = (run) => (run ? `${run.date} ${run.commit}` : "—");

export function compareReport(history) {
  const lines = ["# Comparaison des recettes : itération précédente, fichier ↔ Docker", ""];
  const files = history.filter((r) => r.source === "file");
  const dockers = history.filter((r) => r.source === "docker");
  const lastFile = files.at(-1);
  const lastDocker = dockers.at(-1);
  lines.push(`- Dernière recette **fichier** : ${stamp(lastFile)}${files.length > 1 ? ` (précédente : ${stamp(files.at(-2))})` : ""}`);
  lines.push(`- Dernière recette **Docker** : ${stamp(lastDocker)}${dockers.length > 1 ? ` (précédente : ${stamp(dockers.at(-2))})` : ""}`);
  lines.push("", "Plus bas = mieux, sauf mention contraire. Les scénarios jumeaux utilisent les mêmes lignes, débits, durées et seuils (voir `scripts/recette/docker.mjs`).", "");

  lines.push("## 1. Fichier ↔ Docker (dernières recettes)", "", "| Scénario jumeau | Mesure | Fichier | Docker | Écart Docker − fichier |", "|---|---|---|---|---|");
  for (const [d, r] of Object.entries(TWINS)) {
    for (const m of METRICS.filter((m) => m.ids.includes(d))) {
      const fv = valueOf(lastFile, r, m.key);
      const dv = valueOf(lastDocker, d, m.key);
      if (fv === undefined && dv === undefined) continue;
      lines.push(`| ${r.toUpperCase()} ↔ ${d.toUpperCase()} | ${m.label} | ${show(fv, m.unit)} | ${show(dv, m.unit)} | ${delta(fv, dv, m.unit)} |`);
    }
  }

  for (const [source, title, ids] of [
    ["file", "2. Recette fichier : itération précédente → dernière", ["r1", "r2", "r2b", "r3-rename", "r8", "m1", "m1b", "m3", "m4"]],
    ["docker", "3. Recette Docker : itération précédente → dernière", ["d1", "d2", "d2b", "d3", "d4"]],
  ]) {
    lines.push("", `## ${title}`, "", "| Scénario | Mesure | Précédente | Dernière | Écart |", "|---|---|---|---|---|");
    let any = false;
    for (const id of ids) {
      const runs = runsWith(history, source, id);
      if (runs.length === 0) continue;
      const last = runs.at(-1);
      const prev = runs.at(-2);
      for (const m of METRICS.filter((m) => m.ids.includes(id))) {
        const to = valueOf(last, id, m.key);
        if (to === undefined) continue;
        any = true;
        const from = valueOf(prev, id, m.key);
        lines.push(`| ${id.toUpperCase()} | ${m.label} | ${show(from, m.unit)} | ${show(to, m.unit)} | ${prev ? delta(from, to, m.unit) : "première mesure"} |`);
      }
    }
    if (!any) lines.push("| — | pas encore de mesure | | | |");
  }

  lines.push("", "## 4. Statut des scénarios (dernières recettes)", "", "| Scénario | Fichier | Docker |", "|---|---|---|");
  for (const [d, r] of Object.entries(TWINS)) {
    const fs = lastFile?.results.find((x) => x.id === r)?.status ?? "—";
    const ds = lastDocker?.results.find((x) => x.id === d)?.status ?? "—";
    lines.push(`| ${r.toUpperCase()} ↔ ${d.toUpperCase()} | ${fs} | ${ds} |`);
  }
  lines.push("", "> R1 ↔ D1 : pas la même mesure (R1 indexe un fichier de 1 Gio, D1 charge la fin d'un historique) ; l'écart indique un ordre de grandeur de l'ouverture, pas un surcoût.");
  return lines.join("\n");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const argv = process.argv.slice(2);
  const opt = (name, fallback) => {
    const at = argv.indexOf(`--${name}`);
    return at >= 0 ? argv[at + 1] : fallback;
  };
  const report = compareReport(readHistory(resolve(root, opt("history", "docs/recette/history.jsonl"))));
  console.log(report);
  const out = opt("out", "");
  if (out) {
    mkdirSync(dirname(resolve(root, out)), { recursive: true });
    writeFileSync(resolve(root, out), report + "\n");
  }
}
