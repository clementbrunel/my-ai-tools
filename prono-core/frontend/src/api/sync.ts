import axiosInstance from './axios';

export const triggerSync = async (): Promise<void> =>
  axiosInstance.post('/admin/sync/trigger');
