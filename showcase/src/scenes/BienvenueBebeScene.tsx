import { useState } from 'react'
import type { Lang } from '../apps'
import ProgressBar from '../components/ProgressBar'
import SceneFrame, { type SceneProps } from '../components/SceneFrame'

const registryItems = (lang: Lang): [string, boolean][] => lang === 'fr'
  ? [['Body naissance', true], ['Veilleuse étoile', true], ['Poussette', false], ['Transat', false]]
  : [['Newborn bodysuit', true], ['Star night light', true], ['Stroller', false], ['Bouncer', false]]

/** Birth-registry list printed on the blank paper card of the poster (box in % of the image, lightly rotated). Items can be ticked. */
function RegistryOnCard({ lang }: { lang: Lang }) {
  const items = registryItems(lang)
  const [checked, setChecked] = useState(() => items.map(([, done]) => done))
  const reserved = checked.filter(Boolean).length
  const toggle = (i: number) => setChecked((c) => c.map((v, j) => (j === i ? !v : v)))
  return (
    <div className="reg">
      <div className="reg-in">
        <p className="reg-h">{lang === 'fr' ? 'Liste de naissance' : 'Birth registry'}<b>Léo</b></p>
        <ul>
          {items.map(([t], i) => (
            <li key={i} className={checked[i] ? 'done' : ''}>
              <button type="button" role="checkbox" aria-checked={checked[i]} onClick={() => toggle(i)}>
                <i>{checked[i] ? '✓' : ''}</i><span>{t}</span>
              </button>
            </li>
          ))}
        </ul>
        <ProgressBar value={reserved / items.length} />
        <p className="reg-f">{reserved} / {items.length} {lang === 'fr' ? 'réservés' : 'reserved'}</p>
      </div>
    </div>
  )
}

export default function BienvenueBebeScene(props: SceneProps) {
  return <SceneFrame {...props} flip overlay={<RegistryOnCard lang={props.lang} />} />
}
