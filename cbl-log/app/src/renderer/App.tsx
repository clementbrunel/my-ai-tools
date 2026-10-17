import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import {
  BUILTIN_FORMATS,
  DETECT_SAMPLE_LINES,
  compileFormat,
  createDefaultRuleSet,
  defaultSettings,
  detectFormat,
  type CompiledFormat,
  type Level,
  type LogFormat,
  type HighlightRule,
  type RuleSet,
  type Row,
  type SearchQuery,
  type Session,
  type SessionTab,
  type Settings,
  type TabId,
  type Theme,
} from "@cbl-log/shared";
import { subscribeEngine } from "./engine/client";
import type { RpcClient } from "./engine/rpc-client";
import { baseName, pathKey } from "./files/path-key";
import { useFileDrop } from "./files/useFileDrop";
import { compileRules, highlightLine } from "./highlight/highlight";
import { RulesEditor } from "./rules/RulesEditor";
import { buildSession } from "./session/session-snapshot";
import { StatusBar } from "./tabs/StatusBar";
import { TabBar } from "./tabs/TabBar";
import { initialTabsState, searchStatus, tabsReducer } from "./tabs/tabs-reducer";
import { SearchBar } from "./search/SearchBar";
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
  const stateRef = useRef(state);
  stateRef.current = state;
  const [notice, setNotice] = useState<{ text: string; isError: boolean } | undefined>();
  const [ruleSet, setRuleSet] = useState<RuleSet>(createDefaultRuleSet);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [userFormats, setUserFormats] = useState<LogFormat[]>([]);
  const [viewLevel, setViewLevel] = useState<Level | undefined>();
  const detecting = useRef(new Set<TabId>());
  const sessionReady = useRef(false);
  /** Last session written (or loaded): reopened if the engine process restarts. */
  const lastSessionObj = useRef<Session | undefined>(undefined);
  const restoreRef = useRef<(session: Session) => Promise<void>>(async () => {});
  const [searchOpen, setSearchOpen] = useState(false);
  const [reveal, setReveal] = useState<{ row: number; nonce: number } | undefined>();
  const revealNonce = useRef(0);
  const viewRow = useRef(0);
  const jumpedFor = useRef<string | undefined>(undefined);
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
        setNotice({ text: "Le moteur a redémarré : les onglets sont rouverts depuis la dernière session.", isError: true });
        if (lastSessionObj.current) void restoreRef.current(lastSessionObj.current);
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
        if (event.type === "rows" && event.total <= DETECT_SAMPLE_LINES * 3) {
          const tab = stateRef.current.tabs.find((t) => t.info.tabId === tabId);
          if (tab && !tab.formatId) void detectRef.current(tabId);
        }
        dispatch({ type: "event", tabId, event, receivedAt: Date.now() });
      });
    });
    return () => {
      offEvents?.();
      offSubscribe();
    };
  }, [resetTabs]);

  /** Opens one file in a tab (or activates its tab); `restore` re-applies a saved session position. */
  const openFile = useCallback(
    async (path: string, restore?: SessionTab): Promise<{ ok: true } | { ok: false; message: string }> => {
      const engine = await withEngine();
      const key = pathKey(path);
      const existing = [...runtimes.current.entries()].find(([, rt]) => rt.pathKey === key);
      if (existing) {
        dispatch({ type: "activated", tabId: existing[0] });
        return { ok: true };
      }
      try {
        const info = await engine.request("open", { path });
        const cache = new PageCache(async (first, count) => (await engine.request("getRows", { tabId: info.tabId, first, count })).rows);
        runtimes.current.set(info.tabId, { cache, total: info.totalRows, pathKey: key });
        dispatch({ type: "opened", info });
        void detectRef.current(info.tabId);
        if (restore) {
          dispatch({ type: "follow", tabId: info.tabId, follow: restore.follow });
          dispatch({ type: "scrollRow", tabId: info.tabId, row: restore.scrollRow });
          if (restore.clearedBefore > 0) dispatch({ type: "clearedTo", tabId: info.tabId, row: restore.clearedBefore });
        }
        return { ok: true };
      } catch (err) {
        return { ok: false, message: err instanceof Error ? err.message : String(err) };
      }
    },
    [withEngine],
  );

  /** (Re)detects the log format of a tab from its first lines; stays raw (null) when none fits. */
  const detectTab = useCallback(
    async (tabId: TabId) => {
      if (detecting.current.has(tabId)) return;
      detecting.current.add(tabId);
      try {
        const engine = await withEngine();
        const { rows } = await engine.request("getRows", { tabId, first: 0, count: DETECT_SAMPLE_LINES });
        const found = detectFormat(rows.map((r) => r.text), formatsRef.current);
        dispatch({ type: "formatDetected", tabId, formatId: found?.format.id ?? null });
      } catch {
        // tab closed meanwhile
      } finally {
        detecting.current.delete(tabId);
      }
    },
    [withEngine],
  );
  const detectRef = useRef(detectTab);
  detectRef.current = detectTab;

  const openPaths = useCallback(
    async (paths: string[]) => {
      for (const path of paths) {
        const result = await openFile(path);
        if (!result.ok) setNotice({ text: `${baseName(path)} : ${result.message}`, isError: true });
      }
    },
    [openFile],
  );

  const restoreSession = useCallback(
    async (session: Session) => {
      const missing: string[] = [];
      for (const tab of session.tabs) {
        const result = await openFile(tab.path, tab);
        if (!result.ok) missing.push(baseName(tab.path));
      }
      if (session.activePath) {
        const key = pathKey(session.activePath);
        const active = [...runtimes.current.entries()].find(([, rt]) => rt.pathKey === key);
        if (active) dispatch({ type: "activated", tabId: active[0] });
      }
      if (missing.length > 0) setNotice({ text: `Session : fichier(s) introuvable(s) : ${missing.join(", ")}`, isError: true });
    },
    [openFile],
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

  // Startup: restore the saved session first, then announce we are ready so that files given on the
  // command line open after it (and end up active).
  restoreRef.current = restoreSession;
  const restoreStarted = useRef(false);
  useEffect(() => {
    const off = window.cblLog.onOpenFiles((paths) => void openPaths(paths));
    if (!restoreStarted.current) {
      restoreStarted.current = true;
      void (async () => {
        try {
          const { value, warning } = await window.cblLog.loadSession();
          if (warning) setNotice({ text: `Session ignorée : ${warning}`, isError: true });
          lastSessionObj.current = value;
          await restoreSession(value);
        } finally {
          sessionReady.current = true;
          window.cblLog.notifyReady();
        }
      })();
    }
    return off;
  }, [openPaths, restoreSession]);

  // Session: written shortly after a change, every 30 s (scroll position) and when the page goes away.
  const lastSession = useRef("");
  const saveSessionNow = useCallback(() => {
    if (!sessionReady.current) return;
    const { tabs, activeId: current } = stateRef.current;
    const session = buildSession(tabs, current, viewRow.current);
    const text = JSON.stringify(session);
    if (text === lastSession.current) return;
    lastSession.current = text;
    lastSessionObj.current = session;
    void window.cblLog.saveSession(session).catch(() => undefined);
  }, []);
  useEffect(() => {
    const timer = setTimeout(saveSessionNow, 1000);
    return () => clearTimeout(timer);
  }, [state.tabs, state.activeId, saveSessionNow]);
  useEffect(() => {
    const interval = setInterval(saveSessionNow, 30_000);
    window.addEventListener("pagehide", saveSessionNow);
    return () => {
      clearInterval(interval);
      window.removeEventListener("pagehide", saveSessionNow);
    };
  }, [saveSessionNow]);

  // Settings (theme): loaded at startup and reloaded when settings.json is edited outside the app.
  const loadSettingsNow = useCallback(() => {
    void window.cblLog.loadSettings().then(({ value, warning }) => {
      setSettings(value);
      if (warning) setNotice({ text: `Réglages ignorés : ${warning}`, isError: true });
    });
  }, []);
  const cycleTheme = useCallback(() => {
    const order: Theme[] = ["system", "light", "dark"];
    setSettings((prev) => {
      const next: Settings = { ...prev, theme: order[(order.indexOf(prev.theme) + 1) % order.length]! };
      void window.cblLog.saveSettings(next).catch(() => undefined);
      return next;
    });
  }, []);

  // Rules: loaded once, edited live, saved shortly after the last edit.
  const loadRulesNow = useCallback(() => {
    void window.cblLog.loadRuleSets().then(({ sets, warnings }) => {
      const loaded = sets.find((s) => s.id === "default") ?? sets[0];
      if (loaded) setRuleSet(loaded);
      if (warnings.length > 0) setNotice({ text: `Règles ignorées : ${warnings.join(" ; ")}`, isError: true });
    });
  }, []);
  const loadFormatsNow = useCallback(() => {
    void window.cblLog.loadFormats().then(({ formats: loaded, warnings }) => {
      setUserFormats(loaded);
      if (warnings.length > 0) setNotice({ text: `Formats ignorés : ${warnings.join(" ; ")}`, isError: true });
    });
  }, []);
  useEffect(() => {
    loadRulesNow();
    loadSettingsNow();
    loadFormatsNow();
    return window.cblLog.onConfigChanged((kind) => {
      if (kind === "rules") loadRulesNow();
      else if (kind === "formats") loadFormatsNow();
      else loadSettingsNow();
    });
  }, [loadRulesNow, loadSettingsNow, loadFormatsNow]);

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

  const searchTab = state.tabs.find((t) => t.info.tabId === state.activeId);
  const searchProgress = searchTab ? searchStatus(searchTab) : undefined;
  // A regex runs on the UI thread to highlight the visible rows: only trust it once the engine has
  // run it on the whole file without stalling (a literal can never backtrack).
  const searchQuery =
    searchTab?.search && (!searchTab.search.query.isRegex || (searchProgress?.done && !searchProgress.error)) ? searchTab.search.query : undefined;
  const formats = useMemo<CompiledFormat[]>(() => {
    const byId = new Map<string, LogFormat>(BUILTIN_FORMATS.map((f) => [f.id, f]));
    for (const f of userFormats) byId.set(f.id, f);
    // user formats first: on a tie in detection the more specific, hand-written format wins
    return [...userFormats, ...[...byId.values()].filter((f) => !userFormats.includes(f))].map(compileFormat);
  }, [userFormats]);
  const formatsRef = useRef(formats);
  formatsRef.current = formats;
  useEffect(() => {
    // formats changed (startup, user file edited): detect again, tabs may now match a better format
    for (const tab of stateRef.current.tabs) void detectRef.current(tab.info.tabId);
  }, [formats]);

  const compiled = useMemo(() => {
    // the search highlight comes first so that it wins over the rules on overlapping fragments
    const searchRule: HighlightRule[] = searchQuery
      ? [
          {
            id: "__search",
            name: "",
            scope: "fragment",
            enabled: true,
            bg: "#ffd600",
            fg: "#000000",
            pattern: searchQuery.pattern,
            isRegex: searchQuery.isRegex,
            caseSensitive: searchQuery.caseSensitive,
            wholeWord: searchQuery.wholeWord ?? false,
          },
        ]
      : [];
    return compileRules([...searchRule, ...ruleSet.rules]);
  }, [ruleSet.rules, searchQuery]);
  const highlight = useCallback((text: string) => highlightLine(text, compiled.compiled), [compiled]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(undefined), 6000);
    return () => clearTimeout(timer);
  }, [notice]);

  useFileDrop(openPaths);

  const active = state.tabs.find((t) => t.info.tabId === state.activeId);
  const activeId = active?.info.tabId;

  const runSearch = useCallback(
    async (query: SearchQuery | null) => {
      if (!activeId) return;
      try {
        const engine = await withEngine();
        const { searchId } = await engine.request("search", { tabId: activeId, query });
        if (query && searchId) dispatch({ type: "searchStarted", tabId: activeId, query, id: searchId });
        else dispatch({ type: "searchStopped", tabId: activeId });
      } catch (err) {
        setNotice({ text: `Recherche : ${err instanceof Error ? err.message : String(err)}`, isError: true });
      }
    },
    [activeId, withEngine],
  );

  const findHit = useCallback(
    async (dir: "next" | "prev") => {
      const tab = active;
      const searchId = tab?.search?.id;
      if (!tab || !searchId) return;
      const from = tab.search?.current?.row ?? (dir === "next" ? viewRow.current - 1 : viewRow.current);
      try {
        const engine = await withEngine();
        const hit = await engine.request("searchNext", { tabId: tab.info.tabId, searchId, fromRow: from, dir });
        if (hit.row === null) return;
        if (hit.row < tab.clearedBefore) dispatch({ type: "unclear", tabId: tab.info.tabId });
        dispatch({ type: "searchHit", tabId: tab.info.tabId, row: hit.row, ordinal: hit.ordinal });
        setReveal({ row: hit.row, nonce: ++revealNonce.current });
      } catch (err) {
        setNotice({ text: `Recherche : ${err instanceof Error ? err.message : String(err)}`, isError: true });
      }
    },
    [active, withEngine],
  );

  const closeSearch = useCallback(() => {
    setSearchOpen(false);
    if (activeId && active?.search) void runSearch(null);
  }, [activeId, active?.search, runSearch]);

  // First results of a new search: jump to the first match after the current position.
  const status = active ? searchStatus(active) : undefined;
  const searchIdNow = active?.search?.id ?? undefined;
  const hasCurrent = !!active?.search?.current;
  useEffect(() => {
    if (searchIdNow && !hasCurrent && (status?.matches ?? 0) > 0 && jumpedFor.current !== searchIdNow) {
      jumpedFor.current = searchIdNow;
      void findHit("next");
    }
  }, [searchIdNow, hasCurrent, status?.matches, findHit]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.ctrlKey && e.key.toLowerCase() === "w" && activeId) {
        e.preventDefault();
        closeTab(activeId);
      } else if (e.ctrlKey && e.key.toLowerCase() === "f" && activeId) {
        e.preventDefault();
        setSearchOpen(true);
      } else if (e.key === "F3" && activeId) {
        e.preventDefault();
        if (active?.search) void findHit(e.shiftKey ? "prev" : "next");
        else setSearchOpen(true);
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
  }, [activeId, active?.search, closeTab, findHit]);

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
  const activeFormat = active?.formatId ? formats.find((f) => f.format.id === active.formatId) : undefined;

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
          {searchOpen && (
            <SearchBar
              key={active.info.tabId}
              initial={active.search}
              status={status}
              onQuery={(q) => void runSearch(q)}
              onNext={() => void findHit("next")}
              onPrev={() => void findHit("prev")}
              onClose={closeSearch}
            />
          )}
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
            format={activeFormat}
            onViewLevel={setViewLevel}
            reveal={reveal}
            currentMatchRow={active.search?.current?.row}
            viewRowRef={viewRow}
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
            theme={settings.theme}
            formatName={activeFormat?.format.name || activeFormat?.format.id}
            level={viewLevel}
            onCycleTheme={cycleTheme}
          />
        </>
      )}
    </div>
  );
}
