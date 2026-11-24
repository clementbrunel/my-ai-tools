import { existsSync, mkdirSync } from "node:fs";
import { release } from "node:os";
import { basename, dirname, join } from "node:path";
import { app, BrowserWindow, clipboard, dialog, ipcMain, Menu, nativeImage, nativeTheme, shell } from "electron";
import { defaultSettings, language, parseDockerUri, resolveLanguage, setLanguage, searchHistorySchema, type ParseRuleSetResult, type RuleSet, type SearchHistoryEntry, type Session, type Settings } from "@cbl-log/shared";
import { parseFileArgs } from "./cli-args";
import { ConfigWatcher, type ConfigKind } from "./config-watcher";
import { loadSession, loadSettings, readLanguageSetting, readSettingsText, saveSession, saveSettings, saveSettingsText, settingsPath } from "./config-store";
import { writeJsonAtomic } from "./json-file";
import { loadFormats } from "./formats-store";
import { EngineHost } from "./engine-process";
import { buildIssueUrl, checkFlood, envLines, feedbackKey, validateDraft, withSent, type FeedbackDraft, type FeedbackEnv } from "./feedback";
import { loadFeedbackHistory, saveFeedbackHistory } from "./feedback-store";
import { loadRecent, saveRecent, withoutRecentFile, withRecentFile } from "./recent-store";
import { exportRuleSet, loadRuleSets, readRuleSetFile, saveRuleSet } from "./rules-store";
import { showAbout, showSplash } from "./brand-windows";
import type { UpdateAction } from "./update-check";
import { checkForUpdates, handleUpdateAction } from "./updater";
import { applyShellIntegration, type ShellIntegration } from "./shell-integration";
import { t } from "@cbl-log/shared";

/** Executable registered in the Explorer: the portable .exe itself (not its temporary unpacked copy); none in development. */
const registeredExe = (): string | undefined => (app.isPackaged ? (process.env["PORTABLE_EXECUTABLE_FILE"] ?? process.execPath) : undefined);

let appliedShell: string | undefined;
/** Brings the Explorer integration in line with the settings (skipped when nothing changed since the last run). */
function syncShellIntegration(settings: Settings, force = false): void {
  const wanted: ShellIntegration = { explorerContextMenu: settings.explorerContextMenu, fileAssociations: settings.fileAssociations };
  const key = JSON.stringify(wanted);
  if (!force && key === appliedShell) return;
  appliedShell = key;
  void applyShellIntegration(registeredExe(), wanted).then((error) => {
    if (error) console.warn(`[cbl-log] ${error}`);
  });
}

// Settings live in %APPDATA%/cbl-log (architecture, section 8), not under the package name.
// CBL_LOG_USER_DATA relocates it (portable use, isolated acceptance runs).
app.setPath("userData", process.env["CBL_LOG_USER_DATA"] ?? join(app.getPath("appData"), "cbl-log"));
const rulesDir = (): string => join(app.getPath("userData"), "rules");
let configWatcher: ConfigWatcher | undefined;

const engine = new EngineHost();
let mainWindow: BrowserWindow | undefined;
/** Startup splash, closed once the main window is painted (see splash.ts). */
let splashWindow: BrowserWindow | undefined;
let rendererReady = false;
/** Paths received before the renderer listens (startup arguments, early second instance). */
const pendingPaths: string[] = [];

/** Single entry point for "open these files": the renderer calls the engine for each path. */
function sendFiles(paths: string[]): void {
  if (paths.length === 0) return;
  if (!mainWindow || mainWindow.isDestroyed() || !rendererReady) {
    pendingPaths.push(...paths);
    return;
  }
  mainWindow.webContents.send("files:open", paths);
}

async function pickFiles(): Promise<string[]> {
  const options: Electron.OpenDialogOptions = {
    properties: ["openFile", "multiSelections"],
    filters: [
      { name: "Logs", extensions: ["log", "txt", "out"] },
      { name: t("Tous les fichiers"), extensions: ["*"] },
    ],
  };
  const result = mainWindow ? await dialog.showOpenDialog(mainWindow, options) : await dialog.showOpenDialog(options);
  return result.canceled ? [] : result.filePaths;
}

