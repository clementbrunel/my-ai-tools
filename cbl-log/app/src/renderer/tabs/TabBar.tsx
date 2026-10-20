import type { TabId } from "@cbl-log/shared";
import { baseName } from "../files/path-key";
import type { TabState } from "./tabs-reducer";

interface Props {
  tabs: TabState[];
  activeId: TabId | undefined;
  onActivate(tabId: TabId): void;
  onClose(tabId: TabId): void;
  /** Opens files from the file dialog. */
  onOpen(): void;
}

export function TabBar({ tabs, activeId, onActivate, onClose, onOpen }: Props) {
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
            onClick={() => onActivate(tabId)}
            onAuxClick={(e) => {
              if (e.button === 1) onClose(tabId);
            }}
            onMouseDown={(e) => {
              if (e.button === 1) e.preventDefault(); // no autoscroll cursor on middle click
            }}
          >
            {tab.state !== "following" && <span className={`dot dot-${tab.state}`} aria-label={tab.state} />}
            <span className="tab-name">{baseName(path)}</span>
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
