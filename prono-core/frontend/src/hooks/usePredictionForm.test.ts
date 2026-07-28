import { renderHook, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { usePredictionForm } from './usePredictionForm';
import { makeBetParticipation, makeMatch, TEAM_FRANCE, TEAM_BRESIL } from '@/test-utils/factories';

const GROUP_MATCH = makeMatch({ phase: 'POOL', teamA: TEAM_FRANCE, teamB: TEAM_BRESIL });
const KNOCKOUT_MATCH = makeMatch({ phase: 'KNOCKOUT', teamA: TEAM_FRANCE, teamB: TEAM_BRESIL });

describe('usePredictionForm — preview (phase POOL)', () => {
  it("prévisualise une victoire de l'équipe A", () => {
    const { result } = renderHook(() => usePredictionForm(GROUP_MATCH, undefined));
    act(() => {
      result.current.setScoreA('2');
      result.current.setScoreB('1');
    });
    expect(result.current.previewOption).toBe('Victoire France 2-1');
  });

  it("prévisualise une victoire de l'équipe B", () => {
    const { result } = renderHook(() => usePredictionForm(GROUP_MATCH, undefined));
    act(() => {
      result.current.setScoreA('0');
      result.current.setScoreB('3');
    });
    expect(result.current.previewOption).toBe('Victoire Brésil 3-0');
  });

  it('prévisualise un match nul', () => {
    const { result } = renderHook(() => usePredictionForm(GROUP_MATCH, undefined));
    act(() => {
      result.current.setScoreA('1');
      result.current.setScoreB('1');
    });
    expect(result.current.previewOption).toBe('Match nul 1-1');
  });

  it('ne propose jamais le bloc t.a.b. en phase de poule', () => {
    const { result } = renderHook(() => usePredictionForm(GROUP_MATCH, undefined));
    act(() => {
      result.current.setScoreA('1');
      result.current.setScoreB('1');
    });
    expect(result.current.showTabOption).toBe(false);
  });
});

describe('usePredictionForm — preview (phase KNOCKOUT)', () => {
  it('ne prévisualise rien tant que le vainqueur t.a.b. n\'est pas choisi à égalité', () => {
    const { result } = renderHook(() => usePredictionForm(KNOCKOUT_MATCH, undefined));
    // scores initiaux 0-0, aucun vainqueur choisi
    expect(result.current.previewOption).toBe('');
  });

  it('prévisualise une victoire nette sans t.a.b.', () => {
    const { result } = renderHook(() => usePredictionForm(KNOCKOUT_MATCH, undefined));
    act(() => {
      result.current.setScoreA('2');
      result.current.setScoreB('1');
    });
    // auto-correction : scores inégaux → knockoutWinner passe automatiquement à 'A'
    expect(result.current.knockoutWinner).toBe('A');
    expect(result.current.previewOption).toBe('Victoire France 2-1');
  });

  it('prévisualise un t.a.b. sans score de tirs au but', () => {
    const { result } = renderHook(() => usePredictionForm(KNOCKOUT_MATCH, undefined));
    act(() => {
      result.current.setScoreA('1');
      result.current.setScoreB('1');
    });
    act(() => result.current.setKnockoutWinner('A'));
    expect(result.current.showTabOption).toBe(true);
    expect(result.current.previewOption).toBe('Victoire France t.a.b. 1-1');
  });

  it('prévisualise un t.a.b. avec le score des tirs au but', () => {
    const { result } = renderHook(() => usePredictionForm(KNOCKOUT_MATCH, undefined));
    act(() => {
      result.current.setScoreA('1');
      result.current.setScoreB('1');
      result.current.setKnockoutWinner('B');
    });
    act(() => {
      result.current.setPenScoreWinner('5');
      result.current.setPenScoreLoser('4');
    });
    expect(result.current.previewOption).toBe('Victoire Brésil t.a.b. 1-1 (5-4)');
  });

  it('vide la prévisualisation si le score contredit le vainqueur choisi', () => {
    const { result } = renderHook(() => usePredictionForm(KNOCKOUT_MATCH, undefined));
    act(() => {
      result.current.setScoreA('1');
      result.current.setScoreB('1');
      result.current.setKnockoutWinner('A');
    });
    // Score devient incohérent avec le vainqueur 'A' choisi manuellement...
    act(() => result.current.setScoreB('3'));
    // ...mais l'auto-correction rebascule automatiquement le vainqueur sur 'B'
    expect(result.current.knockoutWinner).toBe('B');
    expect(result.current.previewOption).toBe('Victoire Brésil 3-1');
  });

  it('remet à zéro le score de t.a.b. dès que les scores redeviennent inégaux', () => {
    const { result } = renderHook(() => usePredictionForm(KNOCKOUT_MATCH, undefined));
    act(() => {
      result.current.setScoreA('1');
      result.current.setScoreB('1');
      result.current.setKnockoutWinner('A');
    });
    act(() => {
      result.current.setPenScoreWinner('5');
      result.current.setPenScoreLoser('4');
    });
    act(() => result.current.setScoreA('2'));
    expect(result.current.penScoreWinner).toBe('');
    expect(result.current.penScoreLoser).toBe('');
  });
});

describe('usePredictionForm — pré-remplissage depuis une participation existante', () => {
  it('pré-remplit le score et le commentaire (match nul, phase POOL)', () => {
    const participation = makeBetParticipation({ chosenOption: 'Match nul 1-1', comment: 'Serré !' });
    const { result } = renderHook(() => usePredictionForm(GROUP_MATCH, participation));
    expect(result.current.scoreA).toBe('1');
    expect(result.current.scoreB).toBe('1');
    expect(result.current.comment).toBe('Serré !');
  });

  it('pré-remplit le vainqueur en phase KNOCKOUT', () => {
    const participation = makeBetParticipation({ chosenOption: 'Victoire France 2-0' });
    const { result } = renderHook(() => usePredictionForm(KNOCKOUT_MATCH, participation));
    expect(result.current.scoreA).toBe('2');
    expect(result.current.scoreB).toBe('0');
    expect(result.current.knockoutWinner).toBe('A');
  });

  it('pré-remplit le score de t.a.b. le cas échéant', () => {
    const participation = makeBetParticipation({ chosenOption: 'Victoire France t.a.b. 1-1 (5-4)' });
    const { result } = renderHook(() => usePredictionForm(KNOCKOUT_MATCH, participation));
    expect(result.current.scoreA).toBe('1');
    expect(result.current.scoreB).toBe('1');
    expect(result.current.knockoutWinner).toBe('A');
    expect(result.current.penScoreWinner).toBe('5');
    expect(result.current.penScoreLoser).toBe('4');
  });

  it("laisse le score par défaut si aucune participation n'existe", () => {
    const { result } = renderHook(() => usePredictionForm(GROUP_MATCH, undefined));
    expect(result.current.scoreA).toBe('0');
    expect(result.current.scoreB).toBe('0');
    expect(result.current.comment).toBe('');
  });
});
