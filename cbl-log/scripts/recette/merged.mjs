// Scenarios of the "All" tab (M3, issues #395 / #393; asked in a comment of #486, tracked in #393): does the merge, which runs in the
// engine process (no workers), hold on real volumes? Same generated WebSphere files and writer as the rest of the run.
//
//   m1  2 files, m1b  4 files : click -> first page, click -> merge complete, engine memory, fluidity of another tab
//                               during the merge, duration of a full re-merge (untick / tick a source)
//   m3  8 sources followed at 1 000 lines/s each with "All" open (NF-11): delay before the lines show up, engine CPU
//
//   m4  search and filter inside the "All" tab (4 files): first results, total duration (NF-05)
import { execFileSync } from "node:child_process";
import { copyFileSync } from "node:fs";
import { join } from "node:path";
import { cpuPercent, cpuTimes, fmt, launch, now, page, percentile, quit, result, sleep, tempDir, verdict, waitFor } from "./lib.mjs";

const tabs = (app) => app.cdp.ev("document.querySelectorAll('.tab').length");
const mergedOpen = (app) => app.cdp.ev("!!document.querySelector('.merged-legend')");
const MERGE_FIRST_PAGE_MS = 1000;
const MERGE_FULL_MS = 5000;

/** Private working set (MiB) of the engine process alone (the utility process that is not the network service). */
function engineMemoryMiB() {
  const script = `
    $pids = Get-CimInstance Win32_Process -Filter "Name like 'cbl-log%'" | Where-Object { $_.CommandLine -match '--type=utility' -and $_.CommandLine -notmatch 'network.mojom' } | ForEach-Object { $_.ProcessId }
    Get-CimInstance Win32_PerfFormattedData_PerfProc_Process | Where-Object { $pids -contains $_.IDProcess } | ForEach-Object { $_.WorkingSetPrivate }`;
  const out = execFileSync("powershell", ["-NoProfile", "-Command", script], { encoding: "utf8" });
  return Math.round(out.split(/\r?\n/).filter(Boolean).reduce((n, l) => n + (Number(l) || 0), 0) / 1048576);
}

/** Per-file totals, by clicking each file tab. */
async function fileTotals(app, count) {
  const out = [];
  for (let i = 0; i < count; i++) {
    await app.cdp.ev(`document.querySelectorAll('.tab')[${i}].click()`);
    await sleep(400);
    out.push(await app.cdp.ev(page.totalLines));
  }
  return out;
}

const tabByText = (re) => `[...document.querySelectorAll('.tab')].find((t) => ${re}.test(t.innerText))`;

export async function mergeOpen(env, count) {
  const id = count === 2 ? "m1" : "m1b";
  const dir = tempDir(id);
  const files = Array.from({ length: count }, (_, i) => join(dir, `srv${i + 1}.log`));
  for (const f of files) copyFileSync(env.mergeFile, f);
  const app = await launch({ exe: env.exe, args: files, userData: tempDir(`${id}ud`), port: env.nextPort() });
  try {
    await waitFor(async () => (await tabs(app)) === count, `${count} tabs`, 180_000, 500);
    await waitFor(() => app.cdp.ev("!!document.querySelector('.tab-all')"), "All button (formats detected)", 120_000, 250);
    await sleep(1500);
    const totals = await fileTotals(app, count);
    const sum = totals.reduce((a, b) => a + b, 0);
    const memBefore = engineMemoryMiB();

    // the merge opens and becomes the active tab; go back to the first file at once and watch its frames
    const t0 = now();
    await app.cdp.ev("document.querySelector('.tab-all').click()");
    await waitFor(() => app.cdp.ev(`(${tabByText("/Tout/")}) ? true : false`), "All tab present", 60_000, 5);
    await app.cdp.ev(`(${tabByText("/srv1/")}).click()`);
    await app.cdp.ev(page.startSampler);
    await app.cdp.ev(`(${tabByText("/Tout/")}).click()`);
    await waitFor(async () => (await mergedOpen(app)) && (await app.cdp.ev(page.rowCount)), "first page of the merge", 120_000, 5);
    const firstMs = now() - t0;
    await waitFor(async () => (await mergedOpen(app)) && (await app.cdp.ev(page.totalLines)) === sum, "merge complete", 300_000, 50);
    const fullMs = now() - t0;
    const s = JSON.parse(await app.cdp.ev(page.stopSampler));
    const memAfter = engineMemoryMiB();
    const p99dt = percentile(s.dt, 99);
    const maxDt = Math.max(...s.dt);

    // untick / tick a source: full re-merge
    const toggle = async (expected) => {
      const t = now();
      await app.cdp.ev("document.querySelector('.merged-legend input').click()");
      await waitFor(async () => (await app.cdp.ev(page.totalLines)) === expected, "re-merge done", 300_000, 25);
      return now() - t;
    };
    const unticked = await toggle(sum - totals[0]);
    const reticked = await toggle(sum);
    const ok = firstMs <= MERGE_FIRST_PAGE_MS && fullMs <= MERGE_FULL_MS && p99dt <= 50;
    return result(
      id,
      `Onglet « Tout » : ${count} fichiers de ${env.mergeLabel}`,
      `première page < ${MERGE_FIRST_PAGE_MS} ms, fusion complète < ${MERGE_FULL_MS / 1000} s (seuils indicatifs), les autres onglets restent fluides (p99 ≤ 50 ms)`,
      verdict(ok),
      {
        "contenu": `${count} × ${env.mergeLabel} = ${sum.toLocaleString("fr-FR")} lignes`,
        "clic → première page": `${fmt(firstMs)} ms (seuil ${MERGE_FIRST_PAGE_MS} ms)`,
        "clic → fusion complète": `${fmt(fullMs)} ms (seuil ${MERGE_FULL_MS} ms)`,
        "mémoire du moteur, avant → après la fusion": `${memBefore} → ${memAfter} Mio (≈ ${fmt(((memAfter - memBefore) * 1048576) / sum, 2)} octet par ligne fusionnée ; attendu ~1)`,
        "fluidité d'un autre onglet pendant la fusion": `p99 ${fmt(p99dt, 1)} ms, max ${fmt(maxDt)} ms, ${s.dt.filter((d) => d > 100).length} images > 100 ms sur ${s.dt.length}`,
        "décocher une source (refusion)": `${fmt(unticked)} ms`,
        "recocher la source (refusion)": `${fmt(reticked)} ms`,
      },
      [
        "Décision (issue #393) : si la fusion initiale dépasse quelques secondes ou gêne les autres onglets, passer la lecture et le parsing des horodatages dans les workers existants.",
        "Fichiers copiés du même log généré : les horodatages se recoupent, cas le plus défavorable pour l'entrelacement.",
      ],
      { merge_first_ms: firstMs, merge_full_ms: fullMs, engine_mem_mib: memAfter, frame_p99: p99dt, toggle_ms: unticked },
    );
  } finally {
    await quit(app, { graceful: false });
  }
}

