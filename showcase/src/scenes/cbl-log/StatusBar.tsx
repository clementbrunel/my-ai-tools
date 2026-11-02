import type { Texts } from './data'
import './StatusBar.css'

const icon = { width: 12, height: 12, viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true } as const

interface StatusProps {
  t: Texts; count: string; fold: boolean; onFold: () => void
  paused: boolean; pending: number; onPause: () => void; follow: boolean; onFollow: () => void
}
/** Status bar: line count, file info, fold switch, then Pause / Suivre together in the bottom right corner. */
export default function StatusBar({ t, count, fold, onFold, paused, pending, onPause, follow, onFollow }: StatusProps) {
  return (
    <div className="cbl-status">
      <span className="count">{count}</span>
      <span className="sep meta-sep" aria-hidden="true" />
      <span className="meta">Spring Boot · UTF-8</span>
      <label className="fold-toggle">
        <input type="checkbox" role="switch" className="switch" checked={fold} onChange={onFold} />
        {t.fold}
      </label>
      <span className="live">
        <button type="button" className={`pause ${paused ? 'on' : ''}`} aria-pressed={paused} onClick={onPause}>
          <svg {...icon}><path d="M5.5 3.5v9M10.5 3.5v9" strokeWidth={2.2} /></svg>
          {paused ? `${t.pause} (+${pending})` : t.pause}
        </button>
        {/* lit while following; it only brings the view back to the end, scrolling up is what turns it off */}
        <button type="button" className={`follow ${follow ? 'on' : ''}`} aria-pressed={follow} disabled={follow} onClick={onFollow}>
          <svg {...icon}><path d="M8 2.5v9M4 8l4 4 4-4M3.5 14h9" /></svg>
          {t.follow}
        </button>
      </span>
    </div>
  )
}
