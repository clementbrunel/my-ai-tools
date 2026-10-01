import type { ReactNode } from 'react'
import type { AppEntry, Lang } from '../apps'
import { useScene } from '../lib/scroll'
import ProgressBar from './ProgressBar'

export interface SceneProps { app: AppEntry; lang: Lang }

interface Props extends SceneProps {
  /** Copy on the right, art on the left (side layout only). */
  flip?: boolean
  /** `split`: copy centered on top of a full-bleed poster (prono-core). `side`: copy next to the art. */
  layout?: 'side' | 'split'
  /** Translatable HTML placed on top of the `scene` poster, positioned in % of the image (needs `sceneRatio`). */
  overlay?: ReactNode
  /** Drawn illustration shown next to the copy, for apps without a poster (side layout). Receives the scroll progress. */
  art?: (progress: number) => ReactNode
}

/** Shared shell of an app scene: sticky full-bleed frame, scroll fade, themed background, copy block. */
export default function SceneFrame({ app, lang, flip = false, layout = 'side', art, overlay }: Props) {
  const [ref, o, p] = useScene<HTMLElement>(0.1)
  const th = app.theme
  const split = layout === 'split'
  const [plain, punch] = app.headline[lang]
  const anchored = !!(app.scene && app.sceneRatio)
  const background = app.scene && !anchored ? `url(${app.scene}) center/cover` : split ? '#0a1628' : th.bg

  return (
    <section ref={ref} className="scene" id={app.id}>
      <div
        className={`sticky app ${flip ? 'flip' : ''} ${split ? 'split' : ''} ${anchored ? 'anchored' : ''}`}
        style={{ opacity: o, pointerEvents: o < 0.4 ? 'none' : 'auto', background, color: th.ink, fontFamily: th.font, ['--punch' as string]: th.punch, ['--punchInk' as string]: th.punchInk }}
      >
        {anchored && (
          <div className="scene-clip">
            <div className="scene-img" style={{ ['--ar' as string]: app.sceneRatio, backgroundImage: `url(${app.scene})` }}>{overlay}</div>
          </div>
        )}
        {app.scene && <div className={`shade ${split ? 'top' : ''} ${th.dark ? '' : 'light'}`} />}
        <div className="copy" style={{ transform: `translateY(${(1 - o) * 50}px)` }}>
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
        </div>
        {art && !app.scene && (
          <div className="stagewrap" style={{ transform: `translateY(${(1 - o) * 80}px) scale(${0.94 + o * 0.06})` }}>{art(p)}</div>
        )}
      </div>
    </section>
  )
}
