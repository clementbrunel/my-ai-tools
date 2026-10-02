import { useEffect, useRef, useState } from 'react'
import type { Lang } from '../apps'
import SceneFrame, { type SceneProps } from '../components/SceneFrame'

const forfeits: Record<Lang, string[]> = {
  fr: [
    'Tu paies l’apéro à tout le groupe',
    'Tu chantes l’hymne du pays gagnant',
    'Tu portes ton maillot à l’envers toute la soirée',
    'Tu postes une photo ridicule de toi',
    'Tu offres une tournée de cafés au groupe',
    'Tu publies « J’avais tort » en statut',
  ],
  en: [
    'You buy a round for the whole group',
    'You sing the winning country’s anthem',
    'You wear your shirt inside out all night',
    'You post a silly photo of yourself',
    'You treat the group to a round of coffees',
    'You post “I was wrong” as your status',
  ],
}
const SPIN_MS = 3000

/** Wheel of forfeits: click to spin, the segment under the top pointer is the loser's penalty. */
function ForfeitWheel({ lang }: { lang: Lang }) {
  const list = forfeits[lang]
  const seg = 360 / list.length
  const [rot, setRot] = useState(0)
  const [spinning, setSpinning] = useState(false)
  const [result, setResult] = useState<number | null>(null)
  const timer = useRef<number>()
  useEffect(() => () => window.clearTimeout(timer.current), [])

  const spin = () => {
    if (spinning) return
    const next = rot + 360 * 4 + Math.random() * 360
    setRot(next)
    setSpinning(true)
    setResult(null)
    timer.current = window.setTimeout(() => {
      setResult(Math.floor(((360 - (next % 360)) % 360) / seg))
      setSpinning(false)
    }, SPIN_MS)
  }

  return (
    <div className="wheel-box">
      <button type="button" className="wheel" onClick={spin} disabled={spinning} aria-label={lang === 'fr' ? 'Tirer un gage' : 'Spin for a forfeit'}>
        <span className="wheel-disc" style={{ transform: `rotate(${rot}deg)`, transition: `transform ${SPIN_MS}ms cubic-bezier(.15,.7,.1,1)` }} />
        <i className="wheel-pin" />
      </button>
      <p className="wheel-txt" aria-live="polite">
        {result === null
          ? <span>{spinning ? '…' : lang === 'fr' ? 'Fais tourner la roue pour découvrir ton gage !' : 'Spin the wheel to find your forfeit!'}</span>
          : <span><b>{lang === 'fr' ? 'Ton gage' : 'Your forfeit'}</b>{list[result]}</span>}
      </p>
    </div>
  )
}

/** Football / F1 poster (`scene` in apps.ts) with the copy centered on top. */
export default function PronoCoreScene(props: SceneProps) {
  return <SceneFrame {...props} layout="split" extra={<ForfeitWheel lang={props.lang} />} />
}
