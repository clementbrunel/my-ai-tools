import { useEffect, useState } from 'react';
import type { BetParticipation, Match } from '@/types';
import { parseOption } from '@/utils/matchCalculations';

/**
 * Score + knockout/t.a.b. state for a match prediction form, plus the pure
 * `computeOption()` preview logic. Pre-fills from the caller's existing
 * participation (if any) and auto-corrects the knockout winner when scores
 * stop being equal.
 */
export const usePredictionForm = (match: Match | null, myParticipation: BetParticipation | undefined) => {
  const [scoreA, setScoreA] = useState('0');
  const [scoreB, setScoreB] = useState('0');
  const [knockoutWinner, setKnockoutWinner] = useState<'A' | 'B' | ''>('');
  const [penScoreWinner, setPenScoreWinner] = useState('');
  const [penScoreLoser, setPenScoreLoser] = useState('');
  const [comment, setComment] = useState('');

  const isKnockout = match?.phase === 'KNOCKOUT';

  // Pre-fill the form once the match and the caller's participation are both available.
  useEffect(() => {
    if (!match || !myParticipation) return;
    const option = myParticipation.chosenOption;
    const [sA, sB] = parseOption(option, match.teamA.name, match.teamB.name);
    setScoreA(sA);
    setScoreB(sB);
    setComment(myParticipation.comment || '');
    if (match.phase === 'KNOCKOUT') {
      if (option.startsWith(`Victoire ${match.teamA.name} `)) setKnockoutWinner('A');
      else if (option.startsWith('Victoire ')) setKnockoutWinner('B');
      if (option.includes(' t.a.b. ')) {
        const penMatch = option.match(/\((\d+)-(\d+)\)$/);
        if (penMatch) { setPenScoreWinner(penMatch[1]); setPenScoreLoser(penMatch[2]); }
      }
    }
  }, [myParticipation, match]);

  // When scores become unequal, auto-correct winner and reset penalty scores.
  // Equal scores (draw/TAB) are left untouched — the TAB section handles them.
  useEffect(() => {
    const a = parseInt(scoreA), b = parseInt(scoreB);
    if (isNaN(a) || isNaN(b) || a === b) return;
    setPenScoreWinner('');
    setPenScoreLoser('');
    if (isKnockout) setKnockoutWinner(a > b ? 'A' : 'B');
  }, [scoreA, scoreB, isKnockout]);

  const computeOption = (): string => {
    if (scoreA === '' || scoreB === '') return '';
    const a = parseInt(scoreA), b = parseInt(scoreB);
    if (isNaN(a) || isNaN(b) || a < 0 || b < 0) return '';
    if (!match) return '';
    if (isKnockout) {
      if (!knockoutWinner) return '';
      const winner = knockoutWinner === 'A' ? match.teamA.name : match.teamB.name;
      if (a === b) {
        const penSuffix = penScoreWinner && penScoreLoser ? ` (${penScoreWinner}-${penScoreLoser})` : '';
        return `Victoire ${winner} t.a.b. ${a}-${b}${penSuffix}`;
      }
      // Score must be consistent with chosen winner; blank preview if not
      if ((knockoutWinner === 'A' && a < b) || (knockoutWinner === 'B' && b < a)) return '';
      const wScore = knockoutWinner === 'A' ? a : b;
      const lScore = knockoutWinner === 'A' ? b : a;
      return `Victoire ${winner} ${wScore}-${lScore}`;
    }
    if (a > b) return `Victoire ${match.teamA.name} ${a}-${b}`;
    if (b > a) return `Victoire ${match.teamB.name} ${b}-${a}`;
    return `Match nul ${a}-${b}`;
  };

  const previewOption = computeOption();
  const scoresEqual = scoreA !== '' && scoreB !== '' && parseInt(scoreA) === parseInt(scoreB) && !isNaN(parseInt(scoreA));
  const showTabOption = isKnockout && scoresEqual && knockoutWinner !== '';

  return {
    scoreA, setScoreA,
    scoreB, setScoreB,
    knockoutWinner, setKnockoutWinner,
    penScoreWinner, setPenScoreWinner,
    penScoreLoser, setPenScoreLoser,
    comment, setComment,
    isKnockout,
    previewOption,
    showTabOption,
  };
};
