import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { Lang } from '../apps'
import SceneFrame, { type SceneProps } from '../components/SceneFrame'

type Level = 'INFO' | 'DEBUG' | 'WARN' | 'ERROR'
interface Row { id: number; n: number; time: string; level: Level; msg: string; roll?: boolean }

/** Fake application log: [level, message, weight]. `user=…` tokens are what the regex rule highlights. */
const pool: [Level, string, number][] = [
  ['INFO', 'GET /api/orders 200 · 38 ms', 5],
  ['INFO', 'login ok user=alice', 3],
  ['DEBUG', 'cache hit ratio 0.93', 3],
  ['INFO', 'ws client connected user=dave', 2],
  ['INFO', 'nightly-export done · 12 480 rows', 2],
  ['WARN', 'pool: slow connection (812 ms) user=bob', 2],
  ['WARN', 'http 429 rate limited user=carol', 2],
  ['ERROR', 'db timeout after 5000 ms on orders#42', 1],
  ['ERROR', 'NullPointerException at OrderService.java:118', 1],
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
const STEP_MS = 650
const KEEP = 60
const FIRST_LINE = 1281
/** Indexes into `pool` for the lines shown on load. */
const seed = [0, 1, 2, 5, 0, 7, 3, 0, 6]

const txt = {
  fr: { rules: 'Règles de surlignage', errors: 'Erreurs seules', roll: 'Simuler un rolling', follow: 'Suivi', lines: 'lignes', lost: 'ligne perdue', rolled: 'rotation', hint: 'Active les règles, filtre, ou fais tourner le fichier.' },
  en: { rules: 'Highlight rules', errors: 'Errors only', roll: 'Simulate a rollover', follow: 'Following', lines: 'lines', lost: 'line lost', rolled: 'rollover', hint: 'Toggle rules, filter, or roll the file over.' },
}

const USER_RE = /(user=\w+)/

/** Message with `user=…` wrapped when the regex rule is on. */
function Msg({ msg, regex }: { msg: string; regex: boolean }): ReactNode {
  if (!regex) return msg
  return msg.split(USER_RE).map((part, i) => (i % 2 ? <mark key={i}>{part}</mark> : part))
}

/** cbl-log window: lines stream in, the visitor toggles highlight rules, the errors filter and a file rollover. */
function LiveTail({ lang }: { lang: Lang }) {
  const t = txt[lang]
  const [rows, setRows] = useState<Row[]>(() => {
    // fixed first screen so every highlight rule has something to show right away
    return seed.map((i, k) => ({ id: uid++, n: FIRST_LINE + k, time: clock((seed.length - k) * STEP_MS), level: pool[i][0], msg: pool[i][1] }))
  })
  const [rules, setRules] = useState({ error: true, warn: true, regex: false })
  const [errorsOnly, setErrorsOnly] = useState(false)
  const [rolls, setRolls] = useState(0)
  const [file, setFile] = useState('app.log')
  const winRef = useRef<HTMLDivElement>(null)
  const visible = useRef(true)
  const timers = useRef<number[]>([])

  // only stream while the window is on screen (and the tab visible)
  useEffect(() => {
    const el = winRef.current
    if (!el || !('IntersectionObserver' in window)) return
    const io = new IntersectionObserver(([e]) => { visible.current = e.isIntersecting })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    const id = window.setInterval(() => {
      if (!visible.current || document.hidden) return
      const [level, msg] = pick()
      setRows((r) => [...r, { id: uid++, n: r[r.length - 1].n + 1, time: clock(), level, msg }].slice(-KEEP))
    }, STEP_MS)
    return () => { window.clearInterval(id); timers.current.forEach(window.clearTimeout) }
  }, [])

  const roll = () => {
    setRolls((n) => n + 1)
    setFile('app.log → app.1.log')
    // the numbering restarts on the fresh file: the tail goes on with no gap
    setRows((r) => [...r, { id: uid++, n: 0, time: clock(), level: 'INFO' as Level, msg: '', roll: true }].slice(-KEEP))
    timers.current.push(window.setTimeout(() => setFile('app.log'), 1600))
  }

  const shown = rows.filter((r) => r.roll || !errorsOnly || r.level === 'ERROR' || r.level === 'WARN').slice(-11)
  const cls = (r: Row) => (r.level === 'ERROR' && rules.error ? 'hl-err' : r.level === 'WARN' && rules.warn ? 'hl-warn' : '')
  const toggle = (k: keyof typeof rules) => setRules((s) => ({ ...s, [k]: !s[k] }))

  return (
    <div className="stage">
      <div className="cbl" ref={winRef}>
        <div className="cbl-title">
          <img src="./icons/cbl-log.svg" alt="" width={16} height={16} />
          <span className="cbl-tab on">{file}</span>
          <span className="cbl-tab">server.log</span>
          <span className="cbl-win" aria-hidden="true"><i /><i /><i /></span>
        </div>
        <div className="cbl-bar" role="group" aria-label={t.rules}>
          <button type="button" className={`chip err ${rules.error ? 'on' : ''}`} aria-pressed={rules.error} onClick={() => toggle('error')}>ERROR</button>
          <button type="button" className={`chip warn ${rules.warn ? 'on' : ''}`} aria-pressed={rules.warn} onClick={() => toggle('warn')}>WARN</button>
          <button type="button" className={`chip rx ${rules.regex ? 'on' : ''}`} aria-pressed={rules.regex} onClick={() => toggle('regex')}>/user=\w+/</button>
          <span className="cbl-sep" />
          <button type="button" className={`chip flt ${errorsOnly ? 'on' : ''}`} aria-pressed={errorsOnly} onClick={() => setErrorsOnly((v) => !v)}>⏷ {t.errors}</button>
          <button type="button" className="chip roll" onClick={roll}>↻ {t.roll}</button>
        </div>
        <div className="cbl-log" aria-hidden="true">
          {shown.map((r) => r.roll
            ? <div key={r.id} className="cbl-row roll"><span className="ln" /><span>── app.log → app.1.log · 0 {t.lost} ──</span></div>
            : (
              <div key={r.id} className={`cbl-row ${cls(r)}`}>
                <span className="ln">{r.n}</span>
                <span className="ts">{r.time}</span>
                <span className={`lv ${r.level.toLowerCase()}`}>{r.level.padEnd(5)}</span>
                <span className="msg"><Msg msg={r.msg} regex={rules.regex} /></span>
              </div>
            ))}
        </div>
        <div className="cbl-status">
          <span>UTF-8 · {rows[rows.length - 1].n.toLocaleString(lang)} {t.lines}{rolls > 0 && ` · ${rolls} ${t.rolled}${rolls > 1 ? 's' : ''} · 0 ${t.lost}`}</span>
          <span className="live"><i />{t.follow}</span>
        </div>
      </div>
      <p className="cbl-hint">{t.hint}</p>
    </div>
  )
}

export default function CblLogScene(props: SceneProps) {
  return <SceneFrame {...props} flip art={() => <LiveTail lang={props.lang} />} />
}
