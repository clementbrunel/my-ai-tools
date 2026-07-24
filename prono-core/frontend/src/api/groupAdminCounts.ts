import apiClient from './axios';

export interface GroupAdminCounts {
  pendingApplications: number;
  pendingForfeitsPerGroup: Record<number, number>;
  missingGagesPerGroup: Record<number, number>;
  groupsWithNoBets: Record<number, boolean>;
  matchesWithoutBetsPerGroup: Record<number, number>;
}

export const getGroupAdminCounts = async (): Promise<GroupAdminCounts> => {
  const response = await apiClient.get<GroupAdminCounts>('/groups/admin-counts');
  return response.data;
};
