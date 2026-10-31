import type { Texts } from './data'
import './WheelResult.css'

/** Text under the wheel: invitation, `…` while spinning, then the forfeit drawn (announced to screen readers). */
export default function WheelResult({ t, spinning, forfeit }: { t: Texts; spinning: boolean; forfeit: string | null }) {
  return (
    <p className="wheel-txt" aria-live="polite">
      {forfeit === null
        ? <span>{spinning ? '…' : t.prompt}</span>
        : <span><b>{t.yours}</b>{forfeit}</span>}
    </p>
  )
}
