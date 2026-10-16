import { AxiosRequestConfig, AxiosResponse } from 'axios';
import api from './client';
import { Guardian } from '../types';

export const getGuardians = (
  params?: AxiosRequestConfig['params']
): Promise<AxiosResponse<Guardian[]>> => api.get<Guardian[]>('/guardians', { params });
export const createGuardian = <T>(data: T): Promise<AxiosResponse> =>
  api.post('/guardians', data);
export const updateGuardian = <T>(guardianId: string, data: T): Promise<AxiosResponse> =>
  api.patch(`/guardians/${guardianId}`, data);
export const deleteGuardian = (guardianId: string): Promise<AxiosResponse> =>
  api.delete(`/guardians/${guardianId}`);
