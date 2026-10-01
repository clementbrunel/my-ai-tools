import type { ComponentType } from 'react'
import type { AppEntry } from '../apps'
import type { SceneProps } from '../components/SceneFrame'
import AiEnvManagerScene from './AiEnvManagerScene'
import BienvenueBebeScene from './BienvenueBebeScene'
import PronoCoreScene from './PronoCoreScene'

/** Maps `AppEntry.stage` to the component that renders the app's scene. */
export const scenes: Record<AppEntry['stage'], ComponentType<SceneProps>> = {
  prono: PronoCoreScene,
  bbb: BienvenueBebeScene,
  cli: AiEnvManagerScene,
}
