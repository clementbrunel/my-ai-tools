import "./SettingsForm.css";
import { useRef, useState } from "react";
import { t, APPLY_LABELS, defaultSetting, getSetting, SETTING_SECTIONS, settingKey, type SettingDoc, type Settings } from "@cbl-log/shared";
import { SettingControl } from "./SettingControl";
import { filterSections, formatValue, isDefault } from "./settings-view";

interface Props {
  settings: Settings;
  /** Search field: only the matching settings are shown. */
  query: string;
  onChange(doc: SettingDoc, value: unknown): void;
}

/** "Interface" mode: a side list of the sections, then their settings (the rarely changed ones folded under « Avancé »). */
export function SettingsForm({ settings, query, onChange }: Props) {
  const sections = filterSections(SETTING_SECTIONS, query);
  const scroller = useRef<HTMLDivElement>(null);
  const [current, setCurrent] = useState<string | undefined>(undefined);
  const searching = query.trim() !== "";

  /** Section at the top of the scrolled list, highlighted in the side list. */
  const onScroll = (): void => {
    const el = scroller.current;
    if (!el) return;
    const top = el.getBoundingClientRect().top;
    let id = sections[0]?.id;
    for (const s of el.querySelectorAll<HTMLElement>("section[data-id]")) if (s.getBoundingClientRect().top - top <= 24) id = s.dataset["id"];
    setCurrent(id);
  };

  return (
    <div className="settings-layout">
      <nav className="settings-nav" aria-label={t("Sections")}>
        {sections.map((section) => (
          <button
            key={section.id}
            type="button"
            className={(current ?? sections[0]?.id) === section.id ? "on" : ""}
            onClick={() => scroller.current?.querySelector(`section[data-id="${section.id}"]`)?.scrollIntoView({ block: "start" })}
          >
            {section.title}
          </button>
        ))}
      </nav>
      <div className="settings-form" ref={scroller} onScroll={onScroll}>
        {sections.map((section) => {
          const main = section.settings.filter((d) => !d.advanced);
          const advanced = section.settings.filter((d) => d.advanced);
          const row = (doc: SettingDoc) => <SettingRow key={settingKey(doc.path)} doc={doc} settings={settings} onChange={(v) => onChange(doc, v)} />;
          return (
            <section key={section.id} data-id={section.id} className="settings-section">
              <h3>{section.title}</h3>
              {main.map(row)}
              {advanced.length > 0 && (
                // open while searching, or when an advanced setting differs from its default
                <details className="settings-advanced" open={searching || advanced.some((d) => !isDefault(d, getSetting(settings, d.path)))}>
                  <summary>{t("Avancé")}</summary>
                  {advanced.map(row)}
                </details>
              )}
            </section>
          );
        })}
        {sections.length === 0 && <p className="hint">{t("Aucun réglage ne correspond à « {query} ».", { query })}</p>}
      </div>
    </div>
  );
}

/** One setting: label (JSON key on hover), when it applies, a one-line explanation (ⓘ for more), « Rétablir » when modified, then its input. */
function SettingRow({ doc, settings, onChange }: { doc: SettingDoc; settings: Settings; onChange(value: unknown): void }) {
  const current = getSetting(settings, doc.path);
  const fallback = defaultSetting(doc.path);
  const modified = !isDefault(doc, current);
  const id = `setting-${settingKey(doc.path)}`;
  return (
    <div className={["setting-row", modified && "modified", doc.control.kind === "flags" && doc.control.appearance && "wide-control"].filter(Boolean).join(" ")}>
      <div className="setting-text">
        <div className="setting-title">
          <label htmlFor={id} title={t("Clé dans settings.json : {key}", { key: settingKey(doc.path) })}>
            {doc.label}
          </label>
          {doc.apply !== "live" && <span className={`setting-apply apply-${doc.apply}`}>{APPLY_LABELS[doc.apply]}</span>}
          {modified && (
            <button
              type="button"
              className="link-btn"
              title={t("Valeur par défaut : {value}", { value: formatValue(doc, fallback) })}
              onClick={() => onChange(doc.control.kind === "text" || doc.control.kind === "font" ? undefined : fallback)}
            >
              {t("Rétablir")}
            </button>
          )}
        </div>
        <p className="setting-desc">
          {doc.description}
          {doc.details && (
            <span className="setting-details" title={doc.details} aria-label={doc.details} tabIndex={0}>
              ⓘ
            </span>
          )}
        </p>
      </div>
      <div className="setting-control">
        <SettingControl id={id} doc={doc} value={current} onChange={onChange} />
      </div>
    </div>
  );
}
