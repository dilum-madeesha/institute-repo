import { AxiosRequestConfig, AxiosResponse } from 'axios';
import api from './client';
import { ClassItem, Student } from '../types';

export const getClasses = (
  params?: AxiosRequestConfig['params']
): Promise<AxiosResponse<ClassItem[]>> => api.get<ClassItem[]>('/classes', { params });
export const getClass = (classId: string): Promise<AxiosResponse<ClassItem>> =>
  api.get<ClassItem>(`/classes/${classId}`);
export const getClassStudents = (classId: string): Promise<AxiosResponse<Student[]>> =>
  api.get<Student[]>(`/classes/${classId}/students`);
export const createClass = <T>(data: T): Promise<AxiosResponse> => api.post('/classes', data);
export const updateClass = <T>(classId: string, data: T): Promise<AxiosResponse> =>
  api.patch(`/classes/${classId}`, data);
export const toggleClassStatus = (classId: string): Promise<AxiosResponse> =>
  api.patch(`/classes/${classId}/status`);
export const deleteClass = (classId: string): Promise<AxiosResponse> =>
  api.delete(`/classes/${classId}`);
