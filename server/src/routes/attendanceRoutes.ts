import { Router } from 'express';
import {
  getSessionAttendance,
  saveDraftAttendance,
  submitAttendance,
  correctAttendanceRecord,
  getRecordChangeLogs,
} from '../controllers/attendanceController';
import { authenticate } from '../middleware/auth';
import { requireTeacherOrAdmin } from '../middleware/role';

const router = Router();

router.use(authenticate, requireTeacherOrAdmin);



// Sessions endpoints
router.get('/sessions/:sessionId/attendance', getSessionAttendance);
router.put('/sessions/:sessionId/attendance', saveDraftAttendance);
router.post('/sessions/:sessionId/submit', submitAttendance);

// Single record correction endpoints
router.patch('/attendance/:attendanceId', correctAttendanceRecord);
router.get('/attendance/:attendanceId/logs', getRecordChangeLogs);

export default router;
