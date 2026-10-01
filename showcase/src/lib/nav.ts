import { useEffect, useState } from 'react'

export const useHash = () => {
  const [h, setH] = useState(location.hash)
  useEffect(() => {
    const f = () => { setH(location.hash); window.scrollTo(0, 0) }
    addEventListener('hashchange', f)
    return () => removeEventListener('hashchange', f)
  }, [])
  return h
}

/** id of the scene under the middle of the viewport ('' on the hero). Scenes overlap while crossfading: the later one wins. */
export const useActiveScene = (enabled: boolean) => {
  const [active, setActive] = useState('')
  useEffect(() => {
    if (!enabled) return
    const f = () => {
      const mid = innerHeight / 2
      const hit = [...document.querySelectorAll<HTMLElement>('.scene')].reverse().find((s) => { const r = s.getBoundingClientRect(); return r.top <= mid && r.bottom >= mid })
      setActive(hit && hit.id ? hit.id : '')
    }
    f(); addEventListener('scroll', f, { passive: true })
    return () => removeEventListener('scroll', f)
  }, [enabled])
  return active
}
