import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import type { Lang } from '../apps'
import SceneFrame, { type SceneProps } from '../components/SceneFrame'

type Level = 'ERROR' | 'WARN' | 'INFO' | 'DEBUG'
interface Entry { id: number; n: number; time: string; level: Level; msg: string; stack?: string[] }
/** One displayed line: an entry, or one line of its stack trace. */
type Line = { kind: 'entry'; e: Entry } | { kind: 'stack'; e: Entry; i: number }

type Pool = [Level, string, number, string[]?][]
/** Fake application log: [level, message, weight, stack trace]. `user=…` tokens are highlighted by the default profile. */
const appPool: Pool = [
  ['INFO', 'GET /api/orders 200 · 38 ms', 5],
  ['INFO', 'login ok user=alice', 3],
  ['DEBUG', 'cache hit ratio 0.93', 3],
  ['INFO', 'ws client connected user=dave', 2],
  ['INFO', 'nightly-export done · 12 480 rows', 2],
  ['WARN', 'pool: slow connection (812 ms) user=bob', 2],
  ['WARN', 'http 429 rate limited user=carol', 2],
  ['ERROR', 'db timeout on GET /api/orders/42', 1, [
    'java.sql.SQLTimeoutException: query timed out after 5000 ms',
    '  at com.zaxxer.hikari.pool.ProxyStatement.executeQuery(ProxyStatement.java:110)',
    '  at com.shop.repo.OrderRepository.find(OrderRepository.java:57)',
    '  at com.shop.service.OrderService.get(OrderService.java:42)',
    '  at com.shop.api.OrderController.show(OrderController.java:31)',
  ]],
  ['ERROR', 'unhandled exception on POST /api/orders user=erin', 1, [
    'java.lang.NullPointerException: customer is null',
    '  at com.shop.service.OrderService.save(OrderService.java:118)',
    '  at com.shop.api.OrderController.create(OrderController.java:64)',
    '  at org.springframework.web.servlet.FrameworkServlet.service(FrameworkServlet.java:897)',
    '  at jakarta.servlet.http.HttpServlet.service(HttpServlet.java:614)',
    '  ... 48 more',
  ]],
]
/** Second tab: a server that writes less often, so its unseen-lines badge is easy to follow. */
const serverPool: Pool = [
  ['INFO', 'GET /health 200 · 2 ms', 4],
  ['INFO', 'POST /api/payments 201 · 112 ms user=frank', 3],
  ['DEBUG', 'gc pause 14 ms', 2],
  ['WARN', 'disk usage 87 % on /var/log', 1],
  ['ERROR', 'payment gateway unreachable user=grace', 1, [
    'java.net.ConnectException: Connection refused',
    '  at java.base/sun.nio.ch.Net.connect(Net.java:579)',
    '  at com.shop.pay.GatewayClient.charge(GatewayClient.java:73)',
    '  at com.shop.pay.PaymentService.pay(PaymentService.java:40)',
  ]],
]
const LEVELS: Level[] = ['ERROR', 'WARN', 'INFO', 'DEBUG']
const pick = (pool: Pool) => {
  let r = Math.random() * pool.reduce((s, p) => s + p[2], 0)
  for (const p of pool) if ((r -= p[2]) < 0) return p
  return pool[0]
}
const clock = (ago = 0) => {
  const d = new Date(Date.now() - ago)
  const z = (v: number, l = 2) => String(v).padStart(l, '0')
  return `${z(d.getHours())}:${z(d.getMinutes())}:${z(d.getSeconds())}.${z(d.getMilliseconds(), 3)}`
}

let uid = 0
const KEEP = 150
/** The two tabs: pool, first line number, lines shown on load (indexes into the pool), write period. */
const TABS = {
  app: { name: 'app.log', pool: appPool, first: 1281, seed: [0, 1, 2, 5, 0, 4, 1, 7, 3, 6, 0], every: 900 },
  server: { name: 'server.log', pool: serverPool, first: 5402, seed: [0, 1, 0, 2, 0, 3, 1, 4, 0, 0, 1], every: 1400 },
}
type TabId = keyof typeof TABS
const TAB_IDS = Object.keys(TABS) as TabId[]
/** One value per tab, built the same way for all of them. */
const perTab = <T,>(f: (id: TabId) => T) => Object.fromEntries(TAB_IDS.map((id) => [id, f(id)])) as Record<TabId, T>
/** Copy of `s` with `v` added or removed. */
const toggled = <T,>(s: Set<T>, v: T) => { const n = new Set(s); if (n.has(v)) n.delete(v); else n.add(v); return n }

const make = (p: Pool[number], n: number, time: string): Entry =>
  ({ id: uid++, n, time, level: p[0], msg: p[1], stack: p[3] })
/** Next file line number: an entry with a stack trace uses one line per stack line too. */
const next = (e: Entry) => e.n + 1 + (e.stack?.length ?? 0)

