import apiClient from './axios';
import type { LeaderboardEntry } from '../types';

export const getLeaderboard = async (): Promise<LeaderboardEntry[]> => {
  const response = await apiClient.get<LeaderboardEntry[]>('/leaderboard');
  return response.data;
};

export const getGroupLeaderboard = async (groupId: number): Promise<LeaderboardEntry[]> => {
  const response = await apiClient.get<LeaderboardEntry[]>(`/leaderboard/group/${groupId}`);
  return response.data;
};
