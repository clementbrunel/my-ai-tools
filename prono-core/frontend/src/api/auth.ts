import apiClient from './axios';
import type {
  AuthResponse,
  ForgotPasswordRequest,
  LoginRequest,
  RegisterRequest,
  RegisterResponse,
  ResetPasswordRequest,
} from '@/types';

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

export const forgotPassword = async (data: ForgotPasswordRequest): Promise<void> => {
  await apiClient.post('/auth/forgot-password', data);
};

export const validateResetToken = async (token: string): Promise<boolean> => {
  const response = await apiClient.get<{ valid: boolean }>('/auth/reset-password/validate', {
    params: { token },
  });
  return response.data.valid;
};

export const resetPassword = async (data: ResetPasswordRequest): Promise<void> => {
  await apiClient.post('/auth/reset-password', data);
};
