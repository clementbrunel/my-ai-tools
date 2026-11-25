import "./SearchBar.css";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { SearchHistoryEntry, SearchQuery, TabId } from "@cbl-log/shared";
import type { SearchState } from "../tabs/tabs-reducer";
import { createDebouncer } from "./debounce";
import { RegexHelp } from "./RegexHelp";
import { insertAt } from "./regex-help";
import { describeSearch, validateQuery } from "./search-text";

/** Quiet time after the last keystroke before the search starts (a search over a big file is not free). */
export const SEARCH_DEBOUNCE_MS = 400;

interface Fields {
  pattern: string;
  isRegex: boolean;
  caseSensitive: boolean;
  wholeWord: boolean;
}

const fieldsOf = (search: SearchState | undefined): Fields => ({
  pattern: search?.query.pattern ?? "",
  isRegex: search?.query.isRegex ?? false,
  caseSensitive: search?.query.caseSensitive ?? false,
  wholeWord: search?.query.wholeWord ?? false,
});

interface Props {
  /** The bar belongs to the active tab: switching tabs shows that tab's own search. */
  tabId: TabId;
  /** Search already running on this tab, to restore the fields when switching tabs. */
  initial: SearchState | undefined;
  status: { matches: number; done: boolean; error?: "too-expensive" | "failed" } | undefined;
  /** Incremented to move the keyboard focus into the field (Ctrl+F). */
  focusRequest: number;
  /** Search this text now, literally (right-click menu of a line); a new `nonce` is a new request. */
  textRequest?: { text: string; nonce: number } | undefined;
  /** null = no search (field emptied). */
  onQuery(query: SearchQuery | null): void;
  onNext(): void;
  onPrev(): void;
  /** Search history, most recent first; undefined = history disabled (settings.searchHistorySize = 0). */
  history?: readonly SearchHistoryEntry[] | undefined;
  /** A search the user went through with (Enter, ↑/↓, history pick, right-click, leaving the field). */
  onRemember?: ((entry: SearchHistoryEntry) => void) | undefined;
  onClearHistory?: (() => void) | undefined;
}

/**
 * Always-visible search bar. The query is sent to the engine once typing pauses (Enter sends it at
 * once); the × empties the field and ends the search, the bar itself stays.
 */
