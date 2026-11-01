import { useMemo, useRef, useState } from "react";
import type { DockerListResult } from "@cbl-log/shared";
import { connectionMessage, containerDot, groupContainers, nextSelection } from "./docker-panel";

interface Props {
  /** Last answer / push of the engine; undefined until the first one. */
  list: DockerListResult | undefined;
  /** Names of the containers already open in a tab. */
  openNames: ReadonlySet<string>;
  onOpen(names: string[]): void;
  onClose(): void;
}

export function WhaleIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="whale">
      <path d="M1.5 8.5h11.5c.7-.8 1.6-.9 2.2-.5-.4-.7-.4-1.5 0-2.2-.9.1-1.6.5-1.9 1.2H1.500c.2 3 1.800 5.200 5.300 5.200 3.300 0 5.500-1.700 6.200-4.700" />
      <path d="M3 6.500h2v2H3zM5 6.500h2v2H5zM7 6.500h2v2H7zM5 4.500h2v2H5z" />
    </svg>
  );
}

export function DockerPanel({ list, openNames, onOpen, onClose }: Props) {
  const [text, setText] = useState("");
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const anchor = useRef<string | undefined>(undefined);
  const groups = useMemo(() => groupContainers(list?.containers ?? [], text), [list, text]);
  const order = useMemo(() => groups.flatMap((g) => g.containers.map((c) => c.name)), [groups]);
  const byName = useMemo(() => new Map((list?.containers ?? []).map((c) => [c.name, c])), [list]);
  const header = connectionMessage(list);
  const openable = [...selected].filter((n) => byName.get(n)?.readable);

  return (
    <aside className="docker-panel" aria-label="Docker">
      <div className="docker-head">
        <span className="docker-title">
          <WhaleIcon /> Docker
        </span>
        <button type="button" className="icon-btn" onClick={onClose} title="Fermer le panneau" aria-label="Fermer le panneau Docker">
          ×
        </button>
      </div>
      <div className={header.ok ? "docker-conn ok" : "docker-conn error"} role="status">
        {header.text}
      </div>
      {list?.status === "connected" && (
        <>
          <input className="docker-filter" type="search" placeholder="Filtrer les conteneurs…" value={text} onChange={(e) => setText(e.target.value)} aria-label="Filtrer les conteneurs" />
          <div className="docker-list" role="listbox" aria-multiselectable="true">
            {groups.length === 0 && <div className="docker-empty">{list.containers.length === 0 ? "Aucun conteneur." : "Aucun conteneur ne correspond."}</div>}
            {groups.map((g) => (
              <section key={g.project}>
                <h3 className="docker-group">
                  {g.project} <span className="docker-count">{g.containers.length}</span>
                </h3>
                {g.containers.map((c) => {
                  const dot = containerDot(c);
                  return (
                    <div
                      key={c.id}
                      role="option"
                      aria-selected={selected.has(c.name)}
                      aria-disabled={!c.readable}
                      className={`docker-row${selected.has(c.name) ? " selected" : ""}${c.readable ? "" : " disabled"}`}
                      title={c.readable ? `${c.name}\n${c.image}\n${c.status}` : `${c.name}\nLogs indisponibles : pilote de log « ${c.logDriver ?? "none"} » (rien à lire côté Docker).`}
                      onClick={(e) => {
                        setSelected(nextSelection(order, selected, anchor.current, c.name, { ctrl: e.ctrlKey || e.metaKey, shift: e.shiftKey }));
                        if (!e.shiftKey) anchor.current = c.name;
                      }}
                      onDoubleClick={() => c.readable && onOpen([c.name])}
                    >
                      <span className={`docker-dot dot-${dot}`} aria-label={dot} />
                      <span className="docker-name">{c.composeService ? `${c.composeService} · ${c.name}` : c.name}</span>
                      {openNames.has(c.name) && <WhaleIcon />}
                      <span className="docker-state">{c.readable ? c.state : "log: none"}</span>
                    </div>
                  );
                })}
              </section>
            ))}
          </div>
          <div className="docker-foot">
            <span className="docker-hint">Double-clic pour ouvrir · Ctrl / Maj pour plusieurs</span>
            <button type="button" disabled={openable.length === 0} onClick={() => onOpen(openable)}>
              Ouvrir{openable.length > 0 ? ` (${openable.length})` : ""}
            </button>
          </div>
        </>
      )}
    </aside>
  );
}
