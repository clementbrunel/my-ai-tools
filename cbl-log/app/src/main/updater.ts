// In-app update from the GitHub releases: the binary published by CI is downloaded and installed by the
// app itself, the user never goes back to the repository. Only network access of the app (NF-07),
// disabled by `checkForUpdates: false` in settings.json; "Aide > Rechercher une mise à jour" always works.
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { createWriteStream, mkdirSync } from "node:fs";
import { rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { app, BrowserWindow, net, shell } from "electron";
import { expectedSha256, findUpdate, RELEASES_URL, type AvailableUpdate, type GitHubRelease, type InstallKind, type UpdateAction, type UpdatePanelState } from "./update-check";

/** Set by electron-builder's portable launcher to the path of the running `.exe`. */
const portableExe = (): string | undefined => process.env["PORTABLE_EXECUTABLE_FILE"];
const installKind = (): InstallKind => (portableExe() ? "portable" : "setup");

let busy = false;
/** Resolver of the "update available" question currently shown in the renderer panel. */
let pendingAction: ((action: UpdateAction) => void) | undefined;

/** The renderer panel answered (IPC "update:action"). */
export function handleUpdateAction(action: UpdateAction): void {
  pendingAction?.(action);
}

const show = (win: BrowserWindow | undefined, state: UpdatePanelState | null): void => {
  if (win && !win.isDestroyed()) win.webContents.send("update:state", state);
};

/** Resolves with the user's answer, or "dismiss" if the window goes away first. "notes" never resolves: it opens the page and waits again. */
async function ask(win: BrowserWindow, update: AvailableUpdate): Promise<Exclude<UpdateAction, "notes">> {
  for (;;) {
    const action = await new Promise<UpdateAction>((resolve) => {
      pendingAction = resolve;
      win.once("closed", () => resolve("dismiss"));
    });
    pendingAction = undefined;
    if (action !== "notes") return action;
    void shell.openExternal(update.pageUrl);
  }
}
/** Version the user postponed in this session: automatic checks stay silent about it, the menu still offers it. */
let declinedVersion: string | undefined;

async function fetchUpdate(): Promise<AvailableUpdate | undefined> {
  const res = await net.fetch(RELEASES_URL, { headers: { Accept: "application/vnd.github+json" } });
  if (!res.ok) throw new Error(`GitHub a répondu ${res.status} ${res.statusText}`);
  return findUpdate((await res.json()) as GitHubRelease[], app.getVersion(), installKind());
}

/** Streams the asset to `target`, showing progress on the taskbar; checks size and SHA-256. */
async function download(update: AvailableUpdate, target: string, win: BrowserWindow | undefined): Promise<void> {
  let lastSent = 0;
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
      const now = Date.now();
      if (now - lastSent > 100) {
        lastSent = now;
        show(win, { kind: "downloading", version: update.version, received, total: update.asset.size });
      }
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
  if (!win || win.isDestroyed()) return;
  show(win, {
    kind: "available",
    version: update.version,
    current: app.getVersion(),
    notes: truncate(update.notes, 4000),
    canInstall: app.isPackaged,
    portable: !!portableExe(),
  });
  if ((await ask(win, update)) !== "install") {
    declinedVersion = update.version; // the hourly check will not nag again about this version
    show(win, null);
    return;
  }
  try {
    show(win, { kind: "downloading", version: update.version, received: 0, total: update.asset.size });
    await install(update, win);
  } catch (err) {
    show(win, { kind: "error", title: "Mise à jour impossible", message: err instanceof Error ? err.message : String(err) });
  }
}

/**
 * Looks for a newer release. `manual`: started from the menu, so "up to date" and network errors are
 * reported; the automatic checks (startup, then hourly) stay silent unless a not-yet-postponed update exists.
 */
export async function checkForUpdates(win: BrowserWindow | undefined, manual: boolean): Promise<void> {
  if (busy) return;
  busy = true;
  try {
    const update = await fetchUpdate();
    if (update) {
      if (manual || update.version !== declinedVersion) await offer(update, win);
    }
    else if (manual) {
      show(win, { kind: "uptodate", current: app.getVersion() });
    }
  } catch (err) {
    if (manual) show(win, { kind: "error", title: "Vérification impossible", message: err instanceof Error ? err.message : String(err) });
  } finally {
    busy = false;
  }
}
