import { Router } from 'express';
import { getStudentPortalOverview } from '../controllers/studentPortalController';
import {
  checkInStudentAttendance,
  getStudentAttendanceSessions,
} from '../controllers/studentAttendanceController';
import { authenticate } from '../middleware/auth';
import { requireRoles } from '../middleware/role';

const router = Router();

router.use(authenticate, requireRoles(['STUDENT']));

router.get('/overview', getStudentPortalOverview);
router.get('/attendance/sessions', getStudentAttendanceSessions);
router.post('/attendance/sessions/:sessionId/check-in', checkInStudentAttendance);

export default router;
