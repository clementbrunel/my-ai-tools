import SceneFrame, { type SceneProps } from '../components/SceneFrame'

/** Football / F1 poster (`scene` in apps.ts) with the copy centered on top. */
export default function PronoCoreScene(props: SceneProps) {
  return <SceneFrame {...props} layout="split" />
}
