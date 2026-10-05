import { apps, profile } from '../apps'
import { go, scrollToY } from '../lib/ui'
import AppIcon from './AppIcon'

const GH = 'M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.87-1.37-3.87-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.19 1.76 1.19 1.03 1.76 2.69 1.25 3.35.96.1-.75.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11 11 0 0 1 5.78 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.84 1.19 3.1 0 4.42-2.69 5.39-5.25 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5Z'

export default function Dock({ active, dark }: { active: string; dark: boolean }) {
  return (
    <nav className={`dock ${active ? 'show' : ''} ${dark ? 'dark' : ''}`} aria-label="Navigation">
      <a className="mono" href="#/" aria-label="Accueil" onClick={(e) => { e.preventDefault(); scrollToY(0) }}>CB</a>
      <span className="sep" />
      {apps.map((a) => (
        <a key={a.id} href={`#${a.id}`} className={`dk ${active === a.id ? 'on' : ''}`} onClick={(e) => go(e, a.id)}>
          <AppIcon id={a.id} size={36} />
          <span className="lbl"><span>{a.name}</span></span>
        </a>
      ))}
      <span className="sep" />
      <a className="soc" href={profile.linkedin} target="_blank" rel="noopener noreferrer" aria-label="LinkedIn">in</a>
      <a className="soc" href={profile.github} target="_blank" rel="noopener noreferrer" aria-label="GitHub">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d={GH} /></svg>
      </a>
    </nav>
  )
}
