import { AxiosResponse } from 'axios';
import api from './client';
import { User } from '../types';

interface AuthUserResponse {
  user: User;
}

interface LoginResponse extends AuthUserResponse {
  token: string;
  message: string;
}

export const getCurrentUser = (): Promise<AxiosResponse<AuthUserResponse>> =>
  api.get<AuthUserResponse>('/auth/me');
export const signIn = (email: string, password: string): Promise<AxiosResponse<LoginResponse>> =>
  api.post<LoginResponse>('/auth/login', { email, password });
export const signOut = (): Promise<AxiosResponse> => api.post('/auth/logout');
export const changePassword = (
  currentPassword: string,
  newPassword: string
): Promise<AxiosResponse> => api.post('/auth/change-password', { currentPassword, newPassword });
