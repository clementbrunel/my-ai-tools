import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LeaderboardRow from './LeaderboardRow';
import type { LeaderboardEntry, UserBetSummary } from '../types';
import { makeUser } from '../test-utils/factories';

vi.mock('../api/bets', () => ({
  getUserBetsInGroup: vi.fn(),
}));

import * as betsApi from '../api/bets';

const makeEntry = (overrides?: Partial<LeaderboardEntry>): LeaderboardEntry => ({
  rank: 2,
  user: makeUser({ id: 42, username: 'alice', displayName: 'Alice Dupont' }),
  betsWon: 5,
  totalPoints: 120,
  forfeitsReceived: 1,
  ...overrides,
});

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

const renderRow = (entry = makeEntry(), groupId: number | null = 7) =>
  render(
    <table>
      <tbody>
        <LeaderboardRow entry={entry} groupId={groupId} />
      </tbody>
    </table>
  );

describe('LeaderboardRow — rendu initial', () => {
  it('affiche le nom affiché', () => {
    renderRow();
    expect(screen.getByText('Alice Dupont')).toBeDefined();
  });

  it('affiche le total de points', () => {
    renderRow();
    expect(screen.getByText('120')).toBeDefined();
  });

  it('affiche le nombre de paris gagnés', () => {
    renderRow();
    expect(screen.getByText('5')).toBeDefined();
  });

  it('affiche le nombre de forfeits', () => {
    renderRow();
    expect(screen.getByText(/1 🃏/)).toBeDefined();
  });

  it('affiche le rang numérique si > 3', () => {
    renderRow(makeEntry({ rank: 5 }));
    expect(screen.getByText('#5')).toBeDefined();
  });

  it("affiche l'emoji médaille pour le rang 1", () => {
    renderRow(makeEntry({ rank: 1 }));
    expect(screen.getByText('🥇')).toBeDefined();
  });
});

describe('LeaderboardRow — expand au clic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('appelle getUserBetsInGroup au premier clic et affiche les paris', async () => {
    const user = userEvent.setup();
    vi.mocked(betsApi.getUserBetsInGroup).mockResolvedValue([makeBet()]);

    renderRow();

    await user.click(screen.getByText('Alice Dupont'));

    await waitFor(() => {
      expect(betsApi.getUserBetsInGroup).toHaveBeenCalledWith(7, 42);
      expect(screen.getByText('Résultat France-Brésil')).toBeDefined();
    });
  });

  it("n'appelle pas l'API si groupId est null", async () => {
    const user = userEvent.setup();
    renderRow(makeEntry(), null);

    await user.click(screen.getByText('Alice Dupont'));

    expect(betsApi.getUserBetsInGroup).not.toHaveBeenCalled();
  });

  it("ne crash pas si l'API échoue", async () => {
    const user = userEvent.setup();
    vi.mocked(betsApi.getUserBetsInGroup).mockRejectedValue(new Error('Network error'));

    renderRow();
    await user.click(screen.getByText('Alice Dupont'));

    await waitFor(() => {
      expect(screen.getByText(/Aucun pari/)).toBeDefined();
    });
  });

  it("n'appelle l'API qu'une seule fois même si on clique plusieurs fois", async () => {
    const user = userEvent.setup();
    vi.mocked(betsApi.getUserBetsInGroup).mockResolvedValue([makeBet()]);

    renderRow();

    await user.click(screen.getByText('Alice Dupont'));
    await waitFor(() => expect(screen.getByText('Résultat France-Brésil')).toBeDefined());

    await user.click(screen.getByText('Alice Dupont'));
    await user.click(screen.getByText('Alice Dupont'));

    expect(betsApi.getUserBetsInGroup).toHaveBeenCalledTimes(1);
  });
});
