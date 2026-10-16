import { Response } from 'express';
import { Lesson } from '../models/Lesson';
import { LessonProgress } from '../models/LessonProgress';
import { AuthRequest } from '../middleware/auth';
import { canAccessClass } from '../middleware/role';
import { logAudit } from '../services/auditService';

export const getLessonsByClass = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const classId = req.params.classId as string;
    const user = req.user!;

    const hasAccess = await canAccessClass(
      user._id.toString(),
      user.role,
      classId,
      user.studentId?.toString(),
      user.guardianId?.toString()
    );

    if (!hasAccess) {
      res.status(403).json({ error: 'Access denied. You do not have permission to view lessons for this class.' });
      return;
    }

    const lessons = await Lesson.find({ classId, isPublished: true })
      .sort({ order: 1, createdAt: 1 })
      .populate('createdBy', 'fullName');

    // If student, attach progress
    if (user.role === 'STUDENT' && user.studentId) {
      const progressList = await LessonProgress.find({
        classId,
        studentId: user.studentId,
      });
      const completedSet = new Set(
        progressList.filter((p) => p.isCompleted).map((p) => p.lessonId.toString())
      );

      const enriched = lessons.map((l) => ({
        ...l.toObject(),
        isCompleted: completedSet.has(l._id.toString()),
      }));
      res.json(enriched);
      return;
    }

    // If parent and child studentId query is provided, verify link
    const { studentId } = req.query;
    if (user.role === 'PARENT' && studentId) {
      const progressList = await LessonProgress.find({
        classId,
        studentId,
      });
      const completedSet = new Set(
        progressList.filter((p) => p.isCompleted).map((p) => p.lessonId.toString())
      );

      const enriched = lessons.map((l) => ({
        ...l.toObject(),
        isCompleted: completedSet.has(l._id.toString()),
      }));
      res.json(enriched);
      return;
    }

    res.json(lessons);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch lessons' });
  }
};

export const createLesson = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { classId, title, description, videoUrl, duration, attachments, order } = req.body;

    if (!classId || !title) {
      res.status(400).json({ error: 'Class ID and lesson title are required.' });
      return;
    }

    const lesson = await Lesson.create({
      classId,
      title: title.trim(),
      description: description ? description.trim() : '',
      videoUrl: videoUrl ? videoUrl.trim() : '',
      duration: duration ? duration.trim() : '',
      attachments: Array.isArray(attachments) ? attachments : [],
      order: order !== undefined ? Number(order) : 0,
      createdBy: req.user!._id,
    });

    await logAudit({
      userId: req.user!._id,
      action: 'LESSON_CREATED',
      entityType: 'Lesson',
      entityId: lesson._id.toString(),
      details: { title: lesson.title, classId },
      ipAddress: req.ip,
    });

    res.status(201).json(lesson);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to create lesson' });
  }
};

export const updateLesson = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const lesson = await Lesson.findById(req.params.id);
    if (!lesson) {
      res.status(404).json({ error: 'Lesson not found' });
      return;
    }

    const { title, description, videoUrl, duration, attachments, order, isPublished } = req.body;
    if (title) lesson.title = title.trim();
    if (description !== undefined) lesson.description = description.trim();
    if (videoUrl !== undefined) lesson.videoUrl = videoUrl.trim();
    if (duration !== undefined) lesson.duration = duration.trim();
    if (attachments !== undefined) lesson.attachments = attachments;
    if (order !== undefined) lesson.order = Number(order);
    if (isPublished !== undefined) lesson.isPublished = Boolean(isPublished);

    await lesson.save();

    await logAudit({
      userId: req.user!._id,
      action: 'LESSON_UPDATED',
      entityType: 'Lesson',
      entityId: lesson._id.toString(),
      ipAddress: req.ip,
    });

    res.json(lesson);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to update lesson' });
  }
};

export const deleteLesson = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const lesson = await Lesson.findByIdAndDelete(req.params.id);
    if (!lesson) {
      res.status(404).json({ error: 'Lesson not found' });
      return;
    }

    await LessonProgress.deleteMany({ lessonId: lesson._id });

    await logAudit({
      userId: req.user!._id,
      action: 'LESSON_DELETED',
      entityType: 'Lesson',
      entityId: lesson._id.toString(),
      ipAddress: req.ip,
    });

    res.json({ message: 'Lesson deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to delete lesson' });
  }
};

export const toggleLessonProgress = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const lessonId = req.params.id as string;
    const user = req.user!;

    if (user.role !== 'STUDENT' || !user.studentId) {
      res.status(403).json({ error: 'Only student accounts can mark lesson completion.' });
      return;
    }

    const lesson = await Lesson.findById(lessonId);
    if (!lesson) {
      res.status(404).json({ error: 'Lesson not found' });
      return;
    }

    let progress = await LessonProgress.findOne({
      studentId: user.studentId,
      lessonId: lesson._id,
    });

    if (!progress) {
      progress = await LessonProgress.create({
        studentId: user.studentId,
        lessonId: lesson._id,
        classId: lesson.classId,
        isCompleted: true,
        completedAt: new Date(),
      });
    } else {
      progress.isCompleted = !progress.isCompleted;
      progress.completedAt = progress.isCompleted ? new Date() : null;
      await progress.save();
    }

    res.json({ message: 'Progress updated', isCompleted: progress.isCompleted });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to update progress' });
  }
};
