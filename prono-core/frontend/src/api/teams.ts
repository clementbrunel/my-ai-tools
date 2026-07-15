import apiClient from './axios';
import type { Team, Match } from '@/types';

export const getTeam = async (id: number): Promise<Team> => {
  const response = await apiClient.get<Team>(`/teams/${id}`);
  return response.data;
};

export const getTeamMatches = async (id: number): Promise<Match[]> => {
  const response = await apiClient.get<Match[]>(`/teams/${id}/matches`);
  return response.data;
};
