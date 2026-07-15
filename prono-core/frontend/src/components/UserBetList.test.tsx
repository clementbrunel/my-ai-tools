import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import UserBetList from './UserBetList';
import type { UserBetSummary } from '@/types';

const makeBet = (overrides?: Partial<UserBetSummary>): UserBetSummary => ({
  participationId: 1,
  betId: 10,
  betTitle: 'Résultat France-Brésil',
  betStatus: 'VALIDATED',
  betPoints: 3,
  chosenOption: '2-1',
  winningOption: '2-1',
  pointsEarned: 3,
  participatedAt: '2026-06-15T10:00:00Z',
  ...overrides,
});

const makeBets = (count: number, overrides?: Partial<UserBetSummary>): UserBetSummary[] =>
  Array.from({ length: count }, (_, i) =>
    makeBet({ participationId: i + 1, betTitle: `Paris ${i + 1}`, ...overrides })
  );

describe('UserBetList — état vide', () => {
  it('affiche le message vide si aucun pari', () => {
    render(<UserBetList bets={[]} />);
    expect(screen.getByText(/Aucun pari effectué/)).toBeDefined();
  });

  it('affiche le message vide si tous les paris sont OPEN et showOpen=false', () => {
    render(<UserBetList bets={[makeBet({ betStatus: 'OPEN', pointsEarned: 0 })]} />);
    expect(screen.getByText(/Aucun pari effectué/)).toBeDefined();
  });
});

describe('UserBetList — mode card (défaut)', () => {
  it('affiche le titre du pari', () => {
    render(<UserBetList bets={[makeBet()]} showOpen />);
    expect(screen.getByText('Résultat France-Brésil')).toBeDefined();
  });

  it('affiche le nom des équipes si matchTeamA/B présents', () => {
    render(<UserBetList bets={[makeBet({ matchTeamA: 'France', matchTeamB: 'Brésil' })]} />);
    expect(screen.getByText('France – Brésil')).toBeDefined();
  });

  it('affiche +X pts et le choix pour un pari gagné', () => {
    render(<UserBetList bets={[makeBet({ pointsEarned: 3 })]} />);
    expect(screen.getByText('+3 pts')).toBeDefined();
  });

  it("affiche 0 pt pour un pari perdu", () => {
    render(<UserBetList bets={[makeBet({ pointsEarned: 0, winningOption: '1-0' })]} />);
    expect(screen.getByText('0 pt')).toBeDefined();
  });

  it('affiche "En cours" pour un pari OPEN', () => {
    render(<UserBetList bets={[makeBet({ betStatus: 'OPEN', pointsEarned: 0 })]} showOpen />);
    expect(screen.getByText('En cours')).toBeDefined();
  });

  it('affiche "Annulé" pour un pari CANCELLED', () => {
    render(<UserBetList bets={[makeBet({ betStatus: 'CANCELLED', pointsEarned: 0 })]} />);
    expect(screen.getByText('Annulé')).toBeDefined();
  });
});

describe('UserBetList — mode compact', () => {
  it('affiche le titre du pari en mode compact', () => {
    render(<UserBetList bets={[makeBet()]} compact />);
    expect(screen.getByText('Résultat France-Brésil')).toBeDefined();
  });

  it('affiche +X pts en vert pour un pari gagné (compact)', () => {
    render(<UserBetList bets={[makeBet({ pointsEarned: 3 })]} compact />);
    expect(screen.getByText('+3pts')).toBeDefined();
  });

  it('affiche le symbole ✓ pour un pari gagné (compact)', () => {
    render(<UserBetList bets={[makeBet({ pointsEarned: 3 })]} compact />);
    expect(screen.getByText('✓')).toBeDefined();
  });

  it('affiche le symbole ✗ pour un pari perdu (compact)', () => {
    render(<UserBetList bets={[makeBet({ pointsEarned: 0, winningOption: '1-0' })]} compact />);
    expect(screen.getByText('✗')).toBeDefined();
  });
});

describe('UserBetList — pagination', () => {
  it("n'affiche pas la pagination si <= 8 paris", () => {
    render(<UserBetList bets={makeBets(8)} />);
    expect(screen.queryByText('›')).toBeNull();
  });

  it('affiche la pagination si > 8 paris', () => {
    render(<UserBetList bets={makeBets(9)} />);
    expect(screen.getByText('›')).toBeDefined();
  });

  it("n'affiche que la première page au rendu initial", () => {
    render(<UserBetList bets={makeBets(9)} />);
    expect(screen.getByText('Paris 1')).toBeDefined();
    expect(screen.queryByText('Paris 9')).toBeNull();
  });

  it('affiche la page suivante après clic sur next', async () => {
    render(<UserBetList bets={makeBets(9)} />);
    await userEvent.click(screen.getByText('›'));
    expect(screen.getByText('Paris 9')).toBeDefined();
    expect(screen.queryByText('Paris 1')).toBeNull();
  });
});
