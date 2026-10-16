import { AxiosRequestConfig, AxiosResponse } from 'axios';
import api from './client';
import { AuditLog } from '../types';

export const getAuditLogs = (
  params?: AxiosRequestConfig['params']
): Promise<AxiosResponse<AuditLog[]>> => api.get<AuditLog[]>('/audit-logs', { params });
