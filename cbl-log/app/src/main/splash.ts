// Startup splash: the main window stays hidden until its first paint (ready-to-show), which can take a
// few seconds on a cold start. This small frameless window appears right away so that the user knows the
// app is starting; it is closed as soon as the main window shows. Self-contained HTML (data URL), no file.
import { BrowserWindow, nativeTheme } from "electron";
import { splashHtml } from "./splash-page";

export function showSplash(version: string, icon: string): BrowserWindow {
  const dark = nativeTheme.shouldUseDarkColors;
  const splash = new BrowserWindow({
    width: 320,
    height: 180,
    frame: false,
    resizable: false,
    movable: true,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: false,
    center: true,
    show: false,
    icon,
    backgroundColor: dark ? "#14171a" : "#ffffff",
    webPreferences: { contextIsolation: true, sandbox: true, nodeIntegration: false },
  });
  splash.once("ready-to-show", () => splash.show());
  void splash.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(splashHtml(version, dark))}`);
  return splash;
}
