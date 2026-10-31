import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { Lang } from '../../apps'
import { LEVELS, TABS, TAB_IDS, nextLine, seedStream, txt, writeLine, type Level, type TabId } from './data'
import { matcher, perTab, toggled, visibleLines, type Include } from './view'
import FilterField from './FilterField'
import LevelPills from './LevelPills'
import LogLine from './LogLine'
import StatusBar from './StatusBar'
import TabBar from './TabBar'

/** cbl-log window, laid out like the app: tabs, command bar (filter + level pills), scrolling log, status bar. */
export default function LiveTail({ lang }: { lang: Lang }) {
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
        <TabBar tab={tab} unseen={unseen} onSelect={switchTab} />
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
