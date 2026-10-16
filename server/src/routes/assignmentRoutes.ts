import { Router } from 'express';
import {
  getAssignmentsByClass,
  createAssignment,
  submitAssignment,
  getSubmissionsForAssignment,
  gradeSubmission,
} from '../controllers/assignmentController';
import { authenticate } from '../middleware/auth';
import { requireTeacherOrAdmin } from '../middleware/role';

const router = Router();

router.use(authenticate);

// Get assignments for class (filtered per role)
router.get('/class/:classId', getAssignmentsByClass);

// Teacher creates assignment
router.post('/', requireTeacherOrAdmin, createAssignment);

// Student submits assignment
router.post('/:id/submit', submitAssignment);

// Teacher views submissions and grades
router.get('/:id/submissions', requireTeacherOrAdmin, getSubmissionsForAssignment);
router.patch('/submissions/:submissionId/grade', requireTeacherOrAdmin, gradeSubmission);

export default router;
