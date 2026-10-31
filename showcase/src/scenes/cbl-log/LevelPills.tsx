import { LEVELS, type Level, type Texts } from './data'
import { lvlClass } from './view'
import './LevelPills.css'

/** Level toggles of the command bar: a level switched off hides its lines (dashed border, empty square). */
export default function LevelPills({ t, levels, onToggle }: { t: Texts; levels: Set<Level>; onToggle: (l: Level) => void }) {
  return (
    <span className="cbl-pills" role="group" aria-label={t.levels}>
      {LEVELS.map((l) => (
        <button key={l} type="button" role="checkbox" aria-checked={levels.has(l)} className={`cbl-pill ${lvlClass(l)} ${levels.has(l) ? 'on' : ''}`} onClick={() => onToggle(l)}>
          <i aria-hidden="true" />{l}
        </button>
      ))}
    </span>
  )
}
