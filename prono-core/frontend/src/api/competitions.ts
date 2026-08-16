import apiClient from './axios';
import type { CompetitionDto, Sport, TeamDto } from '@/types';

/** The sport is required — competitions are always created in an explicit sport. */
export const createCompetition = async (name: string, sport: Sport): Promise<void> => {
  await apiClient.post('/competitions', { name, sport });
};

/** Omit `sports` (or pass an empty list) to get every competition regardless of sport. */
export const getCompetitions = async (sports?: Sport[]): Promise<CompetitionDto[]> => {
  const response = await apiClient.get<CompetitionDto[]>('/competitions', {
    params: sports && sports.length > 0 ? { sport: sports.join(',') } : undefined,
  });
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

export const setCompetitionActive = async (competitionId: number, active: boolean): Promise<void> => {
  await apiClient.put(`/competitions/${competitionId}/active`, active, {
    headers: { 'Content-Type': 'application/json' },
  });
};

/** Pass `null` to clear the season. */
export const setCompetitionSeason = async (competitionId: number, season: number | null): Promise<void> => {
  await apiClient.put(`/competitions/${competitionId}/season`, season, {
    headers: { 'Content-Type': 'application/json' },
  });
};

/** Pass `null` to clear the competition code (disables automatic fixture/score sync for this competition). */
export const setCompetitionFootballDataCode = async (competitionId: number, code: string | null): Promise<void> => {
  await apiClient.put(`/competitions/${competitionId}/football-data-competition-code`, code, {
    headers: { 'Content-Type': 'application/json' },
  });
};

/** Imports/refreshes a competition's roster from football-data.org (requires a configured competition code and season). */
export const syncCompetitionTeamsFromFootballData = async (competitionId: number): Promise<TeamDto[]> => {
  const response = await apiClient.post<TeamDto[]>(`/competitions/${competitionId}/sync-teams-from-football-data`);
  return response.data;
};

export const deleteCompetition = async (competitionId: number): Promise<void> => {
  await apiClient.delete(`/competitions/${competitionId}`);
};
