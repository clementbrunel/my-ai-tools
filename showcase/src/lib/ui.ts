import type { Lang } from '../apps'

export const ui = {
  fr: { sub: 'Apps & outils', scroll: 'Défiler', aboutT: 'Trois projets. Un développeur.', aboutP: 'Je conçois et développe des applications web et des outils pour développeurs. Écris-moi, ou regarde le code.', legal: 'Mentions légales' },
  en: { sub: 'Apps & tools', scroll: 'Scroll', aboutT: 'Three projects. One developer.', aboutP: 'I design and build web apps and developer tools. Reach out, or read the code.', legal: 'Legal notice' },
} satisfies Record<Lang, Record<string, string>>

export const initialLang = (): Lang => {
  try { const s = localStorage.getItem('lang'); if (s === 'fr' || s === 'en') return s } catch { /* storage unavailable */ }
  return navigator.language.startsWith('fr') ? 'fr' : 'en'
}

let rafId = 0

/** Slow eased scroll (native `behavior: 'smooth'` is too quick and not tunable). Duration grows with distance. */
export function scrollToY(target: number) {
  cancelAnimationFrame(rafId)
  const from = scrollY
  const dist = target - from
  if (Math.abs(dist) < 2 || matchMedia('(prefers-reduced-motion: reduce)').matches) { scrollTo(0, target); return }
  const duration = Math.min(2800, Math.max(900, Math.abs(dist) * 0.6))
  const start = performance.now()
  const stop = () => cancelAnimationFrame(rafId)
  addEventListener('wheel', stop, { once: true, passive: true })
  addEventListener('touchstart', stop, { once: true, passive: true })
  const step = (now: number) => {
    const p = Math.min(1, (now - start) / duration)
    const eased = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2
    scrollTo(0, from + dist * eased)
    if (p < 1) rafId = requestAnimationFrame(step)
  }
  rafId = requestAnimationFrame(step)
}

/**
 * Smooth-scroll to a scene. Scenes fade in/out with scroll progress, so landing on the section's top edge
 * would leave it transparent: aim for the middle of its scroll range, where it is fully visible.
 */
export function go(e: React.MouseEvent, id: string) {
  e.preventDefault()
  const el = document.getElementById(id)
  if (!el) return
  scrollToY(el.offsetTop + Math.max(0, el.offsetHeight - innerHeight) * 0.5)
}
