import { Response } from 'express';
import bcrypt from 'bcryptjs';
import { User } from '../models/User';
import { ClassModel } from '../models/Class';
import { AuthRequest } from '../middleware/auth';
import { logAudit } from '../services/auditService';

export const getUsers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { role, status, search } = req.query;
    const filter: any = {};

    if (role) filter.role = role;
    if (status) filter.status = status;
    if (search) {
      filter.$or = [
        { fullName: { $regex: String(search), $options: 'i' } },
        { email: { $regex: String(search), $options: 'i' } },
      ];
    }

    const users = await User.find(filter).sort({ createdAt: -1 });
    res.json(users);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch users' });
  }
};

export const getUserById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    res.json(user);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch user' });
  }
};

export const createUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { fullName, email, password, role } = req.body;

    if (!fullName || !email || !password) {
      res.status(400).json({ error: 'Full name, email, and password are required.' });
      return;
    }

    if (String(password).length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters long.' });
      return;
    }

    const normalizedEmail = email.toLowerCase().trim();
    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      res.status(409).json({ error: 'A user with this email address already exists.' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({
      fullName: fullName.trim(),
      email: normalizedEmail,
      passwordHash,
      role: role === 'ADMIN' ? 'ADMIN' : 'TEACHER',
      status: 'ACTIVE',
    });

    await logAudit({
      userId: req.user!._id,
      action: 'USER_CREATED',
      entityType: 'User',
      entityId: user._id.toString(),
      details: { email: user.email, role: user.role },
      ipAddress: req.ip,
    });

    res.status(201).json({
      message: 'User created successfully',
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        status: user.status,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to create user' });
  }
};

export const updateUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { fullName, email, role, password } = req.body;
    const user = await User.findById(req.params.id);

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    if (password !== undefined && String(password).length > 0 && String(password).length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters long.' });
      return;
    }

    if (email && email.toLowerCase().trim() !== user.email) {
      const normalizedEmail = email.toLowerCase().trim();
      const existing = await User.findOne({ email: normalizedEmail });
      if (existing) {
        res.status(409).json({ error: 'A user with this email already exists.' });
        return;
      }
      user.email = normalizedEmail;
    }

    if (fullName) user.fullName = fullName.trim();
    if (role) user.role = role;
    if (password) user.passwordHash = await bcrypt.hash(String(password), 10);

    await user.save();

    await logAudit({
      userId: req.user!._id,
      action: 'USER_UPDATED',
      entityType: 'User',
      entityId: user._id.toString(),
      details: {
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        passwordChanged: Boolean(password),
      },
      ipAddress: req.ip,
    });

    res.json({ message: 'User updated successfully', user });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to update user' });
  }
};

export const toggleUserStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Prevent admin from deactivating themselves
    if (user._id.toString() === req.user!._id.toString()) {
      res.status(400).json({ error: 'You cannot deactivate your own account.' });
      return;
    }

    user.status = user.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    await user.save();

    await logAudit({
      userId: req.user!._id,
      action: user.status === 'ACTIVE' ? 'USER_ACTIVATED' : 'USER_DEACTIVATED',
      entityType: 'User',
      entityId: user._id.toString(),
      details: { newStatus: user.status },
      ipAddress: req.ip,
    });

    res.json({ message: `User account is now ${user.status.toLowerCase()}.`, user });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to update user status' });
  }
};

export const resetUserPassword = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) {
      res.status(400).json({ error: 'New password must be at least 6 characters long.' });
      return;
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    await user.save();

    await logAudit({
      userId: req.user!._id,
      action: 'USER_PASSWORD_RESET_BY_ADMIN',
      entityType: 'User',
      entityId: user._id.toString(),
      ipAddress: req.ip,
    });

    res.json({ message: `Password reset successfully for ${user.fullName}.` });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to reset password' });
  }
};

export const deleteTeacher = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const teacher = await User.findById(req.params.id);
    if (!teacher) {
      res.status(404).json({ error: 'Teacher not found.' });
      return;
    }

    if (teacher.role !== 'TEACHER') {
      res.status(400).json({ error: 'Only teacher accounts can be deleted from this endpoint.' });
      return;
    }

    await ClassModel.updateMany({ teachers: teacher._id }, { $pull: { teachers: teacher._id } });
    await teacher.deleteOne();

    await logAudit({
      userId: req.user!._id,
      action: 'TEACHER_DELETED',
      entityType: 'User',
      entityId: teacher._id.toString(),
      details: { fullName: teacher.fullName, email: teacher.email },
      ipAddress: req.ip,
    });

    res.json({ message: `Teacher account for ${teacher.fullName} was deleted.` });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to delete teacher' });
  }
};
