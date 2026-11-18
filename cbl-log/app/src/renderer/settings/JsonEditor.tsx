import "./JsonEditor.css";
import { useEffect, useRef } from "react";
import type { SettingsTextCheck } from "@cbl-log/shared";

/** Plain textarea with a line-number gutter, Tab indentation and the faulty line marked. */
export function JsonEditor({ text, onChange, errorLine }: { text: string; onChange(text: string): void; errorLine: number | undefined }) {
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

/** Result of the live validation, under the editor: valid, unknown keys, or the errors (first one located). */
export function JsonStatus({ check }: { check: SettingsTextCheck }) {
  if (!check.ok)
    return (
      <div className="settings-status error" role="status">
        {check.errors.map((e, i) => (
          <div key={e}>
            ✕ {i === 0 && check.line !== undefined ? `Ligne ${check.line} : ` : ""}
            {e}
          </div>
        ))}
      </div>
    );
  return (
    <div className={check.warnings.length > 0 ? "settings-status warn" : "settings-status ok"} role="status">
      {check.warnings.length > 0 ? check.warnings.map((w) => <div key={w}>⚠ {w}</div>) : <div>✓ JSON valide</div>}
    </div>
  );
}
