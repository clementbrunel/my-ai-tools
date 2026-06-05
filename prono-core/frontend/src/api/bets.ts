import apiClient from './axios';
import type {
  Bet, BetParticipation, CreateBetRequest, OpenBettingRequest, OpenCompetitionRequest,
} from '../types';

export const getBets = async (): Promise<Bet[]> => {
  const response = await apiClient.get<Bet[]>('/bets');
  return response.data;
};

export const getParticipatedBets = async (): Promise<Bet[]> => {
  const response = await apiClient.get<Bet[]>('/bets/participated');
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

export const upsertParticipate = async (
  betId: number,
  chosenOption: string,
  comment?: string
): Promise<BetParticipation> => {
  const response = await apiClient.put<BetParticipation>(`/bets/${betId}/participate`, {
    chosenOption,
    comment,
  });
  return response.data;
};

export const getParticipations = async (betId: number): Promise<BetParticipation[]> => {
  const response = await apiClient.get<BetParticipation[]>(`/bets/${betId}/participations`);
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
