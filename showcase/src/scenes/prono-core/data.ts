// Forfeits and texts of the prono-core wheel (ForfeitWheel.tsx).
import type { Lang } from '../../apps'

/** Wheel segments, clockwise from the top pointer. */
export const forfeits: Record<Lang, string[]> = {
  fr: [
    'Tu paies l’apéro à tout le groupe',
    'Tu chantes l’hymne du pays gagnant',
    'Tu portes ton maillot à l’envers toute la soirée',
    'Tu postes une photo ridicule de toi',
    'Tu offres une tournée de cafés au groupe',
    'Tu publies « J’avais tort » en statut',
  ],
  en: [
    'You buy a round for the whole group',
    'You sing the winning country’s anthem',
    'You wear your shirt inside out all night',
    'You post a silly photo of yourself',
    'You treat the group to a round of coffees',
    'You post “I was wrong” as your status',
  ],
}

/** Spin duration (matches the CSS transition set on the disc). */
export const SPIN_MS = 3000

/** Rotation after a spin: four full turns plus a random stop. */
export const nextRotation = (rot: number) => rot + 360 * 4 + Math.random() * 360

/** Index of the segment under the top pointer once the disc stops at `rot` degrees. */
export const landedSegment = (rot: number, count: number) => Math.floor(((360 - (rot % 360)) % 360) / (360 / count))

export interface Texts { spin: string; prompt: string; yours: string }
export const txt: Record<Lang, Texts> = {
  fr: { spin: 'Tirer un gage', prompt: 'Fais tourner la roue pour découvrir ton gage !', yours: 'Ton gage' },
  en: { spin: 'Spin for a forfeit', prompt: 'Spin the wheel to find your forfeit!', yours: 'Your forfeit' },
}
