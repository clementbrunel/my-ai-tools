import apiClient from './axios';
import type { LeaderboardEntry } from '../types';

export const getLeaderboard = async (): Promise<LeaderboardEntry[]> => {
  const response = await apiClient.get<LeaderboardEntry[]>('/leaderboard');
  return response.data;
};