export function SearchBar({ tabId, initial, status, focusRequest, textRequest, onQuery, onNext, onPrev, history, onRemember, onClearHistory }: Props) {
  const [fields, setFields] = useState<Fields>(() => fieldsOf(initial));
  const [typing, setTyping] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  /** History drop-down: index of the highlighted entry, undefined = closed. */
  const [historyAt, setHistoryAt] = useState<number | undefined>(undefined);
  const historyList = history ?? [];
  const inputRef = useRef<HTMLInputElement>(null);
  /** Cursor to restore once React has rendered the inserted text. */
  const pendingCursor = useRef<number | undefined>(undefined);

  // The debounced sender always uses the latest `onQuery` (it follows the active tab).
  const onQueryRef = useRef(onQuery);
  onQueryRef.current = onQuery;
  const debouncer = useMemo(
    () =>
      createDebouncer((next: Fields) => {
        setTyping(false);
        const invalid = validateQuery(next);
        onQueryRef.current(next.pattern === "" || invalid ? null : next);
      }, SEARCH_DEBOUNCE_MS),
    [],
  );
  useEffect(() => () => debouncer.cancel(), [debouncer]);

  // Another tab: drop what was being typed (it was meant for the previous tab) and show this tab's search.
  const [boundTab, setBoundTab] = useState(tabId);
  if (boundTab !== tabId) {
    setBoundTab(tabId);
    debouncer.cancel();
    setTyping(false);
    setFields(fieldsOf(initial));
  }

  // A request made before this bar appeared (or for another tab) is not replayed.
  const handledText = useRef(textRequest?.nonce);
  useEffect(() => {
    if (!textRequest || textRequest.nonce === handledText.current) return;
    handledText.current = textRequest.nonce;
    debouncer.cancel();
    const next: Fields = { pattern: textRequest.text, isRegex: false, caseSensitive: false, wholeWord: false };
    setFields(next);
    setTyping(false);
    onQueryRef.current(next);
    rememberRef.current(next);
  }, [textRequest, debouncer]);

  useEffect(() => {
    if (focusRequest === 0) return;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [focusRequest]);

  useLayoutEffect(() => {
    if (pendingCursor.current === undefined) return;
    inputRef.current?.focus();
    inputRef.current?.setSelectionRange(pendingCursor.current, pendingCursor.current);
    pendingCursor.current = undefined;
  }, [fields.pattern]);

  const remember = (f: Fields = fields): void => {
    if (f.pattern !== "" && !validateQuery(f)) onRemember?.({ ...f });
  };
  const rememberRef = useRef(remember);
  rememberRef.current = remember;

  const pickHistory = (entry: SearchHistoryEntry): void => {
    setHistoryAt(undefined);
    debouncer.cancel();
    setTyping(false);
    setFields({ ...entry });
    onQuery({ ...entry });
    remember({ ...entry });
    inputRef.current?.focus();
  };

  const update = (change: Partial<Fields>): void => {
    const next = { ...fields, ...change };
    setFields(next);
    setTyping(true);
    debouncer.call(next);
  };

  const clear = (): void => {
    debouncer.cancel();
    setTyping(false);
    setFields((f) => ({ ...f, pattern: "" }));
    onQuery(null);
    inputRef.current?.focus();
  };

  const insert = (text: string): void => {
    const input = inputRef.current;
    const done = insertAt(fields.pattern, input?.selectionStart ?? fields.pattern.length, input?.selectionEnd ?? fields.pattern.length, text);
    pendingCursor.current = done.cursor;
    update({ pattern: done.value, isRegex: true }); // everything in the help is regex syntax
  };

  const invalid = validateQuery(fields);
  const current = initial?.current;
  return (
    <div className="searchblock">
      <div className="searchbar" role="search">
        <div className={invalid ? "field invalid" : "field"}>
          <SearchIcon />
          <input
            ref={inputRef}
            value={fields.pattern}
            placeholder="Rechercher (Ctrl+F)"
            aria-label="Rechercher"
            onChange={(e) => update({ pattern: e.target.value })}
            onBlur={() => {
              setHistoryAt(undefined);
              remember();
            }}
            onKeyDown={(e) => {
              if (historyAt !== undefined) {
                if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                  e.preventDefault();
                  const n = historyList.length;
                  setHistoryAt((historyAt + (e.key === "ArrowDown" ? 1 : n - 1)) % n);
                  return;
                }
                if (e.key === "Enter" && historyList[historyAt]) {
                  e.preventDefault();
                  pickHistory(historyList[historyAt]);
                  return;
                }
                if (e.key === "Escape") {
                  e.preventDefault();
                  setHistoryAt(undefined);
                  return;
                }
              }
              if (e.key === "ArrowDown" && historyList.length > 0) {
                e.preventDefault();
                setHistoryAt(0);
              } else if (e.key === "Enter") {
                e.preventDefault();
                remember();
                if (debouncer.pending) debouncer.flush(); // the query was still being typed: search it first
                else if (e.shiftKey) onPrev();
                else onNext();
              } else if (e.key === "Escape") {
                e.preventDefault();
                if (fields.pattern !== "") clear();
                else inputRef.current?.blur();
              }
            }}
          />
          <span className={invalid || (!typing && status?.error) ? "search-count error" : "search-count"} role="status">
            {!invalid && fields.pattern !== "" && !status?.error && (typing || !status?.done) && <span className="spinner" aria-hidden="true" />}
            {typing && !invalid ? "…" : describeSearch({ pattern: fields.pattern, invalid, status, ordinal: current?.ordinal ?? null })}
          </span>
          <button type="button" className={fields.isRegex ? "opt on" : "opt"} aria-pressed={fields.isRegex} onClick={() => update({ isRegex: !fields.isRegex })} title="Expression régulière">
            .*
          </button>
          <button type="button" className={fields.caseSensitive ? "opt on" : "opt"} aria-pressed={fields.caseSensitive} onClick={() => update({ caseSensitive: !fields.caseSensitive })} title="Respecter la casse">
            Aa
          </button>
          <button type="button" className={fields.wholeWord ? "opt on" : "opt"} aria-pressed={fields.wholeWord} onClick={() => update({ wholeWord: !fields.wholeWord })} title="Mot entier : ERROR ne trouve pas ERRORS ni MYERROR">
            <u>ab</u>
          </button>
          <span className="field-sep" aria-hidden="true" />
          {history && (
            <button
              type="button"
              className={historyAt !== undefined ? "opt on" : "opt"}
              disabled={historyList.length === 0}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                setHistoryAt(historyAt === undefined ? 0 : undefined);
                inputRef.current?.focus();
              }}
              title={historyList.length === 0 ? "Historique des recherches (vide)" : "Historique des recherches (flèche bas)"}
              aria-label="Historique des recherches"
              aria-expanded={historyAt !== undefined}
            >
              <ClockIcon />
            </button>
          )}
          <button
            type="button"
            className="opt"
            onClick={() => {
              remember();
              onPrev();
            }}
            title="Précédent (Maj+F3)"
            aria-label="Précédent"
          >
            ↑
          </button>
          <button
            type="button"
            className="opt"
            onClick={() => {
              remember();
              onNext();
            }}
            title="Suivant (F3)"
            aria-label="Suivant"
          >
            ↓
          </button>
          <button type="button" className="opt" onClick={clear} disabled={fields.pattern === ""} title="Vider la recherche (Échap)" aria-label="Vider la recherche">
            ×
          </button>
        </div>
        <button type="button" className={helpOpen ? "help-toggle on" : "help-toggle"} onClick={() => setHelpOpen((v) => !v)} title="Aide à la saisie des expressions régulières" aria-label="Aide à la saisie" aria-expanded={helpOpen}>
          ?
        </button>
        {historyAt !== undefined && historyList.length > 0 && (
          <ul className="search-history" role="listbox" aria-label="Historique des recherches" onMouseDown={(e) => e.preventDefault()}>
            {historyList.map((entry, i) => (
              <li
                key={i}
                role="option"
                aria-selected={i === historyAt}
                className={i === historyAt ? "on" : undefined}
                onMouseEnter={() => setHistoryAt(i)}
                onClick={() => pickHistory(entry)}
              >
                <span className="search-history-pattern">{entry.pattern}</span>
                <span className="search-history-opts">
                  {entry.isRegex && <span title="Expression régulière">.*</span>}
                  {entry.caseSensitive && <span title="Respecter la casse">Aa</span>}
                  {entry.wholeWord && (
                    <span title="Mot entier">
                      <u>ab</u>
                    </span>
                  )}
                </span>
              </li>
            ))}
            {onClearHistory && (
              <li
                className="search-history-clear"
                onClick={() => {
                  setHistoryAt(undefined);
                  onClearHistory();
                }}
              >
                Effacer l'historique
              </li>
            )}
          </ul>
        )}
      </div>
      {helpOpen && (
        <RegexHelp
          pattern={fields.pattern}
          isRegex={fields.isRegex}
          onInsert={insert}
          onPreset={(p) => {
            pendingCursor.current = p.length;
            update({ pattern: p, isRegex: true });
          }}
          onEnableRegex={() => update({ isRegex: true })}
        />
      )}
    </div>
  );
}

function ClockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" aria-hidden="true">
      <circle cx="8" cy="8" r="6" />
      <path d="M8 4.5V8l2.5 1.5" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg className="field-icon" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
      <circle cx="7" cy="7" r="4.5" />
      <path d="M10.5 10.5 14 14" />
    </svg>
  );
}
