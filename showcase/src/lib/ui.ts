import type { Lang } from '../apps'

export const ui = {
  fr: { sub: 'Apps & outils', scroll: 'Défiler', aboutT: 'Trois projets. Un développeur.', aboutP: 'Je conçois et développe des applications web et des outils pour développeurs. Écris-moi, ou regarde le code.', legal: 'Mentions légales' },
  en: { sub: 'Apps & tools', scroll: 'Scroll', aboutT: 'Three projects. One developer.', aboutP: 'I design and build web apps and developer tools. Reach out, or read the code.', legal: 'Legal notice' },
} satisfies Record<Lang, Record<string, string>>

export const initialLang = (): Lang => {
  try { const s = localStorage.getItem('lang'); if (s === 'fr' || s === 'en') return s } catch { /* storage unavailable */ }
  return navigator.language.startsWith('fr') ? 'fr' : 'en'
}

/**
 * Smooth-scroll to a scene. Scenes fade in/out with scroll progress, so landing on the section's top edge
 * would leave it transparent: aim for the middle of its scroll range, where it is fully visible.
 */
export function go(e: React.MouseEvent, id: string) {
  e.preventDefault()
  const el = document.getElementById(id)
  if (!el) return
  const top = el.offsetTop + Math.max(0, el.offsetHeight - innerHeight) * 0.5
  window.scrollTo({ top, behavior: 'smooth' })
}
