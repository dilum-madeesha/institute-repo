import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import { ClassModel } from '../models/Class';
import { Enrollment } from '../models/Enrollment';
import { StudentGuardian } from '../models/StudentGuardian';
import { UserRole } from '../models/User';
import { currentEnrollmentFilter } from '../services/enrollmentAccess';

export const requireAdmin = (req: AuthRequest, res: Response, next: NextFunction): void => {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  if (req.user.role !== 'ADMIN') {
    res.status(403).json({ error: 'Access denied. Administrator privileges required.' });
    return;
  }
  next();
};

export const requireTeacherOrAdmin = (req: AuthRequest, res: Response, next: NextFunction): void => {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  if (req.user.role !== 'ADMIN' && req.user.role !== 'TEACHER') {
    res.status(403).json({ error: 'Access denied. Teacher or administrator privileges required.' });
    return;
  }
  next();
};

export const requireRoles = (allowedRoles: UserRole[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        error: `Access denied. Requires one of: ${allowedRoles.join(', ')}`,
      });
      return;
    }
    next();
  };
};

export const canAccessClass = async (
  userId: string,
  userRole: UserRole,
  classId: string,
  studentId?: string | null,
  guardianId?: string | null
): Promise<boolean> => {
  if (userRole === 'ADMIN') return true;

  if (userRole === 'TEACHER') {
    const classObj = await ClassModel.findById(classId);
    if (!classObj) return false;
    return classObj.teachers.some((tId) => tId.toString() === userId.toString());
  }

  if (userRole === 'STUDENT' && studentId) {
    const activeEnrollment = await Enrollment.findOne(currentEnrollmentFilter(studentId, classId));
    return !!activeEnrollment;
  }

  if (userRole === 'PARENT' && guardianId) {
    // Find children linked to this parent
    const links = await StudentGuardian.find({ guardianId });
    const childStudentIds = links.map((l) => l.studentId);
    const activeEnrollment = await Enrollment.findOne(
      currentEnrollmentFilter({ $in: childStudentIds }, classId)
    );
    return !!activeEnrollment;
  }

  return false;
};

export const verifyParentStudentLink = async (
  guardianId: string,
  studentId: string
): Promise<boolean> => {
  const link = await StudentGuardian.findOne({ guardianId, studentId });
  return !!link;
};
