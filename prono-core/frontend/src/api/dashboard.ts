import apiClient from './axios';

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

export const getDashboardStats = async (): Promise<DashboardStats> => {
  const response = await apiClient.get<DashboardStats>('/dashboard/stats');
  return response.data;
};
