import { Response } from 'express';
import mongoose from 'mongoose';
import { Lesson } from '../models/Lesson';
import { LessonProgress } from '../models/LessonProgress';
import { Enrollment } from '../models/Enrollment';
import { AuthRequest } from '../middleware/auth';
import { canAccessClass, verifyParentStudentLink } from '../middleware/role';
import { logAudit } from '../services/auditService';
import { currentEnrollmentFilter } from '../services/enrollmentAccess';
import {
  deletePrivateFiles,
  InvalidPrivateFileError,
  sendPrivateFile,
  storePrivateFiles,
  StoredPrivateFile,
} from '../services/privateFileStorage';

const uploadedFiles = (req: AuthRequest): Express.Multer.File[] =>
  Array.isArray(req.files) ? req.files as Express.Multer.File[] : [];

const parseJsonField = (value: unknown): unknown => {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
};

const isPublished = (lesson: { publicationStatus?: string; isPublished?: boolean }) =>
  lesson.publicationStatus === 'PUBLISHED' ||
  (!lesson.publicationStatus && lesson.isPublished === true);

const isWebUrl = (value: unknown): value is string => {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
};

const publicAttachments = (attachments: Array<Record<string, any>> = []) =>
  attachments.map(({ name, fileUrl, fileType, fileSize, fileId }) => ({
    name,
    fileUrl,
    fileType,
    fileSize,
    ...(fileId ? { fileId } : {}),
  }));

const publicLesson = (lesson: any) => {
  const data = lesson.toObject ? lesson.toObject() : lesson;
  return { ...data, attachments: publicAttachments(data.attachments || []) };
};

const normalizeAttachmentInput = (
  input: unknown,
  existingAttachments: Array<Record<string, any>> = []
): { error?: string; attachments?: Array<Record<string, any>> } => {
  const parsed = parseJsonField(input);
  if (!Array.isArray(parsed)) return { error: 'Lesson attachments must be provided as a list.' };
  const attachments: Array<Record<string, any>> = [];
  for (const item of parsed) {
    if (!item || typeof item.name !== 'string' || typeof item.fileUrl !== 'string') {
      return { error: 'Each learning resource needs a name and a valid link or uploaded file.' };
    }
    const name = item.name.trim();
    if (!name || name.length > 180 || item.fileUrl.length > 2000) {
      return { error: 'Resource names must be 1–180 characters and resource links must be valid.' };
    }
    const internalId = item.fileUrl.match(/^\/api\/lessons\/files\/([0-9a-f-]{36})$/i)?.[1];
    if (internalId) {
      const existing = existingAttachments.find((attachment) => attachment.fileId === internalId);
      if (!existing) return { error: 'An uploaded resource does not belong to this lesson.' };
      attachments.push(existing);
    } else {
      if (!isWebUrl(item.fileUrl)) {
        return { error: 'Learning resource links must use HTTP or HTTPS.' };
      }
      attachments.push({
        name,
        fileUrl: item.fileUrl,
        fileType: typeof item.fileType === 'string' ? item.fileType : 'LINK',
        ...(typeof item.fileSize === 'string' ? { fileSize: item.fileSize } : {}),
      });
    }
  }
  return { attachments };
};

const currentEnrollment = (studentId: mongoose.Types.ObjectId, classId: mongoose.Types.ObjectId) => {
  return Enrollment.findOne(currentEnrollmentFilter(studentId, classId));
};

export const getLessonsByClass = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const classId = req.params.classId as string;
    const user = req.user!;
    if (!mongoose.isValidObjectId(classId)) {
      res.status(400).json({ error: 'A valid class is required.' });
      return;
    }
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

    let studentId: mongoose.Types.ObjectId | null = user.role === 'STUDENT' ? user.studentId || null : null;
    if (user.role === 'PARENT' && req.query.studentId) {
      const requestedStudentId = String(req.query.studentId);
      if (
        !user.guardianId ||
        !mongoose.isValidObjectId(requestedStudentId) ||
        !(await verifyParentStudentLink(user.guardianId.toString(), requestedStudentId))
      ) {
        res.status(403).json({ error: 'Access denied. Student is not linked to your parent account.' });
        return;
      }
      studentId = new mongoose.Types.ObjectId(requestedStudentId);
      if (!(await currentEnrollment(studentId, new mongoose.Types.ObjectId(classId)))) {
        res.status(403).json({ error: 'The linked student is not currently enrolled in this class.' });
        return;
      }
    }

    const lessonFilter: Record<string, any> = { classId };
    if (req.query.includeArchived !== 'true') {
      lessonFilter.publicationStatus = { $ne: 'ARCHIVED' };
    }
    if (user.role === 'STUDENT' || studentId) {
      lessonFilter.isPublished = true;
      lessonFilter.$or = [
        { publicationStatus: 'PUBLISHED' },
        { publicationStatus: { $exists: false } },
      ];
    }
    const lessons = await Lesson.find(lessonFilter)
      .sort({ chapter: 1, order: 1, createdAt: 1 })
      .populate('classId', 'name classCode subject')
      .populate('createdBy', 'fullName');

    if (studentId) {
      const progressList = await LessonProgress.find({ classId, studentId });
      const completedSet = new Set(
        progressList.filter((progress) => progress.isCompleted).map((progress) => progress.lessonId.toString())
      );
      res.json(
        lessons.map((lesson) => ({
          ...publicLesson(lesson),
          isCompleted: completedSet.has(lesson._id.toString()),
        }))
      );
      return;
    }
    res.json(lessons.map(publicLesson));
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch lessons' });
  }
};

