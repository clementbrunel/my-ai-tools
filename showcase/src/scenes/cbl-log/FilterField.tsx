import { useState } from 'react'
import type { Texts } from './data'
import { validRegex, type Include } from './view'

/** Filter field of the command bar: Enter (or +) adds the text as an include chip, × removes it. */
export default function FilterField({ t, includes, onChange }: { t: Texts; includes: Include[]; onChange: (l: Include[]) => void }) {
  const [text, setText] = useState('')
  const [isRegex, setRegex] = useState(false)
  const invalid = isRegex && text !== '' && !validRegex(text)
  const add = () => {
    if (!text.trim() || invalid) return
    onChange([...includes, { pattern: text.trim(), regex: isRegex }])
    setText('')
  }
  return (
    <div className={`cbl-field ${invalid ? 'invalid' : ''}`} role="search">
      <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" aria-hidden="true"><path d="M2 3h12L9.5 8.5V13l-3 1.5v-6z" /></svg>
      {includes.map((inc, i) => (
        <span key={`${inc.pattern}-${i}`} className="cbl-chip">+ {inc.pattern}
          <button type="button" aria-label={`${t.remove} ${inc.pattern}`} onClick={() => onChange(includes.filter((_, k) => k !== i))}>×</button>
        </span>
      ))}
      <input value={text} placeholder={includes.length ? '' : t.filter} aria-label={t.filter} title={t.include}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add() } else if (e.key === 'Escape') setText('') }} />
      <button type="button" className={`opt ${isRegex ? 'on' : ''}`} aria-pressed={isRegex} title={t.regex} onClick={() => setRegex((v) => !v)}>.*</button>
      <span className="sep" aria-hidden="true" />
      <button type="button" className="opt inc" title={t.include} aria-label={t.include} disabled={!text.trim() || invalid} onClick={add}>+</button>
    </div>
  )
}
