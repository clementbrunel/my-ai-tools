import type { ComponentType } from 'react'
import type { AppEntry } from '../apps'
import type { SceneProps } from '../components/SceneFrame'
import AiEnvManagerScene from './AiEnvManagerScene'
import BienvenueBebeScene from './BienvenueBebeScene'
import CblLogScene from './CblLogScene'
import PronoCoreScene from './PronoCoreScene'

/** Maps `AppEntry.stage` to the component that renders the app's scene. */
export const scenes: Record<AppEntry['stage'], ComponentType<SceneProps>> = {
  prono: PronoCoreScene,
  bbb: BienvenueBebeScene,
  tail: CblLogScene,
  cli: AiEnvManagerScene,
}
