import apiClient from './axios';
import type { User } from '../types';

export const updateAvatar = async (avatarUrl: string): Promise<User> => {
  const response = await apiClient.patch<User>('/users/me/avatar', null, { params: { avatarUrl } });
  return response.data;
};

export const updatePassword = async (currentPassword: string, newPassword: string): Promise<void> => {
  await apiClient.patch('/users/me/password', { currentPassword, newPassword });
};
