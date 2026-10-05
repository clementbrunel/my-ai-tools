import { useEffect, useRef, useState } from 'react'

/** Progress 0..1 of an element scrolling through the viewport (0 = top reaches top, 1 = bottom reaches bottom). */
export function useScrollProgress<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [p, setP] = useState(0)
  useEffect(() => {
    let raf = 0
    const update = () => {
      raf = 0
      const el = ref.current
      if (!el) return
      const r = el.getBoundingClientRect()
      const total = r.height - window.innerHeight
      setP(total <= 0 ? 0 : Math.min(1, Math.max(0, -r.top / total)))
    }
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update) }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); cancelAnimationFrame(raf) }
  }, [])
  return [ref, p] as const
}

/** Fade in over the first `edge`, hold, fade out over the last `edge`. `first`/`last` skip the outer fade. */
export function fade(p: number, edge = 0.22, first = false, last = false) {
  const i = first ? 1 : Math.min(1, p / edge)
  const o = last ? 1 : Math.min(1, (1 - p) / edge)
  return Math.max(0, Math.min(i, o))
}

/** Scroll progress + the scene's fade opacity in one go (see `fade` for the options). */
export function useScene<T extends HTMLElement>(edge: number, first = false, last = false) {
  const [ref, p] = useScrollProgress<T>()
  return [ref, fade(p, edge, first, last), p] as const
}
