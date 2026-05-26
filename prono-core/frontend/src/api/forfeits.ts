import apiClient from './axios';
import type { Forfeit } from '../types';

export const getForfeits = async (): Promise<Forfeit[]> => {
  const response = await apiClient.get<Forfeit[]>('/forfeits');
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
