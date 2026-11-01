import type { ReactNode } from 'react'
import type { AppEntry, Lang } from '../apps'
import { useScene } from '../lib/scroll'
import SceneCopy from './SceneCopy'
import './SceneFrame.css'

export interface SceneProps { app: AppEntry; lang: Lang }

interface Props extends SceneProps {
  /** Copy on the right, art on the left (side layout only). */
  flip?: boolean
  /** `split`: copy centered on top of a full-bleed poster (prono-core). `side`: copy next to the art. */
  layout?: 'side' | 'split'
  /** Translatable HTML placed on top of the `scene` poster, positioned in % of the image (needs `sceneRatio`). */
  overlay?: ReactNode
  /** Interactive widget placed under the call-to-action links (inside the copy block). */
  extra?: ReactNode
  /** Drawn illustration shown next to the copy, for apps without a poster (side layout). Receives the scroll progress. */
  art?: (progress: number) => ReactNode
}

/** Shared shell of an app scene: sticky full-bleed frame, scroll fade, themed background, copy block. */
export default function SceneFrame({ app, lang, flip = false, layout = 'side', art, overlay, extra }: Props) {
  const [ref, o, p] = useScene<HTMLElement>(0.1)
  const th = app.theme
  const split = layout === 'split'
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
        <SceneCopy app={app} lang={lang} extra={extra} style={{ transform: `translateY(${(1 - o) * 50}px)` }} />
        {art && !app.scene && (
          <div className="stagewrap" style={{ transform: `translateY(${(1 - o) * 80}px) scale(${0.94 + o * 0.06})` }}>{art(p)}</div>
        )}
      </div>
    </section>
  )
}
