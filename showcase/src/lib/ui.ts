import { useEffect, useState } from 'react'
import type { Lang } from '../apps'

export const ui = {
  fr: { sub: 'Apps & outils', scroll: 'Défiler', swipe: 'Glisser', aboutT: 'Quatre projets. Un développeur.', aboutP: 'Je conçois et développe des applications web et des outils pour développeurs. Écris-moi, ou regarde le code.', legal: 'Mentions légales' },
  en: { sub: 'Apps & tools', scroll: 'Scroll', swipe: 'Swipe', aboutT: 'Four projects. One developer.', aboutP: 'I design and build web apps and developer tools. Reach out, or read the code.', legal: 'Legal notice' },
} satisfies Record<Lang, Record<string, string>>

export const initialLang = (): Lang => {
  try { const s = localStorage.getItem('lang'); if (s === 'fr' || s === 'en') return s } catch { /* storage unavailable */ }
  return navigator.language.startsWith('fr') ? 'fr' : 'en'
}

/** True on phones, where the slides are swiped horizontally (vertically elsewhere). Mirrors the breakpoint in styles.css. */
const HORIZONTAL_MQ = '(max-width:820px)'

export const useSwipeX = () => {
  const [s, setS] = useState(() => matchMedia(HORIZONTAL_MQ).matches)
  useEffect(() => {
    const m = matchMedia(HORIZONTAL_MQ)
    const f = () => setS(m.matches)
    f(); m.addEventListener('change', f)
    return () => m.removeEventListener('change', f)
  }, [])
  return s
}

/** Index of the slide currently in view in the track (works for both axes: the unused one stays at 0). */
export const slideIndex = (track: HTMLElement) =>
  Math.round(Math.max(track.scrollLeft / Math.max(1, track.clientWidth), track.scrollTop / Math.max(1, track.clientHeight)))

/** Go to a scene by id ('' = hero). `instant` skips the animation. */
export function goToScene(id: string, instant = false) {
  const track = document.querySelector<HTMLElement>('main')
  const el = id ? document.getElementById(id) : track?.querySelector<HTMLElement>('.scene')
  if (!track || !el) return
  const behavior = instant || matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
  track.scrollTo({ left: el.offsetLeft, top: el.offsetTop, behavior })
}

export function go(e: React.MouseEvent, id: string) {
  e.preventDefault()
  if (document.getElementById(id)) goToScene(id)
}
