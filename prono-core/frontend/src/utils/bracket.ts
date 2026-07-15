import type { Match } from '@/types';

/**
 * Ordre canonique des tours de la phase éliminatoire — même liste que le
 * menu déroulant du formulaire admin de création de match
 * (AdminMatchesTab.tsx), réutilisée ici comme source de vérité pour
 * ordonner l'arbre plutôt que de deviner l'ordre depuis les dates.
 */
export const KNOCKOUT_ROUNDS = [
  '1/32 de finale',
  '1/16 de finale',
  '1/8 de finale',
  '1/4 de finale',
  '1/2 finale',
  'Petite finale',
  'Finale',
];

const normalize = (s: string): string =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();

export const isThirdPlaceRound = (round: string): boolean => {
  if (round === 'Petite finale') return true;
  const n = normalize(round);
  return n.includes('petit') || n.includes('3e place') || n.includes('troisieme') || n.includes('3eme place');
};

/** Ordre des tours dans l'arbre (plus petit = plus tôt). */
export const getRoundTier = (round: string): number => {
  if (isThirdPlaceRound(round)) return 90;

  const exactIndex = KNOCKOUT_ROUNDS.indexOf(round);
  if (exactIndex !== -1) return exactIndex;

  // Fallback pour les libellés existants en base qui ne matchent pas
  // exactement la liste canonique (ex: "8e de finale", "Quart de finale").
  const n = normalize(round);
  if (n.includes('32')) return 0;
  if (n.includes('16')) return 1;
  if (n.includes('huitieme') || n.includes('8eme') || /\b8e\b/.test(n) || n.includes('round of 16')) return 2;
  if (n.includes('quart')) return 3;
  if (n.includes('demi')) return 4;
  if (n.includes('finale')) return 6;
  return 99;
};

export interface BracketTier {
  tier: number;
  label: string;
  matches: Match[];
}

export interface BracketData {
  tiers: BracketTier[];
  thirdPlace: Match[];
}

const teamNames = (m: Match) => [m.teamA.name, m.teamB.name];

/**
 * Reconstruit l'ordre des matchs de chaque tour de sorte que deux matchs
 * consécutifs alimentent bien le même match du tour suivant. On part du
 * dernier tour (trié par date) et on remonte tour par tour en retrouvant,
 * pour chaque match du tour suivant, les matchs du tour précédent qui
 * partagent une équipe (le vainqueur qualifié). Sans correspondance
 * d'équipe trouvable (tour pas encore joué), on retombe sur un tri
 * chronologique simple.
 */
export const buildBracketData = (allMatches: Match[]): BracketData => {
  const knockout = allMatches.filter((m) => m.phase === 'KNOCKOUT');
  const thirdPlace = knockout
    .filter((m) => isThirdPlaceRound(m.round))
    .sort((a, b) => a.matchDate.localeCompare(b.matchDate));
  const mainMatches = knockout.filter((m) => !isThirdPlaceRound(m.round));

  const byTier = new Map<number, Match[]>();
  for (const m of mainMatches) {
    const t = getRoundTier(m.round);
    if (!byTier.has(t)) byTier.set(t, []);
    byTier.get(t)!.push(m);
  }
  const tierKeys = Array.from(byTier.keys()).sort((a, b) => a - b);

  const ordered = new Map<number, Match[]>();
  for (let i = tierKeys.length - 1; i >= 0; i--) {
    const tier = tierKeys[i];
    const matches = byTier.get(tier)!;

    if (i === tierKeys.length - 1) {
      ordered.set(
        tier,
        [...matches].sort((a, b) => a.matchDate.localeCompare(b.matchDate))
      );
      continue;
    }

    const nextOrdered = ordered.get(tierKeys[i + 1]) ?? [];
    const remaining = new Set(matches.map((m) => m.id));
    const result: Match[] = [];

    for (const nextMatch of nextOrdered) {
      const wanted = new Set(teamNames(nextMatch));
      const feeders = matches
        .filter((m) => remaining.has(m.id) && teamNames(m).some((n) => wanted.has(n)))
        .sort((a, b) => a.matchDate.localeCompare(b.matchDate));
      for (const f of feeders) {
        result.push(f);
        remaining.delete(f.id);
      }
    }

    const orphans = matches
      .filter((m) => remaining.has(m.id))
      .sort((a, b) => a.matchDate.localeCompare(b.matchDate));
    result.push(...orphans);

    ordered.set(tier, result);
  }

  const tiers: BracketTier[] = tierKeys.map((t) => ({
    tier: t,
    label: mainMatches.find((m) => getRoundTier(m.round) === t)?.round ?? KNOCKOUT_ROUNDS[t] ?? 'Tour',
    matches: ordered.get(t) ?? [],
  }));

  return { tiers, thirdPlace };
};
