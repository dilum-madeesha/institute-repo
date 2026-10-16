import { Router } from 'express';
import {
  getLessonsByClass,
  createLesson,
  updateLesson,
  deleteLesson,
  toggleLessonProgress,
} from '../controllers/lessonController';
import { authenticate } from '../middleware/auth';
import { requireTeacherOrAdmin } from '../middleware/role';

const router = Router();

router.use(authenticate);

// Viewing lessons is accessible to any enrolled role (handled in controller via canAccessClass)
router.get('/class/:classId', getLessonsByClass);

// Teacher/Admin actions
router.post('/', requireTeacherOrAdmin, createLesson);
router.patch('/:id', requireTeacherOrAdmin, updateLesson);
router.delete('/:id', requireTeacherOrAdmin, deleteLesson);

// Student toggle completion
router.post('/:id/progress', toggleLessonProgress);

export default router;
