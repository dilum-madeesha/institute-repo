import { Router } from 'express';
import {
  getStudents,
  getStudentById,
  createStudent,
  updateStudent,
  toggleStudentStatus,
  deleteStudent,
  getStudentAttendance,
} from '../controllers/studentController';
import {
  linkGuardianToStudent,
  updateStudentGuardianLink,
  unlinkGuardianFromStudent,
} from '../controllers/guardianController';
import { authenticate } from '../middleware/auth';
import { requireAdmin, requireTeacherOrAdmin } from '../middleware/role';

const router = Router();

router.use(authenticate, requireTeacherOrAdmin);

router.get('/', getStudents);
router.post('/', createStudent);
router.get('/:id', getStudentById);
router.patch('/:id', updateStudent);
router.patch('/:id/status', toggleStudentStatus);
router.delete('/:id', requireAdmin, deleteStudent);
router.get('/:id/attendance', getStudentAttendance);

// Guardian linking sub-routes
router.post('/:id/guardians', linkGuardianToStudent);
router.patch('/:id/guardians/:guardianId', updateStudentGuardianLink);
router.delete('/:id/guardians/:guardianId', unlinkGuardianFromStudent);

export default router;
