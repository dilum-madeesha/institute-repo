import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { AttendanceHub } from './AttendanceHub';
import { StudentAttendance } from './StudentAttendance';

export const AttendancePage: React.FC = () => {
  const { isStudent } = useAuth();
  return isStudent ? <StudentAttendance /> : <AttendanceHub />;
};
