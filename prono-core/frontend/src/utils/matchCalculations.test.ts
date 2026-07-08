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
  // ── Groupe 1 : résultat final Victoire France 1-0 ─────────────────────────

  it('1.1 — exact score → 5', () => {
    expect(computePoints('Victoire France 1-0', 'Victoire France 1-0')).toBe(5);
  });

  it('1.2 — bon gagnant, mauvais score → 3', () => {
    expect(computePoints('Victoire France 2-1', 'Victoire France 1-0')).toBe(3);
  });

  it('1.3 — prédit TAB France, résultat normal France → 3', () => {
    expect(computePoints('Victoire France t.a.b. 1-1', 'Victoire France 1-0')).toBe(3);
  });

  it('1.4 — mauvais gagnant → 0', () => {
    expect(computePoints('Victoire Maroc 1-0', 'Victoire France 1-0')).toBe(0);
  });

  it('1.5 — mauvais gagnant TAB → 0', () => {
    expect(computePoints('Victoire Maroc t.a.b. 1-1', 'Victoire France 1-0')).toBe(0);
  });

  // ── Groupe 2 : résultat final Victoire France t.a.b. 1-1 (5-4) ───────────

  it('2.1 — exact TAB avec score pénalty → 7', () => {
    expect(computePoints('Victoire France t.a.b. 1-1 (5-4)', 'Victoire France t.a.b. 1-1 (5-4)')).toBe(7);
  });

  it('2.2 — bon gagnant + bon score rég + mauvais score pén → 5', () => {
    expect(computePoints('Victoire France t.a.b. 1-1 (3-2)', 'Victoire France t.a.b. 1-1 (5-4)')).toBe(5);
  });

  it('2.3 — bon gagnant + bon score rég + pas de score pén → 5', () => {
    expect(computePoints('Victoire France t.a.b. 1-1', 'Victoire France t.a.b. 1-1 (5-4)')).toBe(5);
  });

  it('2.4 — bon gagnant + mauvais score rég → 3', () => {
    expect(computePoints('Victoire France t.a.b. 0-0', 'Victoire France t.a.b. 1-1 (5-4)')).toBe(3);
  });

  it('2.5 — bon gagnant, prédit normal vs TAB → 3', () => {
    expect(computePoints('Victoire France 2-1', 'Victoire France t.a.b. 1-1 (5-4)')).toBe(3);
  });

  it('2.6 — mauvais gagnant + bon score rég → 2', () => {
    expect(computePoints('Victoire Maroc t.a.b. 1-1', 'Victoire France t.a.b. 1-1 (5-4)')).toBe(2);
  });

  it('2.7 — mauvais gagnant + mauvais score rég → 0', () => {
    expect(computePoints('Victoire Maroc t.a.b. 0-0', 'Victoire France t.a.b. 1-1 (5-4)')).toBe(0);
  });

  it('2.8 — mauvais gagnant normal vs TAB → 0', () => {
    expect(computePoints('Victoire Maroc 2-1', 'Victoire France t.a.b. 1-1 (5-4)')).toBe(0);
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
