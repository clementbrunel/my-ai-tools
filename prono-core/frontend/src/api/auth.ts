import apiClient from './axios';
import type { AuthResponse, LoginRequest, RegisterRequest, RegisterResponse } from '../types';

export const login = async (data: LoginRequest): Promise<AuthResponse> => {
  const response = await apiClient.post<AuthResponse>('/auth/login', data);
  return response.data;
};

export const register = async (data: RegisterRequest): Promise<RegisterResponse> => {
  const response = await apiClient.post<RegisterResponse>('/auth/register', data);
  return response.data;
};

export const verifyEmail = async (token: string): Promise<AuthResponse> => {
  const response = await apiClient.post<AuthResponse>('/auth/verify-email', { token });
  return response.data;
};

export const resendVerification = async (email: string): Promise<void> => {
  await apiClient.post('/auth/resend-verification', { email });
};
