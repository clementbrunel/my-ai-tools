import type { AuthResponse, Bet, BetParticipation, CompetitionDto, Forfeit, Group, GroupMember, Match, TeamDto, User } from '@/types';

export const makeTeam = (overrides?: Partial<TeamDto>): TeamDto => ({
  id: 1,
  name: 'France',
  iso2: 'fr',
  crestUrl: null,
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
  active: true,
  season: null,
  footballDataCompetitionCode: null,
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

export const makeGroupMember = (overrides?: Partial<GroupMember>): GroupMember => ({
  id: 1,
  userId: 1,
  username: 'alice',
  role: 'MEMBER',
  status: 'ACTIVE',
  joinedAt: '2026-06-01T00:00:00Z',
  ...overrides,
});

export const makeGroup = (overrides?: Partial<Group>): Group => ({
  id: 1,
  sports: ['FOOT'],
  name: 'Les Potes',
  inviteCode: 'ABCD1234',
  createdByUsername: 'alice',
  memberCount: 1,
  isPrivate: false,
  gagesEnabled: true,
  members: [makeGroupMember()],
  createdAt: '2026-06-01T00:00:00Z',
  currentUserRole: 'GROUP_ADMIN',
  ...overrides,
});

export const makeForfeit = (overrides?: Partial<Forfeit>): Forfeit => ({
  id: 1,
  title: 'Karaoké solo',
  description: 'Une chanson entière devant le groupe',
  category: 'Nourriture',
  isActive: true,
  timesCompleted: 0,
  voteScore: 0,
  userVote: 0,
  ...overrides,
});

export const makeBet = (overrides?: Partial<Bet>): Bet => ({
  id: 1,
  title: 'France - Brésil',
  groupId: 1,
  groupName: 'Les Amis',
  creator: makeUser(),
  betType: 'SCORE',
  points: 5,
  deadline: '2026-07-01T20:00:00Z',
  status: 'OPEN',
  createdAt: '2026-06-01T00:00:00Z',
  participationsCount: 0,
  ...overrides,
});

export const makeBetParticipation = (overrides?: Partial<BetParticipation>): BetParticipation => ({
  id: 1,
  betId: 1,
  user: makeUser(),
  chosenOption: 'Match nul 1-1',
  createdAt: '2026-06-15T10:00:00Z',
  ...overrides,
});
