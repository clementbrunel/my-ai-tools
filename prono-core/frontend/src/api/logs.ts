import apiClient from './axios';
import type { LogLevel, LogPage } from '@/types';

export const getServerLogs = async (
  page: number,
  size: number,
  search?: string,
  level?: LogLevel | '',
): Promise<LogPage> => {
  const response = await apiClient.get<LogPage>('/admin/logs', {
    params: {
      page,
      size,
      search: search || undefined,
      level: level || undefined,
    },
  });
  return response.data;
};
