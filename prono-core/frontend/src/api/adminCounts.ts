import apiClient from './axios';

export interface AdminCounts {
  pendingApplications: number;
  pendingForfeitsPerGroup: Record<number, number>;
  missingGagesPerGroup: Record<number, number>;
  groupsWithNoBets: Record<number, boolean>;
}

export const getAdminCounts = async (): Promise<AdminCounts> => {
  const response = await apiClient.get<AdminCounts>('/admin/counts');
  return response.data;
};
