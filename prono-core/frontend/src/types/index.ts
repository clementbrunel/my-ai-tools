export interface User {
  id: number;
  username: string;
  displayName?: string;
  email: string;
  role: 'PLATFORM_ADMIN' | 'USER';
  avatarUrl?: string;
  globalScore: number;
  betsWon: number;
  forfeitsReceived: number;
  createdAt?: string;
}

export const isAdmin = (user: User | null | undefined): boolean =>
  user?.role === 'PLATFORM_ADMIN';

export type GroupRole = 'GROUP_ADMIN' | 'MEMBER';
export type MemberStatus = 'ACTIVE' | 'PENDING';

export interface GroupMember {
  id: number;
  userId: number;
  username: string;
  displayName?: string;
  avatarUrl?: string;
  role: GroupRole;
  status: MemberStatus;
  joinedAt: string;
}

export interface Group {
  id: number;
  name: string;
  description?: string;
  inviteCode: string;
  createdByUsername: string;
  memberCount: number;
  isPrivate: boolean;
  members: GroupMember[];
  pendingApplications?: GroupMember[];
  createdAt: string;
  currentUserRole: GroupRole | null;
}

export interface PublicGroup {
  id: number;
  name: string;
  description?: string;
  createdByUsername: string;
  memberCount: number;
  isPrivate: boolean;
  createdAt: string;
  currentUserStatus: MemberStatus | null;
}

export interface CreateGroupRequest {
  name: string;
  description?: string;
}

export interface JoinGroupRequest {
  inviteCode: string;
}

export interface Match {
  id: number;
  teamA: string;
  teamB: string;
  matchDate: string;
  scoreA?: number;
  scoreB?: number;
  status: 'UPCOMING' | 'ONGOING' | 'FINISHED';
  competition: string;
  round: string;
}

export interface Bet {
  id: number;
  title: string;
  description?: string;
  groupId: number;
  groupName: string;
  match?: Match;
  creator: User;
  betType: 'SCORE' | 'EVENT' | 'FORFEIT' | 'FREE';
  points: number;
  deadline: string;
  status: 'OPEN' | 'VALIDATED' | 'CANCELLED';
  winningOption?: string;
  createdAt: string;
  participationsCount: number;
}

export interface BetParticipation {
  id: number;
  betId: number;
  user: User;
  chosenOption: string;
  comment?: string;
  createdAt: string;
}

export interface Forfeit {
  id: number;
  title: string;
  description: string;
  category: string;
  isActive: boolean;
  timesCompleted: number;
  proposedByUsername?: string;
  /** null = shared gage (visible to all groups); set = belongs to that group only */
  groupId?: number | null;
  groupName?: string | null;
}

export interface UserForfeitEntry {
  id: number;
  forfeit: Forfeit;
  assignedByUsername: string;
  completed: boolean;
  completedAt?: string;
  assignedAt: string;
}

export interface DailyGageCandidate {
  id: number;
  forfeit: Forfeit;
  voteScore: number;
  /** Current user's vote: -1, 0, or +1 */
  userVote: number;
}

export interface DailyGage {
  id: number;
  groupId: number;
  groupName: string;
  matchDate: string;   // "2026-06-11"
  forfeit?: Forfeit;
  mode: 'DIRECT' | 'VOTE';
  status: 'PENDING' | 'ACTIVE' | 'SETTLED';
  assignedToUsername?: string;
  assignedAt?: string;
  candidates: DailyGageCandidate[];
  createdAt: string;
}

export interface LeaderboardEntry {
  rank: number;
  user: User;
  betsWon: number;
  totalPoints: number;
  forfeitsReceived: number;
}

export interface AuthResponse {
  token: string;
  tokenType: string;
  user: User;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
}

export interface CreateBetRequest {
  title: string;
  description?: string;
  matchId: number;
  groupId: number;
  betType: 'SCORE';
  points: number;
}

export interface OpenBettingRequest {
  groupId: number;
  matchId: number;
}

export interface OpenCompetitionRequest {
  groupId: number;
  competition: string;
}

export interface CreateMatchRequest {
  teamA: string;
  teamB: string;
  matchDate: string;
  competition: string;
  round: string;
}

export interface UpdateMatchScoreRequest {
  scoreA: number;
  scoreB: number;
  status: 'UPCOMING' | 'ONGOING' | 'FINISHED';
}

export interface DecodedToken {
  sub: string;
  iat: number;
  exp: number;
}
