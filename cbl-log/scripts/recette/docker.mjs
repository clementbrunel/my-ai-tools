// Docker scenarios of the acceptance run (issue #486): the SAME data, rates, durations and thresholds as the file run
// (run.mjs), so that `compare.mjs` can put the two side by side.
//
//   file run        Docker run   same data
//   r1  1 Gio       d1           first lines of the same generated WebSphere file, in a container's stdout
//   r2  1 000 l/s   d2           same 50 000 seed lines + same writer line format, 20 s
//   r2b 10 000 l/s  d2b          NF-04
//   r3  rolling     d3           spool rotation (spoolMaxMb = 1) with the same 117 100 lines
//   r8  8 onglets   d4           8 containers, 1 000 l/s each, 20 s
//   r7  session     d7           reopen + spool cleanup (tab closed / app relaunched)
//   -               d5, d6       container stopped / restarted, container recreated (compose up)
//
// Needs Docker Desktop running and an image with Node (default node:22-alpine, `--docker-image`).
import { execFileSync, spawn } from "node:child_process";
import { closeSync, existsSync, openSync, readSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { copyAllRows, cpuPercent, cpuTimes, fmt, launch, memory, now, page, percentile, quit, result, separatorLabels, sleep, tempDir, verdict, waitFor, writeConfig } from "./lib.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const WRITER = join(here, "docker-writer.mjs");
const LABEL = "cbl-log-recette";
const MEMORY_BUDGET_MIB = 400;

const docker = (...args) => execFileSync("docker", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
const dockerQuiet = (...args) => {
  try {
    return docker(...args);
  } catch {
    return "";
  }
};

/** First `n` complete lines of a file (the file can be huge: only its head is read). */
function headLines(file, n) {
  const fd = openSync(file, "r");
  try {
    const buf = Buffer.alloc(Math.min(statSync(file).size, n * 400));
    const read = readSync(fd, buf, 0, buf.length, 0);
    const lines = buf.subarray(0, read).toString("latin1").split("\n").slice(0, n);
    return lines.length === n ? lines : lines.slice(0, -1);
  } finally {
    closeSync(fd);
  }
}

export function checkDocker(image) {
  try {
    docker("version", "--format", "{{.Server.Version}}");
  } catch {
    throw new Error("Docker Desktop ne répond pas (docker version). Lancer Docker Desktop avant la recette Docker.");
  }
  if (!dockerQuiet("image", "inspect", image, "--format", "{{.Id}}")) {
    console.log(`Image ${image} absente : docker pull…`);
    docker("pull", image);
  }
}

export const dockerContext = () => dockerQuiet("context", "show") || "default";

/** Removes every container created by a recette run (also the leftovers of a crashed one). */
export function removeRecetteContainers() {
  const ids = dockerQuiet("ps", "-aq", "--filter", `label=${LABEL}`).split(/\s+/).filter(Boolean);
  if (ids.length > 0) dockerQuiet("rm", "-f", ...ids);
}

/**
 * Starts a container whose PID 1 prints the seed file (if any) to stdout, then idles. Writers are run in it
 * with `docker exec`, their output going to the container's stdout. Resolves once the seed is fully logged.
 */
async function startContainer(env, name, { seedFile, seedLines } = {}) {
  const mounts = ["-v", `${dirname(WRITER)}:/s:ro`];
  let command = "exec sleep 1000000";
  if (seedFile) {
    mounts.push("-v", `${dirname(seedFile)}:/data:ro`);
    command = `cat /data/${basename(seedFile)}; exec sleep 1000000`;
  }
  docker("run", "-d", "--name", name, "--label", LABEL, ...mounts, env.image, "sh", "-c", command);
  if (seedFile) {
    const last = seedLines[seedLines.length - 1];
    await waitFor(() => docker("logs", "--tail", "1", name).replace(/\r$/, "") === last.replace(/\r$/, ""), `seed of ${name} logged`, 300_000, 500);
  }
}

/** Runs the in-container writer to completion (resolves when it exits). */
function runDockerWriter(name, rate, seconds, startSeq = 0) {
  return new Promise((resolve, reject) => {
    const cmd = `exec node /s/docker-writer.mjs --rate ${rate} --seconds ${seconds} --start-seq ${startSeq} > /proc/1/fd/1 2>&1`;
    const child = spawn("docker", ["exec", name, "sh", "-c", cmd], { stdio: "ignore" });
    child.once("exit", (code) => (code === 0 ? resolve() : reject(new Error(`writer in ${name} exited with ${code}`))));
  });
}

/** Offset (ms) container clock − host clock, so that write → display latencies are not biased by the VM clock. */
function clockSkewMs(name) {
  const samples = [];
  for (let i = 0; i < 5; i++) {
    const t0 = Date.now();
    const remote = Number(docker("exec", name, "node", "-e", "process.stdout.write(String(Date.now()))"));
    const t1 = Date.now();
    samples.push({ rtt: t1 - t0, skew: remote - (t0 + t1) / 2 });
  }
  return samples.sort((a, b) => a.rtt - b.rtt)[0].skew; // the shortest round trip is the most accurate
}

/** Opens a container from the Docker panel (Ctrl+Shift+D, double-click), the way a user does. */
async function openContainerTab(app, name) {
  if (!(await app.cdp.ev("!!document.querySelector('.docker-panel')"))) await app.cdp.key("D", "KeyD", 2 | 8, 68);
  const find = `[...document.querySelectorAll('.docker-row')].find((r) => (r.querySelector('.docker-name')?.innerText ?? '').endsWith(${JSON.stringify(name)}))`;
  await waitFor(() => app.cdp.ev(`!!(${find})`), `container ${name} listed`, 30_000, 100);
  const t0 = now();
  await app.cdp.ev(`(${find}).dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))`);
  return t0;
}

/** Sequence numbers `#seq#ts#` of the copied rows: duplicates, disorder, and what is missing between first and last. */
function seqReport(text, first, last) {
  const seqs = text
    .split(/\r?\n/)
    .map((l) => /#(\d+)#\d+#/.exec(l)?.[1])
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
  if (seqs.length > 0) lost += Math.max(0, seqs[0] - first) + Math.max(0, last - seqs[seqs.length - 1]);
  return { rows: seqs.length, duplicates, outOfOrder, lost };
}

const settled = async (app, what) => {
  let previous = -1;
  await waitFor(
    async () => {
      const total = await app.cdp.ev(page.totalLines);
      const stable = total === previous && total > 0;
      previous = total;
      return stable;
    },
    what,
    60_000,
    800,
  );
  return app.cdp.ev(page.totalLines);
};

const sessionOf = (env, names) => ({ tabs: names.map((n) => ({ path: `docker://${env.context}/${n}` })), activePath: `docker://${env.context}/${names[0]}` });
const spoolDir = (env) => join(process.env.LOCALAPPDATA ?? tmpdir(), "cbl-log", "docker", env.context);

// ------------------------------------------------------------------------------------------------

/** d1 ↔ r1: opening with the last 5 000 lines of a long history, in under 0.3 s; format, levels; "Charger plus d'historique". */
export async function d1(env) {
  const seedFile = env.seedFile;
  const lastLine = lastLineOf(seedFile);
  const name = "cbl-recette-d1";
  const userData = tempDir("d1ud");
  writeConfig(userData, { docker: { initialTail: 5000 } });
  const app = await launch({ exe: env.exe, userData, port: env.nextPort() });
  try {
    await startContainer(env, name, { seedFile, seedLines: [lastLine] });
    const t0 = await openContainerTab(app, name);
    await waitFor(() => app.cdp.ev(page.rowCount), "rows of the container shown", 60_000, 10);
    const rowsMs = now() - t0;
    const lines = await waitFor(async () => ((await app.cdp.ev(page.totalLines)) >= 5000 ? app.cdp.ev(page.totalLines) : 0), "5 000 lines indexed", 60_000, 10);
    const totalMs = now() - t0;
    await sleep(1500);
    const format = await app.cdp.ev(`document.querySelector('.statusbar [title="Format de log détecté"]')?.innerText ?? ''`);
    const levelMarks = await app.cdp.ev(`[...document.querySelectorAll('.log-row .log-level')].filter((e) => e.innerText.trim()).length`);
    const idle = memory();

    // "Charger plus d'historique" (x10): the view is rebuilt
    const before = await app.cdp.ev(page.totalLines);
    const t1 = now();
    await app.cdp.ev(`[...document.querySelectorAll('.statusbar button')].find((b) => /Charger plus/.test(b.innerText))?.click()`);
    await waitFor(async () => (await app.cdp.ev(page.totalLines)) > before, "more history loaded", 120_000, 50);
    await settled(app, "history settled");
    const moreMs = now() - t1;
    const after = await app.cdp.ev(page.totalLines);
    const ok = totalMs <= 300 && format === "websphere-basic" && levelMarks > 0 && after > before;
    return result(
      "d1",
      `Ouvrir un conteneur (${env.seedLabel} de log WebSphere en historique, ${env.initialTail} dernières lignes)`,
      "5 000 dernières lignes affichées en moins de 0,3 s ; format websphere-basic détecté ; « Charger plus d'historique » fonctionne",
      verdict(ok),
      {
        "historique du conteneur": `${env.seedLabel} de lignes WebSphere (les ${env.seedLines.toLocaleString("fr-FR")} premières du même fichier généré que R1)`,
        "double-clic → premières lignes affichées": `${fmt(rowsMs)} ms`,
        "double-clic → 5 000 lignes indexées et affichées": `${fmt(totalMs)} ms (seuil ≤ 300 ms)`,
        "lignes dans l'onglet": lines.toLocaleString("fr-FR"),
        "format détecté": format || "?",
        "lignes avec niveau (visibles)": String(levelMarks),
        "mémoire privée, au repos": `${idle.privateMiB} Mio (${idle.processes} processus ; working set ${idle.workingSetMiB} Mio)`,
        "« Charger plus d'historique » (×10)": `${before.toLocaleString("fr-FR")} → ${after.toLocaleString("fr-FR")} lignes en ${fmt(moreMs)} ms`,
      },
      [
        "Pas de comparaison directe avec R1 : R1 indexe un fichier de 1 Gio (fin affichée < 1 s), D1 charge uniquement la fin (tail=5000). Ce qui se compare est le délai d'ouverture ressenti, pas la taille.",
        "Le conteneur vient d'être rempli : les logs sont dans le cache de dockerd (une lecture à froid sera plus lente).",
      ],
      { open_ms: totalMs, mem_mib: idle.privateMiB },
    );
  } finally {
    await quit(app, { graceful: false });
    dockerQuiet("rm", "-f", name);
  }
}

function countLines(file) {
  const fd = openSync(file, "r");
  try {
    const buf = Buffer.alloc(8 * 1024 * 1024);
    let count = 0;
    for (let n; (n = readSync(fd, buf, 0, buf.length, null)) > 0; ) for (let i = 0; i < n; i++) if (buf[i] === 10) count++;
    return count;
  } finally {
    closeSync(fd);
  }
}

function lastLineOf(file) {
  const size = statSync(file).size;
  const fd = openSync(file, "r");
  try {
    const len = Math.min(size, 64 * 1024);
    const buf = Buffer.alloc(len);
    readSync(fd, buf, 0, len, size - len);
    return buf.toString("latin1").replace(/\n$/, "").split("\n").pop();
  } finally {
    closeSync(fd);
  }
}

/** d2 ↔ r2 and d2b ↔ r2b: continuous follow at `rate` lines/s. */
export async function follow(env, { id, rate, seconds, seedCount, latencyP95, title, criterion }) {
  const dir = tempDir(id);
  const seedFile = join(dir, "seed.log");
  const seed = Array.from({ length: seedCount }, (_, i) => `[10/14/26 10:02:11:204 UTC] 0000004a SystemOut     O seed ${i}`);
  writeFileSync(seedFile, seed.join("\n") + "\n");
  const name = `cbl-recette-${id}`;
  const userData = tempDir(`${id}ud`);
  writeConfig(userData, { docker: { initialTail: seedCount } }); // all the seed lines, as the 50 000 lines of R2
  const app = await launch({ exe: env.exe, userData, port: env.nextPort() });
  try {
    await startContainer(env, name, { seedFile, seedLines: seed });
    const skew = clockSkewMs(name);
    await openContainerTab(app, name);
    await waitFor(async () => (await app.cdp.ev(page.totalLines)) >= seedCount, "seed shown", 60_000, 100);
    await sleep(1000);
    await app.cdp.ev(page.startSampler);
    const cpu0 = cpuTimes();
    await runDockerWriter(name, rate, seconds);
    const cpu1 = cpuTimes();
    await sleep(1500);
    const s = JSON.parse(await app.cdp.ev(page.stopSampler));
    const lat = s.lat.map((l) => l + skew);
    const total = await app.cdp.ev(page.totalLines);
    const mem = memory();
    const cpu = cpuPercent(cpu0, cpu1);
    const expectedTotal = seedCount + rate * seconds;
    const p50 = percentile(lat, 50);
    const p95 = percentile(lat, 95);
    const p99dt = percentile(s.dt, 99);
    const ok = s.lastSeq === rate * seconds - 1 && total === expectedTotal && p95 <= latencyP95 && p99dt <= 50;
    return result(
      id,
      title,
      criterion,
      verdict(ok),
      {
        "dernière ligne affichée": `#${s.lastSeq} (attendu #${rate * seconds - 1})`,
        "lignes dans l'onglet": `${total.toLocaleString("fr-FR")} (attendu ${expectedTotal.toLocaleString("fr-FR")})`,
        "latence écriture → affichage": `p50 ${fmt(p50)} ms, p95 ${fmt(p95)} ms, max ${fmt(Math.max(...lat))} ms (seuil p95 ≤ ${latencyP95} ms)`,
        "durée des images": `p99 ${fmt(p99dt, 1)} ms, ${s.dt.filter((d) => d > 100).length} images > 100 ms sur ${s.dt.length} (seuil p99 ≤ 50 ms)`,
        "CPU pendant l'écriture (% d'un cœur)": `moteur ${fmt(cpu.engine, 1)} %, toute l'appli ${fmt(cpu.total, 1)} %`,
        "mémoire privée": `${mem.privateMiB} Mio`,
        "décalage d'horloge conteneur − hôte (corrigé)": `${fmt(skew)} ms`,
      },
      [
        "La latence passe par dockerd (VM WSL2) → named pipe → spool → tailer : c'est l'écart avec la recette fichier qui est intéressant.",
        "L'échantillonneur de l'UI lit la dernière ligne toutes les 100 ms : la latence mesurée a une résolution de ~100 ms.",
      ],
      { lat_p50: p50, lat_p95: p95, frame_p99: p99dt, mem_mib: mem.privateMiB, cpu_engine_pct: cpu.engine, cpu_total_pct: cpu.total },
    );
  } finally {
    await quit(app, { graceful: false });
    dockerQuiet("rm", "-f", name);
  }
}

export const d2 = (env) =>
  follow(env, { id: "d2", rate: 1000, seconds: 20, seedCount: 50_000, latencyP95: 500, title: "Conteneur : 1 000 lignes/s en continu (20 s, follow)", criterion: "l'affichage suit en continu, l'UI reste fluide (mêmes seuils que R2)" });

export const d2b = (env) =>
  follow(env, { id: "d2b", rate: 10_000, seconds: 10, seedCount: 50_000, latencyP95: 100, title: "Conteneur bavard : 10 000 lignes/s (NF-04, 10 s, follow)", criterion: "délai d'affichage ≤ 100 ms (p95) ; CPU du moteur ~2 % d'un cœur ; Defender actif" });

/** d3 ↔ r3-rename: the spool is rotated at the cap (1 MiB here) while the container logs 117 100 lines. */
export async function d3(env) {
  const name = "cbl-recette-d3";
  const lines = 117_100;
  const userData = tempDir("d3ud");
  writeConfig(userData, { docker: { initialTail: 5000, spoolMaxMb: 1 } });
  const app = await launch({ exe: env.exe, userData, port: env.nextPort() });
  try {
    await startContainer(env, name);
    await openContainerTab(app, name);
    await waitFor(() => app.cdp.ev("!!document.querySelector('.tab')"), "tab open");
    await runDockerWriter(name, 11_710, 10); // 117 100 lines, like the rolling writer of R3
    const written = lines;
    const total = await settled(app, "line count settled");
    const text = await copyAllRows(app.cdp);
    const seq = seqReport(text, 0, written - 1);
    const labels = await separatorLabels(app.cdp);
    const missing = written - total;
    const ok = seq.duplicates === 0 && seq.outOfOrder === 0 && missing === 0 && labels.length >= 1;
    return result(
      "d3",
      "Rotation du fichier tampon au plafond (1 Mio au lieu de 256 Mo)",
      "aucune ligne perdue ni dupliquée, séparateur de rotation affiché à chaque rotation",
      verdict(ok),
      {
        "lignes écrites par le conteneur": `${written.toLocaleString("fr-FR")} (≈ ${fmt((written * 125) / 1048576, 1)} Mio, plafond 1 Mio)`,
        "lignes comptées par l'onglet": `${total.toLocaleString("fr-FR")} (manquantes : ${missing.toLocaleString("fr-FR")})`,
        "lignes encore lisibles (copie de tout l'onglet)": seq.rows.toLocaleString("fr-FR"),
        "doublons / désordre dans les lignes lisibles": `${seq.duplicates} / ${seq.outOfOrder}`,
        "séparateurs de rotation affichés": String(labels.length),
      },
      ["Comme pour R3, seules les lignes du spool courant et des archives gardées (3) restent lisibles ; les plus anciennes sont comptées mais libérées."],
      { missing, separators: labels.length },
    );
  } finally {
    await quit(app, { graceful: false });
    dockerQuiet("rm", "-f", name);
  }
}

/** d5 + d6: the container is stopped then restarted (no line lost or duplicated), then recreated (same tab, separator). */
export async function d5andD6(env) {
  const name = "cbl-recette-d5";
  const userData = tempDir("d5ud");
  writeConfig(userData, { docker: { initialTail: 5000 } });
  const app = await launch({ exe: env.exe, userData, port: env.nextPort() });
  const measures5 = {};
  const measures6 = {};
  let ok5 = false;
  let ok6 = false;
  try {
    await startContainer(env, name);
    await openContainerTab(app, name);
    await waitFor(() => app.cdp.ev("!!document.querySelector('.tab')"), "tab open");
    await runDockerWriter(name, 1000, 5, 0); // #0..#4999
    docker("stop", "-t", "1", name);
    await sleep(2500);
    const stopped = await app.cdp.ev(page.totalLines);
    docker("start", name);
    await sleep(1500);
    await runDockerWriter(name, 1000, 5, 5000); // #5000..#9999
    const total5 = await settled(app, "after restart");
    const rep5 = seqReport(await copyAllRows(app.cdp), 0, 9999);
    ok5 = total5 === 10_000 && rep5.duplicates === 0 && rep5.outOfOrder === 0 && rep5.lost === 0;
    measures5["lignes avant l'arrêt → après le redémarrage"] = `${stopped.toLocaleString("fr-FR")} → ${total5.toLocaleString("fr-FR")} (attendu 10 000)`;
    measures5["lignes lisibles / perdues / dupliquées / désordre"] = `${rep5.rows.toLocaleString("fr-FR")} / ${rep5.lost} / ${rep5.duplicates} / ${rep5.outOfOrder}`;

    // compose up that recreates the container: same name, new id
    const tabsBefore = await app.cdp.ev("document.querySelectorAll('.tab').length");
    docker("rm", "-f", name);
    await sleep(1500);
    await startContainer(env, name);
    await runDockerWriter(name, 1000, 5, 10_000); // #10000..#14999
    const total6 = await settled(app, "after recreate");
    const rep6 = seqReport(await copyAllRows(app.cdp), 0, 14_999);
    const labels = await separatorLabels(app.cdp);
    const recreated = labels.filter((l) => /recréé/.test(l)).length;
    const tabsAfter = await app.cdp.ev("document.querySelectorAll('.tab').length");
    ok6 = tabsAfter === tabsBefore && recreated === 1 && rep6.duplicates === 0 && rep6.outOfOrder === 0 && total6 === 15_000;
    measures6["onglets avant → après"] = `${tabsBefore} → ${tabsAfter} (même onglet attendu)`;
    measures6["séparateurs « conteneur recréé »"] = `${recreated} (attendu 1)`;
    measures6["lignes comptées"] = `${total6.toLocaleString("fr-FR")} (attendu 15 000)`;
    measures6["lignes lisibles / perdues / dupliquées / désordre"] = `${rep6.rows.toLocaleString("fr-FR")} / ${rep6.lost} / ${rep6.duplicates} / ${rep6.outOfOrder}`;
  } finally {
    await quit(app, { graceful: false });
    dockerQuiet("rm", "-f", name);
  }
  return [
    result("d5", "Conteneur arrêté puis redémarré", "aucune ligne perdue ni dupliquée", verdict(ok5), measures5),
    result("d6", "`docker compose up` qui recrée le conteneur (même nom, nouvel id)", "même onglet, séparateur « conteneur recréé »", verdict(ok6), measures6),
  ];
}

/** d4 ↔ r8: 8 containers followed at once, 1 000 lines/s each for 20 s (NF-11). */
export async function d4(env) {
  const names = Array.from({ length: 8 }, (_, i) => `cbl-recette-d4-srv${i + 1}`);
  const seedLines = headLines(env.seedFile, 20_000);
  const dir = tempDir("d4");
  const seedFile = join(dir, "seed.log");
  writeFileSync(seedFile, seedLines.join("\n") + "\n");
  const userData = tempDir("d4ud");
  writeConfig(userData, { docker: { initialTail: 20_000 }, session: sessionOf(env, names) });
  try {
    await Promise.all(names.map((n) => startContainer(env, n, { seedFile, seedLines })));
    const skew = clockSkewMs(names[0]);
    const app = await launch({ exe: env.exe, userData, port: env.nextPort() });
    try {
      await waitFor(async () => (await app.cdp.ev("document.querySelectorAll('.tab').length")) === 8, "8 tabs", 120_000, 500);
      await sleep(2500);
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
      const cpu0 = cpuTimes();
      await Promise.all(names.map((n) => runDockerWriter(n, 1000, 20)));
      const cpu1 = cpuTimes();
      await sleep(2500);
      const s = JSON.parse(await app.cdp.ev(page.stopSampler));
      const mem = memory();
      const after = await totals();
      const missing = after.map((t, i) => before[i] + 20_000 - t);
      const p99dt = percentile(s.dt, 99);
      const p95 = percentile(s.lat.map((l) => l + skew), 95);
      const cpu = cpuPercent(cpu0, cpu1);
      const ok = missing.every((m) => m === 0) && mem.privateMiB <= MEMORY_BUDGET_MIB && p99dt <= 50;
      return result(
        "d4",
        "8 conteneurs suivis en même temps (1 000 lignes/s chacun, 20 s)",
        `UI fluide, mémoire < ${MEMORY_BUDGET_MIB} Mo (NF-11)`,
        verdict(ok),
        {
          "contenu préexistant": `8 × ${before[0].toLocaleString("fr-FR")} lignes (mêmes premières lignes du fichier généré)`,
          "lignes écrites par conteneur": "20 000 (160 000 au total)",
          "lignes manquantes par onglet": missing.join(", "),
          "mémoire privée, avant → pendant/après": `${memBefore.privateMiB} → ${mem.privateMiB} Mio (${mem.processes} processus ; working set ${mem.workingSetMiB} Mio)`,
          "durée des images (onglet actif)": `p99 ${fmt(p99dt, 1)} ms, ${s.dt.filter((d) => d > 100).length} images > 100 ms sur ${s.dt.length} (seuil p99 ≤ 50 ms)`,
          "latence écriture → affichage (onglet actif)": `p95 ${fmt(p95)} ms`,
          "CPU pendant l'écriture (% d'un cœur)": `moteur ${fmt(cpu.engine, 1)} %, toute l'appli ${fmt(cpu.total, 1)} %`,
        },
        [],
        { frame_p99: p99dt, mem_mib: mem.privateMiB, lat_p95: p95, cpu_engine_pct: cpu.engine, cpu_total_pct: cpu.total, missing: missing.reduce((a, b) => a + Math.abs(b), 0) },
      );
    } finally {
      await quit(app, { graceful: false });
    }
  } finally {
    dockerQuiet("rm", "-f", ...names);
  }
}

/** d7 ↔ r7: tabs reopened after a restart, spool files removed on tab close and purged when orphaned. */
export async function d7(env) {
  const names = ["cbl-recette-d7-a", "cbl-recette-d7-b"];
  const userData = tempDir("d7ud");
  writeConfig(userData, { docker: { initialTail: 5000 }, session: sessionOf(env, names) });
  const spools = () => (existsSync(spoolDir(env)) ? readdirSync(spoolDir(env)).filter((f) => names.some((n) => f.startsWith(n))) : []);
  try {
    for (const n of names) await startContainer(env, n);
    for (const n of names) await runDockerWriter(n, 1000, 2);
    let app = await launch({ exe: env.exe, userData, port: env.nextPort() });
    const measures = {};
    let ok = false;
    try {
      await waitFor(async () => (await app.cdp.ev("document.querySelectorAll('.tab').length")) === 2, "tabs restored from the session", 30_000);
      await sleep(1500);
      const opened = spools().length;
      const rows = await app.cdp.ev(page.totalLines);
      measures["onglets rouverts depuis la session (docker://…)"] = "2 sur 2";
      measures["lignes de l'onglet actif"] = String(rows);
      measures["fichiers tampons présents"] = String(opened);
      // close the active tab: its spool goes away
      await app.cdp.ev("document.querySelector('.viewport').focus()");
      await app.cdp.key("w", "KeyW", 2);
      await waitFor(() => spools().length < opened, "spool of the closed tab removed", 10_000, 200);
      measures["après fermeture d'un onglet"] = `${spools().length} fichier tampon restant`;
      // kill without cleanup: the orphan is purged by the next launch (no tab opens it)
      await quit(app, { graceful: false });
      writeConfig(userData, { docker: { initialTail: 5000 }, session: { tabs: [] } });
      const orphans = spools().length;
      app = await launch({ exe: env.exe, userData, port: env.nextPort() });
      await waitFor(() => spools().length === 0, "orphan spools purged", 15_000, 200);
      measures["tampons orphelins avant → après relance"] = `${orphans} → ${spools().length}`;
      ok = opened === 2 && rows > 0 && spools().length === 0;
    } finally {
      await quit(app, { graceful: false });
    }
    return result("d7", "Fermer / rouvrir l'appli, nettoyage des fichiers tampons", "mêmes onglets conteneur ; tampons supprimés à la fermeture d'onglet et purgés au lancement", verdict(ok), measures, [
      `Dossier des tampons : ${spoolDir(env)}`,
    ]);
  } finally {
    dockerQuiet("rm", "-f", ...names);
  }
}

/** Scenarios that need a person (Docker Desktop stopped / restarted, `docker-users`), listed in the report. */
export const MANUAL = [
  "Docker Desktop arrêté au lancement de cbl-log, puis démarré : connexion automatique, onglets repris",
  "Compte hors du groupe `docker-users` : message clair",
  "Redémarrage de Docker Desktop pendant le suivi : reconnexion et reprise sans doublon",
  "Conteneur WebSphere réel de référence : stack traces repliées, filtres de niveau",
];

export const DOCKER_IDS = ["d1", "d2", "d2b", "d3", "d5", "d4", "d7"];

export async function prepareEnv({ exe, nextPort, image, seedSize, generatedFile }) {
  checkDocker(image);
  removeRecetteContainers();
  const seedFile = await generatedFile(seedSize);
  // the full generated file is the seed: lines are the first ones of the very file R1 opens
  const lines = countLines(seedFile);
  return { exe, nextPort, image, seedFile, seedLabel: seedSize.replace(/(\d)([MG])$/, "$1 $2io"), seedLines: lines, initialTail: 5000, context: dockerContext() };
}

