import apiClient from './axios';
import type { CompetitionDto, TeamDto } from '../types';

export const createCompetition = async (name: string, sport: 'FOOT' | 'F1' = 'FOOT'): Promise<void> => {
  await apiClient.post('/competitions', name, {
    headers: { 'Content-Type': 'text/plain' },
    params: { sport },
  });
};

export const getCompetitions = async (): Promise<CompetitionDto[]> => {
  const response = await apiClient.get<CompetitionDto[]>('/competitions');
  return response.data;
};

export const getCompetitionTeams = async (competitionId: number): Promise<TeamDto[]> => {
  const response = await apiClient.get<TeamDto[]>(`/competitions/${competitionId}/teams`);
  return response.data;
};

export const getAllKnownTeams = async (): Promise<TeamDto[]> => {
  const response = await apiClient.get<TeamDto[]>('/competitions/known-teams');
  return response.data;
};

export const findOrCreateTeam = async (teamName: string): Promise<TeamDto> => {
  const response = await apiClient.post<TeamDto>('/competitions/teams', teamName, {
    headers: { 'Content-Type': 'text/plain' },
  });
  return response.data;
};

export const setCompetitionTeams = async (competitionId: number, teamIds: number[]): Promise<void> => {
  await apiClient.put(`/competitions/${competitionId}/teams`, teamIds);
};

export const addTeamToCompetition = async (competitionId: number, teamId: number): Promise<void> => {
  await apiClient.post(`/competitions/${competitionId}/teams`, teamId, {
    headers: { 'Content-Type': 'application/json' },
  });
};

export const removeTeamFromCompetition = async (competitionId: number, teamId: number): Promise<void> => {
  await apiClient.delete(`/competitions/${competitionId}/teams/${teamId}`);
};
