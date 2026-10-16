import { AxiosResponse } from 'axios';
import api from './client';
import { DashboardStats } from '../types';

export const getParentDashboard = (): Promise<AxiosResponse<DashboardStats>> =>
  api.get<DashboardStats>('/parent/dashboard');
export const getDashboardStats = (): Promise<AxiosResponse<DashboardStats>> =>
  api.get<DashboardStats>('/dashboard/stats');
