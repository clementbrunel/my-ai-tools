// State of settings.json in the "Configuration" window: the text being edited (single source of truth for
// both modes), its live validation, load / save through the main process, and external edits.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { checkSettingsText, type Settings, type SettingsTextCheck } from "@cbl-log/shared";

export interface SettingsDocument {
  /** Path of settings.json (shown to the user). */
  path: string;
  loaded: boolean;
  text: string;
  setText(text: string): void;
  check: SettingsTextCheck;
  /** Last valid value of the text: what the form shows while the JSON is being fixed. */
  value: Settings | undefined;
  dirty: boolean;
  /** The file changed on disk while there were pending edits. */
  changedOnDisk: boolean;
  saving: boolean;
  /** Why the main process refused the last save. */
  saveErrors: string[];
  /** Re-reads the file, dropping pending edits. */
  reload(): void;
  save(): Promise<void>;
  /** Up to date even inside callbacks created earlier (close guard). */
  isDirty(): boolean;
}

/** `onLoaded` gets the check of each text read from disk (an unusable file is better shown as JSON). */
export function useSettingsDocument(onSaved: (settings: Settings) => void, onLoaded?: (check: SettingsTextCheck) => void): SettingsDocument {
  const [path, setPath] = useState("");
  const [savedText, setSavedText] = useState<string | undefined>(undefined);
  const [text, setText] = useState("");
  const [saveErrors, setSaveErrors] = useState<string[]>([]);
  const [changedOnDisk, setChangedOnDisk] = useState(false);
  const [saving, setSaving] = useState(false);

  const check = useMemo(() => checkSettingsText(text), [text]);
  const lastValid = useRef<Settings | undefined>(undefined);
  if (check.ok) lastValid.current = check.value;
  const dirty = savedText !== undefined && text !== savedText;
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  const onLoadedRef = useRef(onLoaded);
  onLoadedRef.current = onLoaded;

  const reload = useCallback(() => {
    void window.cblLog.readSettingsText().then((r) => {
      setPath(r.path);
      setSavedText(r.text);
      setText(r.text);
      setChangedOnDisk(false);
      setSaveErrors([]);
      onLoadedRef.current?.(checkSettingsText(r.text));
    });
  }, []);
  useEffect(reload, [reload]);
  // External edit: reloaded at once unless the user has pending changes (then offered).
  useEffect(
    () =>
      window.cblLog.onConfigChanged((kind) => {
        if (kind !== "settings") return;
        if (dirtyRef.current) setChangedOnDisk(true);
        else reload();
      }),
    [reload],
  );

  const save = useCallback(async () => {
    if (!dirty || !check.ok || saving) return;
    setSaving(true);
    try {
      const result = await window.cblLog.saveSettingsText(text);
      if (result.ok) {
        const written = text.endsWith("\n") ? text : `${text}\n`;
        setSavedText(written);
        setText(written);
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

  const isDirty = useCallback(() => dirtyRef.current, []);

  return { path, loaded: savedText !== undefined, text, setText, check, value: lastValid.current, dirty, changedOnDisk, saving, saveErrors, reload, save, isDirty };
}
