import { Router } from 'express';
import {
  getAssignmentsByClass,
  createAssignment,
  updateAssignment,
  publishAssignment,
  cancelScheduledAssignment,
  archiveAssignment,
  submitAssignment,
  getSubmissionsForAssignment,
  gradeSubmission,
  releaseSubmissionGrade,
  returnSubmissionForRevision,
  downloadAssignmentAttachment,
  downloadSubmissionFile,
} from '../controllers/assignmentController';
import { authenticate } from '../middleware/auth';
import { requireRoles, requireTeacherOrAdmin } from '../middleware/role';
import { receivePrivateFiles } from '../services/privateFileStorage';

const router = Router();

router.use(authenticate);

router.get('/files/:fileId', downloadAssignmentAttachment);
router.get('/submission-files/:fileId', downloadSubmissionFile);

// Get assignments for class (filtered per role)
router.get('/class/:classId', getAssignmentsByClass);

// Teacher creates assignment
router.post('/', requireTeacherOrAdmin, receivePrivateFiles(), createAssignment);
router.patch('/:id', requireTeacherOrAdmin, receivePrivateFiles(), updateAssignment);
router.post('/:id/publish', requireTeacherOrAdmin, publishAssignment);
router.post('/:id/cancel-schedule', requireTeacherOrAdmin, cancelScheduledAssignment);
router.post('/:id/archive', requireTeacherOrAdmin, archiveAssignment);

// Student submits assignment
router.post('/:id/submit', requireRoles(['STUDENT']), receivePrivateFiles(), submitAssignment);

// Teacher views submissions and grades
router.get('/:id/submissions', requireTeacherOrAdmin, getSubmissionsForAssignment);
router.patch('/submissions/:submissionId/grade', requireTeacherOrAdmin, gradeSubmission);
router.post('/submissions/:submissionId/release-grade', requireTeacherOrAdmin, releaseSubmissionGrade);
router.post('/submissions/:submissionId/return', requireTeacherOrAdmin, returnSubmissionForRevision);

export default router;
