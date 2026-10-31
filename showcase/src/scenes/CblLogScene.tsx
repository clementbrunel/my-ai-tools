import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Lang } from '../apps'
import SceneFrame, { type SceneProps } from '../components/SceneFrame'
import { LEVELS, TABS, TAB_IDS, nextLine, seedStream, txt, writeLine, type Entry, type Level, type TabId, type Texts } from './cblLogData'

/** One displayed line: a record, or one line of its stack trace. */
type Line = { kind: 'entry'; e: Entry } | { kind: 'stack'; e: Entry; i: number }
interface Include { pattern: string; regex: boolean }
interface View { levels: Set<Level>; includes: Include[]; fold: boolean; open: Set<number>; frozenAt: number | null }

/** One value per tab, built the same way for all of them. */
const perTab = <T,>(f: (id: TabId) => T) => Object.fromEntries(TAB_IDS.map((id) => [id, f(id)])) as Record<TabId, T>
/** Copy of `s` with `v` added or removed. */
const toggled = <T,>(s: Set<T>, v: T) => { const n = new Set(s); if (n.has(v)) n.delete(v); else n.add(v); return n }
const lvlClass = (l: Level) => `lvl-${l.toLowerCase()}`

const matcher = (inc: Include): ((s: string) => boolean) => {
  if (!inc.regex) { const p = inc.pattern.toLowerCase(); return (s) => s.toLowerCase().includes(p) }
  try { const re = new RegExp(inc.pattern, 'i'); return (s) => re.test(s) } catch { return () => false }
}
const validRegex = (s: string) => { try { new RegExp(s); return true } catch { return false } }

/** Lines to render: records of the shown levels matching an included text, each followed by its trace unless folded. Stops at the Pause point. */
function visibleLines(entries: Entry[], v: View, tests: ((s: string) => boolean)[]) {
  const lines: Line[] = []
  let matched = 0
  for (const e of entries) {
    if (v.frozenAt !== null && e.id > v.frozenAt) break
    if (!v.levels.has(e.level) || (tests.length && !tests.some((f) => f(e.msg)))) continue
    matched++
    lines.push({ kind: 'entry', e })
    if (e.stack && (!v.fold || v.open.has(e.id))) e.stack.forEach((_, i) => lines.push({ kind: 'stack', e, i }))
  }
  return { lines, matched }
}

const USER_RE = /(user=\w+)/
/** Message with the default profile's `user=…` highlight. */
const Msg = ({ msg }: { msg: string }): ReactNode => msg.split(USER_RE).map((part, i) => (i % 2 ? <mark key={i}>{part}</mark> : part))

const icon = { width: 12, height: 12, viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true } as const

