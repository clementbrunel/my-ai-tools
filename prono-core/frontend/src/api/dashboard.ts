import apiClient from './axios';
import type { Sport } from '@/types';

export interface GroupRankEntry {
  groupId: number;
  groupName: string;
  rank: number;
  total: number;
  points: number;
}

export interface DashboardStats {
  upcomingMatchesInMyGroups: number;
  groupRanks: GroupRankEntry[];
}

export const getDashboardStats = async (sport: Sport = 'FOOT'): Promise<DashboardStats> => {
  const response = await apiClient.get<DashboardStats>('/dashboard/stats', { params: { sport } });
  return response.data;
};
