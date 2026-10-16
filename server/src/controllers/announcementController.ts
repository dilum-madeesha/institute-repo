import { Response } from 'express';
import { Announcement } from '../models/Announcement';
import { Enrollment } from '../models/Enrollment';
import { StudentGuardian } from '../models/StudentGuardian';
import { ClassModel } from '../models/Class';
import { AuthRequest } from '../middleware/auth';
import { logAudit } from '../services/auditService';

export const getAnnouncements = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    let allowedClassIds: any[] = [];

    if (user.role === 'ADMIN') {
      const allAnnouncements = await Announcement.find()
        .populate('classId', 'name classCode')
        .populate('createdBy', 'fullName role')
        .sort({ createdAt: -1 });
      res.json(allAnnouncements);
      return;
    }

    if (user.role === 'TEACHER') {
      const classes = await ClassModel.find({ teachers: user._id });
      allowedClassIds = classes.map((c) => c._id);
    } else if (user.role === 'STUDENT' && user.studentId) {
      const enrollments = await Enrollment.find({ studentId: user.studentId, status: 'ACTIVE' });
      allowedClassIds = enrollments.map((e) => e.classId);
    } else if (user.role === 'PARENT' && user.guardianId) {
      const links = await StudentGuardian.find({ guardianId: user.guardianId });
      const childIds = links.map((l) => l.studentId);
      const enrollments = await Enrollment.find({ studentId: { $in: childIds }, status: 'ACTIVE' });
      allowedClassIds = enrollments.map((e) => e.classId);
    }

    // Match announcements that are either school-wide (classId = null) OR in allowed classes
    const announcements = await Announcement.find({
      $and: [
        {
          $or: [
            { classId: null },
            { classId: { $in: allowedClassIds } },
          ],
        },
        {
          $or: [
            { targetRoles: { $size: 0 } },
            { targetRoles: user.role },
          ],
        },
      ],
    })
      .populate('classId', 'name classCode')
      .populate('createdBy', 'fullName role')
      .sort({ createdAt: -1 });

    res.json(announcements);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch announcements' });
  }
};

export const createAnnouncement = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { classId, title, content, priority, targetRoles } = req.body;

    if (!title || !content) {
      res.status(400).json({ error: 'Announcement title and content are required.' });
      return;
    }

    const announcement = await Announcement.create({
      classId: classId || null,
      title: title.trim(),
      content: content.trim(),
      priority: priority || 'NORMAL',
      targetRoles: Array.isArray(targetRoles) ? targetRoles : ['STUDENT', 'PARENT', 'TEACHER'],
      createdBy: req.user!._id,
    });

    await logAudit({
      userId: req.user!._id,
      action: 'ANNOUNCEMENT_CREATED',
      entityType: 'Announcement',
      entityId: announcement._id.toString(),
      details: { title: announcement.title, classId: announcement.classId },
      ipAddress: req.ip,
    });

    const populated = await Announcement.findById(announcement._id)
      .populate('classId', 'name classCode')
      .populate('createdBy', 'fullName role');

    res.status(201).json(populated);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to create announcement' });
  }
};

export const deleteAnnouncement = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const announcement = await Announcement.findByIdAndDelete(req.params.id);
    if (!announcement) {
      res.status(404).json({ error: 'Announcement not found' });
      return;
    }

    await logAudit({
      userId: req.user!._id,
      action: 'ANNOUNCEMENT_DELETED',
      entityType: 'Announcement',
      entityId: announcement._id.toString(),
      ipAddress: req.ip,
    });

    res.json({ message: 'Announcement deleted' });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to delete announcement' });
  }
};
