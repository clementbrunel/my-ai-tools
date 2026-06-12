import apiClient from './axios';
import type { FixtureCandidate } from '../types';

export const getFixtureCandidates = async (matchId: number): Promise<FixtureCandidate[]> => {
  const response = await apiClient.get<FixtureCandidate[]>(`/admin/sync/candidates/${matchId}`);
  return response.data;
};

export const linkMatch = async (matchId: number, fixtureId: number): Promise<void> => {
  await apiClient.post(`/admin/sync/link/${matchId}`, { fixtureId });
};

export const unlinkMatch = async (matchId: number): Promise<void> => {
  await apiClient.delete(`/admin/sync/link/${matchId}`);
};

export const triggerSync = async (): Promise<void> => {
  await apiClient.post('/admin/sync/trigger');
};
