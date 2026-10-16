import { AxiosResponse } from 'axios';
import api from './client';
import { Announcement } from '../types';

export const getAnnouncements = (): Promise<AxiosResponse<Announcement[]>> =>
  api.get<Announcement[]>('/announcements');
export const createAnnouncement = <T>(data: T): Promise<AxiosResponse> =>
  api.post('/announcements', data);
export const deleteAnnouncement = (announcementId: string): Promise<AxiosResponse> =>
  api.delete(`/announcements/${announcementId}`);
