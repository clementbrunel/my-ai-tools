import { describe, it, expect } from 'vitest';
import { extractResult, computePoints, parseOption } from './matchCalculations';

describe('extractResult', () => {
  it('returns "Match nul" for a draw option', () => {
    expect(extractResult('Match nul 1-1')).toBe('Match nul');
  });

  it('strips the score from a victory option', () => {
    expect(extractResult('Victoire France 2-1')).toBe('Victoire France');
  });

  it('handles multi-word team names', () => {
    expect(extractResult('Victoire Costa Rica 1-0')).toBe('Victoire Costa Rica');
  });

  it('returns the option as-is when it matches no known prefix', () => {
    expect(extractResult('Unknown option')).toBe('Unknown option');
  });

  it('handles "Victoire " prefix with no trailing space (no score)', () => {
    expect(extractResult('Victoire France')).toBe('Victoire');
  });

  it('strips t.a.b. marker and returns team name', () => {
    expect(extractResult('Victoire France t.a.b. 1-1')).toBe('Victoire France');
  });

  it('strips t.a.b. marker and penalty score suffix', () => {
    expect(extractResult('Victoire France t.a.b. 1-1 (5-4)')).toBe('Victoire France');
  });
});

describe('computePoints', () => {
  it('returns 5 for an exact match', () => {
    expect(computePoints('Victoire France 2-1', 'Victoire France 2-1')).toBe(5);
  });

  it('returns 3 when the winner is correct but the score differs', () => {
    expect(computePoints('Victoire France 2-1', 'Victoire France 3-0')).toBe(3);
  });

  it('returns 0 when the winner is wrong', () => {
    expect(computePoints('Victoire France 2-1', 'Victoire Maroc 1-0')).toBe(0);
  });

  it('returns 5 for an exact draw match', () => {
    expect(computePoints('Match nul 1-1', 'Match nul 1-1')).toBe(5);
  });

  it('returns 3 when both predict a draw but different scores', () => {
    expect(computePoints('Match nul 0-0', 'Match nul 2-2')).toBe(3);
  });

  it('returns 0 when one predicts draw and other predicts victory', () => {
    expect(computePoints('Match nul 0-0', 'Victoire France 1-0')).toBe(0);
  });

  it('trims whitespace before comparing', () => {
    expect(computePoints('  Victoire France 2-1  ', 'Victoire France 2-1')).toBe(5);
  });

  // ── TAB (tirs au but) scoring ──────────────────────────────────────────────

  it('returns 7 for exact TAB match including penalty score', () => {
    expect(computePoints('Victoire France t.a.b. 1-1 (5-4)', 'Victoire France t.a.b. 1-1 (5-4)')).toBe(7);
  });

  it('returns 5 for correct winner + TAB mode, no penalty score in prediction', () => {
    expect(computePoints('Victoire France t.a.b. 1-1', 'Victoire France t.a.b. 1-1 (5-4)')).toBe(5);
  });

  it('returns 5 for correct winner + TAB mode, wrong regular score', () => {
    expect(computePoints('Victoire France t.a.b. 0-0', 'Victoire France t.a.b. 1-1 (5-4)')).toBe(5);
  });

  it('returns 5 for correct winner + TAB mode, wrong penalty score', () => {
    expect(computePoints('Victoire France t.a.b. 1-1 (4-5)', 'Victoire France t.a.b. 1-1 (5-4)')).toBe(5);
  });

  it('returns 5 for exact TAB match when no penalty score stored in winning option', () => {
    expect(computePoints('Victoire France t.a.b. 1-1', 'Victoire France t.a.b. 1-1')).toBe(5);
  });

  it('returns 3 for correct winner but predicted normal win on a TAB match', () => {
    expect(computePoints('Victoire France 2-1', 'Victoire France t.a.b. 1-1')).toBe(3);
  });

  it('returns 3 for correct winner but predicted TAB on a normal win match', () => {
    expect(computePoints('Victoire France t.a.b. 1-1', 'Victoire France 2-1')).toBe(3);
  });

  it('returns 0 for wrong winner on a TAB match', () => {
    expect(computePoints('Victoire Angleterre t.a.b. 1-1', 'Victoire France t.a.b. 1-1')).toBe(0);
  });
});

describe('parseOption', () => {
  const teamA = 'France';
  const teamB = 'Maroc';

  it('parses a draw option', () => {
    expect(parseOption('Match nul 1-1', teamA, teamB)).toEqual(['1', '1']);
  });

  it('parses a draw with 0-0', () => {
    expect(parseOption('Match nul 0-0', teamA, teamB)).toEqual(['0', '0']);
  });

  it('parses a teamA victory — score stays [first, second]', () => {
    expect(parseOption('Victoire France 2-1', teamA, teamB)).toEqual(['2', '1']);
  });

  it('parses a teamB victory — swaps scores so [scoreA, scoreB]', () => {
    // teamB won 1-0, stored as "Victoire Maroc 1-0"; scoreA=0, scoreB=1
    expect(parseOption('Victoire Maroc 1-0', teamA, teamB)).toEqual(['0', '1']);
  });

  it('returns ["",""] when option has no score pattern', () => {
    expect(parseOption('Victoire France', teamA, teamB)).toEqual(['', '']);
  });

  it('returns ["",""] for an unrecognised option with a score', () => {
    expect(parseOption('Quelque chose 2-1', teamA, teamB)).toEqual(['', '']);
  });

  it('handles multi-word team names for teamA', () => {
    expect(parseOption('Victoire Costa Rica 3-2', 'Costa Rica', 'Brésil')).toEqual(['3', '2']);
  });

  it('handles multi-word team names for teamB', () => {
    expect(parseOption('Victoire Corée du Sud 1-0', 'Brésil', 'Corée du Sud')).toEqual(['0', '1']);
  });

  it('parses a TAB victory for teamA — returns draw score', () => {
    expect(parseOption('Victoire France t.a.b. 1-1', teamA, teamB)).toEqual(['1', '1']);
  });

  it('parses a TAB victory for teamB — returns draw score', () => {
    expect(parseOption('Victoire Maroc t.a.b. 0-0', teamA, teamB)).toEqual(['0', '0']);
  });

  it('parses a TAB victory with penalty score suffix', () => {
    expect(parseOption('Victoire France t.a.b. 1-1 (5-4)', teamA, teamB)).toEqual(['1', '1']);
  });
});
