import { Router } from 'express';
import {
  getLessonsByClass,
  createLesson,
  updateLesson,
  archiveLesson,
  downloadLessonAttachment,
  toggleLessonProgress,
} from '../controllers/lessonController';
import { authenticate } from '../middleware/auth';
import { requireTeacherOrAdmin } from '../middleware/role';
import { receivePrivateFiles } from '../services/privateFileStorage';

const router = Router();

router.use(authenticate);

// Viewing lessons is accessible to any enrolled role (handled in controller via canAccessClass)
router.get('/files/:fileId', downloadLessonAttachment);
router.get('/class/:classId', getLessonsByClass);

// Teacher/Admin actions
router.post('/', requireTeacherOrAdmin, receivePrivateFiles(), createLesson);
router.patch('/:id', requireTeacherOrAdmin, receivePrivateFiles(), updateLesson);
router.delete('/:id', requireTeacherOrAdmin, archiveLesson);

// Student toggle completion
router.post('/:id/progress', toggleLessonProgress);

export default router;
