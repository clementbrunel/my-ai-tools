import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { Lang } from '../apps'
import SceneFrame, { type SceneProps } from '../components/SceneFrame'

type Level = 'INFO' | 'DEBUG' | 'WARN' | 'ERROR'
interface Entry { id: number; n: number; time: string; level: Level; msg: string; stack?: string[] }
/** One displayed line: an entry, or one line of its stack trace. */
type Line = { kind: 'entry'; e: Entry } | { kind: 'stack'; e: Entry; i: number }

/** Fake application log: [level, message, weight, stack trace]. `user=…` tokens are what the regex rule highlights. */
const pool: [Level, string, number, string[]?][] = [
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
const total = pool.reduce((s, p) => s + p[2], 0)
const pick = () => {
  let r = Math.random() * total
  for (const p of pool) if ((r -= p[2]) < 0) return p
  return pool[0]
}
const clock = (ago = 0) => {
  const d = new Date(Date.now() - ago)
  const z = (v: number, l = 2) => String(v).padStart(l, '0')
  return `${z(d.getHours())}:${z(d.getMinutes())}:${z(d.getSeconds())}.${z(d.getMilliseconds(), 3)}`
}

let uid = 0
const STEP_MS = 900
const KEEP = 40
const ROWS = 11
const FIRST_LINE = 1281
/** Indexes into `pool` for the lines shown on load: every rule has something to show right away. */
const seed = [0, 1, 2, 5, 0, 4, 1, 7, 3, 6, 0]

const make = (p: (typeof pool)[number], n: number, time: string): Entry =>
  ({ id: uid++, n, time, level: p[0], msg: p[1], stack: p[3] })
/** Next file line number: an entry with a stack trace uses one line per stack line too. */
const next = (e: Entry) => e.n + 1 + (e.stack?.length ?? 0)

const txt = {
  fr: { rules: 'Niveaux et règles', fold: 'Replier les stack traces', lines: (n: number) => `ligne${n > 1 ? 's' : ''}`, follow: 'Suivi', paused: 'En pause', hint: 'Décoche un niveau pour le masquer, déplie une stack trace.' },
  en: { rules: 'Levels and rules', fold: 'Fold stack traces', lines: (n: number) => `line${n > 1 ? 's' : ''}`, follow: 'Following', paused: 'Paused', hint: 'Untick a level to hide it, unfold a stack trace.' },
}

const USER_RE = /(user=\w+)/

/** Message with `user=…` wrapped when the regex rule is on. */
function Msg({ msg, regex }: { msg: string; regex: boolean }): ReactNode {
  if (!regex) return msg
  return msg.split(USER_RE).map((part, i) => (i % 2 ? <mark key={i}>{part}</mark> : part))
}

/** cbl-log window: lines stream in; the visitor filters levels, toggles a regex rule and folds / unfolds stack traces. */
function LiveTail({ lang }: { lang: Lang }) {
  const t = txt[lang]
  const [entries, setEntries] = useState<Entry[]>(() => {
    const out: Entry[] = []
    seed.forEach((i, k) => out.push(make(pool[i], out.length ? next(out[out.length - 1]) : FIRST_LINE, clock((seed.length - k) * STEP_MS))))
    return out
  })
  const [show, setShow] = useState({ error: true, warn: true })
  const [regex, setRegex] = useState(false)
  const [fold, setFold] = useState(true)
  const [open, setOpen] = useState<Set<number>>(() => new Set())
  const [hover, setHover] = useState(false)
  const winRef = useRef<HTMLDivElement>(null)
  const visible = useRef(true)
  const paused = useRef(false)
  paused.current = hover

  // only stream while the window is on screen, the tab visible and the pointer not on the log (time to click)
  useEffect(() => {
    const el = winRef.current
    if (!el || !('IntersectionObserver' in window)) return
    const io = new IntersectionObserver(([e]) => { visible.current = e.isIntersecting })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    const id = window.setInterval(() => {
      if (!visible.current || paused.current || document.hidden) return
      setEntries((r) => [...r, make(pick(), next(r[r.length - 1]), clock())].slice(-KEEP))
    }, STEP_MS)
    return () => window.clearInterval(id)
  }, [])

  const lines: Line[] = []
  for (const e of entries) {
    if ((e.level === 'ERROR' && !show.error) || (e.level === 'WARN' && !show.warn)) continue
    lines.push({ kind: 'entry', e })
    if (e.stack && (!fold || open.has(e.id))) e.stack.forEach((_, i) => lines.push({ kind: 'stack', e, i }))
  }
  const shown = lines.slice(-ROWS)
  const last = entries[entries.length - 1]

  const toggleOpen = (id: number) => setOpen((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const lvl = (e: Entry) => (e.level === 'ERROR' ? 'hl-err' : e.level === 'WARN' ? 'hl-warn' : '')

  return (
    <div className="stage">
      <div className="cbl" ref={winRef}>
        <div className="cbl-title">
          <img src="./icons/cbl-log.svg" alt="" width={16} height={16} />
          <span className="cbl-tab on">app.log</span>
          <span className="cbl-tab">server.log</span>
          <span className="cbl-win" aria-hidden="true"><i /><i /><i /></span>
        </div>
        <div className="cbl-bar" role="group" aria-label={t.rules}>
          <button type="button" className={`chip err ${show.error ? 'on' : ''}`} aria-pressed={show.error} onClick={() => setShow((s) => ({ ...s, error: !s.error }))}><i />ERROR</button>
          <button type="button" className={`chip warn ${show.warn ? 'on' : ''}`} aria-pressed={show.warn} onClick={() => setShow((s) => ({ ...s, warn: !s.warn }))}><i />WARN</button>
          <button type="button" className={`chip rx ${regex ? 'on' : ''}`} aria-pressed={regex} onClick={() => setRegex((v) => !v)}><i />/user=\w+/</button>
          <span className="cbl-sep" />
          <button type="button" className={`chip fold ${fold ? 'on' : ''}`} aria-pressed={fold} onClick={() => { setFold((v) => !v); setOpen(new Set()) }}><i />{t.fold}</button>
        </div>
        <div className="cbl-log" onPointerEnter={() => setHover(true)} onPointerLeave={() => setHover(false)}>
          {shown.map((l) => l.kind === 'stack'
            ? (
              <div key={`${l.e.id}-${l.i}`} className="cbl-row stack">
                <span className="ln">{l.e.n + 1 + l.i}</span>
                <span className="msg">{l.e.stack![l.i]}</span>
              </div>
            )
            : (
              <div key={l.e.id} className={`cbl-row ${lvl(l.e)}`}>
                <span className="ln">{l.e.n}</span>
                <span className="ts">{l.e.time}</span>
                <span className={`lv ${l.e.level.toLowerCase()}`}>{l.e.level.padEnd(5)}</span>
                <span className="msg"><Msg msg={l.e.msg} regex={regex} /></span>
                {l.e.stack && fold && (
                  <button type="button" className={`fold-badge ${open.has(l.e.id) ? 'open' : ''}`} aria-expanded={open.has(l.e.id)} onClick={() => toggleOpen(l.e.id)}>
                    {open.has(l.e.id) ? '▾' : '▸'} +{l.e.stack.length} {t.lines(l.e.stack.length)}
                  </button>
                )}
              </div>
            ))}
        </div>
        <div className="cbl-status">
          <span>UTF-8 · {(next(last) - 1).toLocaleString(lang)} {t.lines(2)}</span>
          <span className={`live ${hover ? 'off' : ''}`}><i />{hover ? t.paused : t.follow}</span>
        </div>
      </div>
      <p className="cbl-hint">{t.hint}</p>
    </div>
  )
}

export default function CblLogScene(props: SceneProps) {
  return <SceneFrame {...props} flip art={() => <LiveTail lang={props.lang} />} />
}
