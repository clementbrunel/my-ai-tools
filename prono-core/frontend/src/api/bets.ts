import apiClient from './axios';
import type { Bet, BetParticipation, CreateBetRequest } from '../types';

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
