import { Router } from 'express';
import {
  getGuardians,
  createGuardian,
  updateGuardian,
  deleteGuardian,
} from '../controllers/guardianController';
import { authenticate } from '../middleware/auth';
import { requireAdmin, requireTeacherOrAdmin } from '../middleware/role';

const router = Router();

router.use(authenticate, requireTeacherOrAdmin);

router.get('/', getGuardians);
router.post('/', createGuardian);
router.patch('/:id', updateGuardian);
router.delete('/:id', requireAdmin, deleteGuardian);

export default router;
