"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toggleLessonProgress = exports.deleteLesson = exports.updateLesson = exports.createLesson = exports.getLessonsByClass = void 0;
const Lesson_1 = require("../models/Lesson");
const LessonProgress_1 = require("../models/LessonProgress");
const role_1 = require("../middleware/role");
const auditService_1 = require("../services/auditService");
const getLessonsByClass = async (req, res) => {
    try {
        const classId = req.params.classId;
        const user = req.user;
        const hasAccess = await (0, role_1.canAccessClass)(user._id.toString(), user.role, classId, user.studentId?.toString(), user.guardianId?.toString());
        if (!hasAccess) {
            res.status(403).json({ error: 'Access denied. You do not have permission to view lessons for this class.' });
            return;
        }
        const lessons = await Lesson_1.Lesson.find({ classId, isPublished: true })
            .sort({ order: 1, createdAt: 1 })
            .populate('createdBy', 'fullName');
        // If student, attach progress
        if (user.role === 'STUDENT' && user.studentId) {
            const progressList = await LessonProgress_1.LessonProgress.find({
                classId,
                studentId: user.studentId,
            });
            const completedSet = new Set(progressList.filter((p) => p.isCompleted).map((p) => p.lessonId.toString()));
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
            const progressList = await LessonProgress_1.LessonProgress.find({
                classId,
                studentId,
            });
            const completedSet = new Set(progressList.filter((p) => p.isCompleted).map((p) => p.lessonId.toString()));
            const enriched = lessons.map((l) => ({
                ...l.toObject(),
                isCompleted: completedSet.has(l._id.toString()),
            }));
            res.json(enriched);
            return;
        }
        res.json(lessons);
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Failed to fetch lessons' });
    }
};
exports.getLessonsByClass = getLessonsByClass;
const createLesson = async (req, res) => {
    try {
        const { classId, title, description, videoUrl, duration, attachments, order } = req.body;
        if (!classId || !title) {
            res.status(400).json({ error: 'Class ID and lesson title are required.' });
            return;
        }
        const lesson = await Lesson_1.Lesson.create({
            classId,
            title: title.trim(),
            description: description ? description.trim() : '',
            videoUrl: videoUrl ? videoUrl.trim() : '',
            duration: duration ? duration.trim() : '',
            attachments: Array.isArray(attachments) ? attachments : [],
            order: order !== undefined ? Number(order) : 0,
            createdBy: req.user._id,
        });
        await (0, auditService_1.logAudit)({
            userId: req.user._id,
            action: 'LESSON_CREATED',
            entityType: 'Lesson',
            entityId: lesson._id.toString(),
            details: { title: lesson.title, classId },
            ipAddress: req.ip,
        });
        res.status(201).json(lesson);
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Failed to create lesson' });
    }
};
exports.createLesson = createLesson;
const updateLesson = async (req, res) => {
    try {
        const lesson = await Lesson_1.Lesson.findById(req.params.id);
        if (!lesson) {
            res.status(404).json({ error: 'Lesson not found' });
            return;
        }
        const { title, description, videoUrl, duration, attachments, order, isPublished } = req.body;
        if (title)
            lesson.title = title.trim();
        if (description !== undefined)
            lesson.description = description.trim();
        if (videoUrl !== undefined)
            lesson.videoUrl = videoUrl.trim();
        if (duration !== undefined)
            lesson.duration = duration.trim();
        if (attachments !== undefined)
            lesson.attachments = attachments;
        if (order !== undefined)
            lesson.order = Number(order);
        if (isPublished !== undefined)
            lesson.isPublished = Boolean(isPublished);
        await lesson.save();
        await (0, auditService_1.logAudit)({
            userId: req.user._id,
            action: 'LESSON_UPDATED',
            entityType: 'Lesson',
            entityId: lesson._id.toString(),
            ipAddress: req.ip,
        });
        res.json(lesson);
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Failed to update lesson' });
    }
};
exports.updateLesson = updateLesson;
const deleteLesson = async (req, res) => {
    try {
        const lesson = await Lesson_1.Lesson.findByIdAndDelete(req.params.id);
        if (!lesson) {
            res.status(404).json({ error: 'Lesson not found' });
            return;
        }
        await LessonProgress_1.LessonProgress.deleteMany({ lessonId: lesson._id });
        await (0, auditService_1.logAudit)({
            userId: req.user._id,
            action: 'LESSON_DELETED',
            entityType: 'Lesson',
            entityId: lesson._id.toString(),
            ipAddress: req.ip,
        });
        res.json({ message: 'Lesson deleted successfully' });
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Failed to delete lesson' });
    }
};
exports.deleteLesson = deleteLesson;
const toggleLessonProgress = async (req, res) => {
    try {
        const lessonId = req.params.id;
        const user = req.user;
        if (user.role !== 'STUDENT' || !user.studentId) {
            res.status(403).json({ error: 'Only student accounts can mark lesson completion.' });
            return;
        }
        const lesson = await Lesson_1.Lesson.findById(lessonId);
        if (!lesson) {
            res.status(404).json({ error: 'Lesson not found' });
            return;
        }
        let progress = await LessonProgress_1.LessonProgress.findOne({
            studentId: user.studentId,
            lessonId: lesson._id,
        });
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
