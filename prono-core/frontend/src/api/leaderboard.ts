import apiClient from './axios';
import type { LeaderboardEntry } from '../types';

export const getGroupLeaderboard = async (
  groupId: number,
  sport?: 'FOOT' | 'F1',
): Promise<LeaderboardEntry[]> => {
  const response = await apiClient.get<LeaderboardEntry[]>(`/leaderboard/group/${groupId}`, {
    params: sport ? { sport } : undefined,
  });
  return response.data;
};
