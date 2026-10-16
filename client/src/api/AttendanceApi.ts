import { AxiosResponse } from 'axios';
import api from './client';
import { ClassSession } from '../types';

export const getClassSessions = (classId: string): Promise<AxiosResponse<ClassSession[]>> =>
  api.get<ClassSession[]>(`/classes/${classId}/sessions`);
export const createClassSession = <T>(classId: string, data: T): Promise<AxiosResponse> =>
  api.post(`/classes/${classId}/sessions`, data);
export const updateClassSession = <T>(
  classId: string,
  sessionId: string,
  data: T
): Promise<AxiosResponse> => api.patch(`/classes/${classId}/sessions/${sessionId}`, data);
export const deleteClassSession = (
  classId: string,
  sessionId: string
): Promise<AxiosResponse> => api.delete(`/classes/${classId}/sessions/${sessionId}`);
export const publishClassSession = (
  classId: string,
  sessionId: string
): Promise<AxiosResponse> => api.post(`/classes/${classId}/sessions/${sessionId}/publish`);
export const getSessionAttendance = (sessionId: string): Promise<AxiosResponse> =>
  api.get(`/sessions/${sessionId}/attendance`);
export const updateSessionAttendance = <T>(
  sessionId: string,
  data: T
): Promise<AxiosResponse> => api.put(`/sessions/${sessionId}/attendance`, data);
export const submitSessionAttendance = <T>(
  sessionId: string,
  data: T
): Promise<AxiosResponse> => api.post(`/sessions/${sessionId}/submit`, data);
export const correctAttendance = <T>(
  recordId: string,
  data: T
): Promise<AxiosResponse> => api.patch(`/attendance/${recordId}`, data);
export const getAttendanceLogs = (recordId: string): Promise<AxiosResponse> =>
  api.get(`/attendance/${recordId}/logs`);
