import { apps, heroScene, heroSceneRatio, type Lang } from '../apps'
import { sceneHash } from '../lib/nav'
import { go, ui, useSwipeX } from '../lib/ui'
import AppIcon from './AppIcon'
import './Hero.css'

export default function Hero({ lang }: { lang: Lang }) {
  const t = ui[lang]
  const swipeX = useSwipeX()
  return (
    <section className="scene hero-scene">
      <div className={`sticky hero ${heroScene ? 'has-img' : ''}`}>
        {heroScene ? <div className="hero-bg" style={{ backgroundImage: `url(${heroScene})`, ['--ar' as string]: heroSceneRatio }} /> : <div className="halo" />}
        <h1><span>Clément</span><em>Brunel</em></h1>
        <p className="sub">{t.sub}</p>
        <div className="icons">{apps.map((a) => <a key={a.id} href={sceneHash(a.id)} aria-label={a.name} onClick={(e) => go(e, a.id)}><AppIcon id={a.id} size={64} /><span>{a.name}</span></a>)}</div>
        <p className="cue">{swipeX ? t.swipe : t.scroll}<i /></p>
      </div>
    </section>
  )
}
