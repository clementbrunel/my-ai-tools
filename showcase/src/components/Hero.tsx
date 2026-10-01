import { apps, heroScene, heroSceneRatio, type Lang } from '../apps'
import { useScene } from '../lib/scroll'
import { go, ui } from '../lib/ui'
import AppIcon from './AppIcon'

export default function Hero({ lang }: { lang: Lang }) {
  const [ref, o] = useScene<HTMLElement>(0.2, true)
  const t = ui[lang]
  return (
    <section ref={ref} className="scene hero-scene">
      <div className={`sticky hero ${heroScene ? 'has-img' : ''}`} style={{ opacity: o, transform: `scale(${0.94 + o * 0.06})` }}>
        {heroScene ? <div className="hero-bg" style={{ backgroundImage: `url(${heroScene})`, ['--ar' as string]: heroSceneRatio }} /> : <div className="halo" />}
        <h1><span>Clément</span><em>Brunel</em></h1>
        <p className="sub">{t.sub}</p>
        <div className="icons">{apps.map((a) => <a key={a.id} href={`#${a.id}`} onClick={(e) => go(e, a.id)}><AppIcon id={a.id} size={64} /></a>)}</div>
        <p className="cue">{t.scroll}<i /></p>
      </div>
    </section>
  )
}
