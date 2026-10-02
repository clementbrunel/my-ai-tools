import { useEffect, useRef, useState } from 'react'
import type { Lang } from '../apps'
import SceneFrame, { type SceneProps } from '../components/SceneFrame'

type Line = [string, string]

/** What the terminal shows on load: the bare `ai-env-manager` scan. */
const scan: Line[] = [
  ['cmd', '$ ai-env-manager'],
  ['ok', '✔ 4 MCP servers healthy'],
  ['ok', '✔ CLAUDE.md · 2 skills · 3 hooks'],
  ['warn', '⚠ hook pre-commit: exit 1'],
  ['warn', '↑ 2 tools outdated'],
]

/** Commands the visitor can run after it (the real CLI also has `verify` and `migrate`); `again` is the output of a second run. */
const commands: { label: string; out: Line[]; again?: Line[] }[] = [
  {
    label: 'update',
    out: [
      ['cmd', '$ ai-env-manager update'],
      ['ok', '✔ upgraded headroom, caveman'],
    ],
    again: [
      ['cmd', '$ ai-env-manager update'],
      ['ok', '✅ All tools are up to date.'],
    ],
  },
  {
    label: 'prepare',
    out: [
      ['cmd', '$ ai-env-manager prepare'],
      ['ok', '✓ token · headroom déjà installé'],
      ['warn', '○ memory · aucun outil détecté'],
      ['ok', '→ suggestion : mempalace'],
      ['ok', '  ai-env-manager prepare --with mempalace'],
    ],
  },
]
const MAX_LINES = 9
const STEP_MS = 320

/** Terminal showing the scan; the command buttons append their output line by line. */
function Terminal({ lang }: { lang: Lang }) {
  const [history, setHistory] = useState<Line[]>(scan)
  const [busy, setBusy] = useState(false)
  const done = useRef(new Set<number>())
  const timer = useRef<number>()
  useEffect(() => () => window.clearInterval(timer.current), [])

  const run = (i: number) => {
    if (busy) return
    const queue = done.current.has(i) ? commands[i].again ?? commands[i].out : commands[i].out
    done.current.add(i)
    setBusy(true)
    let n = 0
    timer.current = window.setInterval(() => {
      const line = queue[n++]
      setHistory((h) => [...h, line])
      if (n >= queue.length) { window.clearInterval(timer.current); setBusy(false) }
    }, STEP_MS)
  }

  return (
    <div className="stage">
      <div className="term">
        <div className="dots"><i /><i /><i /><span>~/my-project</span></div>
        <pre>{history.map(([k, l], i) => i < history.length - MAX_LINES ? null : <div key={i} className={k}>{l}{i === history.length - 1 && <span className="cursor"> ▋</span>}</div>)}</pre>
        <div className="term-btns" role="group" aria-label={lang === 'fr' ? 'Lancer une commande' : 'Run a command'}>
          {commands.map((c, i) => <button key={c.label} type="button" disabled={busy} onClick={() => run(i)}>{c.label}</button>)}
        </div>
      </div>
    </div>
  )
}

export default function AiEnvManagerScene(props: SceneProps) {
  return <SceneFrame {...props} art={() => <Terminal lang={props.lang} />} />
}
