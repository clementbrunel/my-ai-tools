// Input of one setting in the form, chosen from its documented control (shared/settings-doc.ts).
import { useEffect, useState } from "react";
import type { SettingDoc } from "@cbl-log/shared";
import { Button } from "../ui/Button";
import { flagChecked, parseNumberInput, toggleFlag } from "./settings-view";
import { installedMonospaceFonts } from "./installed-fonts";
import "../filter/LevelPills.css";
import { t, fmtNumber, locale } from "@cbl-log/shared";

export function SettingControl({ id, doc, value, onChange }: { id: string; doc: SettingDoc; value: unknown; onChange(value: unknown): void }) {
  const control = doc.control;
  switch (control.kind) {
    case "boolean":
      return (
        <label className="toggle">
          <input id={id} type="checkbox" checked={value === true} onChange={(e) => onChange(e.target.checked)} />
          <span>{value === true ? t("Activé") : t("Désactivé")}</span>
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
      if (control.choices) {
        const current = typeof value === "number" ? value : undefined;
        const choices = current !== undefined && !control.choices.includes(current) ? [...control.choices, current].sort((a, b) => a - b) : control.choices;
        return (
          <span className="number-field">
            <select id={id} className="number-choice" value={current ?? ""} onChange={(e) => onChange(Number(e.target.value))}>
              {choices.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            {control.unit && <span className="unit">{control.unit}</span>}
          </span>
        );
      }
      return <NumberField id={id} value={typeof value === "number" ? value : undefined} min={control.min} max={control.max} decimal={control.decimal} unit={control.unit} onChange={onChange} />;
    case "font": {
      // the default first, then the installed monospaced fonts; a font set in the JSON stays in the list
      const current = typeof value === "string" ? value : "";
      const fonts = installedMonospaceFonts().filter((f) => f !== control.emptyLabel);
      if (current && current !== control.emptyLabel && !fonts.includes(current)) fonts.push(current);
      return (
        <select id={id} value={current} onChange={(e) => onChange(e.target.value === "" ? undefined : e.target.value)}>
          <option value="">{t("{font} (par défaut)", { font: control.emptyLabel })}</option>
          {fonts.map((f) => (
            <option key={f} value={f} style={{ fontFamily: `"${f}", monospace` }}>
              {f}
            </option>
          ))}
        </select>
      );
    }
    case "text":
      return (
        <TextField id={id} value={typeof value === "string" ? value : ""} placeholder={control.placeholder} onChange={(v) => onChange(v === "" ? undefined : v)} />
      );
    case "flags": {
      const on = (Array.isArray(value) ? value : []) as string[];
      const checkedCount = control.options.filter((o) => flagChecked(on, o)).length;
      if (control.appearance === "level-pills") {
        // same buttons and colours as the level pills of the status bar (LevelPills.tsx)
        return (
          <span className="level-pills" id={id} role="group">
            {control.options.map((o) => {
              const checked = flagChecked(on, o);
              return (
                <button
                  key={o.value}
                  type="button"
                  role="checkbox"
                  aria-checked={checked}
                  // at least one option stays checked
                  disabled={checked && checkedCount === 1}
                  className={`level-pill lvl-${o.value}${checked ? " on" : ""}`}
                  onClick={() => onChange(toggleFlag(control.options, on, o, !checked))}
                >
                  <span className="level-dot" aria-hidden="true" />
                  {o.label}
                </button>
              );
            })}
          </span>
        );
      }
      return (
        <span className="flags" id={id} role="group">
          {control.options.map((o) => {
            const checked = flagChecked(on, o);
            return (
              <label key={o.value} className="flag">
                <input
                  type="checkbox"
                  checked={checked}
                  // at least one option stays checked
                  disabled={checked && checkedCount === 1}
                  onChange={(e) => onChange(toggleFlag(control.options, on, o, e.target.checked))}
                />
                <span>{o.label}</span>
              </label>
            );
          })}
        </span>
      );
    }
    case "map": {
      const entries = Object.entries((value ?? {}) as Record<string, string>);
      if (entries.length === 0) return <p className="hint map-empty">{t("Aucun motif appris.")}</p>;
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
                aria-label={t("Supprimer le motif de {key}", { key: k })}
                title={t("Supprimer (retour à la détection automatique)")}
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
function NumberField(props: { id: string; value: number | undefined; min: number; max: number; decimal?: boolean | undefined; unit?: string | undefined; onChange(value: number): void }) {
  const { id, value, min, max, decimal, unit, onChange } = props;
  const shown = (v: number | undefined): string => (v === undefined ? "" : decimal ? String(v).replace(".", locale() === "fr-FR" ? "," : ".") : String(v));
  const [draft, setDraft] = useState(shown(value));
  useEffect(() => setDraft(shown(value)), [value]);
  const valid = parseNumberInput(draft, { min, max, decimal }) !== undefined;
  return (
    <span className="number-field">
      <input
        id={id}
        type="text"
        inputMode={decimal ? "decimal" : "numeric"}
        value={draft}
        aria-invalid={!valid}
        onChange={(e) => {
          setDraft(e.target.value);
          const v = parseNumberInput(e.target.value, { min, max, decimal });
          if (v !== undefined) onChange(v);
        }}
        onBlur={() => setDraft(shown(value))}
      />
      {unit && <span className="unit">{unit}</span>}
      {!valid && (
        <span className="field-error">
          {decimal
            ? t("Nombre entre {min} et {max}", { min: fmtNumber(min), max: fmtNumber(max) })
            : t("Entier entre {min} et {max}", { min: fmtNumber(min), max: fmtNumber(max) })}
        </span>
      )}
    </span>
  );
}

/** Text input committed on blur / Entrée, so that the JSON is not rewritten at each keystroke. */
function TextField({ id, value, placeholder, onChange }: { id: string; value: string; placeholder?: string | undefined; onChange(value: string): void }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const commit = (): void => {
    if (draft.trim() !== value) onChange(draft.trim());
  };
  return (
    <input
      id={id}
      type="text"
      className="text-field"
      value={draft}
      placeholder={placeholder}
      spellCheck={false}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit();
      }}
    />
  );
}
