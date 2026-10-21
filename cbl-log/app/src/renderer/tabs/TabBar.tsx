import { useRef, useState } from "react";
import type { TabId } from "@cbl-log/shared";
import { baseName } from "../files/path-key";
import type { TabState } from "./tabs-reducer";

interface Props {
  tabs: TabState[];
  activeId: TabId | undefined;
  onActivate(tabId: TabId): void;
  onClose(tabId: TabId): void;
  /** Gives the tab a custom name (empty = back to the file name). */
  onRename(tabId: TabId, name: string): void;
  /** Opens files from the file dialog. */
  onOpen(): void;
}

export function TabBar({ tabs, activeId, onActivate, onClose, onRename, onOpen }: Props) {
  const [editing, setEditing] = useState<TabId | undefined>(undefined);
  const cancelled = useRef(false);

  return (
    <nav className="tabs" role="tablist">
      {tabs.map((tab) => {
        const { tabId, path } = tab.info;
        const active = tabId === activeId;
        return (
          <div
            key={tabId}
            role="tab"
            aria-selected={active}
            className={active ? "tab active" : "tab"}
            title={tab.message ? `${path}\n${tab.message}` : path}
            onDoubleClick={() => setEditing(tabId)}
            onClick={() => onActivate(tabId)}
            onAuxClick={(e) => {
              if (e.button === 1) onClose(tabId);
            }}
            onMouseDown={(e) => {
              if (e.button === 1) e.preventDefault(); // no autoscroll cursor on middle click
            }}
          >
            {tab.state !== "following" && <span className={`dot dot-${tab.state}`} aria-label={tab.state} />}
            {editing === tabId ? (
              <input
                className="tab-rename"
                autoFocus
                defaultValue={tab.customName ?? baseName(path)}
                aria-label="Nom de l'onglet"
                onFocus={(e) => e.currentTarget.select()}
                onClick={(e) => e.stopPropagation()}
                onDoubleClick={(e) => e.stopPropagation()}
                onBlur={(e) => {
                  const name = e.currentTarget.value.trim();
                  if (!cancelled.current) onRename(tabId, name === baseName(path) ? "" : name);
                  cancelled.current = false;
                  setEditing(undefined);
                }}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === "Enter") e.currentTarget.blur();
                  else if (e.key === "Escape") {
                    cancelled.current = true;
                    setEditing(undefined);
                  }
                }}
              />
            ) : (
              <span className="tab-name">
                {tab.customName ?? baseName(path)}
              </span>
            )}
            {!active && tab.unseen > 0 && <span className="badge">{tab.unseen > 999 ? "999+" : tab.unseen}</span>}
            <button
              type="button"
              className="tab-close"
              aria-label="Fermer l'onglet"
              onClick={(e) => {
                e.stopPropagation();
                onClose(tabId);
              }}
            >
              ×
            </button>
          </div>
        );
      })}
      <button type="button" className="tab-add" onClick={onOpen} title="Ouvrir un fichier (Ctrl+O)" aria-label="Ouvrir un fichier">
        +
      </button>
    </nav>
  );
}
