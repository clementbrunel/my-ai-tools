// In-app update from the GitHub releases: the binary published by CI is downloaded and installed by the
// app itself, the user never goes back to the repository. Only network access of the app (NF-07),
// disabled by `checkForUpdates: false` in settings.json; "Aide > Rechercher une mise à jour" always works.
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { createWriteStream, mkdirSync } from "node:fs";
import { rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { app, BrowserWindow, dialog, net, shell } from "electron";
import { expectedSha256, findUpdate, RELEASES_URL, type AvailableUpdate, type GitHubRelease, type InstallKind } from "./update-check";

/** Set by electron-builder's portable launcher to the path of the running `.exe`. */
const portableExe = (): string | undefined => process.env["PORTABLE_EXECUTABLE_FILE"];
const installKind = (): InstallKind => (portableExe() ? "portable" : "setup");

let busy = false;

async function fetchUpdate(): Promise<AvailableUpdate | undefined> {
  const res = await net.fetch(RELEASES_URL, { headers: { Accept: "application/vnd.github+json" } });
  if (!res.ok) throw new Error(`GitHub a répondu ${res.status} ${res.statusText}`);
  return findUpdate((await res.json()) as GitHubRelease[], app.getVersion(), installKind());
}

/** Streams the asset to `target`, showing progress on the taskbar; checks size and SHA-256. */
async function download(update: AvailableUpdate, target: string, win: BrowserWindow | undefined): Promise<void> {
  const res = await net.fetch(update.asset.browser_download_url);
  if (!res.ok || !res.body) throw new Error(`Téléchargement impossible : ${res.status} ${res.statusText}`);
  mkdirSync(dirname(target), { recursive: true });
  const out = createWriteStream(target);
  const hash = createHash("sha256");
  let received = 0;
  try {
    const reader = res.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      hash.update(value);
      received += value.length;
      if (!out.write(value)) await new Promise<void>((resolve) => out.once("drain", () => resolve()));
      win?.setProgressBar(update.asset.size > 0 ? received / update.asset.size : 2);
    }
    await new Promise<void>((resolve, reject) => out.end((err?: Error | null) => (err ? reject(err) : resolve())));
  } catch (err) {
    out.destroy();
    await rm(target, { force: true });
    throw err;
  } finally {
    win?.setProgressBar(-1);
  }
  const sha = expectedSha256(update.asset);
  if (received !== update.asset.size || (sha && hash.digest("hex") !== sha)) {
    await rm(target, { force: true });
    throw new Error("Le fichier téléchargé est incomplet ou corrompu.");
  }
}

/** Downloads then runs the new version and quits this one. */
async function install(update: AvailableUpdate, win: BrowserWindow | undefined): Promise<void> {
  const portable = portableExe();
  if (portable) {
    // A running portable .exe cannot replace itself: the new one is placed next to it and started.
    const target = join(dirname(portable), update.asset.name);
    await download(update, target, win);
    spawn(target, [], { detached: true, stdio: "ignore" }).unref();
  } else {
    const target = join(app.getPath("temp"), "cbl-log-update", update.asset.name);
    await download(update, target, win);
    // Silent NSIS install into the current folder, then the installer restarts cbl-log.
    spawn(target, ["/S", "--updated", "--force-run"], { detached: true, stdio: "ignore" }).unref();
  }
  app.quit(); // the renderer saves the session on pagehide: tabs are restored by the new version
}

const truncate = (text: string, max: number): string => (text.length > max ? `${text.slice(0, max)}…` : text);

async function offer(update: AvailableUpdate, win: BrowserWindow | undefined): Promise<void> {
  const canInstall = app.isPackaged;
  const buttons = canInstall ? ["Installer maintenant", "Voir les notes", "Plus tard"] : ["Voir les notes", "Fermer"];
  const options: Electron.MessageBoxOptions = {
    type: "info",
    title: "Mise à jour disponible",
    message: `cbl-log ${update.version} est disponible (version actuelle : ${app.getVersion()}).`,
    detail:
      (update.notes ? `Nouveautés :\n${truncate(update.notes, 1200)}\n\n` : "") +
      (canInstall
        ? portableExe()
          ? "La nouvelle version portable sera téléchargée à côté de l'actuelle puis lancée."
          : "La mise à jour est téléchargée puis installée ; cbl-log redémarre et rouvre vos onglets."
        : "Installation automatique indisponible en mode développement."),
    buttons,
    defaultId: 0,
    cancelId: buttons.length - 1,
    noLink: true,
  };
  const { response } = win ? await dialog.showMessageBox(win, options) : await dialog.showMessageBox(options);
  const choice = buttons[response];
  if (choice === "Voir les notes") void shell.openExternal(update.pageUrl);
  if (choice !== "Installer maintenant") return;
  try {
    await install(update, win);
  } catch (err) {
    dialog.showErrorBox("Mise à jour", `La mise à jour a échoué : ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Looks for a newer release. `manual`: started from the menu, so "up to date" and network errors are
 * reported; the automatic check at startup stays silent unless an update exists.
 */
export async function checkForUpdates(win: BrowserWindow | undefined, manual: boolean): Promise<void> {
  if (busy) return;
  busy = true;
  try {
    const update = await fetchUpdate();
    if (update) await offer(update, win);
    else if (manual) {
      const options: Electron.MessageBoxOptions = { type: "info", title: "Mise à jour", message: `cbl-log ${app.getVersion()} est à jour.` };
      await (win ? dialog.showMessageBox(win, options) : dialog.showMessageBox(options));
    }
  } catch (err) {
    if (manual) dialog.showErrorBox("Mise à jour", `Impossible de vérifier les mises à jour : ${err instanceof Error ? err.message : String(err)}`);
  } finally {
    busy = false;
  }
}
