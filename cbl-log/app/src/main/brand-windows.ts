// Startup splash and "À propos" window. The main window stays hidden until its first paint (ready-to-show),
// which can take a few seconds on a cold start: the small frameless splash appears right away so that the
// user knows the app is starting, and is closed as soon as the main window shows.
// Self-contained HTML (data URLs), the avatar being inlined from resources/avatar.png.
import { readFileSync } from "node:fs";
import { BrowserWindow, nativeTheme, shell } from "electron";
import { aboutHtml, AUTHOR_URL, REPO_URL, splashHtml, themeColors } from "./brand-pages";

let avatarCache: string | undefined;

/** Avatar as a data URL; undefined if the file is missing (the pages then simply omit it). */
function avatarDataUrl(path: string): string | undefined {
  if (avatarCache === undefined) {
    try {
      avatarCache = `data:image/png;base64,${readFileSync(path).toString("base64")}`;
    } catch {
      avatarCache = "";
    }
  }
  return avatarCache || undefined;
}

const pageUrl = (html: string): string => `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;

const secure = { contextIsolation: true, sandbox: true, nodeIntegration: false } as const;

export function showSplash(version: string, icon: string, avatar: string): BrowserWindow {
  const dark = nativeTheme.shouldUseDarkColors;
  const splash = new BrowserWindow({
    width: 320,
    height: 220,
    frame: false,
    resizable: false,
    movable: true,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    center: true,
    show: false,
    icon,
    backgroundColor: themeColors(dark).bg,
    webPreferences: secure,
  });
  splash.once("ready-to-show", () => splash.show());
  void splash.loadURL(pageUrl(splashHtml(version, dark, avatarDataUrl(avatar))));
  return splash;
}

let aboutWindow: BrowserWindow | undefined;

/** Only the author's GitHub pages may be opened, in the default browser. */
const isAllowedLink = (url: string): boolean => url === AUTHOR_URL || url === REPO_URL;

export function showAbout(parent: BrowserWindow | undefined, version: string, icon: string, avatar: string): void {
  if (aboutWindow && !aboutWindow.isDestroyed()) {
    aboutWindow.focus();
    return;
  }
  const dark = nativeTheme.shouldUseDarkColors;
  const win = new BrowserWindow({
    parent,
    modal: !!parent,
    width: 380,
    height: 330,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    title: "À propos de cbl-log",
    show: false,
    icon,
    backgroundColor: themeColors(dark).bg,
    webPreferences: secure,
  });
  aboutWindow = win;
  win.removeMenu();
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isAllowedLink(url)) void shell.openExternal(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (event) => event.preventDefault());
  win.once("ready-to-show", () => win.show());
  win.on("closed", () => {
    if (aboutWindow === win) aboutWindow = undefined;
  });
  void win.loadURL(pageUrl(aboutHtml(version, dark, avatarDataUrl(avatar))));
}
