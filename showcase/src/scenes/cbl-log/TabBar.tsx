import { TABS, TAB_IDS, type TabId } from './data'

/** Title bar: app icon, one tab per log file (with its unseen-lines badge when inactive), window controls. */
export default function TabBar({ tab, unseen, onSelect }: { tab: TabId; unseen: Record<TabId, number>; onSelect: (id: TabId) => void }) {
  return (
    <div className="cbl-title">
      <img src="./icons/cbl-log.svg" alt="" width={16} height={16} />
      <span className="cbl-tabs" role="tablist">
        {TAB_IDS.map((id) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} className={`cbl-tab ${tab === id ? 'on' : ''}`} onClick={() => onSelect(id)}>
            {TABS[id].name}
            {tab !== id && unseen[id] > 0 && <span className="badge">{unseen[id] > 999 ? '999+' : unseen[id]}</span>}
          </button>
        ))}
      </span>
      <span className="cbl-tab add" aria-hidden="true">+</span>
      <span className="cbl-win" aria-hidden="true"><i /><i /><i /></span>
    </div>
  )
}
