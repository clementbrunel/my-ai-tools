import type { CSSProperties, ReactNode } from 'react'
import type { AppEntry, Lang } from '../apps'
import ProgressBar from './ProgressBar'
import './SceneCopy.css'

/** Text block of a scene: name, kind, headline (last part in the punch colour), description, tags, progress, links, then `extra`. */
export default function SceneCopy({ app, lang, style, extra }: { app: AppEntry; lang: Lang; style: CSSProperties; extra?: ReactNode }) {
  const [plain, punch] = app.headline[lang]
  return (
    <div className="copy" style={style}>
      <p className="appname">{app.name}</p>
      <p className="kind">{app.kind[lang]}</p>
      <h2>
        {plain.split('\n').map((line, i) => <span key={line} className={i ? 'h2-sub' : 'h2-line'}>{line}</span>)}
        <span className="h2-line punch-line"><span className="punch">{punch}</span></span>
      </h2>
      <p className="lede">{app.description[lang]}</p>
      <ul className="tags">{app.tags.map((t) => <li key={t}>{t}</li>)}</ul>
      {app.progress && (
        <div className="progress" role="progressbar" aria-label={app.progress.label[lang]} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(app.progress.value * 100)}>
          <p>{app.progress.label[lang]}</p>
          <ProgressBar value={app.progress.value} />
        </div>
      )}
      {app.links.map((l) => <a key={l.url} className="cta" href={l.url} target="_blank" rel="noopener noreferrer">{l.label[lang]} ↗</a>)}
      {extra}
    </div>
  )
}
