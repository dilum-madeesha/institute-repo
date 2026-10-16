import { Router } from 'express';
import authRoutes from './authRoutes';
import userRoutes from './userRoutes';
import classRoutes from './classRoutes';
import studentRoutes from './studentRoutes';
import guardianRoutes from './guardianRoutes';
import enrollmentRoutes from './enrollmentRoutes';
import attendanceRoutes from './attendanceRoutes';
import notificationRoutes from './notificationRoutes';
import reportRoutes from './reportRoutes';
import dashboardRoutes from './dashboardRoutes';
import auditRoutes from './auditRoutes';
import lessonRoutes from './lessonRoutes';
import assignmentRoutes from './assignmentRoutes';
import examRoutes from './examRoutes';
import announcementRoutes from './announcementRoutes';
import parentRoutes from './parentRoutes';
import studentPortalRoutes from './studentPortalRoutes';

const apiRouter = Router();

apiRouter.use('/auth', authRoutes);
apiRouter.use('/users', userRoutes);
apiRouter.use('/classes', classRoutes);
apiRouter.use('/students', studentRoutes);
apiRouter.use('/guardians', guardianRoutes);
apiRouter.use('/enrollments', enrollmentRoutes);
apiRouter.use('/', attendanceRoutes); // provides /sessions and /attendance
apiRouter.use('/notifications', notificationRoutes);
apiRouter.use('/reports', reportRoutes);
apiRouter.use('/dashboard', dashboardRoutes);
apiRouter.use('/audit-logs', auditRoutes);

// LMS Learning, Assessment, and Role Portals
apiRouter.use('/lessons', lessonRoutes);
apiRouter.use('/assignments', assignmentRoutes);
apiRouter.use('/exams', examRoutes);
apiRouter.use('/announcements', announcementRoutes);
apiRouter.use('/parent', parentRoutes);
apiRouter.use('/student', studentPortalRoutes);

export default apiRouter;
