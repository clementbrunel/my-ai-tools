import { useEffect, useRef, useState } from "react";
import type { SearchQuery } from "@cbl-log/shared";
import type { SearchState } from "../tabs/tabs-reducer";
import { describeSearch, validateQuery } from "./search-text";

export const SEARCH_DEBOUNCE_MS = 150;

interface Props {
  /** Search already running on this tab, to restore the fields when switching tabs. */
  initial: SearchState | undefined;
  status: { matches: number; done: boolean; error?: "too-expensive" | "failed" } | undefined;
  onQuery(query: SearchQuery | null): void;
  onNext(): void;
  onPrev(): void;
  onClose(): void;
}

/** Ctrl+F bar: the query is sent to the engine 150 ms after the last keystroke. */
export function SearchBar({ initial, status, onQuery, onNext, onPrev, onClose }: Props) {
  const [pattern, setPattern] = useState(initial?.query.pattern ?? "");
  const [isRegex, setIsRegex] = useState(initial?.query.isRegex ?? false);
  const [caseSensitive, setCaseSensitive] = useState(initial?.query.caseSensitive ?? false);
  const inputRef = useRef<HTMLInputElement>(null);
  const first = useRef(true);
  const invalid = validateQuery({ pattern, isRegex, caseSensitive });

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      if (initial) return; // restoring a tab: the search is already running
    }
    const timer = setTimeout(() => {
      if (pattern === "" || invalid) onQuery(null);
      else onQuery({ pattern, isRegex, caseSensitive });
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pattern, isRegex, caseSensitive]);

  const current = initial?.current;
  return (
    <div className="searchbar" role="search">
      <input
        ref={inputRef}
        className={invalid ? "invalid" : ""}
        value={pattern}
        placeholder="Rechercher"
        aria-label="Rechercher"
        onChange={(e) => setPattern(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            if (e.shiftKey) onPrev();
            else onNext();
          } else if (e.key === "Escape") {
            e.preventDefault();
            onClose();
          }
        }}
      />
      <label title="Expression régulière">
        <input type="checkbox" checked={isRegex} onChange={(e) => setIsRegex(e.target.checked)} /> .*
      </label>
      <label title="Respecter la casse">
        <input type="checkbox" checked={caseSensitive} onChange={(e) => setCaseSensitive(e.target.checked)} /> Aa
      </label>
      <button type="button" onClick={onPrev} title="Précédent (Maj+F3)" aria-label="Précédent">
        ↑
      </button>
      <button type="button" onClick={onNext} title="Suivant (F3)" aria-label="Suivant">
        ↓
      </button>
      <span className={invalid || status?.error ? "search-count error" : "search-count"} role="status">
        {describeSearch({ pattern, invalid, status, ordinal: current?.ordinal ?? null })}
      </span>
      <button type="button" onClick={onClose} aria-label="Fermer la recherche">
        ×
      </button>
    </div>
  );
}
