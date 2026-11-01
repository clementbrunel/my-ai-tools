import { useEffect, useRef, useState } from 'react'
import type { Lang } from '../../apps'
import { STEP_MS, commands, scan, txt, type Line } from './data'
import CommandButtons from './CommandButtons'
import TermOutput from './TermOutput'
import './Terminal.css'

/** Terminal showing the scan; the command buttons append their output line by line. */
export default function Terminal({ lang }: { lang: Lang }) {
  const [history, setHistory] = useState<Line[]>(scan)
  const [busy, setBusy] = useState(false)
  /** Commands already run once: a second run prints their `again` output. */
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
        <TermOutput history={history} />
        <CommandButtons label={txt[lang].run} busy={busy} onRun={run} />
      </div>
    </div>
  )
}
