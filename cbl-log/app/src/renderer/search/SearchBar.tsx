import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { SearchQuery, TabId } from "@cbl-log/shared";
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
  /** null = no search (field emptied). */
  onQuery(query: SearchQuery | null): void;
  onNext(): void;
  onPrev(): void;
}

/**
 * Always-visible search bar. The query is sent to the engine once typing pauses (Enter sends it at
 * once); the × empties the field and ends the search, the bar itself stays.
 */
export function SearchBar({ tabId, initial, status, focusRequest, onQuery, onNext, onPrev }: Props) {
  const [fields, setFields] = useState<Fields>(() => fieldsOf(initial));
  const [typing, setTyping] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
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
        <input
          ref={inputRef}
          className={invalid ? "invalid" : ""}
          value={fields.pattern}
          placeholder="Rechercher (Ctrl+F)"
          aria-label="Rechercher"
          onChange={(e) => update({ pattern: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
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
        <label title="Expression régulière">
          <input type="checkbox" checked={fields.isRegex} onChange={(e) => update({ isRegex: e.target.checked })} /> .*
        </label>
        <label title="Respecter la casse">
          <input type="checkbox" checked={fields.caseSensitive} onChange={(e) => update({ caseSensitive: e.target.checked })} /> Aa
        </label>
        <label title="Mot entier : ERROR ne trouve pas ERRORS ni MYERROR">
          <input type="checkbox" checked={fields.wholeWord} onChange={(e) => update({ wholeWord: e.target.checked })} /> Mot
        </label>
        <button type="button" className={helpOpen ? "help-toggle on" : "help-toggle"} onClick={() => setHelpOpen((v) => !v)} title="Aide à la saisie des expressions régulières" aria-label="Aide à la saisie" aria-expanded={helpOpen}>
          ?
        </button>
        <button type="button" onClick={onPrev} title="Précédent (Maj+F3)" aria-label="Précédent">
          ↑
        </button>
        <button type="button" onClick={onNext} title="Suivant (F3)" aria-label="Suivant">
          ↓
        </button>
        <span className={invalid || (!typing && status?.error) ? "search-count error" : "search-count"} role="status">
          {typing && !invalid ? "…" : describeSearch({ pattern: fields.pattern, invalid, status, ordinal: current?.ordinal ?? null })}
        </span>
        <button type="button" onClick={clear} disabled={fields.pattern === ""} title="Vider la recherche (Échap)" aria-label="Vider la recherche">
          ×
        </button>
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
