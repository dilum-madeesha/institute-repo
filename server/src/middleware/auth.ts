import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { ENV } from '../config/env';
import { User, IUser, normalizeAccountStatus, normalizeUserRole } from '../models/User';
import { Student } from '../models/Student';
import { currentEnrollmentFilter } from '../services/enrollmentAccess';

export interface AuthRequest extends Request {
  user?: IUser;
}

export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    let token: string | undefined;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      res.status(401).json({ error: 'Authentication required. Please sign in.' });
      return;
    }

    const decoded = jwt.verify(token, ENV.JWT_SECRET) as { id: string };
    const user = await User.findById(decoded.id);

    if (!user) {
      res.status(401).json({ error: 'User account not found.' });
      return;
    }

    const normalizedRole = normalizeUserRole(user.role);
    if (!normalizedRole) {
      res.status(403).json({ error: 'This account has an unsupported role. Please contact an administrator.' });
      return;
    }
    if (user.role !== normalizedRole) {
      user.role = normalizedRole;
    }

    const normalizedStatus = normalizeAccountStatus(user.status);
    if (normalizedStatus !== 'ACTIVE') {
      res.status(403).json({ error: 'Account is deactivated. Please contact an administrator.' });
      return;
    }
    user.status = normalizedStatus;

    if (user.role === 'STUDENT') {
      try {
        const linkedStudentExists = user.studentId
          ? await Student.exists({ _id: user.studentId })
          : null;
        if (!user.studentId || !linkedStudentExists) {
          const normalizedEmail = user.email.trim().toLowerCase();
          const matchingStudents = await Student.find({
            email: { $regex: `^${normalizedEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' },
            status: /^ACTIVE$/i,
          })
            .select('_id')
            .limit(2);

          if (matchingStudents.length === 1) {
            const studentId = matchingStudents[0]._id;
            const alreadyLinkedAccount = await User.exists({
              _id: { $ne: user._id },
              role: /^STUDENT$/i,
              studentId,
            });
            if (!alreadyLinkedAccount) {
              user.studentId = studentId;
              await user.save();
            }
          }
        }
      } catch (error) {
        console.error('Failed to verify the student profile link:', error);
        res.status(500).json({ error: 'Unable to verify the student profile link. Please try again.' });
        return;
      }
    }

    if (user.isModified()) {
      try {
        await user.save();
      } catch (error) {
        console.error('Failed to normalize legacy account data:', error);
        res.status(500).json({ error: 'Unable to update account details. Please try again.' });
        return;
      }
    }

    req.user = user;
    next();
  } catch (error) {
    if (
      error instanceof jwt.JsonWebTokenError ||
      error instanceof jwt.TokenExpiredError ||
      error instanceof jwt.NotBeforeError
    ) {
      res.status(401).json({ error: 'Invalid or expired session token. Please sign in again.' });
      return;
    }
    console.error('Authentication middleware failed:', error);
    res.status(500).json({ error: 'Unable to verify your account. Please try again.' });
  }
};