export const createLesson = async (req: AuthRequest, res: Response): Promise<void> => {
  let storedFiles: StoredPrivateFile[] = [];
  let lessonCreated = false;
  try {
    const classId = String(req.body.classId || '');
    if (!mongoose.isValidObjectId(classId)) {
      res.status(400).json({ error: 'A valid class is required.' });
      return;
    }
    if (!(await canAccessClass(req.user!._id.toString(), req.user!.role, classId))) {
      res.status(403).json({ error: 'You can create lessons only for classes assigned to you.' });
      return;
    }
    const attachmentsResult = normalizeAttachmentInput(parseJsonField(req.body.attachments ?? []));
    if (attachmentsResult.error) {
      res.status(400).json({ error: attachmentsResult.error });
      return;
    }
    if ((attachmentsResult.attachments?.length || 0) + uploadedFiles(req).length > 10) {
      res.status(400).json({ error: 'Lessons support up to 10 combined links and uploaded resources.' });
      return;
    }
    const title = typeof req.body.title === 'string' ? req.body.title.trim() : '';
    const description = typeof req.body.description === 'string' ? req.body.description.trim() : '';
    const videoUrl = typeof req.body.videoUrl === 'string' ? req.body.videoUrl.trim() : '';
    const chapter = typeof req.body.chapter === 'string' ? req.body.chapter.trim() : '';
    const topic = typeof req.body.topic === 'string' ? req.body.topic.trim() : '';
    const publicationStatus = req.body.publicationStatus || 'DRAFT';
    const order = req.body.order === undefined || req.body.order === '' ? 0 : Number(req.body.order);
    if (!title || title.length > 150 || description.length > 10000) {
      res.status(400).json({ error: 'Lesson title is required (up to 150 characters) and description must not exceed 10,000 characters.' });
      return;
    }
    if (!['DRAFT', 'PUBLISHED'].includes(publicationStatus)) {
      res.status(400).json({ error: 'Choose draft or publish now for the lesson.' });
      return;
    }
    if (!Number.isInteger(order) || order < 0) {
      res.status(400).json({ error: 'Lesson sequence must be a non-negative whole number.' });
      return;
    }
    if (videoUrl && (!isWebUrl(videoUrl) || !videoUrl.startsWith('https://'))) {
      res.status(400).json({ error: 'Video links must use HTTPS.' });
      return;
    }
    if (publicationStatus === 'PUBLISHED' && !videoUrl) {
      res.status(400).json({ error: 'Add an HTTPS video link before publishing the lesson.' });
      return;
    }

    storedFiles = await storePrivateFiles(uploadedFiles(req), (fileId) => `/api/lessons/files/${fileId}`);
    const lesson = await Lesson.create({
      classId,
      title,
      description,
      videoUrl,
      duration: typeof req.body.duration === 'string' ? req.body.duration.trim().slice(0, 50) : '',
      chapter: chapter.slice(0, 150),
      topic: topic.slice(0, 150),
      order,
      attachments: [
        ...(attachmentsResult.attachments || []),
        ...storedFiles.map((file) => ({
          name: file.originalName,
          fileUrl: file.fileUrl,
          fileType: file.mimeType,
          fileSize: `${Math.ceil(file.size / 1024)} KB`,
          fileId: file.fileId,
          storageKey: file.storageKey,
          originalName: file.originalName,
          mimeType: file.mimeType,
          size: file.size,
        })),
      ],
      isPublished: publicationStatus === 'PUBLISHED',
      publicationStatus,
      publishedAt: publicationStatus === 'PUBLISHED' ? new Date() : null,
      createdBy: req.user!._id,
    });
    lessonCreated = true;
    await logAudit({
      userId: req.user!._id,
      action: 'LESSON_CREATED',
      entityType: 'Lesson',
      entityId: lesson._id.toString(),
      details: { title: lesson.title, classId, publicationStatus },
      ipAddress: req.ip,
    });
    res.status(201).json(publicLesson(lesson));
  } catch (error: any) {
    if (storedFiles.length && !lessonCreated) await deletePrivateFiles(storedFiles);
    if (error instanceof InvalidPrivateFileError) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: error.message || 'Failed to create lesson' });
  }
};

