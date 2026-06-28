import type { AuthResponse, Match, User } from '../types';

export const makeUser = (overrides?: Partial<User>): User => ({
  id: 1,
  username: 'testuser',
  email: 'test@example.com',
  emailVerified: true,
  role: 'USER',
  emailReminderEnabled: false,
  emailGageEnabled: false,
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
  teamA: 'France',
  teamB: 'Brésil',
  matchDate: '2026-07-01T20:00:00Z',
  status: 'UPCOMING',
  competition: 'Coupe du Monde 2026',
  round: 'Finale',
  ...overrides,
});
