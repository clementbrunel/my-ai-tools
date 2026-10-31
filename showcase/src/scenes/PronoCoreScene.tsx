import SceneFrame, { type SceneProps } from '../components/SceneFrame'
import ForfeitWheel from './prono-core/ForfeitWheel'

/** Football / F1 poster (`scene` in apps.ts) with the copy centered on top and the forfeit wheel (prono-core/) under it. */
export default function PronoCoreScene(props: SceneProps) {
  return <SceneFrame {...props} layout="split" extra={<ForfeitWheel lang={props.lang} />} />
}
