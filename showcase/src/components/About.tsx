import { profile, type Lang } from '../apps'
import { ui } from '../lib/ui'
import './About.css'

export default function About({ lang }: { lang: Lang }) {
  const t = ui[lang]
  return (
    <section className="scene about-scene" id="contact">
      <div className="sticky about">
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