export const updateLesson = async (req: AuthRequest, res: Response): Promise<void> => {
  let storedFiles: StoredPrivateFile[] = [];
  let lessonSaved = false;
  try {
    const lesson = await Lesson.findById(req.params.id);
    if (!lesson) {
      res.status(404).json({ error: 'Lesson not found.' });
      return;
    }
    if (!(await canAccessClass(req.user!._id.toString(), req.user!.role, lesson.classId.toString()))) {
      res.status(403).json({ error: 'You are not authorized to edit lessons for this class.' });
      return;
    }
    if (lesson.publicationStatus === 'ARCHIVED') {
      res.status(409).json({ error: 'Archived lessons cannot be edited.' });
      return;
    }

    const title = req.body.title === undefined ? lesson.title : String(req.body.title).trim();
    const description = req.body.description === undefined ? lesson.description || '' : String(req.body.description).trim();
    const videoUrl = req.body.videoUrl === undefined ? lesson.videoUrl || '' : String(req.body.videoUrl).trim();
    const chapter = req.body.chapter === undefined ? lesson.chapter || '' : String(req.body.chapter).trim();
    const topic = req.body.topic === undefined ? lesson.topic || '' : String(req.body.topic).trim();
    const order = req.body.order === undefined ? lesson.order : Number(req.body.order);
    const publicationStatus = req.body.publicationStatus || lesson.publicationStatus || (lesson.isPublished ? 'PUBLISHED' : 'DRAFT');
    const attachmentsResult = normalizeAttachmentInput(
      parseJsonField(req.body.attachments) ?? lesson.attachments,
      lesson.attachments as Array<Record<string, any>>
    );
    if (attachmentsResult.error) {
      res.status(400).json({ error: attachmentsResult.error });
      return;
    }
    if ((attachmentsResult.attachments?.length || 0) + uploadedFiles(req).length > 10) {
      res.status(400).json({ error: 'Lessons support up to 10 combined links and uploaded resources.' });
      return;
    }
    if (!title || title.length > 150 || description.length > 10000) {
      res.status(400).json({ error: 'Lesson title is required (up to 150 characters) and description must not exceed 10,000 characters.' });
      return;
    }
    if (!['DRAFT', 'PUBLISHED'].includes(publicationStatus)) {
      res.status(400).json({ error: 'Choose draft or published status.' });
      return;
    }
    if (!Number.isInteger(order) || order < 0) {
      res.status(400).json({ error: 'Lesson sequence must be a non-negative whole number.' });
      return;
    }
    if (videoUrl && (!isWebUrl(videoUrl) || !videoUrl.startsWith('https://'))) {
      res.status(400).json({ error: 'Video links must use HTTPS.' });
      return;
    }
    if (publicationStatus === 'PUBLISHED' && !videoUrl) {
      res.status(400).json({ error: 'Add an HTTPS video link before publishing the lesson.' });
      return;
    }

    const previousPrivateFiles = lesson.attachments
      .filter((attachment) => attachment.storageKey)
      .map((attachment) => ({ storageKey: attachment.storageKey! }));
    storedFiles = await storePrivateFiles(uploadedFiles(req), (fileId) => `/api/lessons/files/${fileId}`);
    lesson.title = title;
    lesson.description = description;
    lesson.videoUrl = videoUrl;
    lesson.duration = req.body.duration === undefined ? lesson.duration : String(req.body.duration).trim().slice(0, 50);
    lesson.chapter = chapter.slice(0, 150);
    lesson.topic = topic.slice(0, 150);
    lesson.order = order;
    lesson.attachments = [
      ...(attachmentsResult.attachments || []),
      ...storedFiles.map((file) => ({
        name: file.originalName,
        fileUrl: file.fileUrl,
        fileType: file.mimeType,
        fileSize: `${Math.ceil(file.size / 1024)} KB`,
        fileId: file.fileId,
        storageKey: file.storageKey,
        originalName: file.originalName,
        mimeType: file.mimeType,
        size: file.size,
      })),
    ] as any;
    lesson.publicationStatus = publicationStatus;
    lesson.isPublished = publicationStatus === 'PUBLISHED';
    lesson.publishedAt = publicationStatus === 'PUBLISHED' ? lesson.publishedAt || new Date() : null;
    await lesson.save();
    lessonSaved = true;
    const retainedStorageKeys = new Set(
      lesson.attachments.map((attachment) => attachment.storageKey).filter(Boolean)
    );
    await deletePrivateFiles(previousPrivateFiles.filter((file) => !retainedStorageKeys.has(file.storageKey)));
    await logAudit({
      userId: req.user!._id,
      action: 'LESSON_UPDATED',
      entityType: 'Lesson',
      entityId: lesson._id.toString(),
      details: { publicationStatus },
      ipAddress: req.ip,
    });
    res.json(publicLesson(lesson));
  } catch (error: any) {
    if (storedFiles.length && !lessonSaved) await deletePrivateFiles(storedFiles);
    if (error instanceof InvalidPrivateFileError) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: error.message || 'Failed to update lesson' });
  }
};

