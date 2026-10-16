import { Router } from 'express';
import {
  getNotifications,
  getNotificationById,
  retryNotification,
} from '../controllers/notificationController';
import { authenticate } from '../middleware/auth';
import { requireTeacherOrAdmin } from '../middleware/role';

const router = Router();

router.use(authenticate, requireTeacherOrAdmin);

router.get('/', getNotifications);
router.get('/:id', getNotificationById);
router.post('/:id/retry', retryNotification);

export default router;