/** Lets the user point at one archive of `path`: the renderer learns the archive name pattern from it. */
async function designateArchive(path: string): Promise<void> {
  const options: Electron.OpenDialogOptions = {
    title: t("Une archive de {file}", { file: basename(path) }),
    defaultPath: dirname(path),
    properties: ["openFile"],
    filters: [
      { name: "Logs", extensions: ["log", "txt", "out"] },
      { name: t("Tous les fichiers"), extensions: ["*"] },
    ],
  };
  const result = mainWindow ? await dialog.showOpenDialog(mainWindow, options) : await dialog.showOpenDialog(options);
  const archive = result.filePaths[0];
  if (!result.canceled && archive) mainWindow?.webContents.send("archive:designated", path, archive);
}

const profileFilters = (): Electron.FileFilter[] => [
  { name: t("Profil de surlignage cbl-log"), extensions: ["json"] },
  { name: t("Tous les fichiers"), extensions: ["*"] },
];

/** Asks where to save a profile, then writes it; resolves with the path written, or undefined if cancelled. */
async function exportProfile(set: RuleSet): Promise<string | undefined> {
  const options: Electron.SaveDialogOptions = {
    title: t("Exporter le profil de surlignage"),
    defaultPath: join(app.getPath("documents"), `${set.id}.json`),
    filters: profileFilters(),
  };
  const result = mainWindow ? await dialog.showSaveDialog(mainWindow, options) : await dialog.showSaveDialog(options);
  if (result.canceled || !result.filePath) return undefined;
  await exportRuleSet(result.filePath, set);
  return result.filePath;
}

/** Asks for a profile file and reads it; resolves with undefined if cancelled. */
async function importProfile(): Promise<ParseRuleSetResult | undefined> {
  const options: Electron.OpenDialogOptions = { title: t("Importer un profil de surlignage"), properties: ["openFile"], filters: profileFilters() };
  const result = mainWindow ? await dialog.showOpenDialog(mainWindow, options) : await dialog.showOpenDialog(options);
  const path = result.canceled ? undefined : result.filePaths[0];
  return path ? readRuleSetFile(path) : undefined;
}

/** Files opened lately (recent.json), most recent first; filled at startup. */
let recentFiles: string[] = [];
/** Search bar history (recent.json), most recent first; the renderer decides its content. */
let recentSearches: SearchHistoryEntry[] = [];

function persistRecent(): void {
  buildMenu();
  void saveRecent(app.getPath("userData"), { schemaVersion: 1, files: recentFiles, searches: recentSearches }).catch(() => undefined);
}

function openRecent(path: string): void {
  if (!parseDockerUri(path) && !existsSync(path)) {
    recentFiles = withoutRecentFile(recentFiles, path);
    persistRecent();
  }
  sendFiles([path]); // a vanished file is reported by the renderer like any open failure
}

/** 16 px menu icons (resources/menu/*.png, 32 px source so they stay sharp on HiDPI screens). */
const menuIcon = (name: "file" | "docker"): Electron.NativeImage =>
  nativeImage.createFromPath(resourcePath(`menu/${name}.png`)).resize({ width: 16, height: 16 });

function recentSubmenu(): Electron.MenuItemConstructorOptions[] {
  if (recentFiles.length === 0) return [{ label: t("(aucun)"), enabled: false }];
  return [
    ...recentFiles.map((path) => ({
      label: path.replace(/&/g, "&&"),
      icon: menuIcon(parseDockerUri(path) ? "docker" : "file"),
      click: () => openRecent(path),
    })),
    { type: "separator" },
    {
      label: t("&Effacer la liste"),
      click: () => {
        recentFiles = [];
        persistRecent();
      },
    },
  ];
}

/** Zoom of the page in percent (Electron zoom level n = 1.2^n), pushed to the renderer to show it. */
function zoomBy(delta: number | "reset"): void {
  const wc = mainWindow?.webContents;
  if (!wc) return;
  const level = delta === "reset" ? 0 : Math.max(-5, Math.min(5, wc.getZoomLevel() + delta));
  wc.setZoomLevel(level);
  wc.send("zoom:changed", Math.round(Math.pow(1.2, level) * 100));
}

