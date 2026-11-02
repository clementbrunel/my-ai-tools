import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { apps } from '../apps'
import { sceneY, scrollToY } from './ui'

export const useHash = () => {
  const [h, setH] = useState(location.hash)
  useEffect(() => {
    const f = () => setH(location.hash)
    addEventListener('hashchange', f)
    return () => removeEventListener('hashchange', f)
  }, [])
  return h
}

/** Shareable URL of a scene: `#/<app id>` (the bare `#<app id>` form is accepted too). */
export const sceneHash = (id: string) => `#/${id}`

/** App id targeted by a hash (`#/cbl-log` or `#cbl-log`), or undefined. */
export const sceneFromHash = (hash: string) => {
  const id = hash.replace(/^#\/?/, '')
  return apps.some((a) => a.id === id) ? id : undefined
}

/**
 * Deep links: opens on the scene named in the URL hash (instantly on load / when coming back from the legal page),
 * follows later hash changes (pasted link, back button), and keeps the hash in sync with the scene being read
 * so that copying the address bar always shares what is on screen.
 */
export const useSceneLinks = (legal: boolean, active: string) => {
  useLayoutEffect(() => {
    if (legal) { scrollTo(0, 0); return }
    const id = sceneFromHash(location.hash)
    if (id) scrollTo(0, sceneY(id))
    const onChange = () => {
      const target = sceneFromHash(location.hash)
      if (target) scrollToY(sceneY(target)); else scrollTo(0, 0)
    }
    addEventListener('hashchange', onChange)
    return () => removeEventListener('hashchange', onChange)
  }, [legal])

  const prev = useRef('')
  useEffect(() => {
    if (legal) { prev.current = ''; return }
    // '' on first render (before the scroll position is read) must not erase an incoming deep link
    if (!active && !prev.current) return
    prev.current = active
    const wanted = active ? sceneHash(active) : ''
    if (location.hash !== wanted && (active || sceneFromHash(location.hash))) {
      history.replaceState(null, '', wanted || location.pathname + location.search)
    }
    document.title = active ? `${apps.find((a) => a.id === active)?.name} — Clément Brunel` : 'Clément Brunel — Apps & outils'
  }, [legal, active])
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
