import "./SettingsPanel.css";
import { useCallback, useState } from "react";
import { setSetting, settingsToText, type SettingDoc, type Settings } from "@cbl-log/shared";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";
import { JsonEditor, JsonStatus } from "./JsonEditor";
import { SettingsForm } from "./SettingsForm";
import { useSettingsDocument } from "./useSettingsDocument";

type Mode = "ui" | "json";

interface Props {
  onClose(): void;
  /** settings.json was written: the app applies the new values. */
  onSaved(settings: Settings): void;
}

/**
 * "Fichier › Configuration…": settings.json edited either as a documented form or as raw JSON (like VS Code).
 * Both modes work on the same text (useSettingsDocument): the form reads its last valid value and rewrites it.
 */
export function SettingsPanel({ onClose, onSaved }: Props) {
  const [mode, setMode] = useState<Mode>("ui");
  const [query, setQuery] = useState("");
  // An unusable file opens in JSON mode, where it can be fixed.
  const doc = useSettingsDocument(onSaved, (check) => {
    if (!check.ok) setMode("json");
  });
  const { check, value } = doc;

  const close = useCallback(() => {
    if (doc.isDirty() && !window.confirm("Abandonner les modifications non enregistrées ?")) return;
    onClose();
  }, [doc.isDirty, onClose]);

  const onKeyDown = (e: React.KeyboardEvent): void => {
    // The window's shortcuts (Ctrl+F, Ctrl+W…) must not act on the log behind the dialog.
    if (e.ctrlKey) e.stopPropagation();
    if (e.ctrlKey && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "s") {
      e.preventDefault();
      void doc.save();
    }
  };

  const edit = (setting: SettingDoc, next: unknown): void => {
    if (value) doc.setText(settingsToText(setSetting(value, setting.path, next)));
  };

  return (
    <Modal title="Configuration" className="settings-panel" onClose={close}>
      <div className="settings-body" onKeyDown={onKeyDown}>
        <div className="settings-toolbar">
          <ModeSwitch mode={mode} canUseForm={check.ok} onChange={setMode} />
          {mode === "ui" ? (
            <input type="search" className="settings-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher un réglage : « docker », « historique », « theme »…" aria-label="Rechercher un réglage" autoFocus />
          ) : (
            <>
              <span className="settings-toolbar-fill" />
              <Button disabled={!check.ok} onClick={() => check.ok && doc.setText(settingsToText(check.value))} title="Réécrit le JSON avec l'indentation standard et toutes les clés (valeurs par défaut comprises)">
                Formater
              </Button>
            </>
          )}
        </div>
        <p className="settings-path">
          <code title={doc.path}>{doc.path || "settings.json"}</code>
          <button type="button" className="link-btn" onClick={() => void window.cblLog.revealSettingsFile()}>
            Afficher dans l'explorateur
          </button>
        </p>

        {doc.changedOnDisk && (
          <div className="settings-banner">
            Le fichier a été modifié en dehors de l'application.
            <Button onClick={doc.reload}>Recharger (abandonner mes modifications)</Button>
          </div>
        )}

        {!doc.loaded ? (
          <p className="hint">Chargement…</p>
        ) : mode === "ui" && value ? (
          <SettingsForm settings={value} query={query} onChange={edit} />
        ) : (
          <>
            <JsonEditor text={doc.text} onChange={doc.setText} errorLine={check.ok ? undefined : check.line} />
            <JsonStatus check={check} />
          </>
        )}

        {doc.saveErrors.length > 0 && (
          <div className="settings-status error" role="alert">
            {doc.saveErrors.map((e) => (
              <div key={e}>✕ Non enregistré : {e}</div>
            ))}
          </div>
        )}
      </div>
      <footer>
        <span className="settings-dirty">{doc.dirty ? "● Modifications non enregistrées" : ""}</span>
        <Button onClick={close}>{doc.dirty ? "Annuler" : "Fermer"}</Button>
        <Button variant="primary" disabled={!doc.dirty || !check.ok || doc.saving} onClick={() => void doc.save()} title="Enregistrer (Ctrl+S)">
          Enregistrer
        </Button>
      </footer>
    </Modal>
  );
}

/** "Interface | JSON" switch; the form is unavailable while the JSON is invalid. */
function ModeSwitch({ mode, canUseForm, onChange }: { mode: Mode; canUseForm: boolean; onChange(mode: Mode): void }) {
  return (
    <div className="segmented" role="tablist" aria-label="Mode d'édition">
      <button type="button" role="tab" aria-selected={mode === "ui"} className={mode === "ui" ? "on" : ""} disabled={!canUseForm} title={canUseForm ? undefined : "Corrigez d'abord le JSON"} onClick={() => onChange("ui")}>
        Interface
      </button>
      <button type="button" role="tab" aria-selected={mode === "json"} className={mode === "json" ? "on" : ""} onClick={() => onChange("json")}>
        JSON
      </button>
    </div>
  );
}
