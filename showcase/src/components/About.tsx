import { profile, type Lang } from '../apps'
import { useScene } from '../lib/scroll'
import { ui } from '../lib/ui'

export default function About({ lang }: { lang: Lang }) {
  const [ref, o] = useScene<HTMLElement>(0.5, false, true)
  const t = ui[lang]
  return (
    <section ref={ref} className="scene about-scene" id="contact">
      <div className="sticky about" style={{ opacity: o, transform: `translateY(${(1 - o) * 40}px)` }}>
        <h2 className="about-t">{t.aboutT}</h2>
        <p className="about-p">{t.aboutP}</p>
        <div className="links">
          <a href={profile.linkedin} target="_blank" rel="noopener noreferrer">LinkedIn ↗</a>
          <a href={profile.github} target="_blank" rel="noopener noreferrer">GitHub ↗</a>
        </div>
        <footer><a href="#/legal">{t.legal}</a> · © {new Date().getFullYear()} {profile.name}</footer>
      </div>
    </section>
  )
}