/** m3: 8 followed sources at 1 000 lines/s each, "All" open. */
export async function mergeFollow(env, runWriter) {
  const dir = tempDir("m3");
  const files = Array.from({ length: 8 }, (_, i) => join(dir, `srv${i + 1}.log`));
  for (const f of files) copyFileSync(env.mergeFile, f);
  const app = await launch({ exe: env.exe, args: files, userData: tempDir("m3ud"), port: env.nextPort() });
  try {
    await waitFor(async () => (await tabs(app)) === 8, "8 tabs", 180_000, 500);
    await waitFor(() => app.cdp.ev("!!document.querySelector('.tab-all')"), "All button", 120_000, 250);
    await sleep(1500);
    const totals = await fileTotals(app, 8);
    const sum = totals.reduce((a, b) => a + b, 0);
    await app.cdp.ev("document.querySelector('.tab-all').click()");
    await waitFor(async () => (await mergedOpen(app)) && (await app.cdp.ev(page.totalLines)) === sum, "merge complete", 300_000, 50);
    await sleep(1000);
    await app.cdp.ev(page.startSampler);
    const cpu0 = cpuTimes();
    await runWriter(files, 1000, 20);
    const cpu1 = cpuTimes();
    await sleep(3500); // merge window (2 s) + engine tick
    const s = JSON.parse(await app.cdp.ev(page.stopSampler));
    const total = await app.cdp.ev(page.totalLines);
    const cpu = cpuPercent(cpu0, cpu1);
    const mem = engineMemoryMiB();
    const p50 = percentile(s.lat, 50);
    const p95 = percentile(s.lat, 95);
    const p99dt = percentile(s.dt, 99);
    const expected = sum + 8 * 20_000;
    const ok = total === expected && p95 <= 2750 && p99dt <= 50;
    return result(
      "m3",
      "Onglet « Tout » : 8 sources en follow à 1 000 lignes/s chacune (NF-11)",
      "toutes les lignes apparaissent, délai ≈ fenêtre de 2 s + 250 ms (p95 ≤ 2,75 s), UI fluide",
      verdict(ok),
      {
        "lignes dans « Tout »": `${total.toLocaleString("fr-FR")} (attendu ${expected.toLocaleString("fr-FR")})`,
        "délai écriture → apparition": `p50 ${fmt(p50)} ms, p95 ${fmt(p95)} ms, max ${fmt(Math.max(...s.lat))} ms (seuil p95 ≤ 2 750 ms)`,
        "durée des images": `p99 ${fmt(p99dt, 1)} ms, ${s.dt.filter((d) => d > 100).length} images > 100 ms sur ${s.dt.length}`,
        "CPU pendant l'écriture (% d'un cœur)": `moteur ${fmt(cpu.engine, 1)} %, toute l'appli ${fmt(cpu.total, 1)} %`,
        "mémoire du moteur": `${mem} Mio`,
      },
      [],
      { lat_p50: p50, lat_p95: p95, frame_p99: p99dt, cpu_engine_pct: cpu.engine, cpu_total_pct: cpu.total, engine_mem_mib: mem },
    );
  } finally {
    await quit(app, { graceful: false });
  }
}