const txt = {
  fr: { levels: 'Niveaux affichés', filter: 'Filtrer (Ctrl+Maj+F)', include: 'Inclure (Entrée)', regex: 'Expression régulière', remove: 'Retirer', fold: 'Replier les traces', lines: (n: number) => `ligne${n > 1 ? 's' : ''}`, of: 'sur', pause: 'Pause', follow: 'Suivre', hint: 'Décoche un niveau, filtre un texte, déplie une trace, remonte dans le log.' },
  en: { levels: 'Levels shown', filter: 'Filter (Ctrl+Shift+F)', include: 'Include (Enter)', regex: 'Regular expression', remove: 'Remove', fold: 'Fold traces', lines: (n: number) => `line${n > 1 ? 's' : ''}`, of: 'of', pause: 'Pause', follow: 'Follow', hint: 'Untick a level, filter a text, unfold a trace, scroll up the log.' },
}

const USER_RE = /(user=\w+)/
const icon = { width: 12, height: 12, viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true } as const

/** Message with the default profile's `user=…` highlight. */
function Msg({ msg }: { msg: string }): ReactNode {
  return msg.split(USER_RE).map((part, i) => (i % 2 ? <mark key={i}>{part}</mark> : part))
}

interface Include { pattern: string; regex: boolean }
const matcher = (inc: Include) => {
  if (!inc.regex) { const p = inc.pattern.toLowerCase(); return (s: string) => s.toLowerCase().includes(p) }
  try { const re = new RegExp(inc.pattern, 'i'); return (s: string) => re.test(s) } catch { return () => false }
}
const validRegex = (s: string) => { try { new RegExp(s); return true } catch { return false } }

