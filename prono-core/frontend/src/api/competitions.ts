import apiClient from './axios';
import type { CompetitionDto, FootStanding, Sport, TeamDto } from '@/types';

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

/** Live league table, proxied from football-data.org — not stored, so this hits the network each call. */
export const getStandings = async (competitionId: number): Promise<FootStanding[]> => {
  const response = await apiClient.get<FootStanding[]>(`/competitions/${competitionId}/standings`);
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

/** Season and football-data.org code are edited together — pass `null` for either to clear it. */
export const setCompetitionSettings = async (
  competitionId: number,
  season: number | null,
  footballDataCompetitionCode: string | null,
): Promise<void> => {
  await apiClient.put(`/competitions/${competitionId}/settings`, { season, footballDataCompetitionCode });
};

/** Imports/refreshes a competition's roster from football-data.org (requires a configured competition code and season). */
export const syncCompetitionTeamsFromFootballData = async (competitionId: number): Promise<TeamDto[]> => {
  const response = await apiClient.post<TeamDto[]>(`/competitions/${competitionId}/sync-teams-from-football-data`);
  return response.data;
};

export const deleteCompetition = async (competitionId: number): Promise<void> => {
  await apiClient.delete(`/competitions/${competitionId}`);
};
