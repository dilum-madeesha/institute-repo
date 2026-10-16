import { AxiosRequestConfig, AxiosResponse } from 'axios';
import api from './client';
import { AttendanceRecord, Student } from '../types';

export const getStudents = (
  params?: AxiosRequestConfig['params']
): Promise<AxiosResponse<Student[]>> => api.get<Student[]>('/students', { params });
export const getStudent = (studentId: string): Promise<AxiosResponse<Student>> =>
  api.get<Student>(`/students/${studentId}`);
export const createStudent = <T>(data: T): Promise<AxiosResponse<Student>> =>
  api.post('/students', data);
export const updateStudent = <T>(studentId: string, data: T): Promise<AxiosResponse> =>
  api.patch(`/students/${studentId}`, data);
export const deleteStudent = (studentId: string): Promise<AxiosResponse> =>
  api.delete(`/students/${studentId}`);
export const toggleStudentStatus = (studentId: string): Promise<AxiosResponse> =>
  api.patch(`/students/${studentId}/status`);
export const getStudentAttendance = (studentId: string): Promise<AxiosResponse<AttendanceRecord[]>> =>
  api.get<AttendanceRecord[]>(`/students/${studentId}/attendance`);
export const addStudentGuardian = <T>(studentId: string, data: T): Promise<AxiosResponse> =>
  api.post(`/students/${studentId}/guardians`, data);
export const updateStudentGuardian = <T>(
  studentId: string,
  guardianId: string,
  data: T
): Promise<AxiosResponse> => api.patch(`/students/${studentId}/guardians/${guardianId}`, data);
export const removeStudentGuardian = (
  studentId: string,
  guardianId: string
): Promise<AxiosResponse> => api.delete(`/students/${studentId}/guardians/${guardianId}`);
export const getStudentOverview = (): Promise<AxiosResponse> => api.get('/student/overview');
export const getStudentAttendanceSessions = (): Promise<AxiosResponse> =>
  api.get('/student/attendance/sessions');
export const checkInStudentAttendance = (sessionId: string): Promise<AxiosResponse> =>
  api.post(`/student/attendance/sessions/${sessionId}/check-in`);
