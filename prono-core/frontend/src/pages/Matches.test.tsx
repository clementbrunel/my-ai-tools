import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Matches from './Matches';
import type { Match } from '../types';

vi.mock('../api/matches', () => ({
  getMatchesForMyGroups: vi.fn(),
}));

vi.mock('../api/groups', () => ({
  getMyGroups: vi.fn(),
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: null }),
}));

vi.mock('../utils/countryFlags', () => ({
  getFlagUrl: () => null,
}));

import * as matchesApi from '../api/matches';
import * as groupsApi from '../api/groups';

const makeMatch = (overrides: Partial<Match> & { id: number }): Match => ({
  teamA: 'France',
  teamB: 'Brésil',
  matchDate: '2026-07-01T20:00:00Z',
  status: 'UPCOMING',
  competition: 'WC 2026',
  round: 'Finale',
  ...overrides,
});

const renderPage = () =>
  render(
    <MemoryRouter>
      <Matches />
    </MemoryRouter>
  );

describe('Matches — filtrage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(groupsApi.getMyGroups).mockResolvedValue([{ id: 1 } as any]);
  });

  it('filtre UPCOMING : n\'affiche que les matchs à venir', async () => {
    vi.mocked(matchesApi.getMatchesForMyGroups).mockResolvedValue([
      makeMatch({ id: 1, teamA: 'France', teamB: 'Brésil', status: 'UPCOMING' }),
      makeMatch({ id: 2, teamA: 'Espagne', teamB: 'Italie', status: 'FINISHED', scoreA: 1, scoreB: 0 }),
    ]);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('France')).toBeDefined();
      expect(screen.queryByText('Espagne')).toBeNull();
    });
  });

  it('filtre FINISHED : n\'affiche que les matchs terminés', async () => {
    const user = userEvent.setup();
    vi.mocked(matchesApi.getMatchesForMyGroups).mockResolvedValue([
      makeMatch({ id: 1, teamA: 'France', teamB: 'Brésil', status: 'UPCOMING' }),
      makeMatch({ id: 2, teamA: 'Espagne', teamB: 'Italie', status: 'FINISHED', scoreA: 1, scoreB: 0 }),
    ]);

    renderPage();
    await waitFor(() => screen.getByText(/Terminés/));

    await user.click(screen.getByText(/Terminés/));

    await waitFor(() => {
      expect(screen.getByText('Espagne')).toBeDefined();
      expect(screen.queryByText('France')).toBeNull();
    });
  });

  it('filtre ALL : affiche tous les matchs', async () => {
    const user = userEvent.setup();
    vi.mocked(matchesApi.getMatchesForMyGroups).mockResolvedValue([
      makeMatch({ id: 1, teamA: 'France', teamB: 'Brésil', status: 'UPCOMING' }),
      makeMatch({ id: 2, teamA: 'Espagne', teamB: 'Italie', status: 'FINISHED', scoreA: 1, scoreB: 0 }),
    ]);

    renderPage();
    await waitFor(() => screen.getByText(/Tous/));

    await user.click(screen.getByText(/Tous/));

    await waitFor(() => {
      expect(screen.getByText('France')).toBeDefined();
      expect(screen.getByText('Espagne')).toBeDefined();
    });
  });
});

describe('Matches — recherche', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(groupsApi.getMyGroups).mockResolvedValue([{ id: 1 } as any]);
    vi.mocked(matchesApi.getMatchesForMyGroups).mockResolvedValue([
      makeMatch({ id: 1, teamA: 'France', teamB: 'Brésil', status: 'UPCOMING' }),
      makeMatch({ id: 2, teamA: 'Espagne', teamB: 'Italie', status: 'UPCOMING' }),
    ]);
  });

  it('filtre par nom d\'équipe (case-insensitive)', async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => screen.getByPlaceholderText(/Rechercher/));

    await user.type(screen.getByPlaceholderText(/Rechercher/), 'france');

    await waitFor(() => {
      expect(screen.getByText('France')).toBeDefined();
      expect(screen.queryByText('Espagne')).toBeNull();
    });
  });

  it('filtre par équipe B', async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => screen.getByPlaceholderText(/Rechercher/));

    await user.type(screen.getByPlaceholderText(/Rechercher/), 'ital');

    await waitFor(() => {
      expect(screen.getByText('Italie')).toBeDefined();
      expect(screen.queryByText('Brésil')).toBeNull();
    });
  });
});

describe('Matches — toggle grille/liste', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(groupsApi.getMyGroups).mockResolvedValue([{ id: 1 } as any]);
    vi.mocked(matchesApi.getMatchesForMyGroups).mockResolvedValue([
      makeMatch({ id: 1, teamA: 'France', teamB: 'Brésil', status: 'UPCOMING' }),
    ]);
  });

  it('bouton Vue tuiles visible', async () => {
    renderPage();
    await waitFor(() => screen.getByTitle('Vue tuiles'));
    expect(screen.getByTitle('Vue tuiles')).toBeDefined();
  });

  it('bouton Vue liste visible', async () => {
    renderPage();
    await waitFor(() => screen.getByTitle('Vue liste'));
    expect(screen.getByTitle('Vue liste')).toBeDefined();
  });

  it('click vue liste → les équipes restent visibles', async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => screen.getByTitle('Vue liste'));
    await user.click(screen.getByTitle('Vue liste'));

    await waitFor(() => {
      expect(screen.getByText('France')).toBeDefined();
    });
  });
});

describe('Matches — group-by-date', () => {
  it('regroupe les matchs par date', async () => {
    vi.clearAllMocks();
    vi.mocked(groupsApi.getMyGroups).mockResolvedValue([{ id: 1 } as any]);
    vi.mocked(matchesApi.getMatchesForMyGroups).mockResolvedValue([
      makeMatch({ id: 1, teamA: 'France', teamB: 'Brésil', status: 'UPCOMING', matchDate: '2026-07-01T20:00:00Z' }),
      makeMatch({ id: 2, teamA: 'Espagne', teamB: 'Italie', status: 'UPCOMING', matchDate: '2026-07-02T20:00:00Z' }),
      makeMatch({ id: 3, teamA: 'Portugal', teamB: 'Angleterre', status: 'UPCOMING', matchDate: '2026-07-01T18:00:00Z' }),
    ]);

    const user = userEvent.setup();
    renderPage();

    await waitFor(() => screen.getByText(/Tous/));
    await user.click(screen.getByText(/Tous/));

    await waitFor(() => {
      // 2 matchs le 2026-07-01, 1 match le 2026-07-02
      const sections = document.querySelectorAll('section');
      expect(sections.length).toBe(2);
    });
  });
});

describe('Matches — sans groupe', () => {
  it('affiche un avertissement si pas de groupe', async () => {
    vi.clearAllMocks();
    vi.mocked(groupsApi.getMyGroups).mockResolvedValue([]);
    vi.mocked(matchesApi.getMatchesForMyGroups).mockResolvedValue([]);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/aucun groupe/i)).toBeDefined();
    });
  });
});
