import apiClient from './axios';
import type { Match, CreateMatchRequest, UpdateMatchScoreRequest } from '../types';

export const getMatches = async (status?: string): Promise<Match[]> => {
  const params = status ? { status } : {};
  const response = await apiClient.get<Match[]>('/matches', { params });
  return response.data;
};

export const getMatch = async (id: number): Promise<Match> => {
  const response = await apiClient.get<Match>(`/matches/${id}`);
  return response.data;
};

export const createMatch = async (data: CreateMatchRequest): Promise<Match> => {
  const response = await apiClient.post<Match>('/matches', data);
  return response.data;
};

export const updateMatchScore = async (id: number, data: UpdateMatchScoreRequest): Promise<Match> => {
  const response = await apiClient.patch<Match>(`/matches/${id}/score`, data);
  return response.data;
};

export const deleteMatch = async (id: number): Promise<void> => {
  await apiClient.delete(`/matches/${id}`);
};

export const getMatchesForMyGroups = async (): Promise<Match[]> => {
  const response = await apiClient.get<Match[]>('/matches/my-groups');
  return response.data;
};

export const getCompetitions = async (): Promise<string[]> => {
  const response = await apiClient.get<string[]>('/matches/competitions');
  return response.data;
};

export const getAllCompetitions = async (): Promise<string[]> => {
  const response = await apiClient.get<string[]>('/matches/competitions', { params: { all: true } });
  return response.data;
};

export const getCompetitionTeams = async (competition: string): Promise<string[]> => {
  const response = await apiClient.get<string[]>(`/matches/competitions/${encodeURIComponent(competition)}/teams`);
  return response.data;
};

export const forceSettleMatch = async (id: number): Promise<void> => {
  await apiClient.post(`/matches/${id}/force-settle-all`);
};
