import { useEffect, useRef, useState } from "react";
import type { FilterSettings, TextMatcher } from "@cbl-log/shared";
import { validateQuery } from "../search/search-text";
import { addMatcher, removeMatcher } from "./filter-state";

interface Props {
  settings: FilterSettings;
  onChange(settings: FilterSettings): void;
  /** Incremented to move the keyboard focus into the field (Ctrl+Maj+F). */
  focusRequest: number;
  /** The engine could not run the filter to the end (regex too expensive, file unreadable). */
  error?: "too-expensive" | "failed" | undefined;
}

const ERRORS = { "too-expensive": "Regex trop coûteuse : filtre interrompu", failed: "Filtre impossible" } as const;

const describe = (m: TextMatcher): string => `${m.pattern}${m.isRegex ? "  (regex)" : ""}${m.caseSensitive ? "  (casse)" : ""}${m.wholeWord ? "  (mot entier)" : ""}`;

/**
 * Include / exclude texts of the filter: a field to type one (Enter includes it, Ctrl+Enter excludes it)
 * and the list of those in force, each removable. The lines shown are those matching an included text
 * (when there is any) and none of the excluded ones.
 */
export function FilterBar({ settings, onChange, focusRequest, error }: Props) {
  const [text, setText] = useState("");
  const [isRegex, setRegex] = useState(false);
  const [caseSensitive, setCase] = useState(false);
  const [wholeWord, setWhole] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Only a request made after the bar appeared moves the focus (showing the bar does not).
  const handled = useRef(focusRequest);
  useEffect(() => {
    if (focusRequest === handled.current) return;
    handled.current = focusRequest;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [focusRequest]);

  const matcher: TextMatcher = { pattern: text, isRegex, caseSensitive, ...(wholeWord ? { wholeWord } : {}) };
  const invalid = validateQuery(matcher);
  const add = (list: "include" | "exclude"): void => {
    if (text === "" || invalid) return;
    onChange(addMatcher(settings, list, matcher));
    setText("");
    inputRef.current?.focus();
  };
  const chips = [
    ...settings.include.map((m, index) => ({ list: "include" as const, m, index })),
    ...settings.exclude.map((m, index) => ({ list: "exclude" as const, m, index })),
  ];

  return (
    <div className="filterbar" role="search" aria-label="Filtre">
      <input
        ref={inputRef}
        className={invalid ? "invalid" : ""}
        value={text}
        placeholder="Filtrer : texte à inclure ou à exclure (Ctrl+Maj+F)"
        aria-label="Texte du filtre"
        title={invalid ? `Regex invalide : ${invalid}` : "Entrée : inclure — Ctrl+Entrée : exclure"}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            add(e.ctrlKey ? "exclude" : "include");
          } else if (e.key === "Escape") {
            e.preventDefault();
            if (text !== "") setText("");
            else inputRef.current?.blur();
          }
        }}
      />
      <label title="Expression régulière">
        <input type="checkbox" checked={isRegex} onChange={(e) => setRegex(e.target.checked)} /> .*
      </label>
      <label title="Respecter la casse">
        <input type="checkbox" checked={caseSensitive} onChange={(e) => setCase(e.target.checked)} /> Aa
      </label>
      <label title="Mot entier : ERROR ne trouve pas ERRORS ni MYERROR">
        <input type="checkbox" checked={wholeWord} onChange={(e) => setWhole(e.target.checked)} /> Mot
      </label>
      <button type="button" onClick={() => add("include")} disabled={text === "" || !!invalid} title="Ne montrer que les lignes qui contiennent ce texte (Entrée)">
        + Inclure
      </button>
      <button type="button" onClick={() => add("exclude")} disabled={text === "" || !!invalid} title="Masquer les lignes qui contiennent ce texte (Ctrl+Entrée)">
        − Exclure
      </button>
      {chips.length > 0 && (
        <span className="chips">
          {chips.map(({ list, m, index }) => (
            <span key={`${list}:${index}`} className={`chip ${list}`} title={`${list === "include" ? "Inclus" : "Exclu"} : ${describe(m)}`}>
              <span aria-hidden="true">{list === "include" ? "+" : "−"}</span> {m.pattern}
              <button type="button" aria-label={`Retirer ${m.pattern}`} onClick={() => onChange(removeMatcher(settings, list, index))}>
                ×
              </button>
            </span>
          ))}
        </span>
      )}
      {error && <span className="search-count error">{ERRORS[error]}</span>}
    </div>
  );
}
