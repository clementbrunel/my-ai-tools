export interface User {
  id: number;
  username: string;
  email: string;
  role: 'ADMIN' | 'USER';
  avatarUrl?: string;
  globalScore: number;
  betsWon: number;
  forfeitsReceived: number;
  createdAt?: string;
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
  matchId?: number;
  betType: 'SCORE' | 'EVENT' | 'FORFEIT' | 'FREE';
  points: number;
  deadline: string;
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
