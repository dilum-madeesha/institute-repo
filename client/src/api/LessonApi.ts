import { AxiosRequestConfig, AxiosResponse } from 'axios';
import api from './client';
import { Lesson } from '../types';

const uploadConfig = (data: unknown): AxiosRequestConfig | undefined =>
  data instanceof FormData ? { headers: { 'Content-Type': 'multipart/form-data' } } : undefined;

export const getClassLessons = (classId: string): Promise<AxiosResponse<Lesson[]>> =>
  api.get<Lesson[]>(`/lessons/class/${classId}`);
export const createLesson = <T>(data: T): Promise<AxiosResponse> =>
  api.post('/lessons', data, uploadConfig(data));
export const updateLesson = <T>(lessonId: string, data: T): Promise<AxiosResponse> =>
  api.patch(`/lessons/${lessonId}`, data, uploadConfig(data));
export const deleteLesson = (lessonId: string): Promise<AxiosResponse> =>
  api.delete(`/lessons/${lessonId}`);
export const markLessonProgress = (lessonId: string): Promise<AxiosResponse> =>
  api.post(`/lessons/${lessonId}/progress`);
export const downloadLessonFile = (apiPath: string): Promise<AxiosResponse<Blob>> =>
  api.get(apiPath, { responseType: 'blob' });
