import { Router } from 'express';
import { getParentDashboard } from '../controllers/parentController';
import { authenticate } from '../middleware/auth';
import { requireRoles } from '../middleware/role';

const router = Router();

router.use(authenticate, requireRoles(['PARENT']));

router.get('/dashboard', getParentDashboard);

export default router;
