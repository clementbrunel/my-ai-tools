import SceneFrame, { type SceneProps } from '../components/SceneFrame'
import Terminal from './ai-env-manager/Terminal'

/** ai-env-manager: interactive terminal (ai-env-manager/) next to the copy. */
export default function AiEnvManagerScene(props: SceneProps) {
  return <SceneFrame {...props} art={() => <Terminal lang={props.lang} />} />
}
