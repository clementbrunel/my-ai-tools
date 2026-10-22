import { contextBridge, ipcRenderer, webUtils } from "electron";
import type { CblLogApi } from "./api";

const api: CblLogApi = {
  version: "2.0.0",
  openFileDialog: () => ipcRenderer.invoke("dialog:open-files") as Promise<string[]>,
  onOpenFiles: (cb) => {
    const listener = (_event: unknown, paths: string[]): void => cb(paths);
    ipcRenderer.on("files:open", listener);
    return () => {
      ipcRenderer.off("files:open", listener);
    };
  },
  getPathForFile: (file) => webUtils.getPathForFile(file),
  notifyReady: () => ipcRenderer.send("renderer:ready"),
  addRecentFile: (path) => ipcRenderer.invoke("recent:add", path) as Promise<void>,
  showFileContextMenu: (path) => ipcRenderer.invoke("file:context-menu", path) as Promise<void>,
  loadRuleSets: () => ipcRenderer.invoke("rules:load") as ReturnType<CblLogApi["loadRuleSets"]>,
  saveRuleSet: (set) => ipcRenderer.invoke("rules:save", set) as Promise<void>,
  exportRuleSet: (set) => ipcRenderer.invoke("rules:export", set) as ReturnType<CblLogApi["exportRuleSet"]>,
  importRuleSet: () => ipcRenderer.invoke("rules:import") as ReturnType<CblLogApi["importRuleSet"]>,
  loadSettings: () => ipcRenderer.invoke("settings:load") as ReturnType<CblLogApi["loadSettings"]>,
  saveSettings: (settings) => ipcRenderer.invoke("settings:save", settings) as Promise<void>,
  loadSession: () => ipcRenderer.invoke("session:load") as ReturnType<CblLogApi["loadSession"]>,
  saveSession: (session) => ipcRenderer.invoke("session:save", session) as Promise<void>,
  loadFormats: () => ipcRenderer.invoke("formats:load") as ReturnType<CblLogApi["loadFormats"]>,
  onOpenFeedback: (cb) => {
    const listener = (): void => cb();
    ipcRenderer.on("feedback:open", listener);
    return () => {
      ipcRenderer.off("feedback:open", listener);
    };
  },
  feedbackStatus: () => ipcRenderer.invoke("feedback:status") as ReturnType<CblLogApi["feedbackStatus"]>,
  submitFeedback: (draft) => ipcRenderer.invoke("feedback:submit", draft) as ReturnType<CblLogApi["submitFeedback"]>,
  onConfigChanged: (cb) => {
    const listener = (_event: unknown, kind: "settings" | "rules" | "formats"): void => cb(kind);
    ipcRenderer.on("config:changed", listener);
    return () => {
      ipcRenderer.off("config:changed", listener);
    };
  },
};

contextBridge.exposeInMainWorld("cblLog", api);

// contextBridge cannot transfer a MessagePort: relay it to the page with window.postMessage.
ipcRenderer.on("engine-port", (event) => {
  window.postMessage({ type: "cbl-log:engine-port" }, "*", event.ports);
});
