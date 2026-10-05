import { useEffect, useState } from 'react'
import { apps, type Lang } from './apps'
import About from './components/About'
import Dock from './components/Dock'
import Hero from './components/Hero'
import Legal from './components/Legal'
import { useActiveScene, useHash } from './lib/nav'
import { initialLang } from './lib/ui'
import { scenes } from './scenes'

export default function App() {
  const [lang, setLang] = useState<Lang>(initialLang)
  const hash = useHash()
  const legal = hash === '#/legal'
  const active = useActiveScene(!legal)
  const activeApp = apps.find((a) => a.id === active)
  const dark = activeApp ? activeApp.theme.dark : true

  useEffect(() => {
    document.documentElement.lang = lang
    try { localStorage.setItem('lang', lang) } catch { /* ignore */ }
  }, [lang])

  return (
    <>
      <button className={`lang ${dark ? 'dark' : ''}`} onClick={() => setLang(lang === 'fr' ? 'en' : 'fr')} aria-label="Switch language">
        <b className={lang === 'fr' ? 'on' : ''}>FR</b> / <b className={lang === 'en' ? 'on' : ''}>EN</b>
      </button>
      {legal ? <Legal lang={lang} /> : (
        <>
          <main>
            <Hero lang={lang} />
            {apps.map((a) => {
              const Scene = scenes[a.stage]
              return <Scene key={a.id} app={a} lang={lang} />
            })}
            <About lang={lang} />
          </main>
          <Dock active={active} dark={dark} />
        </>
      )}
    </>
  )
}
