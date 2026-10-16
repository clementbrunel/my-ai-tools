import { join } from "node:path";
import { app, BrowserWindow } from "electron";
import { EngineHost } from "./engine-process";

const engine = new EngineHost();

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
  engine.attachWindow(win);
  win.once("ready-to-show", () => win.show());

  const devUrl = process.env["ELECTRON_RENDERER_URL"];
  if (devUrl) {
    void win.loadURL(devUrl);
  } else {
    void win.loadFile(join(__dirname, "../renderer/index.html"));
  }
}

void app.whenReady().then(() => {
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
