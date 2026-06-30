/**
 * Strips score and t.a.b. marker — used to compare winners regardless of mode.
 * "Victoire France t.a.b. 1-1 (5-4)" → "Victoire France"
 * "Victoire France 2-1"               → "Victoire France"
 * "Match nul 1-1"                     → "Match nul"
 */
export const extractResult = (option: string): string => {
  let s = option.replace(/\s*\(\d+-\d+\)$/, '');
  s = s.replace(' t.a.b.', '');
  if (s.startsWith('Match nul')) return 'Match nul';
  if (s.startsWith('Victoire ')) {
    const lastSpace = s.lastIndexOf(' ');
    if (lastSpace > 0) return s.substring(0, lastSpace);
  }
  return option;
};

/**
 * Extracts the regulation score (last "X-Y" token after stripping penalty suffix).
 * "Victoire France t.a.b. 1-1 (5-4)" → "1-1"
 * "Victoire France t.a.b. 0-0"        → "0-0"
 * "Victoire France 2-1"               → "2-1"
 * "Victoire France"                   → ""
 */
const extractRegulationScore = (option: string): string => {
  const s = option.replace(/\s*\(\d+-\d+\)$/, '');
  const i = s.lastIndexOf(' ');
  if (i < 0) return '';
  const tail = s.substring(i + 1);
  return /^\d+-\d+$/.test(tail) ? tail : '';
};

/**
 * Mirror of Java computeEarnedPoints() — scoring additif gagnant/score/pénalty.
 *
 * Normal :  +5 bon gagnant + bon score  |  +3 bon gagnant  |  0 mauvais gagnant
 * TAB :     +7 bon gagnant + bon score rég + bon score pén
 *           +5 bon gagnant + bon score rég (sans/mauvais score pén)
 *           +3 bon gagnant + mauvais score rég
 *           +2 mauvais gagnant + bon score rég
 *            0 mauvais gagnant + mauvais score rég
 */
export const computePoints = (chosen: string, winning: string): number => {
  const c = chosen.trim();
  const w = winning.trim();
  const winningIsTab = w.includes(' t.a.b. ');
  if (winningIsTab) {
    const winningHasPenScore = /\(\d+-\d+\)$/.test(w);
    if (c === w && winningHasPenScore) return 7;
    const wReg = extractRegulationScore(w);
    const sameWinner   = extractResult(c) === extractResult(w);
    const sameRegScore = wReg !== '' && wReg === extractRegulationScore(c);
    if (sameWinner && sameRegScore) return 5;
    if (sameWinner)                 return 3;
    if (sameRegScore)               return 2;
    return 0;
  }
  if (c === w) return 5;
  if (extractResult(c) === extractResult(w)) return 3;
  return 0;
};

/**
 * Parse a stored option string back into [scoreA, scoreB] for form pre-fill.
 * Handles both normal and TAB options (penalty score suffix ignored).
 */
export const parseOption = (option: string, teamA: string, teamB: string): [string, string] => {
  const withoutPenScore = option.replace(/\s*\(\d+-\d+\)$/, '');
  const m = withoutPenScore.match(/(\d+)-(\d+)$/);
  if (!m) return ['', ''];
  const [, first, second] = m;
  if (withoutPenScore.startsWith('Match nul')) return [first, second];
  if (withoutPenScore.startsWith(`Victoire ${teamA}`)) return [first, second];
  if (withoutPenScore.startsWith(`Victoire ${teamB}`)) return [second, first];
  return ['', ''];
};