/** Filter field of the command bar: Enter (or +) adds the text as an include chip, × removes it. */
function FilterField({ t, includes, onChange }: { t: Texts; includes: Include[]; onChange: (l: Include[]) => void }) {
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

/** Level toggles of the command bar: a level switched off hides its lines (dashed border, empty square). */
function LevelPills({ t, levels, onToggle }: { t: Texts; levels: Set<Level>; onToggle: (l: Level) => void }) {
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

/** A record (with its fold badge while traces are folded) or one of its stack trace lines. */
function LogLine({ line, t, fold, open, onToggle }: { line: Line; t: Texts; fold: boolean; open: boolean; onToggle: () => void }) {
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

interface StatusProps {
  t: Texts; count: string; fold: boolean; onFold: () => void
  paused: boolean; pending: number; onPause: () => void; follow: boolean; onFollow: () => void
}
/** Status bar: line count, file info, fold switch, then Pause / Suivre together in the bottom right corner. */
function StatusBar({ t, count, fold, onFold, paused, pending, onPause, follow, onFollow }: StatusProps) {
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

/** cbl-log window, laid out like the app: tabs, command bar (filter + level pills), scrolling log, status bar. */
function LiveTail({ lang }: { lang: Lang }) {
  const t = txt[lang]
  const [streams, setStreams] = useState(() => perTab(seedStream))
  const [tab, setTab] = useState<TabId>('app')
  /** New lines written in a tab that is not the active one (the badge on its title). */
  const [unseen, setUnseen] = useState(() => perTab(() => 0))
  const [levels, setLevels] = useState<Set<Level>>(() => new Set(LEVELS))
  const [includes, setIncludes] = useState<Include[]>([])
  const [fold, setFold] = useState(true)
  const [open, setOpen] = useState<Set<number>>(() => new Set())
  /** Suivre: keep the view on the last line. Scrolling up turns it off, scrolling back to the end turns it on. */
  const [follow, setFollow] = useState(true)
  /** Pause: last entry id rendered while frozen; the lines written meanwhile are counted, shown on resume. */
  const [frozenAt, setFrozenAt] = useState<number | null>(null)
  const winRef = useRef<HTMLDivElement>(null)
  const logRef = useRef<HTMLDivElement>(null)
  const visible = useRef(true)
  const activeRef = useRef(tab)
  activeRef.current = tab

  // only write while the window is on screen and the browser tab visible
  useEffect(() => {
    const el = winRef.current
    if (!el || !('IntersectionObserver' in window)) return
    const io = new IntersectionObserver(([e]) => { visible.current = e.isIntersecting })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    const timers = TAB_IDS.map((id) => window.setInterval(() => {
      if (!visible.current || document.hidden) return
      setStreams((s) => ({ ...s, [id]: writeLine(id, s[id]) }))
      if (activeRef.current !== id) setUnseen((u) => ({ ...u, [id]: u[id] + 1 }))
    }, TABS[id].every))
    return () => timers.forEach(window.clearInterval)
  }, [])

  // follow: stick to the end after every render (new line, unfolded trace, filter change…)
  useLayoutEffect(() => {
    const el = logRef.current
    if (el && follow) el.scrollTop = el.scrollHeight
  })
  const onScroll = () => {
    const el = logRef.current
    if (!el) return
    const atEnd = el.scrollHeight - el.scrollTop - el.clientHeight < 4
    if (atEnd !== follow) setFollow(atEnd)
  }

  const switchTab = (id: TabId) => {
    if (id === tab) return
    setTab(id)
    setUnseen((u) => ({ ...u, [id]: 0 }))
    setOpen(new Set()); setFollow(true); setFrozenAt(null)
  }

  const entries = streams[tab]
  const last = entries[entries.length - 1]
  const tests = useMemo(() => includes.map(matcher), [includes])
  const { lines, matched } = visibleLines(entries, { levels, includes, fold, open, frozenAt }, tests)
  const total = nextLine(last) - 1
  const filtered = levels.size < LEVELS.length || includes.length > 0
  const count = `${filtered ? `${matched.toLocaleString(lang)} ${t.of} ` : ''}${total.toLocaleString(lang)} ${t.lines(2)}`

  return (
    <div className="stage">
      <div className="cbl" ref={winRef}>
        <div className="cbl-title">
          <img src="./icons/cbl-log.svg" alt="" width={16} height={16} />
          <span className="cbl-tabs" role="tablist">
            {TAB_IDS.map((id) => (
              <button key={id} type="button" role="tab" aria-selected={tab === id} className={`cbl-tab ${tab === id ? 'on' : ''}`} onClick={() => switchTab(id)}>
                {TABS[id].name}
                {tab !== id && unseen[id] > 0 && <span className="badge">{unseen[id] > 999 ? '999+' : unseen[id]}</span>}
              </button>
            ))}
          </span>
          <span className="cbl-tab add" aria-hidden="true">+</span>
          <span className="cbl-win" aria-hidden="true"><i /><i /><i /></span>
        </div>
        <div className="cbl-top">
          <FilterField t={t} includes={includes} onChange={setIncludes} />
          <LevelPills t={t} levels={levels} onToggle={(l) => setLevels((s) => toggled(s, l))} />
        </div>
        <div className="cbl-log" ref={logRef} onScroll={onScroll} tabIndex={0}>
          {lines.map((l) => (
            <LogLine key={l.kind === 'stack' ? `${l.e.id}-${l.i}` : l.e.id} line={l} t={t} fold={fold} open={open.has(l.e.id)} onToggle={() => setOpen((s) => toggled(s, l.e.id))} />
          ))}
        </div>
        <StatusBar
          t={t} count={count}
          fold={fold} onFold={() => { setFold((v) => !v); setOpen(new Set()) }}
          paused={frozenAt !== null} pending={frozenAt === null ? 0 : entries.filter((e) => e.id > frozenAt).length}
          onPause={() => setFrozenAt(frozenAt === null ? last.id : null)}
          follow={follow} onFollow={() => setFollow(true)}
        />
      </div>
      <p className="cbl-hint">{t.hint}</p>
    </div>
  )
}

export default function CblLogScene(props: SceneProps) {
  return <SceneFrame {...props} flip art={() => <LiveTail lang={props.lang} />} />
}
