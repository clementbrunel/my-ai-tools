import apiClient from './axios';
import type { Group, GroupMember, CreateGroupRequest, JoinGroupRequest } from '../types';

export const getAllGroups = async (): Promise<Group[]> => {
  const response = await apiClient.get<Group[]>('/groups');
  return response.data;
};

export const getMyGroups = async (): Promise<Group[]> => {
  const response = await apiClient.get<Group[]>('/groups/mine');
  return response.data;
};

export const getGroup = async (groupId: number): Promise<Group> => {
  const response = await apiClient.get<Group>(`/groups/${groupId}`);
  return response.data;
};

export const createGroup = async (data: CreateGroupRequest): Promise<Group> => {
  const response = await apiClient.post<Group>('/groups', data);
  return response.data;
};

export const joinGroup = async (data: JoinGroupRequest): Promise<Group> => {
  const response = await apiClient.post<Group>('/groups/join', data);
  return response.data;
};

export const leaveGroup = async (groupId: number): Promise<void> => {
  await apiClient.delete(`/groups/${groupId}/leave`);
};

export const promoteMember = async (groupId: number, userId: number): Promise<GroupMember> => {
  const response = await apiClient.post<GroupMember>(`/groups/${groupId}/members/${userId}/promote`);
  return response.data;
};

export const demoteMember = async (groupId: number, userId: number): Promise<GroupMember> => {
  const response = await apiClient.post<GroupMember>(`/groups/${groupId}/members/${userId}/demote`);
  return response.data;
};

export const removeMember = async (groupId: number, userId: number): Promise<void> => {
  await apiClient.delete(`/groups/${groupId}/members/${userId}`);
};
