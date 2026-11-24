// Input of one setting in the form, chosen from its documented control (shared/settings-doc.ts).
import { useEffect, useState } from "react";
import type { SettingDoc } from "@cbl-log/shared";
import { Button } from "../ui/Button";

export function SettingControl({ id, doc, value, onChange }: { id: string; doc: SettingDoc; value: unknown; onChange(value: unknown): void }) {
  const control = doc.control;
  switch (control.kind) {
    case "boolean":
      return (
        <label className="toggle">
          <input id={id} type="checkbox" checked={value === true} onChange={(e) => onChange(e.target.checked)} />
          <span>{value === true ? "Activé" : "Désactivé"}</span>
        </label>
      );
    case "enum":
      return (
        <select id={id} value={String(value)} onChange={(e) => onChange(e.target.value)}>
          {control.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      );
    case "number":
      return <NumberField id={id} value={typeof value === "number" ? value : undefined} min={control.min} max={control.max} step={control.step} unit={control.unit} onChange={onChange} />;
    case "text":
      return (
        <TextField id={id} value={typeof value === "string" ? value : ""} placeholder={control.placeholder} suggestions={control.suggestions} onChange={(v) => onChange(v === "" ? undefined : v)} />
      );
    case "map": {
      const entries = Object.entries((value ?? {}) as Record<string, string>);
      if (entries.length === 0) return <p className="hint map-empty">Aucun motif appris.</p>;
      return (
        <ul className="map-list" id={id}>
          {entries.map(([k, v]) => (
            <li key={k}>
              <code className="map-key" title={k}>
                {k}
              </code>
              <code className="map-value" title={v}>
                {v}
              </code>
              <Button
                variant="ghost"
                aria-label={`Supprimer le motif de ${k}`}
                title="Supprimer (retour à la détection automatique)"
                onClick={() => {
                  const next = { ...(value as Record<string, string>) };
                  delete next[k];
                  onChange(next);
                }}
              >
                ×
              </Button>
            </li>
          ))}
        </ul>
      );
    }
  }
}

/** Number input that keeps what is being typed and only commits a value within the bounds. */
function NumberField(props: { id: string; value: number | undefined; min: number; max: number; step?: number | undefined; unit?: string | undefined; onChange(value: number): void }) {
  const { id, value, min, max, step, unit, onChange } = props;
  const [draft, setDraft] = useState(value === undefined ? "" : String(value));
  useEffect(() => setDraft(value === undefined ? "" : String(value)), [value]);
  const n = Number(draft);
  const valid = draft.trim() !== "" && Number.isInteger(n) && n >= min && n <= max;
  return (
    <span className="number-field">
      <input
        id={id}
        type="number"
        min={min}
        max={max}
        step={step ?? 1}
        value={draft}
        aria-invalid={!valid}
        onChange={(e) => {
          setDraft(e.target.value);
          const v = Number(e.target.value);
          if (e.target.value.trim() !== "" && Number.isInteger(v) && v >= min && v <= max) onChange(v);
        }}
        onBlur={() => setDraft(value === undefined ? "" : String(value))}
      />
      {unit && <span className="unit">{unit}</span>}
      {!valid && (
        <span className="field-error">
          Entier entre {min.toLocaleString("fr-FR")} et {max.toLocaleString("fr-FR")}
        </span>
      )}
    </span>
  );
}

/** Text input committed on blur / Entrée, so that the JSON is not rewritten at each keystroke. */
function TextField(props: { id: string; value: string; placeholder?: string | undefined; suggestions?: readonly string[] | undefined; onChange(value: string): void }) {
  const { id, value, placeholder, suggestions, onChange } = props;
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const commit = (): void => {
    if (draft.trim() !== value) onChange(draft.trim());
  };
  const listId = suggestions ? `${id}-suggestions` : undefined;
  return (
    <>
      <input
        id={id}
        type="text"
        className="text-field"
        value={draft}
        placeholder={placeholder}
        spellCheck={false}
        list={listId}
        onChange={(e) => {
          setDraft(e.target.value);
          // picking a suggestion in the list commits it at once (no blur needed)
          if (suggestions?.includes(e.target.value) && e.target.value !== value) onChange(e.target.value);
        }}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
        }}
      />
      {suggestions && (
        <datalist id={listId}>
          {suggestions.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      )}
    </>
  );
}
