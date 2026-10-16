import { AxiosRequestConfig, AxiosResponse } from 'axios';
import api from './client';
import { Assignment, AssignmentSubmission } from '../types';

const uploadConfig = (data: unknown): AxiosRequestConfig | undefined =>
  data instanceof FormData ? { headers: { 'Content-Type': 'multipart/form-data' } } : undefined;

export const getClassAssignments = (classId: string): Promise<AxiosResponse<Assignment[]>> =>
  api.get<Assignment[]>(`/assignments/class/${classId}`);
export const createAssignment = <T>(data: T): Promise<AxiosResponse> =>
  api.post('/assignments', data, uploadConfig(data));
export const updateAssignment = <T>(
  assignmentId: string,
  data: T
): Promise<AxiosResponse> =>
  api.patch(`/assignments/${assignmentId}`, data, uploadConfig(data));
export const submitAssignment = <T>(
  assignmentId: string,
  data: T
): Promise<AxiosResponse> =>
  api.post(`/assignments/${assignmentId}/submit`, data, uploadConfig(data));
export const getAssignmentSubmissions = (
  assignmentId: string
): Promise<AxiosResponse<AssignmentSubmission[]>> =>
  api.get<AssignmentSubmission[]>(`/assignments/${assignmentId}/submissions`);
export const gradeAssignmentSubmission = <T>(
  submissionId: string,
  data: T
): Promise<AxiosResponse> => api.patch(`/assignments/submissions/${submissionId}/grade`, data);
export const updateAssignmentPublication = (
  assignmentId: string,
  action: 'publish' | 'cancel-schedule' | 'archive'
): Promise<AxiosResponse> => api.post(`/assignments/${assignmentId}/${action}`);
export const releaseAssignmentGrade = (submissionId: string): Promise<AxiosResponse> =>
  api.post(`/assignments/submissions/${submissionId}/release-grade`);
export const returnAssignmentSubmission = (
  submissionId: string,
  feedback: string
): Promise<AxiosResponse> =>
  api.post(`/assignments/submissions/${submissionId}/return`, { feedback });
export const downloadAssignmentFile = (apiPath: string): Promise<AxiosResponse<Blob>> =>
  api.get(apiPath, { responseType: 'blob' });
