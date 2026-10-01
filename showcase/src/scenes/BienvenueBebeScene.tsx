import type { Lang } from '../apps'
import ProgressBar from '../components/ProgressBar'
import SceneFrame, { type SceneProps } from '../components/SceneFrame'

const registryItems = (lang: Lang): [string, boolean][] => lang === 'fr'
  ? [['Body naissance', true], ['Veilleuse étoile', true], ['Poussette', false], ['Transat', false]]
  : [['Newborn bodysuit', true], ['Star night light', true], ['Stroller', false], ['Bouncer', false]]

/** Birth-registry list printed on the blank paper card of the poster (box in % of the image, lightly rotated). */
function RegistryOnCard({ lang }: { lang: Lang }) {
  return (
    <div className="reg">
      <div className="reg-in">
        <p className="reg-h">{lang === 'fr' ? 'Liste de naissance' : 'Birth registry'}<b>Léo</b></p>
        <ul>{registryItems(lang).map(([t, done]) => <li key={t} className={done ? 'done' : ''}><i>{done ? '✓' : ''}</i><span>{t}</span></li>)}</ul>
        <ProgressBar value={0.58} />
        <p className="reg-f">7 / 12 {lang === 'fr' ? 'réservés' : 'reserved'}</p>
      </div>
    </div>
  )
}

export default function BienvenueBebeScene(props: SceneProps) {
  return <SceneFrame {...props} flip overlay={<RegistryOnCard lang={props.lang} />} />
}
