import { join } from "node:path";
import { app, BrowserWindow, dialog, ipcMain, Menu } from "electron";
import { parseFileArgs } from "./cli-args";
import { EngineHost } from "./engine-process";

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
  ipcMain.on("renderer:ready", () => {
    rendererReady = true;
    sendFiles(pendingPaths.splice(0));
  });

  void app.whenReady().then(() => {
    buildMenu();
    engine.start();
    createWindow();
    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on("before-quit", () => engine.stop());

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
}
