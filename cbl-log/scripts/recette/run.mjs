// Acceptance run of the MVP criteria (cahier des charges, section 7; issue #393) on the PACKAGED app.
//
//   npm run package:dir && npm run recette -- --size 1G [--only r1,r2,...] [--out docs/recette-mvp.md] [--history docs/recette/history.jsonl]
//
// The app runs with an isolated config folder (CBL_LOG_USER_DATA) and is driven over the DevTools
// protocol. Needs the bench build (`npm run bench -- --size 1G --generate-only` does it) for the
// generator and the 1 000 lines/s writer.
import { execFileSync, fork, spawn } from "node:child_process";
import { appendFileSync, copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { cpus, platform, release, tmpdir, totalmem } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { launch, memory, now, openInRunningApp, page, percentile, quit, sleep, tempDir, waitFor } from "./lib.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const argv = process.argv.slice(2);
const opt = (name, fallback) => {
  const at = argv.indexOf(`--${name}`);
  return at >= 0 ? argv[at + 1] : fallback;
};
const exe = resolve(opt("exe", join(root, "release/win-unpacked/cbl-log.exe")));
const sizeArg = opt("size", "1G");
const only = opt("only", "")
  .split(",")
  .filter(Boolean);
const outFile = opt("out", "");
const historyFile = opt("history", "");
const benchDir = join(root, "packages/engine/dist/bench-build/bench");
const writerJs = join(benchDir, "writer.js");
const rollingFixture = join(root, "packages/engine/test/fixtures/rolling-writer.mjs");
const MEMORY_BUDGET_MIB = 400;

let portCounter = 9400;
const nextPort = () => portCounter++;
const fmt = (n, digits = 0) => (Number.isFinite(n) ? n.toFixed(digits) : "n/a");

/** Writes lines `#seq#wallMs#` to the given files at `rate` lines/s per file; resolves when done. */
function runWriter(files, rate, seconds) {
  return new Promise((resolveWriter, reject) => {
    // the bench writer only runs when forked (it talks to its parent over IPC)
    const child = fork(writerJs, ["--files", files.join(","), "--rate", String(rate), "--seconds", String(seconds)], { execArgv: [], stdio: "ignore" });
    let done = false;
    child.on("message", (m) => {
      if (m.type === "done") done = true;
    });
    child.once("exit", (code) => (code === 0 && done ? resolveWriter() : reject(new Error(`writer exited with ${code} (done=${done})`))));
  });
}

const result = (id, title, criterion, status, measures, notes = []) => ({ id, title, criterion, status, measures, notes });
const verdict = (ok) => (ok ? "PASS" : "FAIL");

async function generatedFile(size) {
  const dir = tempDir("gen");
  const generate = spawn(process.execPath, ["--expose-gc", join(benchDir, "run.js"), "--size", size, "--generate-only"], { stdio: "inherit", cwd: join(root, "packages/engine") });
  await new Promise((r) => generate.once("exit", r));
  rmSync(dir, { recursive: true, force: true });
  const bytes = { "1G": 1073741824, "200M": 209715200, "128M": 134217728 }[size];
  const file = join(tmpdir(), "cbl-log-bench", `websphere-basic-${bytes}.log`);
  if (!existsSync(file)) throw new Error(`generated file not found: ${file}`);
  return file;
}

/** Reads the copy of every row of the active tab (Ctrl+A, Ctrl+C) from the clipboard. */
async function copyAllRows(cdp) {
  await cdp.ev("document.querySelector('.viewport').focus()");
  await cdp.key("a", "KeyA", 2);
  await sleep(200);
  await cdp.key("c", "KeyC", 2);
  await waitFor(() => cdp.ev("/copiée/.test(document.querySelector('.toast')?.innerText ?? '')"), "copy done", 60_000, 200);
  return cdp.ev("navigator.clipboard.readText()", true);
}

/** Scrolls the whole file in steps small enough that every rolling separator gets rendered once. */
async function collectSeparators(cdp) {
  return cdp.ev(
    `(async () => {
      const v = document.querySelector('.viewport'); const seen = new Set(); const step = 100 * 18;
      const raf = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      for (let top = 0; top <= v.scrollHeight; top += step) {
        v.scrollTop = top; await raf();
        document.querySelectorAll('.roll-label').forEach((l) => seen.add(l.innerText));
      }
      return seen.size;
    })()`,
    true,
  );
}

function sequenceReport(text, expectedLast) {
  const seqs = text
    .split(/\r?\n/)
    .map((l) => /^(\d{8}) /.exec(l)?.[1])
    .filter((s) => s !== undefined)
    .map(Number);
  let duplicates = 0;
  let outOfOrder = 0;
  let lost = 0;
  for (let i = 1; i < seqs.length; i++) {
    if (seqs[i] === seqs[i - 1]) duplicates++;
    else if (seqs[i] < seqs[i - 1]) outOfOrder++;
    else lost += seqs[i] - seqs[i - 1] - 1;
  }
  if (seqs.length > 0) lost += seqs[0] + (expectedLast - seqs[seqs.length - 1]);
  return { rows: seqs.length, duplicates, outOfOrder, lost };
}

// ------------------------------------------------------------------------------------------------

async function r1(ctx) {
  const userData = tempDir("r1");
  const app = await launch({ exe, userData, port: nextPort() });
  try {
    // baseline: what it costs to open a 10-line file through a second instance
    const tiny = join(tempDir("tiny"), "tiny.log");
    writeFileSync(tiny, Array.from({ length: 10 }, (_, i) => `line ${i}`).join("\n") + "\n");
    let t0 = now();
    openInRunningApp(app, [tiny]);
    await waitFor(() => app.cdp.ev(page.rowCount), "tiny file shown", 20_000, 10);
    const baselineMs = now() - t0;
    await app.cdp.ev("document.querySelector('.viewport').focus()");
    await app.cdp.key("w", "KeyW", 2);
    await sleep(500);

    t0 = now();
    openInRunningApp(app, [ctx.bigFile]);
    await waitFor(() => app.cdp.ev(page.rowCount), "end of the big file shown", 120_000, 10);
    const endVisibleMs = now() - t0;
    const lines = await waitFor(() => app.cdp.ev(page.totalLines), "line count", 5000);
    await sleep(2000);
    const idle = memory();
    for (let i = 0; i < 40; i++) {
      await app.cdp.ev(`(() => { const v = document.querySelector('.viewport'); v.scrollTop = Math.random() * (v.scrollHeight - v.clientHeight); })()`);
      await sleep(60);
    }
    await sleep(500);
    const afterScroll = memory();
    const corrected = Math.max(0, endVisibleMs - baselineMs);
    return result(
      "r1",
      `Ouvrir un fichier de ${sizeArg} (WebSphere généré)`,
      `fin affichée < 1 s ; mémoire totale < ${MEMORY_BUDGET_MIB} Mo`,
      verdict(corrected <= 1000 && afterScroll.privateMiB <= MEMORY_BUDGET_MIB),
      {
        "taille": `${fmt(statSync(ctx.bigFile).size / 1073741824, 2)} Gio, ${lines.toLocaleString("fr-FR")} lignes`,
        "ouverture → fin affichée": `${fmt(endVisibleMs)} ms (dont ~${fmt(baselineMs)} ms de relais de seconde instance mesurés sur un fichier de 10 lignes) → ~${fmt(corrected)} ms`,
        "mémoire privée, au repos": `${idle.privateMiB} Mio (${idle.processes} processus ; working set ${idle.workingSetMiB} Mio)`,
        "mémoire privée, après 40 sauts aléatoires": `${afterScroll.privateMiB} Mio (working set ${afterScroll.workingSetMiB} Mio)`,
      },
      [
        `Le fichier vient d'être généré : il est dans le cache disque de l'OS (une lecture à froid sera plus lente).`,
        `La fin n'est affichée qu'une fois l'indexation initiale terminée, donc le délai croît avec la taille : extrapolé linéairement à 10 Gio, ~${fmt((corrected * 10) / 1000, 1)} s, au-dessus de la cible de 1 s. L'ouverture affiche un loader avec le pourcentage d'indexation ; l'affichage immédiat de la fin (F-03, #406) est volontairement reporté.`,
        `Mémoire : « privée » = working set privé cumulé des processus cbl-log (colonne « Mémoire » du Gestionnaire des tâches) ; le « working set » total compte aussi les pages partagées entre processus.`,
      ],
    );
  } finally {
    await quit(app, { graceful: false });
  }
}

async function r2() {
  const dir = tempDir("r2");
  const file = join(dir, "live.log");
  writeFileSync(file, Array.from({ length: 50_000 }, (_, i) => `[10/14/26 10:02:11:204 UTC] 0000004a SystemOut     O seed ${i}`).join("\n") + "\n");
  const app = await launch({ exe, args: [file], userData: tempDir("r2ud"), port: nextPort() });
  try {
    await waitFor(() => app.cdp.ev(page.rowCount), "file shown");
    await app.cdp.ev(page.startSampler);
    await runWriter([file], 1000, 20);
    await sleep(1500);
    const s = JSON.parse(await app.cdp.ev(page.stopSampler));
    const total = await app.cdp.ev(page.totalLines);
    const mem = memory();
    const p95 = percentile(s.lat, 95);
    const p99dt = percentile(s.dt, 99);
    const ok = s.lastSeq === 19_999 && total === 70_000 && p95 <= 500 && p99dt <= 50;
    return result("r2", "1 000 lignes/s en continu (20 s, follow)", "l'affichage suit en continu, l'UI reste fluide", verdict(ok), {
      "dernière ligne affichée": `#${s.lastSeq} (attendu #19999)`,
      "lignes dans l'onglet": `${total.toLocaleString("fr-FR")} (attendu 70 000)`,
      "latence écriture → affichage": `p50 ${fmt(percentile(s.lat, 50))} ms, p95 ${fmt(p95)} ms, max ${fmt(Math.max(...s.lat))} ms (seuil p95 ≤ 500 ms)`,
      "durée des images": `p99 ${fmt(p99dt, 1)} ms, ${s.dt.filter((d) => d > 100).length} images > 100 ms sur ${s.dt.length} (seuil p99 ≤ 50 ms)`,
      "mémoire privée": `${mem.privateMiB} Mio`,
    });
  } finally {
    await quit(app, { graceful: false });
  }
}

async function rolling(mode, id, title, lossless) {
  const dir = tempDir(id);
  const live = join(dir, "app.log");
  writeFileSync(live, "");
  const app = await launch({ exe, args: [live], userData: tempDir(`${id}ud`), port: nextPort() });
  try {
    await waitFor(() => app.cdp.ev("!!document.querySelector('.tab')"), "tab open");
    const config = { dir, mode, rollBytes: 1024 * 1024, rolls: 10, syncRoll: false };
    const writerErrors = [];
    let done;
    const writer = fork(rollingFixture, [JSON.stringify(config)], { execArgv: [] });
    writer.on("message", (m) => {
      if (m.type === "error") writerErrors.push(`${m.op}: ${m.code}`);
      if (m.type === "done") done = m;
    });
    await new Promise((r) => writer.once("exit", r));
    // let the app catch up
    let previous = -1;
    await waitFor(async () => {
      const total = await app.cdp.ev(page.totalLines);
      const stable = total === previous && total > 0;
      previous = total;
      return stable;
    }, "line count settled", 30_000, 800);
    const total = await app.cdp.ev(page.totalLines);
    const text = await copyAllRows(app.cdp);
    const seq = sequenceReport(text, done.lastSeq);
    const separators = await collectSeparators(app.cdp);
    // Lines are lost when the tab counted fewer than the writer wrote. What is still READABLE afterwards
    // is another matter: rolled files stay readable as long as their archive exists (dormant segments are
    // reopened on read); after a truncate without archive, the old rows stay counted but are gone.
    const missing = done.lastSeq + 1 - total;
    const ok = writerErrors.length === 0 && seq.duplicates === 0 && seq.outOfOrder === 0 && separators === 10 && (!lossless || missing === 0);
    const notes = [];
    if (!lossless) notes.push("Après une troncature sans archive, les lignes des fichiers précédents restent comptées mais ne sont plus lisibles (leur contenu a disparu).");
    if (!lossless) notes.push("Troncature sans archive pendant l'écriture : des lignes écrites entre deux contrôles peuvent disparaître avec le fichier (inhérent au truncate) ; doublons et désordre restent bloquants.");
    return result(id, title, "le rolling réussit à chaque fois côté serveur, aucune ligne dupliquée, séparateur affiché" + (lossless ? ", aucune ligne perdue" : ""), verdict(ok), {
      "lignes écrites": `${(done.lastSeq + 1).toLocaleString("fr-FR")} (10 rollings de 1 Mio)`,
      "lignes comptées par l'onglet": `${total.toLocaleString("fr-FR")} (manquantes : ${missing.toLocaleString("fr-FR")})`,
      "lignes encore lisibles (copie de tout l'onglet)": `${seq.rows.toLocaleString("fr-FR")}`,
      "erreurs côté écrivain (rename / truncate / copie / ouverture)": writerErrors.length === 0 ? "aucune" : writerErrors.join(", "),
      "doublons / désordre dans les lignes lisibles": `${seq.duplicates} / ${seq.outOfOrder}`,
      "séparateurs de rolling affichés": `${separators} sur 10`,
    }, notes);
  } finally {
    await quit(app, { graceful: false });
  }
}

async function r3b() {
  const dir = tempDir("r3b");
  const file = join(dir, "app.log");
  const rows = (tag, n) => Array.from({ length: n }, (_, i) => `${tag}${i} ${"x".repeat(60)}`).join("\n") + "\n";
  writeFileSync(file, rows("OLD", 500));
  const app = await launch({ exe, args: [file], userData: tempDir("r3bud"), port: nextPort() });
  try {
    await waitFor(async () => (await app.cdp.ev(page.totalLines)) === 500, "500 old lines");
    // truncated, then regrown beyond its former size before the next poll
    writeFileSync(file, rows("NEW", 800));
    await waitFor(async () => (await app.cdp.ev(page.totalLines)) >= 1300, "truncation noticed", 15_000, 200);
    await sleep(800);
    const text = await copyAllRows(app.cdp);
    const lines = text.split(/\r?\n/).filter(Boolean);
    const mixed = lines.filter((l) => !/^(OLD|NEW)\d+ x{60}$/.test(l) || (l.includes("OLD") && l.includes("NEW"))).length;
    const news = lines.filter((l) => l.startsWith("NEW")).length;
    const ok = mixed === 0 && news === 800;
    return result("r3b", "Fichier vidé puis regrossi au-delà de l'ancienne taille entre deux contrôles", "la troncature est détectée, pas de lignes mélangées", verdict(ok), {
      "lignes NEW lisibles": `${news} sur 800`,
      "lignes corrompues ou mélangées": String(mixed),
      "lignes comptées dans l'onglet": String(await app.cdp.ev(page.totalLines)),
    });
  } finally {
    await quit(app, { graceful: false });
  }
}

async function r4() {
  const dir = tempDir("r4");
  const file = join(dir, "held.log");
  writeFileSync(file, Array.from({ length: 200 }, (_, i) => `line ${i}`).join("\n") + "\n");
  const app = await launch({ exe, args: [file], userData: tempDir("r4ud"), port: nextPort() });
  try {
    await waitFor(() => app.cdp.ev(page.rowCount), "file shown");
    const errors = [];
    const attempt = (label, fn) => {
      try {
        fn();
      } catch (e) {
        errors.push(`${label}: ${e.code}`);
      }
    };
    attempt("append", () => writeFileSync(file, "more\n", { flag: "a" }));
    attempt("rename", () => renameSync(file, `${file}.1`));
    attempt("recreate", () => writeFileSync(file, "fresh 1\nfresh 2\n"));
    attempt("copy", () => copyFileSync(`${file}.1`, `${file}.copy`));
    attempt("delete archive", () => rmSync(`${file}.1`));
    attempt("delete live file", () => rmSync(file));
    await waitFor(() => app.cdp.ev("!!document.querySelector('.banner-missing')"), "missing banner", 10_000, 200);
    attempt("recreate again", () => writeFileSync(file, "back 1\n"));
    await waitFor(async () => !(await app.cdp.ev("!!document.querySelector('.banner-missing')")), "following again", 10_000, 200);
    return result("r4", "Pas de verrou pendant le suivi", "l'appli qui écrit peut renommer / supprimer le fichier", verdict(errors.length === 0), {
      "opérations tentées pendant que cbl-log suit": "ajout, renommage, recréation, copie, suppression de l'archive et du fichier suivi, recréation",
      "échecs": errors.length === 0 ? "aucun" : errors.join(", "),
      "bandeau « fichier absent » puis reprise": "oui",
    });
  } finally {
    await quit(app, { graceful: false });
  }
}

async function r6andR7() {
  const dir = tempDir("r67");
  const a = join(dir, "a.log");
  const b = join(dir, "b.log");
  const body = (tag) => Array.from({ length: 3000 }, (_, i) => (i % 10 === 0 ? `${tag} ${i} ERROR boom` : `${tag} ${i} fine`)).join("\n") + "\n";
  writeFileSync(a, body("A"));
  writeFileSync(b, body("B"));
  const userData = tempDir("r67ud");
  const coloredRows = (app) => app.cdp.ev(`[...document.querySelectorAll('.log-row')].filter((r) => r.style.backgroundColor).length`);

  let app = await launch({ exe, args: [a, b], userData, port: nextPort() });
  const measures6 = {};
  const measures7 = {};
  let ok6 = false;
  let ok7 = false;
  try {
    await waitFor(async () => (await app.cdp.ev("document.querySelectorAll('.tab').length")) === 2, "two tabs");
    await sleep(1500); // let the startup loading of rules / formats settle (it would overwrite an early edit)
    const before = await coloredRows(app);
    // hot edit: disable the first rule (ERROR) in the editor
    await app.cdp.key("h", "KeyH", 2);
    await waitFor(() => app.cdp.ev("!!document.querySelector('.rules-editor')"), "rules editor");
    await app.cdp.ev("document.querySelector('.rule-row input[type=checkbox]').click()");
    await sleep(800);
    const during = await coloredRows(app);
    await app.cdp.key("Escape", "Escape", 0, 27);
    await waitFor(() => {
      try {
        return JSON.parse(readFileSync(join(userData, "rules", "default.json"), "utf8")).rules[0].enabled === false;
      } catch {
        return false;
      }
    }, "rule persisted", 5000, 200);
    measures6["lignes colorées (ERROR actif → règle désactivée à chaud)"] = `${before} → ${during}`;
    measures6["règle enregistrée dans rules/default.json"] = "oui (enabled: false)";

    // session: leave follow on tab B, scroll to the middle, switch back to A
    await app.cdp.ev("document.querySelectorAll('.tab')[1].click()");
    await sleep(500);
    await app.cdp.ev("(() => { const v = document.querySelector('.viewport'); v.scrollTop = (v.scrollHeight - v.clientHeight) / 2; })()");
    await sleep(800);
    const topBefore = await app.cdp.ev(`Number(document.querySelector('.log-row .log-gutter').innerText)`);
    const followBefore = await app.cdp.ev("document.querySelector('.follow').className");
    await sleep(1500); // the session is written ~1 s after a change
    await quit(app);

    app = await launch({ exe, userData, port: nextPort() });
    await waitFor(async () => (await app.cdp.ev("document.querySelectorAll('.tab').length")) === 2, "tabs restored", 15_000);
    await sleep(1200);
    const active = await app.cdp.ev("document.querySelector('.tab.active .tab-name').innerText");
    const topAfter = await app.cdp.ev(`Number(document.querySelector('.log-row .log-gutter').innerText)`);
    const followAfter = await app.cdp.ev("document.querySelector('.follow').className");
    const afterRestart = await coloredRows(app);
    ok7 = active === "b.log" && Math.abs(topAfter - topBefore) <= 40 && followBefore === followAfter;
    ok6 = during < before && afterRestart === during;
    measures7["onglets rouverts"] = "2 sur 2";
    measures7["onglet actif"] = active;
    measures7["première ligne affichée (avant → après redémarrage)"] = `${topBefore} → ${topAfter}`;
    measures7["follow (avant → après)"] = `${followBefore.includes("on") ? "actif" : "coupé"} → ${followAfter.includes("on") ? "actif" : "coupé"}`;
    measures6["lignes colorées après redémarrage"] = String(afterRestart);
  } finally {
    await quit(app, { graceful: false });
  }
  return [
    result("r6", "Règles de surlignage regex", "appliquées, modifiables à chaud, persistées", verdict(ok6), measures6),
    result("r7", "Fermer / rouvrir l'appli", "mêmes onglets, mêmes positions, mêmes règles", verdict(ok7), measures7),
  ];
}

async function r8(ctx) {
  const dir = tempDir("r8");
  const files = [];
  for (let i = 0; i < 8; i++) {
    const f = join(dir, `srv${i + 1}.log`);
    copyFileSync(ctx.mediumFile, f);
    files.push(f);
  }
  const app = await launch({ exe, args: files, userData: tempDir("r8ud"), port: nextPort() });
  try {
    await waitFor(async () => (await app.cdp.ev("document.querySelectorAll('.tab').length")) === 8, "8 tabs", 180_000, 500);
    await sleep(1500);
    const totals = async () => {
      const out = [];
      for (let i = 0; i < 8; i++) {
        await app.cdp.ev(`document.querySelectorAll('.tab')[${i}].click()`);
        await sleep(400);
        out.push(await app.cdp.ev(page.totalLines));
      }
      return out;
    };
    const before = await totals();
    const memBefore = memory();
    await app.cdp.ev(page.startSampler);
    await runWriter(files, 1000, 20);
    await sleep(2000);
    const s = JSON.parse(await app.cdp.ev(page.stopSampler));
    const mem = memory();
    const after = await totals();
    const missing = after.map((t, i) => before[i] + 20_000 - t);
    const p99dt = percentile(s.dt, 99);
    const ok = missing.every((m) => m === 0) && mem.privateMiB <= MEMORY_BUDGET_MIB && p99dt <= 50;
    return result("r8", "8 onglets en follow simultané (1 000 lignes/s chacun, 20 s)", `UI fluide, mémoire < ${MEMORY_BUDGET_MIB} Mo`, verdict(ok), {
      "contenu préexistant": `8 × ${fmt(statSync(ctx.mediumFile).size / 1048576)} Mio = ${fmt((8 * statSync(ctx.mediumFile).size) / 1073741824, 2)} Gio`,
      "lignes écrites par onglet": "20 000 (160 000 au total)",
      "lignes manquantes par onglet": missing.join(", "),
      "mémoire privée, avant → pendant/après": `${memBefore.privateMiB} → ${mem.privateMiB} Mio (${mem.processes} processus ; working set ${mem.workingSetMiB} Mio)`,
      "durée des images (onglet actif)": `p99 ${fmt(p99dt, 1)} ms, ${s.dt.filter((d) => d > 100).length} images > 100 ms sur ${s.dt.length} (seuil p99 ≤ 50 ms)`,
    });
  } finally {
    await quit(app, { graceful: false });
  }
}

// ------------------------------------------------------------------------------------------------

function gitCommit() {
  try {
    const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
    const dirty = git("status", "--porcelain", "--", ".") !== "";
    return `${git("rev-parse", "--short", "HEAD")}${dirty ? " (+ modifications locales)" : ""}`;
  } catch {
    return "inconnu";
  }
}

function toMarkdown(results, meta) {
  const icon = { PASS: "✅", FAIL: "❌", "NON RÉALISÉ": "⏭️" };
  const lines = [
    "# Recette MVP cbl-log (critères P0, cahier des charges § 7)",
    "",
    `Exécutée le ${meta.date} sur l'application **packagée** (\`release/win-unpacked/cbl-log.exe\`), version ${meta.version}, par \`npm run recette\` (\`scripts/recette/\`).`,
    "",
    `Machine : ${meta.machine}.`,
    `Commit mesuré : ${meta.commit}.`,
    `Fichier de référence : log WebSphere généré (\`npm run bench\`), ${sizeArg} au lieu des 10 Go du critère 1.`,
    "",
    "| # | Critère | Résultat |",
    "|---|---------|----------|",
    ...results.map((r) => `| ${r.id.toUpperCase()} | ${r.title} | ${icon[r.status]} ${r.status} |`),
    "",
  ];
  for (const r of results) {
    lines.push(`## ${r.id.toUpperCase()} — ${r.title}`, "", `Critère : ${r.criterion}.`, "", "| Mesure | Valeur |", "|---|---|");
    for (const [k, v] of Object.entries(r.measures)) lines.push(`| ${k} | ${v} |`);
    for (const n of r.notes) lines.push("", `> ${n}`);
    lines.push("");
  }
  lines.push(
    "## Non réalisé dans cette passe",
    "",
    "- **Critère 1 à 10 Gio** : mesuré sur 1 Gio (extrapolation dans R1).",
    "- **Critère 3 avec un vrai conteneur WebSphere Liberty** (`icr.io/appcafe/open-liberty`, bind mount, `maxFileSize=1`) : remplacé par l'écrivain simulé du banc (`packages/engine/test/fixtures/rolling-writer.mjs`), qui reproduit les trois modes de rolling mais pas le comportement exact d'un serveur.",
    "- **Critère 5** (volume Docker Desktop et partage SMB du NAS) : nécessite Docker et le NAS, hors de portée de cette machine ; le suivi par polling est couvert côté moteur (`PollScheduler`, `LOCAL_POLL_MS` / `UNC_POLL_MS`) mais pas mesuré ici.",
    "- **Critère 8 à 10 Gio au total** (NF-11 complet) : mesuré avec 8 fichiers de 128 Mio (1 Gio au total).",
    "",
    "## Comment relancer",
    "",
    "```bash",
    "cd cbl-log",
    "npm run package:dir                       # construit release/win-unpacked/cbl-log.exe",
    "npm run bench -- --size 1G --generate-only # compile le banc (générateur + écrivain) et prépare le log",
    "npm run recette -- --size 1G --out docs/recette-mvp.md --history docs/recette/history.jsonl [--only r1,r2,r3,r3t,r3c,r3b,r4,r67,r8]",
    "```",
    "",
    "L'application tourne avec un dossier de configuration isolé (`CBL_LOG_USER_DATA`) : la configuration réelle n'est pas touchée.",
  );
  return lines.join("\n");
}

async function main() {
  if (!existsSync(exe)) throw new Error(`Packaged app not found: ${exe}\nRun: npm run package:dir`);
  if (!existsSync(writerJs)) throw new Error("Bench build missing: run `npm run bench -- --size 200M --generate-only` first");
  const want = (id) => only.length === 0 || only.includes(id);
  const ctx = {};
  if (want("r1")) ctx.bigFile = await generatedFile(sizeArg);
  if (want("r8")) ctx.mediumFile = await generatedFile("128M");

  const results = [];
  const run = async (id, fn) => {
    if (!want(id)) return;
    console.log(`\n=== ${id.toUpperCase()} ===`);
    const started = now();
    try {
      const r = await fn();
      for (const item of Array.isArray(r) ? r : [r]) {
        console.log(`${item.status} ${item.id}: ${item.title}`);
        for (const [k, v] of Object.entries(item.measures)) console.log(`   ${k}: ${v}`);
        results.push(item);
      }
    } catch (err) {
      console.log(`ERREUR ${id}: ${err.stack ?? err}`);
      results.push(result(id, id, "", "FAIL", { erreur: String(err.message ?? err) }));
    }
    console.log(`   (${fmt((now() - started) / 1000, 1)} s)`);
  };

  await run("r1", () => r1(ctx));
  await run("r2", r2);
  await run("r3", () => rolling("rename", "r3-rename", "Rolling rename + create, 10 rollings de 1 Mio", true));
  await run("r3t", () => rolling("truncate", "r3-truncate", "Rolling truncate pendant l'écriture, 10 rollings de 1 Mio", false));
  await run("r3c", () => rolling("copytruncate", "r3-copytruncate", "Rolling copytruncate, 10 rollings de 1 Mio", true));
  await run("r3b", r3b);
  await run("r4", r4);
  await run("r67", r6andR7);
  await run("r8", () => r8(ctx));

  const pkg = JSON.parse(readFileSync(join(root, "app/package.json"), "utf8"));
  const meta = {
    date: new Date().toLocaleDateString("sv-SE"), // local date, YYYY-MM-DD
    version: pkg.version,
    commit: gitCommit(),
    machine: `${cpus()[0]?.model.trim()} (${cpus().length} threads), ${Math.round(totalmem() / 1073741824)} Go de RAM, Windows ${release()} ${platform()}`,
  };
  const markdown = toMarkdown(results, meta);
  if (historyFile) {
    // one JSON line per run, to follow the measures over time (append-only)
    mkdirSync(dirname(resolve(root, historyFile)), { recursive: true });
    const record = { ...meta, size: sizeArg, only, results: results.map(({ id, status, measures }) => ({ id, status, measures })) };
    appendFileSync(resolve(root, historyFile), JSON.stringify(record) + "\n");
    console.log(`Mesures ajoutées à ${historyFile}`);
  }
  if (outFile) {
    mkdirSync(dirname(resolve(root, outFile)), { recursive: true });
    writeFileSync(resolve(root, outFile), markdown + "\n");
    console.log(`\nRapport écrit dans ${outFile}`);
  }
  process.exit(results.some((r) => r.status === "FAIL") ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
