"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteAnnouncement = exports.createAnnouncement = exports.getAnnouncements = void 0;
const Announcement_1 = require("../models/Announcement");
const Enrollment_1 = require("../models/Enrollment");
const StudentGuardian_1 = require("../models/StudentGuardian");
const Class_1 = require("../models/Class");
const auditService_1 = require("../services/auditService");
const enrollmentAccess_1 = require("../services/enrollmentAccess");
const getAnnouncements = async (req, res) => {
    try {
        const user = req.user;
        let allowedClassIds = [];
        if (user.role === 'ADMIN') {
            const allAnnouncements = await Announcement_1.Announcement.find()
                .populate('classId', 'name classCode')
                .populate('createdBy', 'fullName role')
                .sort({ createdAt: -1 });
            res.json(allAnnouncements);
            return;
        }
        if (user.role === 'TEACHER') {
            const classes = await Class_1.ClassModel.find({ teachers: user._id });
            allowedClassIds = classes.map((c) => c._id);
        }
        else if (user.role === 'STUDENT' && user.studentId) {
            const enrollments = await Enrollment_1.Enrollment.find((0, enrollmentAccess_1.currentEnrollmentFilter)(user.studentId));
            allowedClassIds = enrollments.map((e) => e.classId);
        }
        else if (user.role === 'PARENT' && user.guardianId) {
            const links = await StudentGuardian_1.StudentGuardian.find({ guardianId: user.guardianId });
            const childIds = links.map((l) => l.studentId);
            const enrollments = await Enrollment_1.Enrollment.find((0, enrollmentAccess_1.currentEnrollmentFilter)({ $in: childIds }));
            allowedClassIds = enrollments.map((e) => e.classId);
        }
        // Match announcements that are either school-wide (classId = null) OR in allowed classes
        const announcements = await Announcement_1.Announcement.find({
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
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Failed to fetch announcements' });
    }
};
exports.getAnnouncements = getAnnouncements;
const createAnnouncement = async (req, res) => {
    try {
        const { classId, title, content, priority, targetRoles } = req.body;
        if (!title || !content) {
            res.status(400).json({ error: 'Announcement title and content are required.' });
            return;
        }
        const announcement = await Announcement_1.Announcement.create({
            classId: classId || null,
            title: title.trim(),
            content: content.trim(),
            priority: priority || 'NORMAL',
            targetRoles: Array.isArray(targetRoles) ? targetRoles : ['STUDENT', 'PARENT', 'TEACHER'],
            createdBy: req.user._id,
        });
        await (0, auditService_1.logAudit)({
            userId: req.user._id,
            action: 'ANNOUNCEMENT_CREATED',
            entityType: 'Announcement',
            entityId: announcement._id.toString(),
            details: { title: announcement.title, classId: announcement.classId },
            ipAddress: req.ip,
        });
        const populated = await Announcement_1.Announcement.findById(announcement._id)
            .populate('classId', 'name classCode')
            .populate('createdBy', 'fullName role');
        res.status(201).json(populated);
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Failed to create announcement' });
    }
};
exports.createAnnouncement = createAnnouncement;
const deleteAnnouncement = async (req, res) => {
    try {
        const announcement = await Announcement_1.Announcement.findByIdAndDelete(req.params.id);
        if (!announcement) {
            res.status(404).json({ error: 'Announcement not found' });
            return;
        }
        await (0, auditService_1.logAudit)({
            userId: req.user._id,
            action: 'ANNOUNCEMENT_DELETED',
            entityType: 'Announcement',
            entityId: announcement._id.toString(),
            ipAddress: req.ip,
        });
        res.json({ message: 'Announcement deleted' });
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Failed to delete announcement' });
    }
};
exports.deleteAnnouncement = deleteAnnouncement;
