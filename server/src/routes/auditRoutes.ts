import { Router } from 'express';
import { getAuditLogs } from '../controllers/auditController';
import { authenticate } from '../middleware/auth';
import { requireAdmin } from '../middleware/role';

const router = Router();

router.use(authenticate, requireAdmin);

router.get('/', getAuditLogs);

export default router;