const PATTERN = "ServletWrappe"; // ~3 % of the generated lines
const stableFor = async (app, expr, ms, timeout) => {
  let last;
  let since = now();
  const deadline = now() + timeout;
  for (;;) {
    const v = await app.cdp.ev(expr);
    if (v !== last) {
      last = v;
      since = now();
    } else if (now() - since >= ms) return { value: v, settledAt: since };
    if (now() > deadline) throw new Error(`Timed out: ${expr}`);
    await sleep(25);
  }
};

/** m4: search and filter inside the "All" tab on 4 files (NF-05: first results < 1 s, 1 Go filtered in < 3 s). */
export async function mergeQuery(env) {
  const count = 4;
  const dir = tempDir("m4");
  const files = Array.from({ length: count }, (_, i) => join(dir, `srv${i + 1}.log`));
  for (const f of files) copyFileSync(env.mergeFile, f);
  const app = await launch({ exe: env.exe, args: files, userData: tempDir("m4ud"), port: env.nextPort() });
  try {
    await waitFor(async () => (await tabs(app)) === count, `${count} tabs`, 180_000, 500);
    await waitFor(() => app.cdp.ev("!!document.querySelector('.tab-all')"), "All button", 120_000, 250);
    await sleep(1500);
    const totals = await fileTotals(app, count);
    const sum = totals.reduce((a, b) => a + b, 0);
    await app.cdp.ev("document.querySelector('.tab-all').click()");
    await waitFor(async () => (await mergedOpen(app)) && (await app.cdp.ev(page.totalLines)) === sum, "merge complete", 300_000, 50);
    await sleep(1000);

    // search (Ctrl+F)
    await app.cdp.ev("document.querySelector('.viewport').focus()");
    await app.cdp.key("f", "KeyF", 2);
    await waitFor(() => app.cdp.ev("document.activeElement?.getAttribute('aria-label') === 'Rechercher'"), "search field focused");
    const t0 = now();
    await app.cdp.send("Input.insertText", { text: PATTERN });
    const countText = `document.querySelector('.search-count')?.innerText ?? ''`;
    await waitFor(async () => /\d/.test(await app.cdp.ev(countText)), "first search result", 120_000, 10);
    const searchFirstMs = now() - t0;
    const searched = await stableFor(app, countText, 800, 300_000);
    const searchFullMs = searched.settledAt - t0;
    await app.cdp.key("Escape", "Escape", 0, 27);

    // filter (Ctrl+Maj+F), then Enter = include
    await app.cdp.key("F", "KeyF", 2 | 8, 70);
    await waitFor(() => app.cdp.ev("document.activeElement?.getAttribute('aria-label') === 'Texte du filtre'"), "filter field focused");
    await app.cdp.send("Input.insertText", { text: PATTERN });
    const t1 = now();
    await app.cdp.key("Enter", "Enter", 0, 13);
    const shown = `(() => { const r = [...document.querySelectorAll('.log-row .log-text')]; return r.length > 0 && r.every((e) => e.innerText.includes(${JSON.stringify(PATTERN)})); })()`;
    await waitFor(() => app.cdp.ev(shown), "first filtered rows", 120_000, 10);
    const filterFirstMs = now() - t1;
    const filtered = await stableFor(app, "document.querySelector('.statusbar').innerText", 800, 300_000);
    const filterFullMs = filtered.settledAt - t1;
    const ok = searchFirstMs <= 1000 && filterFirstMs <= 1000;
    return result(
      "m4",
      `Onglet « Tout » : recherche et filtre sur ${count} fichiers de ${env.mergeLabel}`,
      "premiers résultats < 1 s, durée totale à comparer à NF-05 (1 Go filtré en < 3 s sur un fichier seul)",
      verdict(ok),
      {
        "contenu": `${count} × ${env.mergeLabel} = ${sum.toLocaleString("fr-FR")} lignes ; motif « ${PATTERN} »`,
        "recherche : premiers résultats": `${fmt(searchFirstMs)} ms (seuil 1 000 ms)`,
        "recherche : compteur stabilisé": `${fmt(searchFullMs)} ms (« ${searched.value} »)`,
        "filtre : premières lignes filtrées": `${fmt(filterFirstMs)} ms (seuil 1 000 ms)`,
        "filtre : barre d'état stabilisée": `${fmt(filterFullMs)} ms`,
        "mémoire du moteur": `${engineMemoryMiB()} Mio`,
      },
      ["« Stabilisé » = valeur inchangée pendant 800 ms (l'interface ne signale pas explicitement la fin) ; durée totale = instant du dernier changement."],
      { search_first_ms: searchFirstMs, search_full_ms: searchFullMs, filter_first_ms: filterFirstMs, filter_full_ms: filterFullMs, engine_mem_mib: engineMemoryMiB() },
    );
  } finally {
    await quit(app, { graceful: false });
  }
}

export const MERGED_IDS = ["m1", "m1b", "m3", "m4"];
