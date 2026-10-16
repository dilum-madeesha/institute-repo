import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User, normalizeAccountStatus, normalizeUserRole } from '../models/User';
import { Student } from '../models/Student';
import { Guardian } from '../models/Guardian';
import { ENV } from '../config/env';
import { AuthRequest } from '../middleware/auth';
import { logAudit } from '../services/auditService';

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Please enter both email and password.' });
      return;
    }

    const normalizedEmail = String(email).toLowerCase().trim();
    const escapedEmail = normalizedEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const matchingUsers = await User.find({
      email: { $regex: `^${escapedEmail}$`, $options: 'i' },
    }).limit(2);
    const user = matchingUsers.length === 1 ? matchingUsers[0] : null;

    if (!user) {
      await logAudit({
        action: 'LOGIN_FAILED',
        entityType: 'User',
        details: { email: normalizedEmail, reason: 'User not found or email is ambiguous' },
        ipAddress: req.ip,
      });
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    const normalizedStatus = normalizeAccountStatus(user.status);
    if (normalizedStatus !== 'ACTIVE') {
      await logAudit({
        userId: user._id,
        action: 'LOGIN_BLOCKED',
        entityType: 'User',
        entityId: user._id.toString(),
        details: { reason: 'Account inactive' },
        ipAddress: req.ip,
      });
      res.status(403).json({ error: 'Your account is deactivated. Please contact an administrator.' });
      return;
    }

    user.status = normalizedStatus;
    const normalizedRole = normalizeUserRole(user.role);
    if (!normalizedRole) {
      res.status(403).json({ error: 'This account has an unsupported role. Please contact an administrator.' });
      return;
    }
    if (user.role !== normalizedRole) {
      user.role = normalizedRole;
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      await logAudit({
        userId: user._id,
        action: 'LOGIN_FAILED',
        entityType: 'User',
        entityId: user._id.toString(),
        details: { reason: 'Incorrect password' },
        ipAddress: req.ip,
      });
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    user.lastLoginAt = new Date();
    await user.save();

    const token = jwt.sign(
      { id: user._id, role: user.role, email: user.email },
      ENV.JWT_SECRET,
      { expiresIn: '7d' }
    );

    await logAudit({
      userId: user._id,
      action: 'LOGIN_SUCCESS',
      entityType: 'User',
      entityId: user._id.toString(),
      ipAddress: req.ip,
    });

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        status: user.status,
        studentId: user.studentId,
        guardianId: user.guardianId,
        lastLoginAt: user.lastLoginAt,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to sign in' });
  }
};

export const getMe = async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  res.json({
    user: {
      id: req.user._id,
      fullName: req.user.fullName,
      email: req.user.email,
      role: req.user.role,
      status: req.user.status,
      studentId: req.user.studentId,
      guardianId: req.user.guardianId,
      lastLoginAt: req.user.lastLoginAt,
    },
  });
};

export const logout = async (req: AuthRequest, res: Response): Promise<void> => {
  if (req.user) {
    await logAudit({
      userId: req.user._id,
      action: 'LOGOUT',
      entityType: 'User',
      entityId: req.user._id.toString(),
      ipAddress: req.ip,
    });
  }
  res.json({ message: 'Logged out successfully' });
};

export const changePassword = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      res.status(400).json({ error: 'Please provide both current and new password.' });
      return;
    }

    if (newPassword.length < 6) {
      res.status(400).json({ error: 'New password must be at least 6 characters long.' });
      return;
    }

    const user = await User.findById(req.user!._id);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isMatch) {
      res.status(400).json({ error: 'Current password does not match.' });
      return;
    }

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    await user.save();

    await logAudit({
      userId: user._id,
      action: 'PASSWORD_CHANGED',
      entityType: 'User',
      entityId: user._id.toString(),
      ipAddress: req.ip,
    });

    res.json({ message: 'Password changed successfully.' });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to change password' });
  }
};
