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
 * Strips only the penalty score suffix — keeps t.a.b. for mode comparison.
 * "Victoire France t.a.b. 1-1 (5-4)" → "Victoire France t.a.b."
 * "Victoire France t.a.b. 0-0"        → "Victoire France t.a.b."
 * "Victoire France 2-1"               → "Victoire France"
 */
const extractResultWithMode = (option: string): string => {
  const s = option.replace(/\s*\(\d+-\d+\)$/, '');
  if (s.startsWith('Match nul')) return 'Match nul';
  if (s.startsWith('Victoire ')) {
    const lastSpace = s.lastIndexOf(' ');
    if (lastSpace > 0) return s.substring(0, lastSpace);
  }
  return option;
};

/**
 * Mirror of Java computeEarnedPoints() with TAB support.
 *
 * Normal match: +5 exact | +3 correct result | 0 wrong
 * TAB match:    +7 right winner via TAB + exact pen score
 *               +5 right winner via TAB (wrong score or no pen score)
 *               +3 right winner but wrong mode
 *               0  wrong winner
 */
export const computePoints = (chosen: string, winning: string): number => {
  const c = chosen.trim();
  const w = winning.trim();
  const winningIsTab = w.includes(' t.a.b. ');
  if (winningIsTab) {
    const winningHasPenScore = /\(\d+-\d+\)$/.test(w);
    if (c === w && winningHasPenScore) return 7;
    if (extractResultWithMode(c) === extractResultWithMode(w)) return 5;
    if (extractResult(c) === extractResult(w)) return 3;
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
