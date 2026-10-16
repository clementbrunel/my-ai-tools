import { useCallback, useEffect, useRef, useState } from "react";
import type { TabInfo } from "@cbl-log/shared";
import { engineReady } from "./engine/client";
import { baseName, pathKey } from "./files/path-key";
import { useFileDrop } from "./files/useFileDrop";

const PREVIEW_ROWS = 200;

interface PreviewTab {
  info: TabInfo;
  /** Temporary stand-in for the virtualized viewport: the last lines as plain text. */
  preview: string;
}

export function App() {
  const [tabs, setTabs] = useState<PreviewTab[]>([]);
  const [activeId, setActiveId] = useState<string | undefined>();
  const [error, setError] = useState<string | undefined>();
  const tabsRef = useRef<PreviewTab[]>([]);

  const openPaths = useCallback(async (paths: string[]) => {
    const engine = await engineReady;
    for (const path of paths) {
      const existing = tabsRef.current.find((t) => pathKey(t.info.path) === pathKey(path));
      if (existing) {
        setActiveId(existing.info.tabId);
        continue;
      }
      try {
        const info = await engine.request("open", { path });
        const first = Math.max(0, info.totalRows - PREVIEW_ROWS);
        const rows = await engine.request("getRows", { tabId: info.tabId, first, count: PREVIEW_ROWS });
        const tab: PreviewTab = { info, preview: rows.rows.map((r) => r.text).join("\n") };
        tabsRef.current = [...tabsRef.current, tab];
        setTabs(tabsRef.current);
        setActiveId(info.tabId);
      } catch (err) {
        setError(`${baseName(path)} : ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }, []);

  useEffect(() => {
    void engineReady.then((engine) => {
      console.log("engine connected");
      // Dev-only handle to drive the engine from DevTools: await __engine.request("open", { path })
      if (import.meta.env.DEV) (window as unknown as { __engine: unknown }).__engine = engine;
    });
    const off = window.cblLog.onOpenFiles((paths) => void openPaths(paths));
    window.cblLog.notifyReady();
    return off;
  }, [openPaths]);

  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => setError(undefined), 6000);
    return () => clearTimeout(timer);
  }, [error]);

  useFileDrop(openPaths);

  const active = tabs.find((t) => t.info.tabId === activeId);

  return (
    <div className="app">
      {error && (
        <div className="toast" role="alert" onClick={() => setError(undefined)}>
          {error}
        </div>
      )}
      {tabs.length === 0 ? (
        <main className="placeholder">
          <h1>cbl-log</h1>
          <p>Glissez un fichier ou Ctrl+O</p>
          <button type="button" onClick={() => void window.cblLog.openFileDialog().then(openPaths)}>
            Ouvrir…
          </button>
        </main>
      ) : (
        <>
          <nav className="tabs">
            {tabs.map((t) => (
              <button
                key={t.info.tabId}
                type="button"
                className={t.info.tabId === activeId ? "tab active" : "tab"}
                title={t.info.path}
                onClick={() => setActiveId(t.info.tabId)}
              >
                {baseName(t.info.path)}
              </button>
            ))}
          </nav>
          <pre className="preview">{active?.preview}</pre>
        </>
      )}
    </div>
  );
}
