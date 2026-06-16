import apiClient from './axios';
import type {
  Bet, BetParticipation, CreateBetRequest, OpenBettingRequest, OpenCompetitionRequest, UserBetSummary,
} from '../types';

export const getBets = async (): Promise<Bet[]> => {
  const response = await apiClient.get<Bet[]>('/bets');
  return response.data;
};

export const getParticipatedBets = async (): Promise<Bet[]> => {
  const response = await apiClient.get<Bet[]>('/bets/participated');
  return response.data;
};

export const getMyParticipations = async (): Promise<UserBetSummary[]> => {
  const response = await apiClient.get<UserBetSummary[]>('/bets/my-participations');
  return response.data;
};

export const getBet = async (id: number): Promise<Bet> => {
  const response = await apiClient.get<Bet>(`/bets/${id}`);
  return response.data;
};

export const getBetsByMatch = async (matchId: number): Promise<Bet[]> => {
  const response = await apiClient.get<Bet[]>(`/bets/match/${matchId}`);
  return response.data;
};

export const createBet = async (data: CreateBetRequest): Promise<Bet> => {
  const response = await apiClient.post<Bet>('/bets', data);
  return response.data;
};

/** Group admin opens a (global) match for betting in their group. */
export const openMatchForBetting = async (data: OpenBettingRequest): Promise<Bet> => {
  const response = await apiClient.post<Bet>('/bets/open', data);
  return response.data;
};

/** Group admin closes a match for betting in their group — removes all open bets and participations. */
export const closeMatchForBetting = async (groupId: number, matchId: number): Promise<void> => {
  await apiClient.delete(`/bets/match/${matchId}/group/${groupId}`);
};

/** Group admin opens every match of a competition for betting in their group (one action). */
export const openCompetitionForBetting = async (data: OpenCompetitionRequest): Promise<Bet[]> => {
  const response = await apiClient.post<Bet[]>('/bets/open-competition', data);
  return response.data;
};

export const participate = async (
  betId: number,
  chosenOption: string,
  comment?: string
): Promise<BetParticipation> => {
  const response = await apiClient.post<BetParticipation>(`/bets/${betId}/participate`, {
    chosenOption,
    comment,
  });
  return response.data;
};

export const upsertParticipateByMatch = async (
  matchId: number,
  chosenOption: string,
  comment?: string
): Promise<BetParticipation[]> => {
  const response = await apiClient.put<BetParticipation[]>(`/bets/match/${matchId}/participate`, {
    chosenOption,
    comment,
  });
  return response.data;
};

export const getParticipations = async (betId: number): Promise<BetParticipation[]> => {
  const response = await apiClient.get<BetParticipation[]>(`/bets/${betId}/participations`);
  return response.data;
};

export const getParticipationsByMatch = async (matchId: number): Promise<BetParticipation[]> => {
  const response = await apiClient.get<BetParticipation[]>(`/bets/match/${matchId}/participations`);
  return response.data;
};

export const validateBet = async (betId: number, winningOption: string): Promise<Bet> => {
  const response = await apiClient.post<Bet>(`/bets/${betId}/validate`, null, {
    params: { winningOption },
  });
  return response.data;
};

export const cancelBet = async (betId: number): Promise<Bet> => {
  const response = await apiClient.post<Bet>(`/bets/${betId}/cancel`);
  return response.data;
};

export const getUserBetsInGroup = async (groupId: number, userId: number): Promise<UserBetSummary[]> => {
  const response = await apiClient.get<UserBetSummary[]>(`/bets/group/${groupId}/user/${userId}/participations`);
  return response.data;
};
