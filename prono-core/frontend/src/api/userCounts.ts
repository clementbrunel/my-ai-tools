import apiClient from './axios';

export interface UserCounts {
  pendingGages: number;
}

export const getUserCounts = async (): Promise<UserCounts> => {
  const response = await apiClient.get<UserCounts>('/user/counts');
  return response.data;
};
