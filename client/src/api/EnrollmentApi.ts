import { AxiosResponse } from 'axios';
import api from './client';

export const createEnrollment = <T>(data: T): Promise<AxiosResponse> =>
  api.post('/enrollments', data);
export const deleteEnrollment = (enrollmentId: string): Promise<AxiosResponse> =>
  api.delete(`/enrollments/${enrollmentId}`);
