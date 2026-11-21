import "./SettingsForm.css";
import { APPLY_LABELS, SETTING_SECTIONS, defaultSetting, getSetting, settingKey, type SettingDoc, type Settings } from "@cbl-log/shared";
import { SettingControl } from "./SettingControl";
import { filterSections, formatValue, isDefault } from "./settings-view";

interface Props {
  settings: Settings;
  /** Search field: only the matching settings are shown. */
  query: string;
  onChange(doc: SettingDoc, value: unknown): void;
}

/** "Interface" mode: the documented settings, by section. */
export function SettingsForm({ settings, query, onChange }: Props) {
  const sections = filterSections(SETTING_SECTIONS, query);
  return (
    <div className="settings-form">
      {sections.map((section) => (
        <section key={section.id} className="settings-section">
          <h3>{section.title}</h3>
          {section.settings.map((doc) => (
            <SettingRow key={settingKey(doc.path)} doc={doc} settings={settings} onChange={(v) => onChange(doc, v)} />
          ))}
        </section>
      ))}
      {sections.length === 0 && <p className="hint">Aucun réglage ne correspond à « {query} ».</p>}
    </div>
  );
}

/** One setting: label, key, when it applies, explanation, default (with "Rétablir"), then its input. */
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
        <SettingControl id={id} doc={doc} value={current} onChange={onChange} />
      </div>
    </div>
  );
}
