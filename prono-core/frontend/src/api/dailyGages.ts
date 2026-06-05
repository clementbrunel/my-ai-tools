import apiClient from './axios';
import type { DailyGage } from '../types';

export const getAllDailyGages = async (): Promise<DailyGage[]> => {
  const response = await apiClient.get<DailyGage[]>('/daily-gages');
  return response.data;
};

export const getDailyGagesByGroup = async (groupId: number): Promise<DailyGage[]> => {
  const response = await apiClient.get<DailyGage[]>(`/daily-gages/group/${groupId}`);
  return response.data;
};

/** Returns the caller's group gages for that date (one per group that configured one). */
export const getDailyGagesByDate = async (date: string): Promise<DailyGage[]> => {
  const response = await apiClient.get<DailyGage[]>(`/daily-gages/date/${date}`);
  return response.data;
};

export const getDailyGageById = async (id: number): Promise<DailyGage> => {
  const response = await apiClient.get<DailyGage>(`/daily-gages/${id}`);
  return response.data;
};

export const createDailyGage = async (
  groupId: number,
  matchDate: string,
  mode: 'DIRECT' | 'VOTE'
): Promise<DailyGage> => {
  const response = await apiClient.post<DailyGage>('/daily-gages', { groupId, matchDate, mode });
  return response.data;
};

export const selectForfeitDirectly = async (
  id: number,
  forfeitId: number
): Promise<DailyGage> => {
  const response = await apiClient.put<DailyGage>(`/daily-gages/${id}/select`, { forfeitId });
  return response.data;
};

export const addCandidate = async (id: number, forfeitId: number): Promise<DailyGage> => {
  const response = await apiClient.post<DailyGage>(`/daily-gages/${id}/candidates`, { forfeitId });
  return response.data;
};

export const removeCandidate = async (id: number, forfeitId: number): Promise<DailyGage> => {
  const response = await apiClient.delete<DailyGage>(`/daily-gages/${id}/candidates/${forfeitId}`);
  return response.data;
};

export const voteOnCandidate = async (
  id: number,
  forfeitId: number,
  vote: number
): Promise<DailyGage> => {
  const response = await apiClient.post<DailyGage>(`/daily-gages/${id}/vote`, { forfeitId, vote });
  return response.data;
};
