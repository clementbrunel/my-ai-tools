import axiosInstance from './axios';
import type { FixtureCandidate } from '../types';

export const getFixtureCandidates = async (matchId: number): Promise<FixtureCandidate[]> =>
  axiosInstance.get(`/admin/sync/candidates/${matchId}`).then(r => r.data);

export const linkMatch = async (matchId: number, externalId: number, apiCode: string): Promise<void> =>
  axiosInstance.post(`/admin/sync/link/${matchId}`, { externalId, apiCode });

export const unlinkMatch = async (matchId: number, apiCode: string): Promise<void> =>
  axiosInstance.delete(`/admin/sync/link/${matchId}`, { params: { apiCode } });

export const triggerSync = async (): Promise<void> =>
  axiosInstance.post('/admin/sync/trigger');
