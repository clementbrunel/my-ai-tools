import apiClient from './axios';
import type { User, UserAdminInfo } from '../types';

export const updateAvatar = async (avatarUrl: string): Promise<User> => {
  const response = await apiClient.patch<User>('/users/me/avatar', null, { params: { avatarUrl } });
  return response.data;
};

export const updateDisplayName = async (displayName: string): Promise<User> => {
  const response = await apiClient.patch<User>('/users/me/display-name', null, { params: { displayName } });
  return response.data;
};

export const updateEmail = async (email: string): Promise<User> => {
  const response = await apiClient.patch<User>('/users/me/email', { email });
  return response.data;
};

export const updatePassword = async (currentPassword: string, newPassword: string): Promise<void> => {
  await apiClient.patch('/users/me/password', { currentPassword, newPassword });
};

export const updateEmailReminder = async (emailReminderEnabled: boolean): Promise<User> => {
  const response = await apiClient.patch<User>('/users/me/email-reminder', { emailReminderEnabled });
  return response.data;
};

export const getAllUsersAdmin = async (): Promise<UserAdminInfo[]> => {
  const response = await apiClient.get<UserAdminInfo[]>('/admin/users');
  return response.data;
};

export const adminUnlockUser = async (userId: number, newPassword?: string): Promise<UserAdminInfo> => {
  const response = await apiClient.patch<UserAdminInfo>(`/admin/users/${userId}/unlock`, { newPassword: newPassword || null });
  return response.data;
};
