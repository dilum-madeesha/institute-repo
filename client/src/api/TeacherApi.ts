import { AxiosResponse } from 'axios';
import api from './client';
import { User } from '../types';

export const getTeachers = (): Promise<AxiosResponse<User[]>> =>
  api.get<User[]>('/users?role=TEACHER');
export const getActiveTeachers = (): Promise<AxiosResponse<User[]>> =>
  api.get<User[]>('/users?role=TEACHER&status=ACTIVE');
export const updateTeacher = <T>(teacherId: string, data: T): Promise<AxiosResponse> =>
  api.patch(`/users/${teacherId}`, data);
export const createTeacher = <T>(data: T): Promise<AxiosResponse> => api.post('/users', data);
export const deleteTeacher = (teacherId: string): Promise<AxiosResponse> =>
  api.delete(`/users/${teacherId}`);
