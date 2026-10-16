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

// Sessions endpoints
router.get('/sessions/:sessionId/attendance', authenticate, requireTeacherOrAdmin, getSessionAttendance);
router.put('/sessions/:sessionId/attendance', authenticate, requireTeacherOrAdmin, saveDraftAttendance);
router.post('/sessions/:sessionId/submit', authenticate, requireTeacherOrAdmin, submitAttendance);

// Single record correction endpoints
router.patch('/attendance/:attendanceId', authenticate, requireTeacherOrAdmin, correctAttendanceRecord);
router.get('/attendance/:attendanceId/logs', authenticate, requireTeacherOrAdmin, getRecordChangeLogs);

export default router;
