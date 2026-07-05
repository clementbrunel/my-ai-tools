import apiClient from './axios';
import type { TeamDto } from '../types';

export const createCompetition = async (name: string): Promise<void> => {
  await apiClient.post('/competitions', name, {
    headers: { 'Content-Type': 'text/plain' },
  });
};

export const getCompetitions = async (): Promise<string[]> => {
  const response = await apiClient.get<string[]>('/competitions');
  return response.data;
};

export const getCompetitionTeams = async (competition: string): Promise<TeamDto[]> => {
  const response = await apiClient.get<TeamDto[]>(`/competitions/${encodeURIComponent(competition)}/teams`);
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

export const setCompetitionTeams = async (competition: string, teamIds: number[]): Promise<void> => {
  await apiClient.put(`/competitions/${encodeURIComponent(competition)}/teams`, teamIds);
};

export const addTeamToCompetition = async (competition: string, teamId: number): Promise<void> => {
  await apiClient.post(`/competitions/${encodeURIComponent(competition)}/teams`, teamId, {
    headers: { 'Content-Type': 'application/json' },
  });
};

export const removeTeamFromCompetition = async (competition: string, teamId: number): Promise<void> => {
  await apiClient.delete(`/competitions/${encodeURIComponent(competition)}/teams/${teamId}`);
};
