import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { app, BrowserWindow, dialog, ipcMain, Menu, nativeTheme } from "electron";
import type { RuleSet, Session, Settings } from "@cbl-log/shared";
import { parseFileArgs } from "./cli-args";
import { ConfigWatcher, type ConfigKind } from "./config-watcher";
import { loadSession, loadSettings, saveSession, saveSettings } from "./config-store";
import { loadFormats } from "./formats-store";
import { EngineHost } from "./engine-process";
import { loadRuleSets, saveRuleSet } from "./rules-store";

// Settings live in %APPDATA%/cbl-log (architecture, section 8), not under the package name.
// CBL_LOG_USER_DATA relocates it (portable use, isolated acceptance runs).
app.setPath("userData", process.env["CBL_LOG_USER_DATA"] ?? join(app.getPath("appData"), "cbl-log"));
const rulesDir = (): string => join(app.getPath("userData"), "rules");
let configWatcher: ConfigWatcher | undefined;

const engine = new EngineHost();
let mainWindow: BrowserWindow | undefined;
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
      { name: "All files", extensions: ["*"] },
    ],
  };
  const result = mainWindow ? await dialog.showOpenDialog(mainWindow, options) : await dialog.showOpenDialog(options);
  return result.canceled ? [] : result.filePaths;
}

function buildMenu(): void {
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      {
        label: "&Fichier",
        submenu: [
          { label: "&Ouvrir…", accelerator: "CmdOrCtrl+O", click: () => void pickFiles().then(sendFiles) },
          { type: "separator" },
          { role: "quit", label: "&Quitter" },
        ],
      },
      { role: "viewMenu" },
    ]),
  );
}

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1100,
    height: 700,
    show: false,
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
  engine.attachWindow(win);
  win.once("ready-to-show", () => win.show());

  const devUrl = process.env["ELECTRON_RENDERER_URL"];
  if (devUrl) {
    void win.loadURL(devUrl);
  } else {
    void win.loadFile(join(__dirname, "../renderer/index.html"));
  }
}

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
  ipcMain.handle("rules:load", () => loadRuleSets(rulesDir()));
  ipcMain.handle("rules:save", async (_event, set: RuleSet) => {
    configWatcher?.noteWrite(`rules/${set.id}.json`, await saveRuleSet(rulesDir(), set));
  });
  ipcMain.handle("settings:load", async () => {
    const loaded = await loadSettings(app.getPath("userData"));
    nativeTheme.themeSource = loaded.value.theme;
    return loaded;
  });
  ipcMain.handle("settings:save", async (_event, settings: Settings) => {
    nativeTheme.themeSource = settings.theme;
    configWatcher?.noteWrite("settings.json", await saveSettings(app.getPath("userData"), settings));
  });
  ipcMain.handle("formats:load", () => loadFormats(join(app.getPath("userData"), "formats")));
  ipcMain.handle("session:load", () => loadSession(app.getPath("userData")));
  ipcMain.handle("session:save", (_event, session: Session) => saveSession(app.getPath("userData"), session).then(() => undefined));
  ipcMain.on("renderer:ready", () => {
    rendererReady = true;
    sendFiles(pendingPaths.splice(0));
  });

  void app.whenReady().then(() => {
    buildMenu();
    mkdirSync(rulesDir(), { recursive: true }); // so that the folders can be watched from the first run
    mkdirSync(join(app.getPath("userData"), "formats"), { recursive: true });
    configWatcher = new ConfigWatcher(app.getPath("userData"), (kind: ConfigKind) => {
      mainWindow?.webContents.send("config:changed", kind);
    });
    configWatcher.start();
    engine.start();
    createWindow();
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
