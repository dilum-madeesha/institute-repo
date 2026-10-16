import { Router } from 'express';
import {
  enrollStudent,
  updateEnrollment,
  endEnrollment,
} from '../controllers/enrollmentController';
import { authenticate } from '../middleware/auth';
import { requireTeacherOrAdmin } from '../middleware/role';

const router = Router();

router.use(authenticate, requireTeacherOrAdmin);

router.post('/', enrollStudent);
router.patch('/:id', updateEnrollment);
router.delete('/:id', endEnrollment);

export default router;
