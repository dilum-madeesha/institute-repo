"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.toggleLessonProgress = exports.downloadLessonAttachment = exports.archiveLesson = exports.updateLesson = exports.createLesson = exports.getLessonsByClass = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const Lesson_1 = require("../models/Lesson");
const LessonProgress_1 = require("../models/LessonProgress");
const Enrollment_1 = require("../models/Enrollment");
const role_1 = require("../middleware/role");
const auditService_1 = require("../services/auditService");
const enrollmentAccess_1 = require("../services/enrollmentAccess");
const privateFileStorage_1 = require("../services/privateFileStorage");
const uploadedFiles = (req) => Array.isArray(req.files) ? req.files : [];
const parseJsonField = (value) => {
    if (typeof value !== 'string')
        return value;
    try {
        return JSON.parse(value);
    }
    catch {
        return undefined;
    }
};
const isPublished = (lesson) => lesson.publicationStatus === 'PUBLISHED' ||
    (!lesson.publicationStatus && lesson.isPublished === true);
const isWebUrl = (value) => {
    if (typeof value !== 'string')
        return false;
    try {
        const url = new URL(value);
        return url.protocol === 'https:' || url.protocol === 'http:';
    }
    catch {
        return false;
    }
};
const publicAttachments = (attachments = []) => attachments.map(({ name, fileUrl, fileType, fileSize, fileId }) => ({
    name,
    fileUrl,
    fileType,
    fileSize,
    ...(fileId ? { fileId } : {}),
}));
const publicLesson = (lesson) => {
    const data = lesson.toObject ? lesson.toObject() : lesson;
    return { ...data, attachments: publicAttachments(data.attachments || []) };
};
const normalizeAttachmentInput = (input, existingAttachments = []) => {
    const parsed = parseJsonField(input);
    if (!Array.isArray(parsed))
        return { error: 'Lesson attachments must be provided as a list.' };
    const attachments = [];
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
            if (!existing)
                return { error: 'An uploaded resource does not belong to this lesson.' };
            attachments.push(existing);
        }
        else {
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
const currentEnrollment = (studentId, classId) => {
    return Enrollment_1.Enrollment.findOne((0, enrollmentAccess_1.currentEnrollmentFilter)(studentId, classId));
};
const getLessonsByClass = async (req, res) => {
    try {
        const classId = req.params.classId;
        const user = req.user;
        if (!mongoose_1.default.isValidObjectId(classId)) {
            res.status(400).json({ error: 'A valid class is required.' });
            return;
        }
        const hasAccess = await (0, role_1.canAccessClass)(user._id.toString(), user.role, classId, user.studentId?.toString(), user.guardianId?.toString());
        if (!hasAccess) {
            res.status(403).json({ error: 'Access denied. You do not have permission to view lessons for this class.' });
            return;
        }
        let studentId = user.role === 'STUDENT' ? user.studentId || null : null;
        if (user.role === 'PARENT' && req.query.studentId) {
            const requestedStudentId = String(req.query.studentId);
            if (!user.guardianId ||
                !mongoose_1.default.isValidObjectId(requestedStudentId) ||
                !(await (0, role_1.verifyParentStudentLink)(user.guardianId.toString(), requestedStudentId))) {
                res.status(403).json({ error: 'Access denied. Student is not linked to your parent account.' });
                return;
            }
            studentId = new mongoose_1.default.Types.ObjectId(requestedStudentId);
            if (!(await currentEnrollment(studentId, new mongoose_1.default.Types.ObjectId(classId)))) {
                res.status(403).json({ error: 'The linked student is not currently enrolled in this class.' });
                return;
            }
        }
        const lessonFilter = { classId };
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
        const lessons = await Lesson_1.Lesson.find(lessonFilter)
            .sort({ chapter: 1, order: 1, createdAt: 1 })
            .populate('classId', 'name classCode subject')
            .populate('createdBy', 'fullName');
        if (studentId) {
            const progressList = await LessonProgress_1.LessonProgress.find({ classId, studentId });
            const completedSet = new Set(progressList.filter((progress) => progress.isCompleted).map((progress) => progress.lessonId.toString()));
            res.json(lessons.map((lesson) => ({
                ...publicLesson(lesson),
                isCompleted: completedSet.has(lesson._id.toString()),
            })));
            return;
        }
        res.json(lessons.map(publicLesson));
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Failed to fetch lessons' });
    }
};
exports.getLessonsByClass = getLessonsByClass;
const createLesson = async (req, res) => {
    let storedFiles = [];
    let lessonCreated = false;
    try {
        const classId = String(req.body.classId || '');
        if (!mongoose_1.default.isValidObjectId(classId)) {
            res.status(400).json({ error: 'A valid class is required.' });
            return;
        }
        if (!(await (0, role_1.canAccessClass)(req.user._id.toString(), req.user.role, classId))) {
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
        storedFiles = await (0, privateFileStorage_1.storePrivateFiles)(uploadedFiles(req), (fileId) => `/api/lessons/files/${fileId}`);
        const lesson = await Lesson_1.Lesson.create({
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
            createdBy: req.user._id,
        });
        lessonCreated = true;
        await (0, auditService_1.logAudit)({
            userId: req.user._id,
            action: 'LESSON_CREATED',
            entityType: 'Lesson',
            entityId: lesson._id.toString(),
            details: { title: lesson.title, classId, publicationStatus },
            ipAddress: req.ip,
        });
        res.status(201).json(publicLesson(lesson));
    }
    catch (error) {
        if (storedFiles.length && !lessonCreated)
            await (0, privateFileStorage_1.deletePrivateFiles)(storedFiles);
        if (error instanceof privateFileStorage_1.InvalidPrivateFileError) {
            res.status(400).json({ error: error.message });
            return;
        }
        res.status(500).json({ error: error.message || 'Failed to create lesson' });
    }
};
exports.createLesson = createLesson;
const updateLesson = async (req, res) => {
    let storedFiles = [];
    let lessonSaved = false;
    try {
        const lesson = await Lesson_1.Lesson.findById(req.params.id);
        if (!lesson) {
            res.status(404).json({ error: 'Lesson not found.' });
            return;
        }
        if (!(await (0, role_1.canAccessClass)(req.user._id.toString(), req.user.role, lesson.classId.toString()))) {
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
        const attachmentsResult = normalizeAttachmentInput(parseJsonField(req.body.attachments) ?? lesson.attachments, lesson.attachments);
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
            .map((attachment) => ({ storageKey: attachment.storageKey }));
        storedFiles = await (0, privateFileStorage_1.storePrivateFiles)(uploadedFiles(req), (fileId) => `/api/lessons/files/${fileId}`);
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
        ];
        lesson.publicationStatus = publicationStatus;
        lesson.isPublished = publicationStatus === 'PUBLISHED';
        lesson.publishedAt = publicationStatus === 'PUBLISHED' ? lesson.publishedAt || new Date() : null;
        await lesson.save();
        lessonSaved = true;
        const retainedStorageKeys = new Set(lesson.attachments.map((attachment) => attachment.storageKey).filter(Boolean));
        await (0, privateFileStorage_1.deletePrivateFiles)(previousPrivateFiles.filter((file) => !retainedStorageKeys.has(file.storageKey)));
        await (0, auditService_1.logAudit)({
            userId: req.user._id,
            action: 'LESSON_UPDATED',
            entityType: 'Lesson',
            entityId: lesson._id.toString(),
            details: { publicationStatus },
            ipAddress: req.ip,
        });
        res.json(publicLesson(lesson));
    }
    catch (error) {
        if (storedFiles.length && !lessonSaved)
            await (0, privateFileStorage_1.deletePrivateFiles)(storedFiles);
        if (error instanceof privateFileStorage_1.InvalidPrivateFileError) {
            res.status(400).json({ error: error.message });
            return;
        }
        res.status(500).json({ error: error.message || 'Failed to update lesson' });
    }
};
exports.updateLesson = updateLesson;
const archiveLesson = async (req, res) => {
    try {
        const lesson = await Lesson_1.Lesson.findById(req.params.id);
        if (!lesson) {
            res.status(404).json({ error: 'Lesson not found.' });
            return;
        }
        if (!(await (0, role_1.canAccessClass)(req.user._id.toString(), req.user.role, lesson.classId.toString()))) {
            res.status(403).json({ error: 'You are not authorized to archive lessons for this class.' });
            return;
        }
        lesson.publicationStatus = 'ARCHIVED';
        lesson.isPublished = false;
        lesson.archivedAt = new Date();
        await lesson.save();
        await (0, auditService_1.logAudit)({
            userId: req.user._id,
            action: 'LESSON_ARCHIVED',
            entityType: 'Lesson',
            entityId: lesson._id.toString(),
            ipAddress: req.ip,
        });
        res.json({ message: 'Lesson archived; its progress history has been preserved.' });
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Failed to archive lesson' });
    }
};
exports.archiveLesson = archiveLesson;
const downloadLessonAttachment = async (req, res) => {
    try {
        const lesson = await Lesson_1.Lesson.findOne({ 'attachments.fileId': req.params.fileId });
        if (!lesson) {
            res.status(404).json({ error: 'Lesson resource not found.' });
            return;
        }
        const user = req.user;
        if (user.role === 'STUDENT' && user.studentId) {
            if (!isPublished(lesson) || !(await currentEnrollment(user.studentId, lesson.classId))) {
                res.status(403).json({ error: 'You are not authorized to access this lesson resource.' });
                return;
            }
        }
        else if (user.role === 'PARENT') {
            const studentId = String(req.query.studentId || '');
            if (!user.guardianId ||
                !mongoose_1.default.isValidObjectId(studentId) ||
                !(await (0, role_1.verifyParentStudentLink)(user.guardianId.toString(), studentId)) ||
                !isPublished(lesson) ||
                !(await currentEnrollment(new mongoose_1.default.Types.ObjectId(studentId), lesson.classId))) {
                res.status(403).json({ error: 'You are not authorized to access this lesson resource.' });
                return;
            }
        }
        else if ((user.role !== 'ADMIN' && user.role !== 'TEACHER') ||
            !(await (0, role_1.canAccessClass)(user._id.toString(), user.role, lesson.classId.toString()))) {
            res.status(403).json({ error: 'You are not authorized to access this lesson resource.' });
            return;
        }
        const attachment = lesson.attachments.find((item) => item.fileId === req.params.fileId);
        if (!attachment?.storageKey || !attachment.originalName || !attachment.mimeType) {
            res.status(404).json({ error: 'Lesson resource not found.' });
            return;
        }
        await (0, privateFileStorage_1.sendPrivateFile)(res, {
            storageKey: attachment.storageKey,
            originalName: attachment.originalName,
            mimeType: attachment.mimeType,
        });
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Failed to download lesson resource' });
    }
};
exports.downloadLessonAttachment = downloadLessonAttachment;
const toggleLessonProgress = async (req, res) => {
    try {
        const user = req.user;
        if (user.role !== 'STUDENT' || !user.studentId) {
            res.status(403).json({ error: 'Only student accounts can mark lesson completion.' });
            return;
        }
        const lesson = await Lesson_1.Lesson.findById(req.params.id);
        if (!lesson || !isPublished(lesson)) {
            res.status(404).json({ error: 'Published lesson not found.' });
            return;
        }
        if (!(await currentEnrollment(user.studentId, lesson.classId))) {
            res.status(403).json({ error: 'You are not currently enrolled in this lesson class.' });
            return;
        }
        let progress = await LessonProgress_1.LessonProgress.findOne({ studentId: user.studentId, lessonId: lesson._id });
        if (!progress) {
            progress = await LessonProgress_1.LessonProgress.create({
                studentId: user.studentId,
                lessonId: lesson._id,
                classId: lesson.classId,
                isCompleted: true,
                completedAt: new Date(),
            });
        }
        else {
            progress.isCompleted = !progress.isCompleted;
            progress.completedAt = progress.isCompleted ? new Date() : null;
            await progress.save();
        }
        res.json({ message: 'Progress updated', isCompleted: progress.isCompleted });
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Failed to update progress' });
    }
};
exports.toggleLessonProgress = toggleLessonProgress;
