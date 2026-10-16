import { AxiosRequestConfig, AxiosResponse } from 'axios';
import api from './client';
import { User } from '../types';

export const getUsers = (
  params?: AxiosRequestConfig['params']
): Promise<AxiosResponse<User[]>> => api.get<User[]>('/users', { params });
export const createUser = <T>(data: T): Promise<AxiosResponse> => api.post('/users', data);
export const toggleUserStatus = (userId: string): Promise<AxiosResponse> =>
  api.patch(`/users/${userId}/status`);
export const resetUserPassword = (userId: string, newPassword: string): Promise<AxiosResponse> =>
  api.post(`/users/${userId}/reset-password`, { newPassword });
