import { useRef, useState } from "react";
import type { TabId } from "@cbl-log/shared";
import { WhaleIcon } from "../docker/DockerPanel";
import { tabLabel, tabUri, type TabState } from "./tabs-reducer";

interface Props {
  tabs: TabState[];
  activeId: TabId | undefined;
  onActivate(tabId: TabId): void;
  onClose(tabId: TabId): void;
  /** Gives the tab a custom name (empty = back to the file name). */
  onRename(tabId: TabId, name: string): void;
  /** Opens files from the file dialog. */
  onOpen(): void;
  /** Docker panel toggle (absent when the feature is disabled). */
  docker?: { open: boolean; onToggle(): void } | undefined;
}

export function TabBar({ tabs, activeId, onActivate, onClose, onRename, onOpen, docker }: Props) {
  const [editing, setEditing] = useState<TabId | undefined>(undefined);
  const cancelled = useRef(false);

  return (
    <nav className="tabs" role="tablist">
      {docker && (
        <button type="button" className={docker.open ? "tab-docker on" : "tab-docker"} aria-pressed={docker.open} onClick={docker.onToggle} title="Conteneurs Docker (Ctrl+Maj+D)" aria-label="Panneau Docker">
          <WhaleIcon />
        </button>
      )}
      {tabs.map((tab) => {
        const { tabId } = tab.info;
        const path = tabUri(tab);
        const label = tabLabel(tab);
        const defaultName = tab.docker?.name ?? path.split(/[\/]/).pop() ?? path;
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
                defaultValue={label}
                aria-label="Nom de l'onglet"
                onFocus={(e) => e.currentTarget.select()}
                onClick={(e) => e.stopPropagation()}
                onDoubleClick={(e) => e.stopPropagation()}
                onBlur={(e) => {
                  const name = e.currentTarget.value.trim();
                  if (!cancelled.current) onRename(tabId, name === defaultName ? "" : name);
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
                {tab.docker && <WhaleIcon />} {label}
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