/** "Affichage" menu (zoom, plein écran). */
function viewMenu(): Electron.MenuItemConstructorOptions {
  return {
    label: t("&Affichage"),
    submenu: [
      { label: t("Zoom a&vant"), accelerator: "CmdOrCtrl+Plus", click: () => zoomBy(1) },
      { label: t("Zoom a&rrière"), accelerator: "CmdOrCtrl+-", click: () => zoomBy(-1) },
      { label: t("&Taille réelle (100 %)"), accelerator: "CmdOrCtrl+0", click: () => zoomBy("reset") },
      { type: "separator" },
      { role: "togglefullscreen", label: t("&Plein écran") },
    ],
  };
}

/**
 * Development-only reload entries of the "Aide" menu. Reload / Force reload only restart the interface
 * (nothing is re-read from disk), so they are not shown in the packaged app. The developer tools stay
 * available everywhere, to diagnose a problem on a user's machine.
 */
function devHelpItems(): Electron.MenuItemConstructorOptions[] {
  if (app.isPackaged) return [];
  return [
    { role: "reload", label: t("Recharger l'interface (dev)") },
    { role: "forceReload", label: t("Recharger sans cache (dev)") },
  ];
}

function buildMenu(): void {
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      {
        label: t("&Fichier"),
        submenu: [
          { label: t("&Ouvrir…"), accelerator: "CmdOrCtrl+O", click: () => void pickFiles().then(sendFiles) },
          { label: t("Fichiers &récents"), submenu: recentSubmenu() },
          { type: "separator" },
          { label: t("&Configuration…"), accelerator: "CmdOrCtrl+,", click: () => mainWindow?.webContents.send("settings:open") },
          { type: "separator" },
          { role: "quit", label: t("&Quitter") },
        ],
      },
      viewMenu(),
      {
        label: t("&Aide"),
        submenu: [
          { label: t("Rechercher une &mise à jour…"), click: () => void checkForUpdates(mainWindow, true) },
          { label: t("&Signaler un bug / proposer une idée…"), click: () => mainWindow?.webContents.send("feedback:open") },
          { type: "separator" },
          { label: t("&Raccourcis clavier"), accelerator: "F1", click: () => mainWindow?.webContents.send("shortcuts:open") },
          { label: t("&Notes de version…"), click: () => mainWindow?.webContents.send("notes:open") },
          { type: "separator" },
          { label: t("À &propos de cbl-log"), click: () => showAbout(mainWindow, app.getVersion(), iconPath(), avatarPath()) },
          { type: "separator" },
          { role: "toggleDevTools", label: t("Outils de développement") },
          ...devHelpItems(),
        ],
      },
    ]),
  );
}

const feedbackEnv = (): FeedbackEnv => ({
  version: app.getVersion(),
  install: process.env["PORTABLE_EXECUTABLE_FILE"] ? "portable" : app.isPackaged ? "installée" : "dev",
  os: `${process.platform === "win32" ? "Windows" : process.platform} ${release()} ${process.arch}`,
  electron: process.versions.electron ?? "?",
});

/** Opens the pre-filled GitHub issue in the browser, unless the draft is invalid or the anti-flood refuses it. */
async function submitFeedback(draft: FeedbackDraft): Promise<{ ok: true } | { ok: false; reason: string }> {
  const invalid = validateDraft(draft);
  if (invalid) return { ok: false, reason: invalid };
  const dir = app.getPath("userData");
  const history = (await loadFeedbackHistory(dir)).value;
  const now = Date.now();
  const key = feedbackKey(draft.kind, draft.title);
  const flood = checkFlood(history, now, key);
  if (!flood.ok) return flood;
  await shell.openExternal(buildIssueUrl(draft, feedbackEnv()));
  await saveFeedbackHistory(dir, withSent(history, now, draft.kind, key)).catch(() => undefined);
  return { ok: true };
}