/** cbl-log window, laid out like the app: level pills and filter in the command bar, fold switch and Pause / Suivre in the status bar. */
function LiveTail({ lang }: { lang: Lang }) {
  const t = txt[lang]
  const [streams, setStreams] = useState(() => perTab((id) => {
    const { pool, first, seed, every } = TABS[id]
    const out: Entry[] = []
    seed.forEach((i, k) => out.push(make(pool[i], out.length ? next(out[out.length - 1]) : first, clock((seed.length - k) * every))))
    return out
  }))
  const [tab, setTab] = useState<TabId>('app')
  /** New lines written in a tab that is not the active one (the badge on its title). */
  const [unseen, setUnseen] = useState(() => perTab(() => 0))
  const activeRef = useRef<TabId>('app')
  activeRef.current = tab
  const entries = streams[tab]
  const [levels, setLevels] = useState<Set<Level>>(() => new Set(LEVELS))
  const [includes, setIncludes] = useState<Include[]>([])
  const [text, setText] = useState('')
  const [isRegex, setRegex] = useState(false)
  const [fold, setFold] = useState(true)
  const [open, setOpen] = useState<Set<number>>(() => new Set())
  /** Suivre: keep the view on the last line. Scrolling up turns it off, scrolling back to the end turns it on (as in the app). */
  const [follow, setFollow] = useState(true)
  /** Pause: last entry id rendered while the view is frozen; the lines written meanwhile are counted, shown on resume. */
  const [frozenAt, setFrozenAt] = useState<number | null>(null)
  const winRef = useRef<HTMLDivElement>(null)
  const logRef = useRef<HTMLDivElement>(null)
  const visible = useRef(true)

  // only stream while the window is on screen and the tab visible
  useEffect(() => {
    const el = winRef.current
    if (!el || !('IntersectionObserver' in window)) return
    const io = new IntersectionObserver(([e]) => { visible.current = e.isIntersecting })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    const ids = TAB_IDS.map((id) => window.setInterval(() => {
      if (!visible.current || document.hidden) return
      setStreams((s) => ({ ...s, [id]: [...s[id], make(pick(TABS[id].pool), next(s[id][s[id].length - 1]), clock())].slice(-KEEP) }))
      if (activeRef.current !== id) setUnseen((u) => ({ ...u, [id]: u[id] + 1 }))
    }, TABS[id].every))
    return () => ids.forEach(window.clearInterval)
  }, [])

  const switchTab = (id: TabId) => {
    if (id === tab) return
    setTab(id)
    setUnseen((u) => ({ ...u, [id]: 0 }))
    setOpen(new Set()); setFollow(true); setFrozenAt(null)
  }

  const last = entries[entries.length - 1]
  const paused = frozenAt !== null
  const togglePause = () => setFrozenAt(paused ? null : last.id)
  /** Suivre only brings the view back to the end; it is turned off by scrolling up. */
  const resumeFollow = () => setFollow(true)

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

  const tests = includes.map(matcher)
  const lines: Line[] = []
  let matched = 0
  for (const e of entries) {
    if (frozenAt !== null && e.id > frozenAt) break
    if (!levels.has(e.level)) continue
    if (tests.length && !tests.some((f) => f(e.msg))) continue
    matched++
    lines.push({ kind: 'entry', e })
    if (e.stack && (!fold || open.has(e.id))) e.stack.forEach((_, i) => lines.push({ kind: 'stack', e, i }))
  }
  const pending = frozenAt === null ? 0 : entries.filter((e) => e.id > frozenAt).length
  const totalLines = next(last) - 1
  const filtered = levels.size < LEVELS.length || includes.length > 0

  const toggleLevel = (l: Level) => setLevels((s) => toggled(s, l))
  const toggleOpen = (id: number) => setOpen((s) => toggled(s, id))
  const invalid = isRegex && text !== '' && !validRegex(text)
  const add = () => {
    if (!text.trim() || invalid) return
    setIncludes((l) => [...l, { pattern: text.trim(), regex: isRegex }])
    setText('')
  }

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
          <div className={`cbl-field ${invalid ? 'invalid' : ''}`} role="search">
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" aria-hidden="true"><path d="M2 3h12L9.5 8.5V13l-3 1.5v-6z" /></svg>
            {includes.map((inc, i) => (
              <span key={`${inc.pattern}-${i}`} className="cbl-chip">+ {inc.pattern}
                <button type="button" aria-label={`${t.remove} ${inc.pattern}`} onClick={() => setIncludes((l) => l.filter((_, k) => k !== i))}>×</button>
              </span>
            ))}
            <input value={text} placeholder={includes.length ? '' : t.filter} aria-label={t.filter} title={t.include}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add() } else if (e.key === 'Escape') setText('') }} />
            <button type="button" className={`opt ${isRegex ? 'on' : ''}`} aria-pressed={isRegex} title={t.regex} onClick={() => setRegex((v) => !v)}>.*</button>
            <span className="sep" aria-hidden="true" />
            <button type="button" className="opt inc" title={t.include} aria-label={t.include} disabled={!text.trim() || invalid} onClick={add}>+</button>
          </div>
          <span className="cbl-pills" role="group" aria-label={t.levels}>
            {LEVELS.map((l) => (
              <button key={l} type="button" role="checkbox" aria-checked={levels.has(l)} className={`cbl-pill lvl-${l.toLowerCase()} ${levels.has(l) ? 'on' : ''}`} onClick={() => toggleLevel(l)}>
                <i aria-hidden="true" />{l}
              </button>
            ))}
          </span>
        </div>
        <div className="cbl-log" ref={logRef} onScroll={onScroll} tabIndex={0}>
          {lines.map((l) => l.kind === 'stack'
            ? (
              <div key={`${l.e.id}-${l.i}`} className="cbl-row stack">
                <span className="ln">{l.e.n + 1 + l.i}</span>
                <span className="msg">{l.e.stack![l.i]}</span>
              </div>
            )
            : (
              <div key={l.e.id} className={`cbl-row ${l.e.level === 'ERROR' ? 'hl-err' : l.e.level === 'WARN' ? 'hl-warn' : ''}`}>
                <span className="ln">{l.e.n}</span>
                <span className="ts">{l.e.time}</span>
                <span className={`lv ${l.e.level.toLowerCase()}`}>{l.e.level.padEnd(5)}</span>
                <span className="msg"><Msg msg={l.e.msg} /></span>
                {l.e.stack && fold && (
                  <button type="button" className={`fold-badge ${open.has(l.e.id) ? 'open' : ''}`} aria-expanded={open.has(l.e.id)} onClick={() => toggleOpen(l.e.id)}>
                    {open.has(l.e.id) ? '▾' : '▸'} +{l.e.stack.length} {t.lines(l.e.stack.length)}
                  </button>
                )}
              </div>
            ))}
        </div>
        <div className="cbl-status">
          <span className="count">{filtered ? `${matched.toLocaleString(lang)} ${t.of} ${totalLines.toLocaleString(lang)} ${t.lines(2)}` : `${totalLines.toLocaleString(lang)} ${t.lines(2)}`}</span>
          <span className="sep meta-sep" aria-hidden="true" />
          <span className="meta">Spring Boot · UTF-8</span>
          <label className="fold-toggle">
            <input type="checkbox" role="switch" className="switch" checked={fold} onChange={() => { setFold((v) => !v); setOpen(new Set()) }} />
            {t.fold}
          </label>
          <span className="live">
            <button type="button" className={`pause ${paused ? 'on' : ''}`} aria-pressed={paused} onClick={togglePause}>
              <svg {...icon}><path d="M5.5 3.5v9M10.5 3.5v9" strokeWidth={2.2} /></svg>
              {paused ? `${t.pause} (+${pending})` : t.pause}
            </button>
            <button type="button" className={`follow ${follow ? 'on' : ''}`} aria-pressed={follow} disabled={follow} onClick={resumeFollow}>
              <svg {...icon}><path d="M8 2.5v9M4 8l4 4 4-4M3.5 14h9" /></svg>
              {t.follow}
            </button>
          </span>
        </div>
      </div>
      <p className="cbl-hint">{t.hint}</p>
    </div>
  )
}

export default function CblLogScene(props: SceneProps) {
  return <SceneFrame {...props} flip art={() => <LiveTail lang={props.lang} />} />
}
