import { AxiosRequestConfig, AxiosResponse } from 'axios';
import api from './client';
import { EmailNotification } from '../types';

export const getNotifications = (
  params?: AxiosRequestConfig['params']
): Promise<AxiosResponse<EmailNotification[]>> =>
  api.get<EmailNotification[]>('/notifications', { params });
export const retryNotification = (notificationId: string): Promise<AxiosResponse> =>
  api.post(`/notifications/${notificationId}/retry`);
