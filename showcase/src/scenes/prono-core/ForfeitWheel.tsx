import { useEffect, useRef, useState } from 'react'
import type { Lang } from '../../apps'
import { SPIN_MS, forfeits, landedSegment, nextRotation, txt } from './data'
import WheelResult from './WheelResult'
import './ForfeitWheel.css'

/** Wheel of forfeits: click to spin, the segment under the top pointer is the loser's penalty. */
export default function ForfeitWheel({ lang }: { lang: Lang }) {
  const list = forfeits[lang]
  const t = txt[lang]
  const [rot, setRot] = useState(0)
  const [spinning, setSpinning] = useState(false)
  const [result, setResult] = useState<number | null>(null)
  const timer = useRef<number>()
  useEffect(() => () => window.clearTimeout(timer.current), [])

  const spin = () => {
    if (spinning) return
    const next = nextRotation(rot)
    setRot(next)
    setSpinning(true)
    setResult(null)
    timer.current = window.setTimeout(() => {
      setResult(landedSegment(next, list.length))
      setSpinning(false)
    }, SPIN_MS)
  }

  return (
    <div className="wheel-box">
      <button type="button" className="wheel" onClick={spin} disabled={spinning} aria-label={t.spin}>
        <span className="wheel-disc" style={{ transform: `rotate(${rot}deg)`, transition: `transform ${SPIN_MS}ms cubic-bezier(.15,.7,.1,1)` }} />
        <i className="wheel-pin" />
      </button>
      <WheelResult t={t} spinning={spinning} forfeit={result === null ? null : list[result]} />
    </div>
  )
}
