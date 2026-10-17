import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { createDefaultRuleSet, type HighlightRule, type RuleSet, type Row, type TabId } from "@cbl-log/shared";
import { subscribeEngine } from "./engine/client";
import type { RpcClient } from "./engine/rpc-client";
import { baseName, pathKey } from "./files/path-key";
import { useFileDrop } from "./files/useFileDrop";
import { compileRules, highlightLine } from "./highlight/highlight";
import { RulesEditor } from "./rules/RulesEditor";
import { StatusBar } from "./tabs/StatusBar";
import { TabBar } from "./tabs/TabBar";
import { initialTabsState, tabsReducer } from "./tabs/tabs-reducer";
import { LogViewport } from "./viewer/LogViewport";
import { PageCache } from "./viewer/page-cache";

interface TabRuntime {
  cache: PageCache;
  /** Row count last seen, to know from where the cache is outdated when rows are appended. */
  total: number;
  pathKey: string;
}

export function App() {
  const [state, dispatch] = useReducer(tabsReducer, initialTabsState);
  const [notice, setNotice] = useState<{ text: string; isError: boolean } | undefined>();
  const [ruleSet, setRuleSet] = useState<RuleSet>(createDefaultRuleSet);
  const [rulesOpen, setRulesOpen] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const engineRef = useRef<RpcClient | undefined>(undefined);
  const engineWaiters = useRef<((engine: RpcClient) => void)[]>([]);
  const runtimes = useRef(new Map<TabId, TabRuntime>());

  const withEngine = useCallback((): Promise<RpcClient> => {
    const engine = engineRef.current;
    return engine ? Promise.resolve(engine) : new Promise((resolve) => engineWaiters.current.push(resolve));
  }, []);

  const resetTabs = useCallback(() => {
    for (const rt of runtimes.current.values()) rt.cache.clear();
    runtimes.current.clear();
    dispatch({ type: "reset" });
  }, []);

  // Engine connection, and events pushed by the engine.
  useEffect(() => {
    let offEvents: (() => void) | undefined;
    const offSubscribe = subscribeEngine((engine, isReconnection) => {
      offEvents?.();
      engineRef.current = engine;
      if (isReconnection) {
        resetTabs();
        setNotice({ text: "Le moteur a redémarré : les onglets ont été fermés.", isError: true });
      } else {
        console.log("engine connected");
      }
      // Dev-only handle to drive the engine from DevTools: await __engine.request("open", { path })
      if (import.meta.env.DEV) (window as unknown as { __engine: unknown }).__engine = engine;
      for (const waiter of engineWaiters.current.splice(0)) waiter(engine);

      offEvents = engine.onAnyEvent((tabId, event) => {
        const rt = runtimes.current.get(tabId);
        if (rt) {
          if (event.type === "rows") {
            // the last line may have been open: re-read from the previous end
            rt.cache.invalidateFrom(Math.max(0, rt.total - 1));
            rt.total = event.total;
          } else if (event.type === "rolled") {
            rt.cache.invalidateFrom(event.at);
          }
        }
        dispatch({ type: "event", tabId, event, receivedAt: Date.now() });
      });
    });
    return () => {
      offEvents?.();
      offSubscribe();
    };
  }, [resetTabs]);

  const openPaths = useCallback(
    async (paths: string[]) => {
      const engine = await withEngine();
      for (const path of paths) {
        const key = pathKey(path);
        const existing = [...runtimes.current.entries()].find(([, rt]) => rt.pathKey === key);
        if (existing) {
          dispatch({ type: "activated", tabId: existing[0] });
          continue;
        }
        try {
          const info = await engine.request("open", { path });
          const cache = new PageCache(async (first, count) => (await engine.request("getRows", { tabId: info.tabId, first, count })).rows);
          runtimes.current.set(info.tabId, { cache, total: info.totalRows, pathKey: key });
          dispatch({ type: "opened", info });
        } catch (err) {
          setNotice({ text: `${baseName(path)} : ${err instanceof Error ? err.message : String(err)}`, isError: true });
        }
      }
    },
    [withEngine],
  );

  const closeTab = useCallback(
    (tabId: TabId) => {
      const rt = runtimes.current.get(tabId);
      rt?.cache.clear();
      runtimes.current.delete(tabId);
      dispatch({ type: "closed", tabId });
      void withEngine().then((engine) => engine.request("close", { tabId }).catch(() => undefined));
    },
    [withEngine],
  );

  useEffect(() => {
    const off = window.cblLog.onOpenFiles((paths) => void openPaths(paths));
    window.cblLog.notifyReady();
    return off;
  }, [openPaths]);

  // Rules: loaded once, edited live, saved shortly after the last edit.
  useEffect(() => {
    void window.cblLog.loadRuleSets().then(({ sets, warnings }) => {
      const loaded = sets.find((s) => s.id === "default") ?? sets[0];
      if (loaded) setRuleSet(loaded);
      if (warnings.length > 0) setNotice({ text: `Règles ignorées : ${warnings.join(" ; ")}`, isError: true });
    });
  }, []);

  const changeRules = useCallback((rules: HighlightRule[]) => {
    setRuleSet((prev) => {
      const next = { ...prev, rules };
      clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        void window.cblLog.saveRuleSet(next).catch((err: unknown) => setNotice({ text: `Règles non enregistrées : ${err instanceof Error ? err.message : String(err)}`, isError: true }));
      }, 400);
      return next;
    });
  }, []);

  const compiled = useMemo(() => compileRules(ruleSet.rules), [ruleSet.rules]);
  const highlight = useCallback((text: string) => highlightLine(text, compiled.compiled), [compiled]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(undefined), 6000);
    return () => clearTimeout(timer);
  }, [notice]);

  useFileDrop(openPaths);

  const active = state.tabs.find((t) => t.info.tabId === state.activeId);
  const activeId = active?.info.tabId;

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.ctrlKey && e.key.toLowerCase() === "w" && activeId) {
        e.preventDefault();
        closeTab(activeId);
      } else if (e.ctrlKey && e.key.toLowerCase() === "h") {
        e.preventDefault();
        setRulesOpen(true);
      } else if (e.ctrlKey && e.key.toLowerCase() === "l" && activeId) {
        e.preventDefault();
        dispatch({ type: "clear", tabId: activeId });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeId, closeTab]);

  const onFollowChange = useCallback(
    (follow: boolean) => {
      if (activeId) dispatch({ type: "follow", tabId: activeId, follow });
    },
    [activeId],
  );
  const onLeave = useCallback(
    (row: number) => {
      if (activeId) dispatch({ type: "scrollRow", tabId: activeId, row });
    },
    [activeId],
  );

  const fetchRows = useCallback(
    async (first: number, count: number): Promise<Row[]> => {
      if (!activeId) return [];
      const engine = await withEngine();
      return (await engine.request("getRows", { tabId: activeId, first, count })).rows;
    },
    [activeId, withEngine],
  );
  const onNotice = useCallback((text: string, isError = false) => setNotice({ text, isError }), []);

  const runtime = activeId ? runtimes.current.get(activeId) : undefined;

  return (
    <div className="app">
      {notice && (
        <div className={notice.isError ? "toast" : "toast info"} role="alert" onClick={() => setNotice(undefined)}>
          {notice.text}
        </div>
      )}
      {rulesOpen && (
        <RulesEditor
          rules={ruleSet.rules}
          errors={compiled.errors}
          onChange={changeRules}
          onReset={() => changeRules(createDefaultRuleSet().rules)}
          onClose={() => setRulesOpen(false)}
        />
      )}
      {!active || !runtime ? (
        <main className="placeholder">
          <h1>cbl-log</h1>
          <p>Glissez un fichier ou Ctrl+O</p>
          <button type="button" onClick={() => void window.cblLog.openFileDialog().then(openPaths)}>
            Ouvrir…
          </button>
        </main>
      ) : (
        <>
          <TabBar tabs={state.tabs} activeId={activeId} onActivate={(tabId) => dispatch({ type: "activated", tabId })} onClose={closeTab} />
          {active.state !== "following" && (
            <div className={`banner banner-${active.state}`} role="status">
              {active.state === "missing" ? "Fichier absent, en attente…" : active.message ?? "Erreur de lecture du fichier."}
            </div>
          )}
          <LogViewport
            key={active.info.tabId}
            cache={runtime.cache}
            total={active.total}
            base={active.clearedBefore}
            marks={active.marks}
            highlight={highlight}
            fetchRows={fetchRows}
            onNotice={onNotice}
            follow={active.follow}
            initialRow={active.scrollRow}
            onFollowChange={onFollowChange}
            onLeave={onLeave}
          />
          <StatusBar
            tab={active}
            onToggleFollow={() => onFollowChange(!active.follow)}
            onClear={() => dispatch({ type: "clear", tabId: active.info.tabId })}
            onUnclear={() => dispatch({ type: "unclear", tabId: active.info.tabId })}
            onEditRules={() => setRulesOpen(true)}
          />
        </>
      )}
    </div>
  );
}
