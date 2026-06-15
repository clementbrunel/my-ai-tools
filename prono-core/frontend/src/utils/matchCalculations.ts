/** Mirror of Java extractResult() for client-side point display */
export const extractResult = (option: string): string => {
  if (option.startsWith('Match nul')) return 'Match nul';
  if (option.startsWith('Victoire ')) {
    const lastSpace = option.lastIndexOf(' ');
    if (lastSpace > 0) return option.substring(0, lastSpace);
  }
  return option;
};

/** Mirror of Java computeEarnedPoints() */
export const computePoints = (chosen: string, winning: string): number => {
  const c = chosen.trim();
  const w = winning.trim();
  if (c === w) return 5;
  if (extractResult(c) === extractResult(w)) return 3;
  return 0;
};

/**
 * Parse a stored option string back into [scoreA, scoreB] for form pre-fill.
 * Format convention (winner's score always first):
 *   "Victoire {teamA} 2-1" → teamA won 2-1 → [2, 1]
 *   "Victoire {teamB} 1-0" → teamB won 1-0 → [0, 1]
 *   "Match nul 1-1"        → draw          → [1, 1]
 */
export const parseOption = (option: string, teamA: string, teamB: string): [string, string] => {
  const m = option.match(/(\d+)-(\d+)$/);
  if (!m) return ['', ''];
  const [, first, second] = m;
  if (option.startsWith('Match nul')) return [first, second];
  if (option.startsWith(`Victoire ${teamA}`)) return [first, second];
  if (option.startsWith(`Victoire ${teamB}`)) return [second, first];
  return ['', ''];
};
