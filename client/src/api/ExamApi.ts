import { AxiosResponse } from 'axios';
import api from './client';
import { Examination } from '../types';

export const getClassExams = (classId: string): Promise<AxiosResponse<Examination[]>> =>
  api.get<Examination[]>(`/exams/class/${classId}`);
export const createExam = <T>(data: T): Promise<AxiosResponse> => api.post('/exams', data);
export const getExamForTaking = (examId: string): Promise<AxiosResponse> =>
  api.get(`/exams/${examId}/take`);
export const submitExam = <T>(examId: string, data: T): Promise<AxiosResponse> =>
  api.post(`/exams/${examId}/submit`, data);
