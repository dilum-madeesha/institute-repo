import { Router } from 'express';
import {
  getExamsByClass,
  createExam,
  getExamForTaking,
  submitExam,
  getSubmissionsForExam,
  gradeExamSubmission,
} from '../controllers/examController';
import { authenticate } from '../middleware/auth';
import { requireTeacherOrAdmin } from '../middleware/role';

const router = Router();

router.use(authenticate);

// Get exams for class
router.get('/class/:classId', getExamsByClass);

// Teacher creates exam
router.post('/', requireTeacherOrAdmin, createExam);

// Student fetches sanitized exam & submits
router.get('/:id/take', getExamForTaking);
router.post('/:id/submit', submitExam);

// Teacher results review & manual grading
router.get('/:id/submissions', requireTeacherOrAdmin, getSubmissionsForExam);
router.patch('/submissions/:submissionId/grade', requireTeacherOrAdmin, gradeExamSubmission);

export default router;
