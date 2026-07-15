import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Matches from './Matches';
import {
  makeMatch,
  TEAM_FRANCE,
  TEAM_BRESIL,
  TEAM_ESPAGNE,
  TEAM_ITALIE,
  TEAM_PORTUGAL,
  TEAM_ANGLETERRE,
} from '@/test-utils/factories';
import { renderWithRouter } from '@/test-utils/render-helpers';

// Le composant lit ses données depuis MatchesContext — on le mocke directement
// pour tester le comportement du composant en isolation.
vi.mock('../context/MatchesContext', () => ({
  MatchesProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useMatches: vi.fn(),
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: null }),
}));

vi.mock('../utils/countryFlags');

import * as matchesCtx from '@/context/MatchesContext';

type CtxValue = ReturnType<typeof matchesCtx.useMatches>;

const makeCtx = (overrides?: Partial<CtxValue>): CtxValue => ({
  matches: [],
  hasGroups: true,
  isLoading: false,
  fetchIfNeeded: vi.fn(),
  markParticipated: vi.fn(),
  ...overrides,
});

const renderPage = () => renderWithRouter(<Matches />);

describe('Matches — filtrage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("filtre UPCOMING : n'affiche que les matchs à venir", async () => {
    vi.mocked(matchesCtx.useMatches).mockReturnValue(makeCtx({
      matches: [
        makeMatch({ id: 1, teamA: TEAM_FRANCE, teamB: TEAM_BRESIL, status: 'UPCOMING' }),
        makeMatch({ id: 2, teamA: TEAM_ESPAGNE, teamB: TEAM_ITALIE, status: 'FINISHED', scoreA: 1, scoreB: 0 }),
      ],
    }));

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('France')).toBeDefined();
      expect(screen.queryByText('Espagne')).toBeNull();
    });
  });

  it("filtre FINISHED : n'affiche que les matchs terminés", async () => {
    const user = userEvent.setup();
    vi.mocked(matchesCtx.useMatches).mockReturnValue(makeCtx({
      matches: [
        makeMatch({ id: 1, teamA: TEAM_FRANCE, teamB: TEAM_BRESIL, status: 'UPCOMING' }),
        makeMatch({ id: 2, teamA: TEAM_ESPAGNE, teamB: TEAM_ITALIE, status: 'FINISHED', scoreA: 1, scoreB: 0 }),
      ],
    }));

    renderPage();

    await user.click(screen.getByText(/Terminés/));

    await waitFor(() => {
      expect(screen.getByText('Espagne')).toBeDefined();
      expect(screen.queryByText('France')).toBeNull();
    });
  });

  it('filtre ALL : affiche tous les matchs', async () => {
    const user = userEvent.setup();
    vi.mocked(matchesCtx.useMatches).mockReturnValue(makeCtx({
      matches: [
        makeMatch({ id: 1, teamA: TEAM_FRANCE, teamB: TEAM_BRESIL, status: 'UPCOMING' }),
        makeMatch({ id: 2, teamA: TEAM_ESPAGNE, teamB: TEAM_ITALIE, status: 'FINISHED', scoreA: 1, scoreB: 0 }),
      ],
    }));

    renderPage();

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
    vi.mocked(matchesCtx.useMatches).mockReturnValue(makeCtx({
      matches: [
        makeMatch({ id: 1, teamA: TEAM_FRANCE, teamB: TEAM_BRESIL, status: 'UPCOMING' }),
        makeMatch({ id: 2, teamA: TEAM_ESPAGNE, teamB: TEAM_ITALIE, status: 'UPCOMING' }),
      ],
    }));
  });

  it("filtre par nom d'équipe (case-insensitive)", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByPlaceholderText(/Rechercher/), 'france');

    await waitFor(() => {
      expect(screen.getByText('France')).toBeDefined();
      expect(screen.queryByText('Espagne')).toBeNull();
    });
  });

  it('filtre par équipe B', async () => {
    const user = userEvent.setup();
    renderPage();

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
    vi.mocked(matchesCtx.useMatches).mockReturnValue(makeCtx({
      matches: [makeMatch({ id: 1, teamA: TEAM_FRANCE, teamB: TEAM_BRESIL, status: 'UPCOMING' })],
    }));
  });

  it('bouton Vue tuiles visible', () => {
    renderPage();
    expect(screen.getByTitle('Vue tuiles')).toBeDefined();
  });

  it('bouton Vue liste visible', () => {
    renderPage();
    expect(screen.getByTitle('Vue liste')).toBeDefined();
  });

  it('click vue liste → les équipes restent visibles', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByTitle('Vue liste'));

    await waitFor(() => {
      expect(screen.getByText('France')).toBeDefined();
    });
  });
});

describe('Matches — group-by-date', () => {
  it('regroupe les matchs par date', async () => {
    vi.clearAllMocks();
    const user = userEvent.setup();
    vi.mocked(matchesCtx.useMatches).mockReturnValue(makeCtx({
      matches: [
        makeMatch({ id: 1, teamA: TEAM_FRANCE, teamB: TEAM_BRESIL, status: 'UPCOMING', matchDate: '2026-07-01T20:00:00Z' }),
        makeMatch({ id: 2, teamA: TEAM_ESPAGNE, teamB: TEAM_ITALIE, status: 'UPCOMING', matchDate: '2026-07-02T20:00:00Z' }),
        makeMatch({ id: 3, teamA: TEAM_PORTUGAL, teamB: TEAM_ANGLETERRE, status: 'UPCOMING', matchDate: '2026-07-01T18:00:00Z' }),
      ],
    }));

    renderPage();

    await user.click(screen.getByText(/Tous/));

    await waitFor(() => {
      const sections = document.querySelectorAll('section');
      expect(sections.length).toBe(2);
    });
  });
});

describe('Matches — sans groupe', () => {
  it('affiche un avertissement si pas de groupe', () => {
    vi.clearAllMocks();
    vi.mocked(matchesCtx.useMatches).mockReturnValue(makeCtx({
      hasGroups: false,
      matches: [],
    }));

    renderPage();

    expect(screen.getByText(/aucun groupe/i)).toBeDefined();
  });
});

describe('Matches — état de chargement', () => {
  it('affiche le spinner pendant isLoading', () => {
    vi.clearAllMocks();
    vi.mocked(matchesCtx.useMatches).mockReturnValue(makeCtx({ isLoading: true }));

    renderPage();

    expect(screen.getByText(/Chargement/i)).toBeDefined();
  });
});
