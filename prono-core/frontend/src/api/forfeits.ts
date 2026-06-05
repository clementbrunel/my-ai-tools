import apiClient from './axios';
import type { Forfeit, UserForfeitEntry } from '../types';

// -----------------------------------------------------------------------
// Forfeit library
// -----------------------------------------------------------------------

export const getForfeits = async (): Promise<Forfeit[]> => {
  const response = await apiClient.get<Forfeit[]>('/forfeits');
  return response.data;
};

export const getAllForfeitsAdmin = async (): Promise<Forfeit[]> => {
  const response = await apiClient.get<Forfeit[]>('/forfeits/all');
  return response.data;
};

export const createForfeit = async (
  title: string,
  description: string,
  category: string
): Promise<Forfeit> => {
  const response = await apiClient.post<Forfeit>('/forfeits', null, {
    params: { title, description, category },
  });
  return response.data;
};

export const proposeForfeit = async (
  groupId: number,
  title: string,
  description: string,
  category: string
): Promise<Forfeit> => {
  const response = await apiClient.post<Forfeit>('/forfeits/propose', {
    groupId,
    title,
    description,
    category,
  });
  return response.data;
};

export const deleteForfeit = async (forfeitId: number): Promise<void> => {
  await apiClient.delete(`/forfeits/${forfeitId}`);
};

// -----------------------------------------------------------------------
// Group-admin gage management
// -----------------------------------------------------------------------

/** Shared forfeits + group-specific forfeits — for the forfeit selection dropdown. */
export const getForfeitsVisibleToGroup = async (groupId: number): Promise<Forfeit[]> => {
  const response = await apiClient.get<Forfeit[]>(`/forfeits/visible/${groupId}`);
  return response.data;
};

export const getGroupForfeits = async (groupId: number): Promise<Forfeit[]> => {
  const response = await apiClient.get<Forfeit[]>(`/forfeits/group/${groupId}`);
  return response.data;
};

export const getGroupPendingForfeits = async (groupId: number): Promise<Forfeit[]> => {
  const response = await apiClient.get<Forfeit[]>(`/forfeits/group/${groupId}/pending`);
  return response.data;
};

export const approveGroupForfeit = async (groupId: number, forfeitId: number): Promise<Forfeit> => {
  const response = await apiClient.patch<Forfeit>(`/forfeits/group/${groupId}/${forfeitId}/approve`);
  return response.data;
};

export const deleteGroupForfeit = async (groupId: number, forfeitId: number): Promise<void> => {
  await apiClient.delete(`/forfeits/group/${groupId}/${forfeitId}`);
};

// -----------------------------------------------------------------------
// Assignment & completion
// -----------------------------------------------------------------------

export const assignForfeit = async (
  userId: number,
  forfeitId: number,
  assignedById: number
): Promise<void> => {
  await apiClient.post('/forfeits/assign', null, {
    params: { userId, forfeitId, assignedById },
  });
};

export const completeForfeit = async (userForfeitId: number): Promise<void> => {
  await apiClient.patch(`/forfeits/${userForfeitId}/complete`);
};

// -----------------------------------------------------------------------
// User gage history
// -----------------------------------------------------------------------

export const getMyForfeits = async (): Promise<UserForfeitEntry[]> => {
  const response = await apiClient.get<UserForfeitEntry[]>('/forfeits/my');
  return response.data;
};

export const getUserForfeits = async (userId: number): Promise<UserForfeitEntry[]> => {
  const response = await apiClient.get<UserForfeitEntry[]>(`/forfeits/user/${userId}`);
  return response.data;
};
