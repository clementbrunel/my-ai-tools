import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import {
  BUILTIN_FORMATS,
  DETECT_SAMPLE_LINES,
  compileFormat,
  createBuiltinRuleSets,
  createDefaultRuleSet,
  createWebSphereRuleSet,
  defaultSettings,
  detectFormat,
  type CompiledFormat,
  type Encoding,
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
} from "@cbl-log/shared";
import { subscribeEngine } from "./engine/client";
import type { RpcClient } from "./engine/rpc-client";
import { baseName, pathKey } from "./files/path-key";
import { useFileDrop } from "./files/useFileDrop";
import { compileRules, highlightLine } from "./highlight/highlight";
import { RulesEditor } from "./rules/RulesEditor";
import { autoRuleSet, pickRuleSet } from "./rules/rule-profile";
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
  /** Files being opened (initial indexing in progress), by open id; progress is 0..1. */
  const [opening, setOpening] = useState<Record<string, { name: string; progress: number }>>({});
  const [notice, setNotice] = useState<{ text: string; isError: boolean } | undefined>();
  const [ruleSets, setRuleSets] = useState<RuleSet[]>(createBuiltinRuleSets);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [userFormats, setUserFormats] = useState<LogFormat[]>([]);
  const [viewLevel, setViewLevel] = useState<Level | undefined>();
  const detecting = useRef(new Set<TabId>());
  const sessionReady = useRef(false);
  /** Last session written (or loaded): reopened if the engine process restarts. */
  const lastSessionObj = useRef<Session | undefined>(undefined);
  const restoreRef = useRef<(session: Session) => Promise<void>>(async () => {});
  /** Incremented by Ctrl+F: the search field takes the focus. */
  const [searchFocus, setSearchFocus] = useState(0);
  const [reveal, setReveal] = useState<{ row: number; nonce: number } | undefined>();
  const revealNonce = useRef(0);
  const viewRow = useRef(0);
  const jumpedFor = useRef<string | undefined>(undefined);
  const saveTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
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
        if (event.type === "indexing") {
          // events of a file still being opened come under its open id, not a tab id
          setOpening((o) => (o[tabId] ? { ...o, [tabId]: { ...o[tabId], progress: event.progress } } : o));
        }
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

  /**
   * Opens one file in a tab (or activates its tab); `restore` re-applies a saved session position.
   * The encoding is forced when `opts.encoding` (or the restored tab) says so, else detected by the engine.
   */
  const openFile = useCallback(
    async (path: string, restore?: SessionTab, opts: { encoding?: Encoding; index?: number } = {}): Promise<{ ok: true } | { ok: false; message: string }> => {
      const engine = await withEngine();
      const key = pathKey(path);
      const existing = [...runtimes.current.entries()].find(([, rt]) => rt.pathKey === key);
      if (existing) {
        dispatch({ type: "activated", tabId: existing[0] });
        return { ok: true };
      }
      const openId = crypto.randomUUID();
      setOpening((o) => ({ ...o, [openId]: { name: baseName(path), progress: 0 } }));
      try {
        const encoding = opts.encoding ?? restore?.encoding;
        const info = await engine.request("open", encoding ? { path, openId, encoding } : { path, openId });
        const cache = new PageCache(async (first, count) => (await engine.request("getRows", { tabId: info.tabId, first, count })).rows);
        runtimes.current.set(info.tabId, { cache, total: info.totalRows, pathKey: key });
        dispatch({ type: "opened", info, ...(encoding ? { encodingChoice: encoding } : {}), ...(opts.index !== undefined ? { index: opts.index } : {}) });
        void detectRef.current(info.tabId);
        if (restore) {
          dispatch({ type: "follow", tabId: info.tabId, follow: restore.follow });
          dispatch({ type: "scrollRow", tabId: info.tabId, row: restore.scrollRow });
          if (restore.clearedBefore > 0) dispatch({ type: "clearedTo", tabId: info.tabId, row: restore.clearedBefore });
          if (restore.ruleSetId) dispatch({ type: "ruleSetChosen", tabId: info.tabId, ruleSetId: restore.ruleSetId });
        }
        return { ok: true };
      } catch (err) {
        return { ok: false, message: err instanceof Error ? err.message : String(err) };
      } finally {
        setOpening(({ [openId]: _done, ...rest }) => rest);
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
        if (result.ok) void window.cblLog.addRecentFile(path).catch(() => undefined);
        else setNotice({ text: `${baseName(path)} : ${result.message}`, isError: true });
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

  /** Reopens a tab with another encoding (undefined = detect again), keeping its place, position and profile. */
  const reopenWithEncoding = useCallback(
    async (tabId: TabId, encoding: Encoding | undefined) => {
      const { tabs, activeId: current } = stateRef.current;
      const index = tabs.findIndex((t) => t.info.tabId === tabId);
      const tab = tabs[index];
      if (!tab) return;
      const session = buildSession([tab], tabId === current ? tabId : undefined, viewRow.current).tabs[0]!;
      const { encoding: _previous, ...restore } = session;
      closeTab(tabId);
      const result = await openFile(tab.info.path, restore, { index, ...(encoding ? { encoding } : {}) });
      if (!result.ok) setNotice({ text: `${baseName(tab.info.path)} : ${result.message}`, isError: true });
    },
    [closeTab, openFile],
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
  // The theme starts as the system's (settings.theme === "system"); the switch then pins light or dark.
  // prefers-color-scheme follows Electron's nativeTheme, so it tells the theme in force in every case.
  const [dark, setDark] = useState(() => matchMedia("(prefers-color-scheme: dark)").matches);
  const darkRef = useRef(dark);
  darkRef.current = dark;
  useEffect(() => {
    const query = matchMedia("(prefers-color-scheme: dark)");
    const onChange = (): void => setDark(query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);
  const toggleTheme = useCallback(() => {
    setSettings((prev) => {
      const next: Settings = { ...prev, theme: darkRef.current ? "light" : "dark" };
      void window.cblLog.saveSettings(next).catch(() => undefined);
      return next;
    });
    setDark(!darkRef.current); // immediate; the media query confirms it once the main process applied it
  }, []);

  // Rules: loaded once, edited live, saved shortly after the last edit.
  const loadRulesNow = useCallback(() => {
    void window.cblLog.loadRuleSets().then(({ sets, warnings }) => {
      if (sets.length > 0) setRuleSets(sets);
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

  /** Applies `edit` to one profile now and writes it to disk shortly after the last edit. */
  const editRuleSet = useCallback((setId: string, edit: (set: RuleSet) => RuleSet) => {
    setRuleSets((prev) =>
      prev.map((set) => {
        if (set.id !== setId) return set;
        const next = edit(set);
        clearTimeout(saveTimers.current.get(setId));
        saveTimers.current.set(
          setId,
          setTimeout(() => {
            void window.cblLog
              .saveRuleSet(next)
              .catch((err: unknown) => setNotice({ text: `Règles non enregistrées : ${err instanceof Error ? err.message : String(err)}`, isError: true }));
          }, 400),
        );
        return next;
      }),
    );
  }, []);

  const createRuleSet = useCallback(
    (name: string, base: RuleSet | undefined, onCreated?: (id: string) => void) => {
      const slug = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "profil";
      let id = slug;
      for (let n = 2; ruleSets.some((s) => s.id === id); n++) id = `${slug}-${n}`;
      const created: RuleSet = { schemaVersion: 1, id, name, formats: [], rules: (base ?? createDefaultRuleSet()).rules.map((r) => ({ ...r })) };
      setRuleSets((prev) => [...prev, created]);
      void window.cblLog.saveRuleSet(created).catch(() => undefined);
      onCreated?.(id);
    },
    [ruleSets],
  );

  const searchTab = state.tabs.find((t) => t.info.tabId === state.activeId);
  const activeRuleSet = pickRuleSet(ruleSets, searchTab?.formatId, searchTab?.ruleSetId);
  const activeRules = activeRuleSet?.rules;
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
    return compileRules([...searchRule, ...(activeRules ?? [])]);
  }, [activeRules, searchQuery]);
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
        setSearchFocus((n) => n + 1);
      } else if (e.key === "F3" && activeId) {
        e.preventDefault();
        if (active?.search) void findHit(e.shiftKey ? "prev" : "next");
        else setSearchFocus((n) => n + 1);
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
  // the rules editor works on the profile in force for the active tab
  const editedSet = activeRuleSet ?? createWebSphereRuleSet();
  const profileChoice = active?.ruleSetId && ruleSets.some((s) => s.id === active.ruleSetId) ? active.ruleSetId : "auto";
  const chooseProfile = (choice: string): void => {
    if (active) dispatch({ type: "ruleSetChosen", tabId: active.info.tabId, ruleSetId: choice === "auto" ? undefined : choice });
  };
  const autoSet = autoRuleSet(ruleSets, active?.formatId);
  const activeFormat = active?.formatId ? formats.find((f) => f.format.id === active.formatId) : undefined;

  return (
    <div className="app">
      {Object.entries(opening).map(([id, o]) => (
        <div key={id} className="toast info opening" role="status">
          Ouverture de {o.name}… {Math.round(o.progress * 100)} %
        </div>
      ))}
      {notice && (
        <div className={notice.isError ? "toast" : "toast info"} role="alert" onClick={() => setNotice(undefined)}>
          {notice.text}
        </div>
      )}
      {rulesOpen && (
        <RulesEditor
          sets={ruleSets}
          selectedId={editedSet.id}
          choice={profileChoice}
          autoName={autoSet?.name || autoSet?.id || "—"}
          onChoose={chooseProfile}
          formatOptions={formats.map((f) => ({ id: f.format.id, name: f.format.name || f.format.id }))}
          onToggleFormat={(formatId) =>
            editRuleSet(editedSet.id, (set) => ({
              ...set,
              formats: set.formats.includes(formatId) ? set.formats.filter((f) => f !== formatId) : [...set.formats, formatId],
            }))
          }
          onCreate={(name) => createRuleSet(name, editedSet, (id) => chooseProfile(id))}
          rules={editedSet.rules}
          errors={compiled.errors}
          onChange={(rules) => editRuleSet(editedSet.id, (set) => ({ ...set, rules }))}
          onReset={() =>
            editRuleSet(editedSet.id, (set) => ({
              ...set,
              rules: (createBuiltinRuleSets().find((b) => b.id === set.id) ?? createDefaultRuleSet()).rules,
            }))
          }
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
          <SearchBar
            tabId={active.info.tabId}
            initial={active.search}
            status={status}
            focusRequest={searchFocus}
            onQuery={(q) => void runSearch(q)}
            onNext={() => void findHit("next")}
            onPrev={() => void findHit("prev")}
          />
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
            dark={dark}
            profiles={ruleSets.map((s) => ({ id: s.id, name: s.name }))}
            profileChoice={profileChoice}
            autoProfileName={autoSet?.name || autoSet?.id || "—"}
            onProfileChange={chooseProfile}
            formatName={activeFormat?.format.name || activeFormat?.format.id}
            level={viewLevel}
            onToggleTheme={toggleTheme}
            onEncodingChange={(encoding) => void reopenWithEncoding(active.info.tabId, encoding)}
          />
        </>
      )}
    </div>
  );
}
