import { Router } from 'express';
import {
  getAttendanceSummaryReport,
  getAbsenceListReport,
  getMissingGuardiansReport,
  exportReportCsv,
} from '../controllers/reportController';
import { authenticate } from '../middleware/auth';
import { requireTeacherOrAdmin } from '../middleware/role';

const router = Router();

router.use(authenticate, requireTeacherOrAdmin);

router.get('/summary', getAttendanceSummaryReport);
router.get('/absences', getAbsenceListReport);
router.get('/missing-guardians', getMissingGuardiansReport);
router.get('/export-csv', exportReportCsv);

export default router;
