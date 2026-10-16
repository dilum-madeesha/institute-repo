import { Router } from 'express';
import {
  getClasses,
  getClassById,
  createClass,
  updateClass,
  toggleClassStatus,
  deleteClass,
  getClassStudents,
} from '../controllers/classController';
import {
  getClassSessions,
  createClassSession,
  publishClassSession,
  updateClassSession,
  deleteClassSession,
} from '../controllers/attendanceController';
import { authenticate } from '../middleware/auth';
import { requireAdmin, requireTeacherOrAdmin } from '../middleware/role';

const router = Router();

router.use(authenticate);

// List classes and single class (accessible to Admin, Teacher, Student, Parent with internal access checks)
router.get('/', getClasses);
router.get('/:id', getClassById);

// Admin-only class creation & status
router.post('/', requireAdmin, createClass);
router.patch('/:id/status', requireAdmin, toggleClassStatus);
router.delete('/:id', requireAdmin, deleteClass);

// Teacher or Admin modification & roster viewing
router.patch('/:id', requireTeacherOrAdmin, updateClass);
router.get('/:id/students', requireTeacherOrAdmin, getClassStudents);

// Sessions nested under classes
router.get('/:id/sessions', requireTeacherOrAdmin, getClassSessions);
router.post('/:id/sessions', requireTeacherOrAdmin, createClassSession);
router.post('/:id/sessions/:sessionId/publish', requireTeacherOrAdmin, publishClassSession);
router.patch('/:id/sessions/:sessionId', requireTeacherOrAdmin, updateClassSession);
router.delete('/:id/sessions/:sessionId', requireAdmin, deleteClassSession);

export default router;
