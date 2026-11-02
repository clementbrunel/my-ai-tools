// Registry items and texts of the BienvenueBébé card (RegistryOnCard.tsx).
import type { Lang } from '../../apps'

/** [gift, already reserved on load]. */
export const registryItems: Record<Lang, [string, boolean][]> = {
  fr: [['Body naissance', true], ['Veilleuse étoile', true], ['Poussette', false], ['Transat', false]],
  en: [['Newborn bodysuit', true], ['Star night light', true], ['Stroller', false], ['Bouncer', false]],
}

/** Baby name shown in the card title. */
export const BABY = 'Léo'

export const txt: Record<Lang, { title: string; reserved: string }> = {
  fr: { title: 'Liste de naissance', reserved: 'réservés' },
  en: { title: 'Birth registry', reserved: 'reserved' },
}