// Window / taskbar icon: shipped next to the asar via electron-builder extraResources when packaged.
const resourcePath = (name: string): string =>
  app.isPackaged ? join(process.resourcesPath, name) : join(__dirname, "../../resources", name);
// Follows the theme in force (resources/icons/*.svg); the .exe/installer keep the dark icon.ico.
const iconPath = (): string => resourcePath(nativeTheme.shouldUseDarkColors ? "icon.png" : "icon-light.png");
// Author avatar shown by the splash and "À propos", independent of the app icon.
const avatarPath = (): string => resourcePath("avatar.png");

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1100,
    height: 700,
    show: false,
    icon: iconPath(),
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });
  mainWindow = win;
  rendererReady = false;
  win.on("closed", () => {
    if (mainWindow === win) mainWindow = undefined;
  });
  // A reload (or HMR full reload) restarts the renderer: wait for its "ready" signal again.
  win.webContents.on("did-start-loading", () => {
    rendererReady = false;
  });
  // Ctrl + wheel zooms by one step (Electron only reports the request, it does not apply it).
  win.webContents.on("zoom-changed", (_event, direction) => zoomBy(direction === "in" ? 1 : -1));
  engine.attachWindow(win);
  win.once("ready-to-show", () => {
    win.show();
    if (splashWindow && !splashWindow.isDestroyed()) splashWindow.close();
    splashWindow = undefined;
  });

  const devUrl = process.env["ELECTRON_RENDERER_URL"];
  if (devUrl) {
    void win.loadURL(devUrl);
  } else {
    void win.loadFile(join(__dirname, "../renderer/index.html"));
  }
}

