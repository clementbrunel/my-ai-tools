import type { ReactNode } from 'react'
import type { Texts } from './data'
import { lvlClass, type Line } from './view'
import './LogLine.css'

const USER_RE = /(user=\w+)/
/** Message with the default profile's `user=…` highlight. */
const Msg = ({ msg }: { msg: string }): ReactNode => msg.split(USER_RE).map((part, i) => (i % 2 ? <mark key={i}>{part}</mark> : part))

/** A record (with its fold badge while traces are folded) or one of its stack trace lines. */
export default function LogLine({ line, t, fold, open, onToggle }: { line: Line; t: Texts; fold: boolean; open: boolean; onToggle: () => void }) {
  const { e } = line
  if (line.kind === 'stack') {
    return <div className="cbl-row stack"><span className="ln">{e.n + 1 + line.i}</span><span className="msg">{e.stack![line.i]}</span></div>
  }
  return (
    <div className={`cbl-row ${lvlClass(e.level)}`}>
      <span className="ln">{e.n}</span>
      <span className="ts">{e.time}</span>
      <span className="lv">{e.level.padEnd(5)}</span>
      <span className="msg"><Msg msg={e.msg} /></span>
      {e.stack && fold && (
        <button type="button" className={`fold-badge ${open ? 'open' : ''}`} aria-expanded={open} onClick={onToggle}>
          {open ? '▾' : '▸'} +{e.stack.length} {t.lines(e.stack.length)}
        </button>
      )}
    </div>
  )
}
