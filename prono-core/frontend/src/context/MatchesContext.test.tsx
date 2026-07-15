import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import { MatchesProvider, useMatches } from './MatchesContext';
import { makeMatch } from '@/test-utils/factories';
import type { Group, Match } from '@/types';

vi.mock('../api/matches', () => ({
  getMatchesForMyGroups: vi.fn(),
}));

vi.mock('../api/groups', () => ({
  getMyGroups: vi.fn(),
}));

import * as matchesApi from '@/api/matches';
import * as groupsApi from '@/api/groups';

// ── Test consumer ──────────────────────────────────────────────────────────────

const TestConsumer: React.FC = () => {
  const { matches, hasGroups, isLoading, fetchIfNeeded, markParticipated } = useMatches();
  return (
    <div>
      <span data-testid="count">{matches.length}</span>
      <span data-testid="hasGroups">{String(hasGroups)}</span>
      <span data-testid="loading">{String(isLoading)}</span>
      <ul>
        {matches.map((m) => (
          <li key={m.id} data-testid={`match-${m.id}`}>
            {String(m.userParticipated ?? false)}
          </li>
        ))}
      </ul>
      <button onClick={fetchIfNeeded}>Fetch</button>
      <button onClick={() => markParticipated(1)}>Mark 1</button>
    </div>
  );
};

const renderContext = () =>
  render(
    <MatchesProvider>
      <TestConsumer />
    </MatchesProvider>
  );

// ── Helpers ────────────────────────────────────────────────────────────────────

const oneGroup = [{ id: 1 } as Group];
const twoMatches = [
  makeMatch({ id: 1, userParticipated: false }),
  makeMatch({ id: 2, userParticipated: false }),
];

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('MatchesContext — useMatches sans provider', () => {
  it('throw si utilisé hors MatchesProvider', () => {
    const err = console.error;
    console.error = vi.fn(); // silence React's error boundary log
    expect(() => render(<TestConsumer />)).toThrow('useMatches must be used within MatchesProvider');
    console.error = err;
  });
});

describe('MatchesContext — fetchIfNeeded', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(groupsApi.getMyGroups).mockResolvedValue(oneGroup);
    vi.mocked(matchesApi.getMatchesForMyGroups).mockResolvedValue(twoMatches);
  });

  it('appelle les deux endpoints API', async () => {
    renderContext();

    await act(async () => { screen.getByText('Fetch').click(); });

    await waitFor(() => {
      expect(groupsApi.getMyGroups).toHaveBeenCalledTimes(1);
      expect(matchesApi.getMatchesForMyGroups).toHaveBeenCalledTimes(1);
    });
  });

  it('peuple matches et hasGroups depuis la réponse API', async () => {
    renderContext();

    await act(async () => { screen.getByText('Fetch').click(); });

    await waitFor(() => {
      expect(screen.getByTestId('count').textContent).toBe('2');
      expect(screen.getByTestId('hasGroups').textContent).toBe('true');
    });
  });

  it('hasGroups: false quand getMyGroups retourne un tableau vide', async () => {
    vi.mocked(groupsApi.getMyGroups).mockResolvedValue([]);
    renderContext();

    await act(async () => { screen.getByText('Fetch').click(); });

    await waitFor(() => {
      expect(screen.getByTestId('hasGroups').textContent).toBe('false');
    });
  });

  it('isLoading: true pendant le premier fetch, false après', async () => {
    let resolveMatches!: (v: Match[]) => void;
    vi.mocked(matchesApi.getMatchesForMyGroups).mockReturnValue(
      new Promise((r) => { resolveMatches = r; })
    );

    renderContext();
    screen.getByText('Fetch').click();

    // État pendant le fetch
    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('true');
    });

    // Résolution
    await act(async () => { resolveMatches(twoMatches); });

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });
  });

  it('ne refetch pas si les données sont fraîches (< 5 min)', async () => {
    renderContext();

    await act(async () => { screen.getByText('Fetch').click(); });
    await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('2'));

    // Deuxième appel immédiat
    await act(async () => { screen.getByText('Fetch').click(); });

    expect(matchesApi.getMatchesForMyGroups).toHaveBeenCalledTimes(1);
  });

  it('refetch silencieusement si données obsolètes (> 5 min)', async () => {
    const dateSpy = vi.spyOn(Date, 'now');
    dateSpy.mockReturnValue(0);

    renderContext();

    await act(async () => { screen.getByText('Fetch').click(); });
    await waitFor(() => expect(matchesApi.getMatchesForMyGroups).toHaveBeenCalledTimes(1));

    // Avancer de 6 minutes
    dateSpy.mockReturnValue(6 * 60 * 1000);

    await act(async () => { screen.getByText('Fetch').click(); });

    await waitFor(() => {
      expect(matchesApi.getMatchesForMyGroups).toHaveBeenCalledTimes(2);
    });

    dateSpy.mockRestore();
  });

  it('isLoading reste false lors d\'un refresh silencieux (données déjà présentes)', async () => {
    const dateSpy = vi.spyOn(Date, 'now');
    dateSpy.mockReturnValue(0);

    renderContext();
    await act(async () => { screen.getByText('Fetch').click(); });
    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));

    // Avancer le temps → données obsolètes
    dateSpy.mockReturnValue(6 * 60 * 1000);

    // Déclencher le refresh silencieux
    await act(async () => { screen.getByText('Fetch').click(); });

    // isLoading doit rester false (pas de spinner sur refresh silencieux)
    expect(screen.getByTestId('loading').textContent).toBe('false');

    dateSpy.mockRestore();
  });

  it('ne crashe pas et remet isLoading à false en cas d\'erreur API', async () => {
    vi.mocked(matchesApi.getMatchesForMyGroups).mockRejectedValue(new Error('Network error'));

    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    renderContext();

    await act(async () => { screen.getByText('Fetch').click(); });

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
      expect(screen.getByTestId('count').textContent).toBe('0');
    });

    errSpy.mockRestore();
  });
});

describe('MatchesContext — markParticipated', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.mocked(groupsApi.getMyGroups).mockResolvedValue(oneGroup);
    vi.mocked(matchesApi.getMatchesForMyGroups).mockResolvedValue(twoMatches);
  });

  it('met userParticipated: true sur le match ciblé', async () => {
    renderContext();
    await act(async () => { screen.getByText('Fetch').click(); });
    await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('2'));

    expect(screen.getByTestId('match-1').textContent).toBe('false');

    await act(async () => { screen.getByText('Mark 1').click(); });

    expect(screen.getByTestId('match-1').textContent).toBe('true');
  });

  it('ne modifie pas les autres matchs', async () => {
    renderContext();
    await act(async () => { screen.getByText('Fetch').click(); });
    await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('2'));

    await act(async () => { screen.getByText('Mark 1').click(); });

    expect(screen.getByTestId('match-2').textContent).toBe('false');
  });

  it('ne déclenche pas de refetch API', async () => {
    renderContext();
    await act(async () => { screen.getByText('Fetch').click(); });
    await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('2'));

    await act(async () => { screen.getByText('Mark 1').click(); });

    expect(matchesApi.getMatchesForMyGroups).toHaveBeenCalledTimes(1);
  });
});
