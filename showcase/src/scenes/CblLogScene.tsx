import SceneFrame, { type SceneProps } from '../components/SceneFrame'
import LiveTail from './cbl-log/LiveTail'
import './CblLogScene.css'

/** cbl-log: live log window (cbl-log/) next to the copy. */
export default function CblLogScene(props: SceneProps) {
  return <SceneFrame {...props} flip art={() => <LiveTail lang={props.lang} />} />
}
