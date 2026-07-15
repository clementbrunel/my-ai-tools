import type { AuthResponse, CompetitionDto, Match, TeamDto, User } from '@/types';

export const makeTeam = (overrides?: Partial<TeamDto>): TeamDto => ({
  id: 1,
  name: 'France',
  iso2: 'fr',
  ...overrides,
});

export const TEAM_FRANCE = makeTeam({ id: 1, name: 'France', iso2: 'fr' });
export const TEAM_BRESIL = makeTeam({ id: 2, name: 'Brésil', iso2: 'br' });
export const TEAM_ESPAGNE = makeTeam({ id: 3, name: 'Espagne', iso2: 'es' });
export const TEAM_ITALIE = makeTeam({ id: 4, name: 'Italie', iso2: 'it' });
export const TEAM_PORTUGAL = makeTeam({ id: 5, name: 'Portugal', iso2: 'pt' });
export const TEAM_ANGLETERRE = makeTeam({ id: 6, name: 'Angleterre', iso2: 'gb-eng' });
export const TEAM_ALLEMAGNE = makeTeam({ id: 7, name: 'Allemagne', iso2: 'de' });

export const makeCompetition = (overrides?: Partial<CompetitionDto>): CompetitionDto => ({
  id: 1,
  name: 'Coupe du Monde 2026',
  sport: 'FOOT',
  ...overrides,
});

export const COMPETITION_WORLD_CUP = makeCompetition({ id: 1, name: 'Coupe du Monde 2026' });

export const makeUser = (overrides?: Partial<User>): User => ({
  id: 1,
  username: 'testuser',
  email: 'test@example.com',
  emailVerified: true,
  role: 'USER',
  emailReminderEnabled: false,
  emailGageEnabled: false,
  emailNewsletterEnabled: true,
  ...overrides,
});

export const makeToken = (expOffsetSeconds = 3600): string => {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = btoa(
    JSON.stringify({
      sub: 'testuser',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + expOffsetSeconds,
    })
  );
  return `${header}.${payload}.sig`;
};

export const makeAuthResponse = (overrides?: Partial<AuthResponse>): AuthResponse => ({
  token: makeToken(),
  tokenType: 'Bearer',
  user: makeUser(),
  ...overrides,
});

export const makeMatch = (overrides?: Partial<Match> & { id?: number }): Match => ({
  id: overrides?.id ?? 1,
  teamA: TEAM_FRANCE,
  teamB: TEAM_BRESIL,
  matchDate: '2026-07-01T20:00:00Z',
  status: 'UPCOMING',
  phase: 'KNOCKOUT',
  competition: COMPETITION_WORLD_CUP,
  round: 'Finale',
  ...overrides,
});
