import "./SettingsPanel.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  APPLY_LABELS,
  SETTING_SECTIONS,
  checkSettingsText,
  defaultSetting,
  getSetting,
  setSetting,
  settingKey,
  settingsToText,
  type SettingDoc,
  type Settings,
} from "@cbl-log/shared";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";
import { filterSections, formatValue, isDefault } from "./settings-view";

type Mode = "ui" | "json";

interface Props {
  onClose(): void;
  /** settings.json was written: the app applies the new values. */
  onSaved(settings: Settings): void;
}

/**
 * "Fichier › Configuration…": settings.json edited either as a documented form or as raw JSON (like VS Code).
 * The JSON text is the single source of truth: the form reads the last valid value of it and rewrites it.
 */
export function SettingsPanel({ onClose, onSaved }: Props) {
  const [mode, setMode] = useState<Mode>("ui");
  const [path, setPath] = useState("");
  const [savedText, setSavedText] = useState<string | undefined>(undefined);
  const [text, setText] = useState("");
  const [query, setQuery] = useState("");
  const [saveErrors, setSaveErrors] = useState<string[]>([]);
  const [changedOnDisk, setChangedOnDisk] = useState(false);
  const [saving, setSaving] = useState(false);

  const check = useMemo(() => checkSettingsText(text), [text]);
  const lastValid = useRef<Settings | undefined>(undefined);
  if (check.ok) lastValid.current = check.value;
  const value = lastValid.current;
  const dirty = savedText !== undefined && text !== savedText;
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;

  const load = useCallback(() => {
    void window.cblLog.readSettingsText().then((r) => {
      setPath(r.path);
      setSavedText(r.text);
      setText(r.text);
      setChangedOnDisk(false);
      setSaveErrors([]);
      // An unusable file opens in JSON mode, where it can be fixed.
      if (!checkSettingsText(r.text).ok) setMode("json");
    });
  }, []);
  useEffect(load, [load]);
  // External edit: reloaded at once unless the user has pending changes (then offered).
  useEffect(
    () =>
      window.cblLog.onConfigChanged((kind) => {
        if (kind !== "settings") return;
        if (dirtyRef.current) setChangedOnDisk(true);
        else load();
      }),
    [load],
  );

  const save = useCallback(async () => {
    if (!dirty || !check.ok || saving) return;
    setSaving(true);
    try {
      const result = await window.cblLog.saveSettingsText(text);
      if (result.ok) {
        setSavedText(text.endsWith("\n") ? text : `${text}\n`);
        if (!text.endsWith("\n")) setText(`${text}\n`);
        setSaveErrors([]);
        setChangedOnDisk(false);
        onSaved(result.value);
      } else {
        setSaveErrors(result.errors);
      }
    } catch (err) {
      setSaveErrors([err instanceof Error ? err.message : String(err)]);
    } finally {
      setSaving(false);
    }
  }, [dirty, check.ok, saving, text, onSaved]);

  const close = useCallback(() => {
    if (dirtyRef.current && !window.confirm("Abandonner les modifications non enregistrées ?")) return;
    onClose();
  }, [onClose]);

  const onKeyDown = (e: React.KeyboardEvent): void => {
    // The window's shortcuts (Ctrl+F, Ctrl+W…) must not act on the log behind the dialog.
    if (e.ctrlKey) e.stopPropagation();
    if (e.ctrlKey && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "s") {
      e.preventDefault();
      void save();
    }
  };

  const edit = (doc: SettingDoc, next: unknown): void => {
    if (!value) return;
    setText(settingsToText(setSetting(value, doc.path, next)));
  };

  const sections = filterSections(SETTING_SECTIONS, query);
  const loaded = savedText !== undefined;

  return (
    <Modal title="Configuration" className="settings-panel" onClose={close}>
      <div className="settings-body" onKeyDown={onKeyDown}>
        <div className="settings-toolbar">
          <div className="segmented" role="tablist" aria-label="Mode d'édition">
            <button type="button" role="tab" aria-selected={mode === "ui"} className={mode === "ui" ? "on" : ""} disabled={!check.ok} title={check.ok ? undefined : "Corrigez d'abord le JSON"} onClick={() => setMode("ui")}>
              Interface
            </button>
            <button type="button" role="tab" aria-selected={mode === "json"} className={mode === "json" ? "on" : ""} onClick={() => setMode("json")}>
              JSON
            </button>
          </div>
          {mode === "ui" ? (
            <input type="search" className="settings-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher un réglage : « docker », « historique », « theme »…" aria-label="Rechercher un réglage" autoFocus />
          ) : (
            <span className="settings-toolbar-fill" />
          )}
          {mode === "json" && (
            <Button disabled={!check.ok} onClick={() => check.ok && setText(settingsToText(check.value))} title="Réécrit le JSON avec l'indentation standard et toutes les clés (valeurs par défaut comprises)">
              Formater
            </Button>
          )}
        </div>
        <p className="settings-path">
          <code title={path}>{path || "settings.json"}</code>
          <button type="button" className="link-btn" onClick={() => void window.cblLog.revealSettingsFile()}>
            Afficher dans l'explorateur
          </button>
        </p>

        {changedOnDisk && (
          <div className="settings-banner">
            Le fichier a été modifié en dehors de l'application.
            <Button onClick={load}>Recharger (abandonner mes modifications)</Button>
          </div>
        )}

        {!loaded ? (
          <p className="hint">Chargement…</p>
        ) : mode === "ui" && value ? (
          <div className="settings-form">
            {sections.map((section) => (
              <section key={section.id} className="settings-section">
                <h3>{section.title}</h3>
                {section.settings.map((doc) => (
                  <SettingRow key={settingKey(doc.path)} doc={doc} settings={value} onChange={(v) => edit(doc, v)} />
                ))}
              </section>
            ))}
            {sections.length === 0 && <p className="hint">Aucun réglage ne correspond à « {query} ».</p>}
          </div>
        ) : (
          <JsonEditor text={text} onChange={setText} errorLine={check.ok ? undefined : check.line} />
        )}

        {mode === "json" && (
          <div className={check.ok ? (check.warnings.length > 0 ? "settings-status warn" : "settings-status ok") : "settings-status error"} role="status">
            {check.ok ? (
              check.warnings.length > 0 ? (
                check.warnings.map((w) => <div key={w}>⚠ {w}</div>)
              ) : (
                <div>✓ JSON valide</div>
              )
            ) : (
              check.errors.map((e) => (
                <div key={e}>
                  ✕ {check.line !== undefined && e === check.errors[0] ? `Ligne ${check.line} : ` : ""}
                  {e}
                </div>
              ))
            )}
          </div>
        )}
        {saveErrors.length > 0 && (
          <div className="settings-status error" role="alert">
            {saveErrors.map((e) => (
              <div key={e}>✕ Non enregistré : {e}</div>
            ))}
          </div>
        )}
      </div>
      <footer>
        <span className="settings-dirty">{dirty ? "● Modifications non enregistrées" : ""}</span>
        <Button onClick={close}>{dirty ? "Annuler" : "Fermer"}</Button>
        <Button variant="primary" disabled={!dirty || !check.ok || saving} onClick={() => void save()} title="Enregistrer (Ctrl+S)">
          Enregistrer
        </Button>
      </footer>
    </Modal>
  );
}

