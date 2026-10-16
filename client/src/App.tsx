import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Layout } from './components/Layout';

import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { ClassList } from './pages/Classes/ClassList';
import { ClassDetail } from './pages/Classes/ClassDetail';
import { AttendanceRegister } from './pages/Attendance/AttendanceRegister';
import { StudentList } from './pages/Students/StudentList';
import { StudentDetail } from './pages/Students/StudentDetail';
import { GuardianList } from './pages/Guardians/GuardianList';
import { NotificationList } from './pages/Notifications/NotificationList';
import { ReportsView } from './pages/Reports/ReportsView';
import { UserList } from './pages/Users/UserList';
import { AuditLogList } from './pages/AuditLogs/AuditLogList';
import { AnnouncementList } from './pages/Announcements/AnnouncementList';
import { TeacherList } from './pages/Teachers/TeacherList';
import { AttendancePage } from './pages/Attendance/AttendancePage';
import { LessonLibrary } from './pages/Lessons/LessonLibrary';
import { ExamPortal } from './pages/Exams/ExamPortal';
import { AssignmentPortal } from './pages/Assignments/AssignmentPortal';
import { SettingsView } from './pages/Settings/SettingsView';

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public login */}
          <Route path="/login" element={<Login />} />

          {/* Protected portal */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="classes" element={<ClassList />} />
            <Route path="classes/:id" element={<ClassDetail />} />
            <Route path="classes/:classId/sessions/:sessionId" element={<AttendanceRegister />} />
            <Route path="students" element={<StudentList />} />
            <Route path="students/:id" element={<StudentDetail />} />
            <Route
              path="teachers"
              element={
                <ProtectedRoute allowedRoles={['ADMIN']}>
                  <TeacherList />
                </ProtectedRoute>
              }
            />
            <Route path="guardians" element={<GuardianList />} />
            <Route path="attendance" element={<AttendancePage />} />
            <Route path="video-lessons" element={<LessonLibrary />} />
            <Route path="exams" element={<ExamPortal />} />
            <Route path="assignments" element={<AssignmentPortal />} />
            <Route path="notifications" element={<NotificationList />} />
            <Route path="announcements" element={<AnnouncementList />} />
            <Route path="reports" element={<ReportsView />} />
            <Route path="settings" element={<SettingsView />} />

            {/* Admin only routes */}
            <Route
              path="users"
              element={
                <ProtectedRoute allowedRoles={['ADMIN']}>
                  <UserList />
                </ProtectedRoute>
              }
            />
            <Route
              path="audit-logs"
              element={
                <ProtectedRoute allowedRoles={['ADMIN']}>
                  <AuditLogList />
                </ProtectedRoute>
              }
            />
          </Route>

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;