export const archiveLesson = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const lesson = await Lesson.findById(req.params.id);
    if (!lesson) {
      res.status(404).json({ error: 'Lesson not found.' });
      return;
    }
    if (!(await canAccessClass(req.user!._id.toString(), req.user!.role, lesson.classId.toString()))) {
      res.status(403).json({ error: 'You are not authorized to archive lessons for this class.' });
      return;
    }
    lesson.publicationStatus = 'ARCHIVED';
    lesson.isPublished = false;
    lesson.archivedAt = new Date();
    await lesson.save();
    await logAudit({
      userId: req.user!._id,
      action: 'LESSON_ARCHIVED',
      entityType: 'Lesson',
      entityId: lesson._id.toString(),
      ipAddress: req.ip,
    });
    res.json({ message: 'Lesson archived; its progress history has been preserved.' });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to archive lesson' });
  }
};

export const downloadLessonAttachment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const lesson = await Lesson.findOne({ 'attachments.fileId': req.params.fileId });
    if (!lesson) {
      res.status(404).json({ error: 'Lesson resource not found.' });
      return;
    }
    const user = req.user!;
    if (user.role === 'STUDENT' && user.studentId) {
      if (!isPublished(lesson) || !(await currentEnrollment(user.studentId, lesson.classId))) {
        res.status(403).json({ error: 'You are not authorized to access this lesson resource.' });
        return;
      }
    } else if (user.role === 'PARENT') {
      const studentId = String(req.query.studentId || '');
      if (
        !user.guardianId ||
        !mongoose.isValidObjectId(studentId) ||
        !(await verifyParentStudentLink(user.guardianId.toString(), studentId)) ||
        !isPublished(lesson) ||
        !(await currentEnrollment(new mongoose.Types.ObjectId(studentId), lesson.classId))
      ) {
        res.status(403).json({ error: 'You are not authorized to access this lesson resource.' });
        return;
      }
    } else if (
      (user.role !== 'ADMIN' && user.role !== 'TEACHER') ||
      !(await canAccessClass(user._id.toString(), user.role, lesson.classId.toString()))
    ) {
      res.status(403).json({ error: 'You are not authorized to access this lesson resource.' });
      return;
    }
    const attachment = lesson.attachments.find((item) => item.fileId === req.params.fileId);
    if (!attachment?.storageKey || !attachment.originalName || !attachment.mimeType) {
      res.status(404).json({ error: 'Lesson resource not found.' });
      return;
    }
    await sendPrivateFile(res, {
      storageKey: attachment.storageKey,
      originalName: attachment.originalName,
      mimeType: attachment.mimeType,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to download lesson resource' });
  }
};

export const toggleLessonProgress = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    if (user.role !== 'STUDENT' || !user.studentId) {
      res.status(403).json({ error: 'Only student accounts can mark lesson completion.' });
      return;
    }
    const lesson = await Lesson.findById(req.params.id);
    if (!lesson || !isPublished(lesson)) {
      res.status(404).json({ error: 'Published lesson not found.' });
      return;
    }
    if (!(await currentEnrollment(user.studentId, lesson.classId))) {
      res.status(403).json({ error: 'You are not currently enrolled in this lesson class.' });
      return;
    }

    let progress = await LessonProgress.findOne({ studentId: user.studentId, lessonId: lesson._id });
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