function SettingRow({ doc, settings, onChange }: { doc: SettingDoc; settings: Settings; onChange(value: unknown): void }) {
  const current = getSetting(settings, doc.path);
  const fallback = defaultSetting(doc.path);
  const modified = !isDefault(doc, current);
  const id = `setting-${settingKey(doc.path)}`;
  return (
    <div className={modified ? "setting-row modified" : "setting-row"}>
      <div className="setting-text">
        <div className="setting-title">
          <label htmlFor={id}>{doc.label}</label>
          <code className="setting-key">{settingKey(doc.path)}</code>
          {doc.apply !== "live" && <span className={`setting-apply apply-${doc.apply}`}>{APPLY_LABELS[doc.apply]}</span>}
        </div>
        <p className="setting-desc">{doc.description}</p>
        <p className="setting-default">
          Par défaut : <code>{formatValue(doc, fallback)}</code>
          {modified && (
            <button type="button" className="link-btn" onClick={() => onChange(doc.control.kind === "text" ? undefined : fallback)}>
              Rétablir
            </button>
          )}
        </p>
      </div>
      <div className="setting-control">
        <Control id={id} doc={doc} value={current} onChange={onChange} />
      </div>
    </div>
  );
}

function Control({ id, doc, value, onChange }: { id: string; doc: SettingDoc; value: unknown; onChange(value: unknown): void }) {
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
      return <TextField id={id} value={typeof value === "string" ? value : ""} placeholder={control.placeholder} onChange={(v) => onChange(v === "" ? undefined : v)} />;
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

/** Plain textarea with a line-number gutter, Tab indentation and the faulty line marked. */
function JsonEditor({ text, onChange, errorLine }: { text: string; onChange(text: string): void; errorLine: number | undefined }) {
  const area = useRef<HTMLTextAreaElement>(null);
  const gutter = useRef<HTMLDivElement>(null);
  const pendingCaret = useRef<number | undefined>(undefined);
  const lines = text.split("\n").length;
  useEffect(() => {
    if (pendingCaret.current === undefined || !area.current) return;
    area.current.selectionStart = area.current.selectionEnd = pendingCaret.current;
    pendingCaret.current = undefined;
  });
  useEffect(() => area.current?.focus(), []);
  return (
    <div className="json-editor">
      <div className="json-gutter" ref={gutter} aria-hidden="true">
        {Array.from({ length: lines }, (_, i) => (
          <div key={i} className={errorLine === i + 1 ? "error" : undefined}>
            {i + 1}
          </div>
        ))}
      </div>
      <textarea
        ref={area}
        value={text}
        spellCheck={false}
        wrap="off"
        aria-label="settings.json"
        onChange={(e) => onChange(e.target.value)}
        onScroll={(e) => {
          if (gutter.current) gutter.current.scrollTop = e.currentTarget.scrollTop;
        }}
        onKeyDown={(e) => {
          if (e.key !== "Tab" || e.ctrlKey || e.altKey) return;
          e.preventDefault();
          const t = e.currentTarget;
          const { selectionStart: start, selectionEnd: end } = t;
          pendingCaret.current = start + 2;
          onChange(`${text.slice(0, start)}  ${text.slice(end)}`);
        }}
      />
    </div>
  );
}
