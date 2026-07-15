export interface User {
  id: number;
  username: string;
  displayName?: string;
  email: string;
  emailVerified: boolean;
  role: 'PLATFORM_ADMIN' | 'USER';
  avatarUrl?: string;
  customAvatarUrl?: string;
  emailReminderEnabled: boolean;
  emailGageEnabled: boolean;
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
  sports: Sport[];
  name: string;
  description?: string;
  inviteCode: string;
  createdByUsername: string;
  createdByDisplayName?: string;
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
  createdByDisplayName?: string;
  memberCount: number;
  isPrivate: boolean;
  createdAt: string;
  currentUserStatus: MemberStatus | null;
}

export interface UserGroupSummary {
  groupId: number;
  groupName: string;
  role: GroupRole;
  status: MemberStatus;
  joinedAt: string;
}

export interface UserAdminInfo extends User {
  groups: UserGroupSummary[];
}

export interface CreateGroupRequest {
  name: string;
  description?: string;
  sports?: Sport[];
}

export interface JoinGroupRequest {
  inviteCode: string;
}

export interface TeamDto {
  id: number;
  name: string;
  iso2: string | null;
}

export interface CompetitionDto {
  id: number;
  name: string;
  sport: Sport;
}

export type MatchPhase = 'POOL' | 'KNOCKOUT';

export interface Match {
  id: number;
  teamA: TeamDto;
  teamB: TeamDto;
  matchDate: string;
  scoreA?: number;
  scoreB?: number;
  status: 'UPCOMING' | 'ONGOING' | 'FINISHED';
  competition: CompetitionDto;
  round: string;
  phase: MatchPhase;
  penaltyWinner?: 'A' | 'B';
  penaltyScoreA?: number;
  penaltyScoreB?: number;
  userParticipated?: boolean;
}

export interface Team {
  id: number;
  name: string;
  iso2: string | null;
}

export interface CreateMatchRequest {
  teamAId: number;
  teamBId: number;
  matchDate: string;
  competitionId: number;
  round: string;
  phase?: MatchPhase;
}

export interface UpdateMatchScoreRequest {
  scoreA: number;
  scoreB: number;
  status: 'FINISHED' | 'ONGOING' | 'UPCOMING';
  penaltyWinner?: 'A' | 'B';
  penaltyScoreA?: number;
  penaltyScoreB?: number;
  penaltyCleared?: boolean;
}

export interface Bet {
  id: number;
  title: string;
  description?: string;
  groupId: number;
  groupName: string;
  match?: Match;
  race?: Race;
  creator: User;
  betType: 'SCORE' | 'EVENT' | 'FORFEIT' | 'FREE' | 'RACE_PICKS';
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
  proposedByDisplayName?: string;
  /** null = shared gage (visible to all groups); set = belongs to that group only */
  groupId?: number | null;
  groupName?: string | null;
  /** Sum of all upvotes and downvotes. */
  voteScore: number;
  /** Current user's vote: +1, -1, or 0 (no vote). */
  userVote: number;
}

export interface UserForfeitEntry {
  id: number;
  forfeit: Forfeit;
  assignedByUsername: string;
  assignedByDisplayName?: string;
  completed: boolean;
  completedAt?: string;
  assignedAt: string;
}

export interface GroupUserForfeit {
  id: number;
  username: string;
  displayName?: string;
  avatarUrl?: string;
  forfeit: Forfeit;
  assignedByUsername: string;
  assignedByDisplayName?: string;
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
  assignedToDisplayName?: string;
  assignedAt?: string;
  candidates: DailyGageCandidate[];
  createdAt: string;
  /** True when all matches of the day are done but the gage isn't settled yet. */
  canForceSettle?: boolean;
}

export interface UserBetSummary {
  participationId: number;
  betId: number;
  betTitle: string;
  matchTeamA?: string;
  matchTeamB?: string;
  matchDate?: string;
  betStatus: 'OPEN' | 'VALIDATED' | 'CANCELLED';
  betPoints: number;
  chosenOption: string;
  winningOption?: string;
  pointsEarned: number;
  participatedAt: string;
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

export interface RegisterResponse {
  message: string;
  email: string;
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
  competitionId: number;
}

export interface DecodedToken {
  sub: string;
  iat: number;
  exp: number;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  newPassword: string;
}

// ── F1 ────────────────────────────────────────────────────────────────────

export type Sport = 'FOOT' | 'F1';

export interface Driver {
  id: number;
  name: string;
  code: string;
  number: number;
  constructorId: number;
  constructorName: string;
  constructorColor: string;
}

export interface RaceResultEntry {
  driver: Driver;
  position: number | null;
  sprintPosition?: number | null;
  pole: boolean;
  fastestLap: boolean;
  dnf: boolean;
}

export type RaceStatus = 'UPCOMING' | 'FINISHED';

export interface Race {
  id: number;
  round: number;
  name: string;
  countryIso2?: string;
  circuit?: string;
  qualifyingDate: string;
  sprintDate?: string | null;
  raceDate: string;
  status: RaceStatus;
  competitionId: number;
  openInUserGroups: boolean;
  userPredicted: boolean;
  predictionsCount: number;
  results?: RaceResultEntry[];
}

export interface F1Prediction {
  raceId: number;
  /** Author — present on the group-visible listings only. */
  username?: string;
  displayName?: string;
  /** Podium picks are masked (null) between qualifying and race start on group listings. */
  p1: Driver | null;
  p2: Driver | null;
  p3: Driver | null;
  pole: Driver | null;
  fastestLap: Driver | null;
  lastClassified: Driver | null;
  pointsEarned: number;
  poleLocked: boolean;
  raceLocked: boolean;
}

export interface F1PredictionRequest {
  p1DriverId: number;
  p2DriverId: number;
  p3DriverId: number;
  poleDriverId?: number | null;
  fastestLapDriverId?: number | null;
  lastClassifiedDriverId?: number | null;
}

export interface F1Standing {
  rank: number;
  driver: Driver | null;
  constructorId: number;
  constructorName: string;
  constructorColor: string;
  points: number;
  wins: number;
  podiums: number;
}

export interface RaceResultEntryRequest {
  driverId: number;
  position: number | null;
  pole: boolean;
  fastestLap: boolean;
  dnf: boolean;
}
