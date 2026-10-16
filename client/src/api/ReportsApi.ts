import { AxiosRequestConfig, AxiosResponse } from 'axios';
import api from './client';

export const getReportSummary = (
  params?: AxiosRequestConfig['params']
): Promise<AxiosResponse> => api.get('/reports/summary', { params });
export const getAbsenceReport = (
  params?: AxiosRequestConfig['params']
): Promise<AxiosResponse> => api.get('/reports/absences', { params });
export const getMissingGuardianReport = (): Promise<AxiosResponse> =>
  api.get('/reports/missing-guardians');
export const downloadReportCsv = (
  params: AxiosRequestConfig['params']
): Promise<AxiosResponse<Blob>> =>
  api.get<Blob>('/reports/export-csv', { params, responseType: 'blob' });
