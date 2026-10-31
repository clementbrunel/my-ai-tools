import SceneFrame, { type SceneProps } from '../components/SceneFrame'
import RegistryOnCard from './bienvenue-bebe/RegistryOnCard'
import './BienvenueBebeScene.css'

/** BienvenueBébé: poster with the birth-registry card (bienvenue-bebe/) written on it. */
export default function BienvenueBebeScene(props: SceneProps) {
  return <SceneFrame {...props} flip overlay={<RegistryOnCard lang={props.lang} />} />
}
