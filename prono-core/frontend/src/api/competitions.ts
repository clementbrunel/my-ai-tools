import apiClient from './axios';

export const getCompetitions = async (): Promise<string[]> => {
  const response = await apiClient.get<string[]>('/competitions');
  return response.data;
};

export const getCompetitionTeams = async (competition: string): Promise<string[]> => {
  const response = await apiClient.get<string[]>(`/competitions/${encodeURIComponent(competition)}/teams`);
  return response.data;
};

export const getAllKnownTeams = async (): Promise<string[]> => {
  const response = await apiClient.get<string[]>('/competitions/known-teams');
  return response.data;
};

export const setCompetitionTeams = async (competition: string, teams: string[]): Promise<void> => {
  await apiClient.put(`/competitions/${encodeURIComponent(competition)}/teams`, teams);
};

export const addTeamToCompetition = async (competition: string, teamName: string): Promise<void> => {
  await apiClient.post(`/competitions/${encodeURIComponent(competition)}/teams`, teamName, {
    headers: { 'Content-Type': 'text/plain' },
  });
};

export const removeTeamFromCompetition = async (competition: string, teamName: string): Promise<void> => {
  await apiClient.delete(`/competitions/${encodeURIComponent(competition)}/teams/${encodeURIComponent(teamName)}`);
};
