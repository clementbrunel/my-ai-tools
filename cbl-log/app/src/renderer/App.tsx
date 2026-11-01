import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import {
  BUILTIN_FORMATS,
  DETECT_SAMPLE_LINES,
  compileFormat,
  createBuiltinRuleSets,
  createDefaultRuleSet,
  createWebSphereRuleSet,
  defaultFilterSettings,
  defaultSettings,
  dockerUri,
  detectFormat,
  formatForFilter,
  parseDockerUri,
  toLineFilter,
  type CompiledFormat,
  type DockerListResult,
  type Encoding,
  type FilterSettings,
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
import { DockerPanel } from "./docker/DockerPanel";
import { dockerStatusText } from "./docker/docker-panel";
import { FeedbackPanel } from "./feedback/FeedbackPanel";
import { FilterBar } from "./filter/FilterBar";
import { LevelPills } from "./filter/LevelPills";
import { nextVisibleHit } from "./filter/filter-nav";
import { compileRules, highlightLine } from "./highlight/highlight";
import { RulesEditor } from "./rules/RulesEditor";
import { autoRuleSet, importAsCopy, importKind, pickRuleSet, uniqueRuleSetId, withRuleSet } from "./rules/rule-profile";
import { buildSession } from "./session/session-snapshot";
import { StatusBar } from "./tabs/StatusBar";
import { TabBar } from "./tabs/TabBar";
import { filterStatus, initialTabsState, searchStatus, tabsReducer, type TabState } from "./tabs/tabs-reducer";
import { SearchBar } from "./search/SearchBar";
import { LogViewport } from "./viewer/LogViewport";
import { PageCache } from "./viewer/page-cache";

interface TabRuntime {
  cache: PageCache;
  /** Row count last seen, to know from where the cache is outdated when rows are appended. */
  total: number;
  pathKey: string;
  /** Pages of the filtered view in force (one per filter: positions mean nothing across filters). */
  filterCache?: PageCache;
  filterCacheId?: string;
  /** Lines available in the filtered view when the cache was last told about them. */
  filterTotal: number;
}

const LEVELS_COUNT = 6;
const NO_MARKS: never[] = [];

/** Identifies what the viewport shows: a tab's file, or its filtered view (its remount key). */
const viewKeyOf = (tabId: TabId, filterId: string | null | undefined): string => `${tabId}:${filterId ?? ""}`;

/** A filtered view is the one on screen: a filter (maybe only the fold of stack traces) is in force and answered. */
function isFilteredNow(tab: TabState | undefined, rt: TabRuntime | undefined): boolean {
  return !!tab?.filterId && !!rt?.filterCache && rt.filterCacheId === tab.filterId;
}

/** The filter reads the current file only: the last rolling is where its view begins. */
function filteredMarks(marks: TabState["marks"]): TabState["marks"] {
  const last = marks[marks.length - 1];
  return last ? [{ ...last, row: 0 }] : NO_MARKS;
}
const ignoreLeave = (): void => {};

export function App() {
  const [state, dispatch] = useReducer(tabsReducer, initialTabsState);
  const stateRef = useRef(state);
  stateRef.current = state;
  /** Files being opened (initial indexing in progress), by open id; progress is 0..1. */
  const [opening, setOpening] = useState<Record<string, { name: string; progress: number }>>({});
  const [notice, setNotice] = useState<{ text: string; isError: boolean } | undefined>();
  const [ruleSets, setRuleSets] = useState<RuleSet[]>(createBuiltinRuleSets);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  /** Docker side panel: shown or not, and the last container list of the engine. */
  const [dockerOpen, setDockerOpen] = useState(false);
  const [dockerList, setDockerList] = useState<DockerListResult | undefined>();
  /** Docker tabs whose history is being extended. */
  const [loadingMore, setLoadingMore] = useState<ReadonlySet<TabId>>(new Set());
  const [userFormats, setUserFormats] = useState<LogFormat[]>([]);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const detecting = useRef(new Set<TabId>());
  const sessionReady = useRef(false);
  /** Last session written (or loaded): reopened if the engine process restarts. */
  const lastSessionObj = useRef<Session | undefined>(undefined);
  const restoreRef = useRef<(session: Session) => Promise<void>>(async () => {});
  /** Incremented by Ctrl+F: the search field takes the focus. */
  const [searchFocus, setSearchFocus] = useState(0);
  /** Incremented by Ctrl+Maj+F: the filter field takes the focus. */
  const [filterFocus, setFilterFocus] = useState(0);
  /** Scroll request for the view called `forKey` (a request meant for another view is ignored). */
  const [reveal, setReveal] = useState<{ row: number; nonce: number; align?: "center" | "top"; forKey: string } | undefined>();
  const revealNonce = useRef(0);
  const viewRow = useRef(0);
  /** First visible position of the filtered view (not a line number: see topLine). */
  const filteredViewRow = useRef(0);
  /** Line shown "in context" (double-click in the filtered view), outlined in the full view. */
  const [anchor, setAnchor] = useState<{ tabId: TabId; line: number } | undefined>();
  /** Rows of the filtered view hidden by "clear" (retained lines before the cleared origin). */
  const [filterBase, setFilterBase] = useState(0);
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
    for (const rt of runtimes.current.values()) {
      rt.cache.clear();
      rt.filterCache?.clear();
    }
    runtimes.current.clear();
    appliedFilters.current.clear();
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
            // the filter starts over on the new file: nothing of its view can be trusted
            rt.filterCache?.invalidateFrom(0);
            rt.filterTotal = 0;
          } else if (event.type === "filter" && rt.filterCache && rt.filterCacheId === event.id) {
            // the view only grows at its end, unless the filter started over
            rt.filterCache.invalidateFrom(event.matches < rt.filterTotal ? 0 : Math.max(0, rt.filterTotal - 1));
            rt.filterTotal = event.matches;
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

  // Docker: the engine lists the containers and pushes every change, as long as the feature is enabled.
  const dockerEnabled = settings.docker.enabled;
  useEffect(() => {
    if (!dockerEnabled) {
      setDockerList(undefined);
      return;
    }
    let offList: (() => void) | undefined;
    const offSubscribe = subscribeEngine((engine) => {
      offList?.();
      offList = engine.onDockerContainers(setDockerList);
      engine.request("dockerSubscribe", {}).then(setDockerList, (err: unknown) => setDockerList({ status: "unavailable", error: err instanceof Error ? err.message : String(err), containers: [] }));
    });
    return () => {
      offList?.();
      offSubscribe();
    };
  }, [dockerEnabled]);

  /**
   * Opens one file in a tab (or activates its tab); `restore` re-applies a saved session position.
   * The encoding is forced when `opts.encoding` (or the restored tab) says so, else detected by the engine.
   */
  const openFile = useCallback(
    async (path: string, restore?: SessionTab, opts: { encoding?: Encoding; index?: number } = {}): Promise<{ ok: true } | { ok: false; message: string }> => {
      const engine = await withEngine();
      const key = pathKey(path);
      const docker = parseDockerUri(path);
      const existing = [...runtimes.current.entries()].find(([, rt]) => rt.pathKey === key);
      if (existing) {
        dispatch({ type: "activated", tabId: existing[0] });
        return { ok: true };
      }
      const openId = crypto.randomUUID();
      setOpening((o) => ({ ...o, [openId]: { name: docker?.name ?? baseName(path), progress: 0 } }));
      try {
        const encoding = docker ? undefined : (opts.encoding ?? restore?.encoding);
        const info = await engine.request(
          "open",
          docker
            ? { docker: { ...docker, initialTail: settingsRef.current.docker.initialTail }, openId }
            : encoding
              ? { path, openId, encoding }
              : { path, openId },
        );
        const cache = new PageCache(async (first, count) => (await engine.request("getRows", { tabId: info.tabId, first, count })).rows);
        runtimes.current.set(info.tabId, { cache, total: info.totalRows, pathKey: key, filterTotal: 0 });
        dispatch({ type: "opened", info, ...(docker ? { docker } : {}), ...(encoding ? { encodingChoice: encoding } : {}), ...(opts.index !== undefined ? { index: opts.index } : {}) });
        void detectRef.current(info.tabId);
        if (restore) {
          dispatch({ type: "follow", tabId: info.tabId, follow: restore.follow });
          dispatch({ type: "scrollRow", tabId: info.tabId, row: restore.scrollRow });
          if (restore.clearedBefore > 0) dispatch({ type: "clearedTo", tabId: info.tabId, row: restore.clearedBefore });
          if (restore.customName) dispatch({ type: "renamed", tabId: info.tabId, name: restore.customName });
          if (restore.ruleSetId) dispatch({ type: "ruleSetChosen", tabId: info.tabId, ruleSetId: restore.ruleSetId });
          if (restore.filter) dispatch({ type: "filterChanged", tabId: info.tabId, filter: restore.filter });
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

  /**
   * Sends the filter of a tab to the engine when it differs from the one in force there. The levels
   * need the format: while it is not known yet, a filter restricting levels waits for it.
   */
  const appliedFilters = useRef(new Map<TabId, string>());
  const filterSeq = useRef(0);
  /** Where the next view change must land (double-click "in context"), instead of the current position. */
  const pendingShow = useRef<{ tabId: TabId; line: number; align: "center" | "top" } | undefined>(undefined);

  /** Where line `row` falls in the filtered view; waits (a few seconds at most) until the scan covers it. */
  const locate = useCallback(
    async (tabId: TabId, filterId: string, row: number, wait: boolean) => {
      const engine = await withEngine();
      for (let attempt = 0; ; attempt++) {
        const where = await engine.request("filterLocate", { tabId, filterId, row });
        if (where.covered || !wait || attempt >= 40) return where;
        await new Promise((resolve) => setTimeout(resolve, 120));
      }
    },
    [withEngine],
  );

  /** Line number of the first visible row of the tab's view, if it is known (rows loaded). */
  const topLine = useCallback((tabId: TabId): number | undefined => {
    const tab = stateRef.current.tabs.find((t) => t.info.tabId === tabId);
    const rt = runtimes.current.get(tabId);
    if (tab && isFilteredNow(tab, rt)) return rt?.filterCache?.getRow(filteredViewRow.current)?.lineNo;
    return viewRow.current;
  }, []);

  /** Puts a view at a position once it exists (follow mode keeps the end in view by itself). */
  const showAt = useCallback((tabId: TabId, filterId: string | null, row: number, align: "center" | "top") => {
    if (stateRef.current.tabs.find((t) => t.info.tabId === tabId)?.follow) return;
    setReveal({ row, nonce: ++revealNonce.current, align, forKey: viewKeyOf(tabId, filterId) });
  }, []);
  const applyFilter = useCallback(
    async (tab: TabState) => {
      const tabId = tab.info.tabId;
      // "Full file" lifts the levels and the text filters, but keeps the fold of stack traces as chosen
      const settings = tab.filterSuspended ? { ...defaultFilterSettings(), foldTraces: tab.filter.foldTraces } : tab.filter;
      if (tab.formatId === undefined && (settings.levels.length < LEVELS_COUNT || settings.foldTraces)) return;
      const format = tab.formatId ? formatsRef.current.find((f) => f.format.id === tab.formatId)?.format : undefined;
      const filter = toLineFilter(settings, !!format, format?.continuation === "not-line");
      // the engine takes the level of each kept row from the format, so any active filter carries it
      const engineFormat = formatForFilter(filter, format);
      const key = JSON.stringify([filter, engineFormat]);
      const previous = appliedFilters.current.get(tabId);
      if (previous === key || (previous === undefined && filter === null)) {
        appliedFilters.current.set(tabId, key); // a fresh tab without filter: nothing to undo in the engine
        return;
      }
      appliedFilters.current.set(tabId, key);
      const seq = ++filterSeq.current;
      const target = pendingShow.current?.tabId === tabId ? pendingShow.current : undefined;
      pendingShow.current = undefined;
      const keepLine = target?.line ?? topLine(tabId); // the view changes, the reader stays where they are
      const align = target?.align ?? "top";
      try {
        const engine = await withEngine();
        const { filterId } = await engine.request("setFilter", { tabId, filter, format: engineFormat });
        const rt = runtimes.current.get(tabId);
        if (!rt || seq !== filterSeq.current) return;
        if (filterId) {
          rt.filterCache?.clear();
          rt.filterCache = new PageCache(async (first, count) => (await engine.request("getRows", { tabId, first, count, filterId })).rows, undefined, true);
          rt.filterCacheId = filterId;
          rt.filterTotal = 0;
        } else {
          rt.filterCache?.clear();
          rt.filterCache = undefined;
          rt.filterCacheId = undefined;
        }
        dispatch({ type: "filterApplied", tabId, filterId });
        if (keepLine !== undefined) {
          if (filterId) {
            // keeping the position is a comfort: the filter is applied whatever happens to it
            const where = await locate(tabId, filterId, keepLine, true).catch(() => undefined);
            if (where && seq === filterSeq.current) showAt(tabId, filterId, where.position, align);
          } else {
            showAt(tabId, null, keepLine, align);
          }
        }
      } catch (err) {
        appliedFilters.current.delete(tabId);
        setNotice({ text: `Filtre : ${err instanceof Error ? err.message : String(err)}`, isError: true });
      }
    },
    [withEngine, topLine, locate, showAt],
  );

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
      rt?.filterCache?.clear();
      appliedFilters.current.delete(tabId);
      runtimes.current.delete(tabId);
      dispatch({ type: "closed", tabId });
      void withEngine().then((engine) => engine.request("close", { tabId }).catch(() => undefined));
    },
    [withEngine],
  );

  /** Opens containers of the panel (by name) in tabs. */
  const openContainers = useCallback(
    async (names: string[]) => {
      const context = dockerList?.context ?? "default";
      for (const name of names) {
        const uri = dockerUri({ context, name });
        const result = await openFile(uri);
        if (result.ok) void window.cblLog.addRecentFile(uri).catch(() => undefined);
        else setNotice({ text: `${name} : ${result.message}`, isError: true });
      }
    },
    [dockerList?.context, openFile],
  );

  /** "Charger plus d'historique": the engine rebuilds the spool with 10x more lines; the view stays on its line. */
  const loadMoreHistory = useCallback(
    async (tabId: TabId) => {
      const tab = stateRef.current.tabs.find((t) => t.info.tabId === tabId);
      if (!tab?.docker) return;
      setLoadingMore((s) => new Set(s).add(tabId));
      try {
        const engine = await withEngine();
        const tail = Math.max(settingsRef.current.docker.initialTail, tab.total) * 10;
        const result = await engine.request("dockerLoadMore", { tabId, tail });
        const rt = runtimes.current.get(tabId);
        if (rt) {
          rt.cache.invalidateFrom(0);
          rt.total = result.totalRows;
          rt.filterCache?.invalidateFrom(0);
          rt.filterTotal = 0;
        }
        dispatch({ type: "reloaded", tabId, total: result.totalRows, addedBefore: result.addedBefore });
        if (stateRef.current.activeId === tabId && !tab.follow && !isFilteredNow(tab, rt)) {
          setReveal({ row: viewRow.current + result.addedBefore, nonce: ++revealNonce.current, align: "top", forKey: viewKeyOf(tabId, null) });
        }
        setNotice({ text: result.addedBefore > 0 ? `${result.addedBefore.toLocaleString("fr-FR")} ligne(s) d'historique ajoutée(s).` : "Tout l'historique disponible est déjà chargé.", isError: false });
      } catch (err) {
        setNotice({ text: `Historique : ${err instanceof Error ? err.message : String(err)}`, isError: true });
      } finally {
        setLoadingMore((s) => {
          const next = new Set(s);
          next.delete(tabId);
          return next;
        });
      }
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
  useEffect(() => window.cblLog.onOpenFeedback(() => setFeedbackOpen(true)), []);

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
      const id = uniqueRuleSetId(ruleSets, name);
      const created: RuleSet = { schemaVersion: 1, id, name, formats: [], rules: (base ?? createDefaultRuleSet()).rules.map((r) => ({ ...r })) };
      setRuleSets((prev) => [...prev, created]);
      void window.cblLog.saveRuleSet(created).catch(() => undefined);
      onCreated?.(id);
    },
    [ruleSets],
  );

  /** Writes a profile to a file of the user's choice, to send it to colleagues. */
  const exportRuleSet = useCallback((set: RuleSet) => {
    window.cblLog
      .exportRuleSet(set)
      .then((path) => path && setNotice({ text: `Profil « ${set.name || set.id} » exporté : ${path}`, isError: false }))
      .catch((err: unknown) => setNotice({ text: `Export impossible : ${err instanceof Error ? err.message : String(err)}`, isError: true }));
  }, []);

  /** Reads a profile shared by a colleague, stores it and applies it to the displayed tab. */
  const importRuleSet = useCallback(
    (onImported: (id: string) => void) => {
      void window.cblLog.importRuleSet().then((result) => {
        if (!result) return;
        if (!result.ok) {
          setNotice({ text: `Profil non importé : ${result.error}`, isError: true });
          return;
        }
        let set = result.value;
        const kind = importKind(ruleSets, set);
        if (kind === "same") {
          setNotice({ text: `Le profil « ${set.name || set.id} » est déjà à jour.`, isError: false });
          onImported(set.id);
          return;
        }
        if (kind === "conflict") {
          const existing = ruleSets.find((s) => s.id === set.id);
          const replace = window.confirm(
            `Un profil « ${existing?.name || set.id} » existe déjà.\n\nOK : le remplacer par celui du fichier.\nAnnuler : garder les deux (le profil importé est ajouté sous un autre nom).`,
          );
          if (replace) clearTimeout(saveTimers.current.get(set.id)); // a pending save of the old rules must not undo the import
          else set = importAsCopy(ruleSets, set);
        }
        setRuleSets((prev) => withRuleSet(prev, set));
        window.cblLog
          .saveRuleSet(set)
          .then(() => setNotice({ text: `Profil « ${set.name || set.id} » importé.`, isError: false }))
          .catch((err: unknown) => setNotice({ text: `Profil importé mais non enregistré : ${err instanceof Error ? err.message : String(err)}`, isError: true }));
        onImported(set.id);
      });
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
      const tabId = tab.info.tabId;
      const top = topLine(tabId) ?? 0;
      const from = tab.search?.current?.row ?? (dir === "next" ? top - 1 : top);
      try {
        const engine = await withEngine();
        if (isFilteredNow(tab, runtimes.current.get(tabId))) {
          // the search covers the whole file: hits on lines the filter hides are skipped
          const filterId = tab.filterId!;
          const found = await nextVisibleHit(
            (fromRow, d) => engine.request("searchNext", { tabId, searchId, fromRow, dir: d }),
            (row) => engine.request("filterLocate", { tabId, filterId, row }),
            from,
            dir,
          );
          if (!found) {
            setNotice({ text: "Aucune occurrence dans les lignes affichées par le filtre.", isError: false });
            return;
          }
          if (tab.pausedAt?.matches !== undefined && found.position >= tab.pausedAt.matches) dispatch({ type: "resumed", tabId });
          dispatch({ type: "searchHit", tabId, row: found.hit.row!, ordinal: found.hit.ordinal });
          setReveal({ row: found.position, nonce: ++revealNonce.current, forKey: viewKeyOf(tabId, filterId) });
          return;
        }
        const hit = await engine.request("searchNext", { tabId, searchId, fromRow: from, dir });
        if (hit.row === null) return;
        if (hit.row < tab.clearedBefore) dispatch({ type: "unclear", tabId });
        if (tab.pausedAt && hit.row >= tab.pausedAt.total) dispatch({ type: "resumed", tabId });
        dispatch({ type: "searchHit", tabId, row: hit.row, ordinal: hit.ordinal });
        setReveal({ row: hit.row, nonce: ++revealNonce.current, forKey: viewKeyOf(tabId, null) });
      } catch (err) {
        setNotice({ text: `Recherche : ${err instanceof Error ? err.message : String(err)}`, isError: true });
      }
    },
    [active, withEngine, topLine],
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
      } else if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "d" && settingsRef.current.docker.enabled) {
        e.preventDefault();
        setDockerOpen((o) => !o);
      } else if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "f" && activeId) {
        e.preventDefault();
        setFilterFocus((n) => n + 1);
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
      } else if (e.key === "Pause" && activeId) {
        e.preventDefault();
        togglePauseRef.current();
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
  // While the view is frozen, what the viewport reports about following means nothing (it sees a
  // short, finished file): the choice made before the pause comes back on resume.
  const activePaused = !!state.tabs.find((t) => t.info.tabId === activeId)?.pausedAt;
  const onViewFollowChange = useCallback(
    (follow: boolean) => {
      if (!activePaused) onFollowChange(follow);
    },
    [activePaused, onFollowChange],
  );
  const togglePauseRef = useRef<() => void>(() => {});
  const onLeave = useCallback(
    (row: number) => {
      if (activeId) dispatch({ type: "scrollRow", tabId: activeId, row });
    },
    [activeId],
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
  // The filtered view is shown once the engine has answered with the filter in force.
  const filterProgress = active ? filterStatus(active) : undefined;
  const filterCache = active?.filterId ? runtime?.filterCache : undefined;
  const filtered = isFilteredNow(active, runtime);
  // Copy reads rows the way the viewport shows them: through the filter only while it is in force.
  const copyFilterId = filtered ? active?.filterId : undefined;
  const fetchRows = useCallback(
    async (first: number, count: number): Promise<Row[]> => {
      if (!activeId) return [];
      const engine = await withEngine();
      return (await engine.request("getRows", { tabId: activeId, first, count, ...(copyFilterId ? { filterId: copyFilterId } : {}) })).rows;
    },
    [activeId, copyFilterId, withEngine],
  );
  const pausedAt = active?.pausedAt;
  // Frozen view: the viewport keeps the row counts of the moment of the pause.
  const shownFileRows = pausedAt ? Math.min(active!.total, pausedAt.total) : (active?.total ?? 0);
  const shownMatches = pausedAt?.matches !== undefined ? Math.min(filterProgress?.matches ?? 0, pausedAt.matches) : (filterProgress?.matches ?? 0);
  const pendingLines = pausedAt ? Math.max(0, filtered && pausedAt.matches !== undefined ? (filterProgress?.matches ?? 0) - pausedAt.matches : active!.total - pausedAt.total) : undefined;
  togglePauseRef.current = () => {
    if (!active) return;
    if (active.pausedAt) dispatch({ type: "resumed", tabId: active.info.tabId });
    else dispatch({ type: "paused", tabId: active.info.tabId, total: active.total, ...(filtered ? { matches: filterProgress?.matches ?? 0 } : {}) });
  };
  const currentViewKey = active ? viewKeyOf(active.info.tabId, filtered ? active.filterId : null) : "";

  // "Clear" in the filtered view hides the retained lines before the cleared origin.
  const clearedBefore = active?.clearedBefore ?? 0;
  useEffect(() => {
    if (!filtered || !active || clearedBefore === 0 || !active.filterId) {
      setFilterBase(0);
      return;
    }
    let live = true;
    void locate(active.info.tabId, active.filterId, clearedBefore, false)
      .then((where) => live && setFilterBase(where.position))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [filtered, active?.info.tabId, active?.filterId, clearedBefore, filterProgress?.matches, locate]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Switches between the filtered view and the full file (the engine filter follows, the position is kept). */
  const toggleFilterView = useCallback(() => {
    if (!active) return;
    setAnchor(undefined);
    dispatch({ type: "filterSuspended", tabId: active.info.tabId, suspended: !active.filterSuspended });
  }, [active]);

  /** Double-click on a line of the filtered view: the full file around it, the filter kept for later. */
  const showInContext = useCallback(
    (row: Row) => {
      if (!active) return;
      const tabId = active.info.tabId;
      pendingShow.current = { tabId, line: row.lineNo, align: "center" };
      dispatch({ type: "follow", tabId, follow: false });
      dispatch({ type: "filterSuspended", tabId, suspended: true });
      setAnchor({ tabId, line: row.lineNo });
    },
    [active],
  );

  /** Ctrl+G in the filtered view: the line number is the file's, the view goes to the nearest retained line. */
  const gotoFileLine = useCallback(
    async (line: number) => {
      if (!active?.filterId) return;
      try {
        const where = await locate(active.info.tabId, active.filterId, line - 1, true);
        setReveal({ row: where.position, nonce: ++revealNonce.current, align: "top", forKey: viewKeyOf(active.info.tabId, active.filterId) });
      } catch (err) {
        setNotice({ text: `Aller à la ligne : ${err instanceof Error ? err.message : String(err)}`, isError: true });
      }
    },
    [active, locate],
  );

  // Send the filter of the active tab to the engine whenever it (or what it depends on) changes.
  const activeTab = active;
  useEffect(() => {
    if (activeTab) void applyFilter(activeTab);
  }, [activeTab?.info.tabId, activeTab?.filter, activeTab?.filterSuspended, activeTab?.formatId, formats, applyFilter]); // eslint-disable-line react-hooks/exhaustive-deps
  const onFilterChange = useCallback(
    (filter: FilterSettings) => {
      if (activeId) dispatch({ type: "filterChanged", tabId: activeId, filter });
    },
    [activeId],
  );

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
          onExport={() => exportRuleSet(editedSet)}
          onImport={() => importRuleSet((id) => chooseProfile(id))}
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
      {feedbackOpen && (
        <FeedbackPanel onClose={() => setFeedbackOpen(false)} onNotice={(text, isError) => setNotice({ text, isError })} />
      )}
      <div className="workspace">
      {dockerEnabled && dockerOpen && (
        <DockerPanel list={dockerList} openNames={new Set(state.tabs.flatMap((t) => (t.docker ? [t.docker.name] : [])))} onOpen={(names) => void openContainers(names)} onClose={() => setDockerOpen(false)} />
      )}
      <div className="main">
      {!active || !runtime ? (
        <main className="placeholder">
          <h1>cbl-log</h1>
          <p>Glissez un fichier ou Ctrl+O</p>
          <button type="button" onClick={() => void window.cblLog.openFileDialog().then(openPaths)}>
            Ouvrir…
          </button>
          {dockerEnabled && !dockerOpen && (
            <button type="button" onClick={() => setDockerOpen(true)}>
              Conteneurs Docker…
            </button>
          )}
        </main>
      ) : (
        <>
          <TabBar
            tabs={state.tabs}
            activeId={activeId}
            onActivate={(tabId) => dispatch({ type: "activated", tabId })}
            onClose={closeTab}
            onRename={(tabId, name) => dispatch({ type: "renamed", tabId, name })}
            onOpen={() => void window.cblLog.openFileDialog().then(openPaths)}
            docker={dockerEnabled ? { open: dockerOpen, onToggle: () => setDockerOpen((o) => !o) } : undefined}
          />
          <div className="toprow">
            <SearchBar
              tabId={active.info.tabId}
              initial={active.search}
              status={status}
              focusRequest={searchFocus}
              onQuery={(q) => void runSearch(q)}
              onNext={() => void findHit("next")}
              onPrev={() => void findHit("prev")}
            />
            <FilterBar settings={active.filter} onChange={onFilterChange} focusRequest={filterFocus} error={filterProgress?.error} />
            <LevelPills filter={active.filter} enabled={!!activeFormat} onChange={onFilterChange} />
          </div>
          {active.state !== "following" && !(active.docker && active.state === "stopped") && (
            <div className={`banner banner-${active.state}`} role="status">
              {active.docker
                ? (active.message ?? (active.state === "waiting" ? "En attente de Docker…" : "Erreur de lecture du conteneur."))
                : active.state === "missing"
                  ? "Fichier absent, en attente…"
                  : active.message ?? "Erreur de lecture du fichier."}
            </div>
          )}
          <LogViewport
            key={currentViewKey}
            cache={filtered && filterCache ? filterCache : runtime.cache}
            total={filtered ? shownMatches : shownFileRows}
            base={filtered ? filterBase : active.clearedBefore}
            marks={filtered ? filteredMarks(active.marks) : active.marks}
            highlight={highlight}
            format={activeFormat}
            filtered={filtered}
            reveal={reveal?.forKey === currentViewKey ? reveal : undefined}
            currentMatchRow={active.search?.current?.row}
            anchorLine={anchor?.tabId === active.info.tabId && (!filtered || active.filterSuspended) ? anchor.line : undefined}
            onRowDoubleClick={filtered && !active.filterSuspended ? showInContext : undefined}
            onGotoLine={filtered ? (line) => void gotoFileLine(line) : undefined}
            fileRows={active.total}
            viewRowRef={filtered ? filteredViewRow : viewRow}
            fetchRows={fetchRows}
            onNotice={onNotice}
            follow={active.follow && !pausedAt}
            initialRow={filtered ? 0 : active.scrollRow}
            onFollowChange={onViewFollowChange}
            onLeave={filtered ? ignoreLeave : onLeave}
          />
          <StatusBar
            tab={active}
            onToggleFollow={() => {
              if (active.pausedAt) dispatch({ type: "resumed", tabId: active.info.tabId });
              onFollowChange(active.pausedAt ? true : !active.follow);
            }}
            pendingLines={pendingLines}
            onTogglePause={() => togglePauseRef.current()}
            onClear={() => dispatch({ type: "clear", tabId: active.info.tabId })}
            onUnclear={() => dispatch({ type: "unclear", tabId: active.info.tabId })}
            onEditRules={() => setRulesOpen(true)}
            dark={dark}
            profiles={ruleSets.map((s) => ({ id: s.id, name: s.name }))}
            profileChoice={profileChoice}
            autoProfileName={autoSet?.name || autoSet?.id || "—"}
            onProfileChange={chooseProfile}
            formatName={activeFormat?.format.name || activeFormat?.format.id}
            onToggleTheme={toggleTheme}
            onEncodingChange={(encoding) => void reopenWithEncoding(active.info.tabId, encoding)}
            canFoldTraces={activeFormat?.format.continuation === "not-line"}
            onFilterChange={onFilterChange}
            filterSuspended={!!active.filterSuspended}
            hasFilter={toLineFilter(active.filter, !!activeFormat, activeFormat?.format.continuation === "not-line") !== null}
            onToggleFilterView={toggleFilterView}
            docker={
              active.docker
                ? {
                    status: dockerStatusText(active.state, dockerList?.containers.find((c) => c.name === active.docker?.name)),
                    loading: loadingMore.has(active.info.tabId),
                    onLoadMore: () => void loadMoreHistory(active.info.tabId),
                  }
                : undefined
            }
            filterShown={filtered && filterProgress ? { matches: filterProgress.matches, done: filterProgress.done } : undefined}
          />
        </>
      )}
      </div>
      </div>
    </div>
  );
}