// Windows toasts (rule notifications) are attributed to the installer's shortcut through this id (electron-builder appId).
if (process.platform === "win32") app.setAppUserModelId("dev.clementbrunel.cbl-log");

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  pendingPaths.push(...parseFileArgs(process.argv, process.cwd(), { isPackaged: app.isPackaged }));

  app.on("second-instance", (_event, argv, workingDirectory) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
    sendFiles(parseFileArgs(argv, workingDirectory, { isPackaged: app.isPackaged }));
  });

  ipcMain.handle("dialog:open-files", () => pickFiles());
  ipcMain.handle("recent:add", (_event, path: string) => {
    recentFiles = withRecentFile(recentFiles, path);
    persistRecent();
  });
  // the preload asks for the language synchronously, before the page's scripts run
  ipcMain.on("language:get", (event) => {
    event.returnValue = language();
  });
  ipcMain.on("window:focus", () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  });
  ipcMain.handle("search-history:get", () => recentSearches);
  ipcMain.handle("search-history:set", (_event, list: unknown) => {
    const parsed = searchHistorySchema.safeParse(list);
    if (!parsed.success) return;
    recentSearches = parsed.data;
    persistRecent();
  });
  ipcMain.handle("file:context-menu", (_event, path: string) => {
    if (typeof path !== "string" || path === "") return;
    Menu.buildFromTemplate([
      { label: t("Ouvrir le dossier du fichier"), click: () => void shell.openPath(dirname(path)) },
      { label: t("Afficher dans l'explorateur"), click: () => shell.showItemInFolder(path) },
      { type: "separator" },
      { label: t("Copier le chemin"), click: () => clipboard.writeText(path) },
      { type: "separator" },
      { label: t("Désigner une archive du rolling…"), click: () => void designateArchive(path) },
    ]).popup(mainWindow ? { window: mainWindow } : {});
  });
  ipcMain.handle("rules:load",() => loadRuleSets(rulesDir()));
  ipcMain.handle("rules:save", async (_event, set: RuleSet) => {
    configWatcher?.noteWrite(`rules/${set.id}.json`, await saveRuleSet(rulesDir(), set));
  });
  ipcMain.handle("rules:export", (_event, set: RuleSet) => exportProfile(set));
  ipcMain.handle("rules:import", () => importProfile());
  ipcMain.handle("settings:load", async () => {
    const loaded = await loadSettings(app.getPath("userData"));
    nativeTheme.themeSource = loaded.value.theme;
    return loaded;
  });
  ipcMain.handle("settings:save", async (_event, settings: Settings) => {
    nativeTheme.themeSource = settings.theme;
    configWatcher?.noteWrite("settings.json", await saveSettings(app.getPath("userData"), settings));
    syncShellIntegration(settings);
  });
  ipcMain.handle("settings:read-text", () => readSettingsText(app.getPath("userData")));
  ipcMain.handle("settings:save-text", async (_event, text: string) => {
    if (typeof text !== "string") return { ok: false, errors: [t("Texte manquant")] };
    const result = await saveSettingsText(app.getPath("userData"), text);
    if (result.ok) {
      nativeTheme.themeSource = result.value.theme;
      configWatcher?.noteWrite("settings.json", result.text);
      syncShellIntegration(result.value);
    }
    return result.ok ? { ok: true, value: result.value } : result;
  });
  ipcMain.handle("settings:reveal", async () => {
    const dir = app.getPath("userData");
    const path = settingsPath(dir);
    // Created with the defaults first, so that the explorer has a file to select.
    if (!existsSync(path)) configWatcher?.noteWrite("settings.json", await writeJsonAtomic(path, defaultSettings()));
    shell.showItemInFolder(path);
  });
  ipcMain.handle("formats:load", () => loadFormats(join(app.getPath("userData"), "formats")));
  ipcMain.handle("session:load", () => loadSession(app.getPath("userData")));
  ipcMain.handle("session:save", (_event, session: Session) => saveSession(app.getPath("userData"), session).then(() => undefined));
  ipcMain.handle("feedback:status", async () => {
    const flood = checkFlood((await loadFeedbackHistory(app.getPath("userData"))).value, Date.now());
    return { env: envLines(feedbackEnv()), blocked: flood.ok ? undefined : flood.reason };
  });
  ipcMain.handle("feedback:submit", (_event, draft: FeedbackDraft) => submitFeedback(draft));
  ipcMain.on("update:action", (_event, action: UpdateAction) => handleUpdateAction(action));
  ipcMain.on("renderer:ready", () => {
    rendererReady = true;
    sendFiles(pendingPaths.splice(0));
  });

  void app.whenReady().then(async () => {
    // The language comes first (splash, menus, engine): settings.json is read synchronously for it alone.
    setLanguage(resolveLanguage(readLanguageSetting(app.getPath("userData")), app.getLocale()));
    splashWindow = showSplash(app.getVersion(), iconPath(), avatarPath()); // first thing, before loading the config
    // Theme switch in the app (themeSource) or system change: swap the window / taskbar icon.
    nativeTheme.on("updated", () => mainWindow?.setIcon(iconPath()));
    const recent = (await loadRecent(app.getPath("userData"))).value;
    recentFiles = recent.files;
    recentSearches = recent.searches;
    buildMenu();
    mkdirSync(rulesDir(), { recursive: true }); // so that the folders can be watched from the first run
    mkdirSync(join(app.getPath("userData"), "formats"), { recursive: true });
    configWatcher = new ConfigWatcher(app.getPath("userData"), (kind: ConfigKind) => {
      mainWindow?.webContents.send("config:changed", kind);
      if (kind === "settings") void loadSettings(app.getPath("userData")).then(({ value }) => syncShellIntegration(value));
    });
    configWatcher.start();
    const startupSettings = (await loadSettings(app.getPath("userData"))).value;
    engine.setDockerSettings(startupSettings.docker);
    // re-written at every start: the exe path changes when the app is installed elsewhere
    syncShellIntegration(startupSettings, true);
    engine.start();
    createWindow();
    // Startup check, then hourly for sessions that are never closed; packaged builds only (a dev build has
    // nothing to install). The setting is re-read at each tick so that toggling it applies without restart.
    if (app.isPackaged) {
      const autoCheck = async (): Promise<void> => {
        if ((await loadSettings(app.getPath("userData"))).value.checkForUpdates) await checkForUpdates(mainWindow, false);
      };
      setTimeout(() => void autoCheck(), 5000);
      setInterval(() => void autoCheck(), 60 * 60 * 1000);
    }
    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on("before-quit", () => {
  configWatcher?.stop();
  engine.stop();
});

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
}
