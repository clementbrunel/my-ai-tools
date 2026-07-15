import apiClient from './axios';
import type { Group, GroupMember, PublicGroup, CreateGroupRequest, JoinGroupRequest, Match, Race, Sport } from '../types';

export const getAllGroups = async (): Promise<Group[]> => {
  const response = await apiClient.get<Group[]>('/groups');
  return response.data;
};

export const getPublicGroups = async (): Promise<PublicGroup[]> => {
  const response = await apiClient.get<PublicGroup[]>('/groups/public');
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

export const applyToGroup = async (groupId: number): Promise<PublicGroup> => {
  const response = await apiClient.post<PublicGroup>(`/groups/${groupId}/apply`);
  return response.data;
};

export const approveApplication = async (groupId: number, userId: number): Promise<GroupMember> => {
  const response = await apiClient.post<GroupMember>(`/groups/${groupId}/applications/${userId}/approve`);
  return response.data;
};

export const rejectApplication = async (groupId: number, userId: number): Promise<void> => {
  await apiClient.delete(`/groups/${groupId}/applications/${userId}/reject`);
};

export const updateGroupSports = async (groupId: number, sports: Sport[]): Promise<Group> => {
  const response = await apiClient.patch<Group>(`/groups/${groupId}/sports`, { sports });
  return response.data;
};

export const updateGroupPrivacy = async (groupId: number, isPrivate: boolean): Promise<Group> => {
  const response = await apiClient.patch<Group>(`/groups/${groupId}/privacy`, { isPrivate });
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

export const getFutureOpenMatches = async (groupId: number): Promise<Match[]> => {
  const response = await apiClient.get<Match[]>(`/groups/${groupId}/future-open-matches`);
  return response.data;
};

export const notifyNewMatches = async (groupId: number, matchIds: number[]): Promise<void> => {
  await apiClient.post(`/groups/${groupId}/notify-new-matches`, { matchIds });
};

export const getFutureOpenRaces = async (groupId: number): Promise<Race[]> => {
  const response = await apiClient.get<Race[]>(`/groups/${groupId}/future-open-races`);
  return response.data;
};

export const notifyNewRaces = async (groupId: number, raceIds: number[]): Promise<void> => {
  await apiClient.post(`/groups/${groupId}/notify-new-races`, { raceIds });
};
