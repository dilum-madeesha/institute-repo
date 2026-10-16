import { Router } from 'express';
import {
  getAnnouncements,
  createAnnouncement,
  deleteAnnouncement,
} from '../controllers/announcementController';
import { authenticate } from '../middleware/auth';
import { requireTeacherOrAdmin } from '../middleware/role';

const router = Router();

router.use(authenticate);

router.get('/', getAnnouncements);
router.post('/', requireTeacherOrAdmin, createAnnouncement);
router.delete('/:id', requireTeacherOrAdmin, deleteAnnouncement);

export default router;
