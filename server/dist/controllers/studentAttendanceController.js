"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkInStudentAttendance = exports.getStudentAttendanceSessions = void 0;
const AttendanceRecord_1 = require("../models/AttendanceRecord");
const ClassSession_1 = require("../models/ClassSession");
const Enrollment_1 = require("../models/Enrollment");
const attendanceWindow_1 = require("../services/attendanceWindow");
const auditService_1 = require("../services/auditService");
const enrollmentAccess_1 = require("../services/enrollmentAccess");
const getStudentAttendanceSessions = async (req, res) => {
    try {
        const user = req.user;
        if (!user.studentId) {
            res.status(403).json({
                error: 'This student login is not linked to a student profile. Ask an administrator to match the account email to the student profile or set the student login password again.',
                code: 'STUDENT_PROFILE_NOT_LINKED',
            });
            return;
        }
        await (0, attendanceWindow_1.finalizeExpiredAttendanceSessions)();
        const enrollments = await Enrollment_1.Enrollment.find((0, enrollmentAccess_1.currentEnrollmentFilter)(user.studentId)).populate({
            path: 'classId',
            select: 'name classCode subject teachers',
            populate: { path: 'teachers', select: 'fullName' },
        });
        const classes = enrollments
            .map((enrollment) => enrollment.classId)
            .filter((classItem) => classItem?._id);
        const classIds = classes.map((classItem) => classItem._id);
        if (classIds.length === 0) {
            res.json([]);
            return;
        }
        const classById = new Map(classes.map((classItem) => [classItem._id.toString(), classItem]));
        const sessions = await ClassSession_1.ClassSession.find({
            classId: { $in: classIds },
            $or: [{ isPublished: true }, { isPublished: { $exists: false } }],
        })
            .sort({ sessionDate: -1, createdAt: -1 })
            .limit(50);
        const records = await AttendanceRecord_1.AttendanceRecord.find({
            studentId: user.studentId,
            classSessionId: { $in: sessions.map((session) => session._id) },
        });
        const recordBySession = new Map(records.map((record) => [record.classSessionId.toString(), record]));
        res.json(sessions.map((session) => {
            const classItem = classById.get(session.classId.toString());
            const record = recordBySession.get(session._id.toString());
            return {
                _id: session._id,
                title: session.title,
                sessionDate: session.sessionDate,
                startTime: session.startTime,
                endTime: session.endTime,
                timeZone: session.timeZone,
                status: session.status,
                isPublished: session.isPublished,
                submittedAt: session.submittedAt,
                autoFinalizedAt: session.autoFinalizedAt,
                class: classItem
                    ? {
                        _id: classItem._id,
                        name: classItem.name,
                        classCode: classItem.classCode,
                        subject: classItem.subject,
                        teachers: classItem.teachers,
                    }
                    : null,
                attendance: record
                    ? { status: record.status, arrivalTime: record.arrivalTime, markedAt: record.markedAt }
                    : null,
                checkInState: session.status === 'DRAFT'
                    ? (0, attendanceWindow_1.getAttendanceWindowState)(session)
                    : 'FINALIZED',
            };
        }));
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Failed to fetch student attendance sessions' });
    }
};
exports.getStudentAttendanceSessions = getStudentAttendanceSessions;
const checkInStudentAttendance = async (req, res) => {
    try {
        const user = req.user;
        if (!user.studentId) {
            res.status(403).json({
                error: 'This student login is not linked to a student profile. Ask an administrator to match the account email to the student profile or set the student login password again.',
                code: 'STUDENT_PROFILE_NOT_LINKED',
            });
            return;
        }
        const session = await ClassSession_1.ClassSession.findById(req.params.sessionId);
        if (!session) {
            res.status(404).json({ error: 'Attendance session not found.' });
            return;
        }
        if (session.isPublished === false) {
            res.status(404).json({ error: 'Published attendance session not found.' });
            return;
        }
        if (session.status !== 'DRAFT') {
            res.status(409).json({ error: 'This attendance session has already been finalized.' });
            return;
        }
        const now = new Date();
        const enrollment = await Enrollment_1.Enrollment.findOne((0, enrollmentAccess_1.currentEnrollmentFilter)(user.studentId, session.classId));
        if (!enrollment) {
            res.status(403).json({ error: 'You are not actively enrolled in this class.' });
            return;
        }
        const windowState = (0, attendanceWindow_1.getAttendanceWindowState)(session);
        if (windowState === 'UPCOMING') {
            res.status(409).json({ error: 'Attendance check-in is not open yet.' });
            return;
        }
        if (windowState === 'CLOSED') {
            await (0, attendanceWindow_1.finalizeExpiredAttendanceSessions)();
            res.status(409).json({ error: 'The attendance check-in window has closed.' });
            return;
        }
        const existingRecord = await AttendanceRecord_1.AttendanceRecord.findOne({
            classSessionId: session._id,
            studentId: user.studentId,
        });
        if (existingRecord) {
            res.status(409).json({ error: 'Your attendance has already been recorded.' });
            return;
        }
        const { start, end } = (0, attendanceWindow_1.getAttendanceWindow)(session);
        if (now < start) {
            res.status(409).json({ error: 'Attendance check-in is not open yet.' });
            return;
        }
        if (now >= end) {
            await (0, attendanceWindow_1.finalizeExpiredAttendanceSessions)();
            res.status(409).json({ error: 'The attendance check-in window has closed.' });
            return;
        }
        const timeZone = session.timeZone || 'Asia/Colombo';
        const arrivalTime = new Intl.DateTimeFormat('en-GB', {
            timeZone,
            hour: '2-digit',
            minute: '2-digit',
            hourCycle: 'h23',
        }).format(now);
        const record = await AttendanceRecord_1.AttendanceRecord.create({
            classSessionId: session._id,
            studentId: user.studentId,
            status: now.getTime() <= start.getTime() ? 'PRESENT' : 'LATE',
            arrivalTime,
            markedBy: user._id,
            markedAt: now,
        });
        await (0, auditService_1.logAudit)({
            userId: user._id,
            action: 'STUDENT_ATTENDANCE_CHECKED_IN',
            entityType: 'AttendanceRecord',
            entityId: record._id.toString(),
            details: { classSessionId: session._id, status: record.status },
            ipAddress: req.ip,
        });
        res.status(201).json({
            message: 'Attendance check-in recorded.',
            attendance: { status: record.status, arrivalTime: record.arrivalTime, markedAt: record.markedAt },
        });
    }
    catch (error) {
        if (error?.code === 11000) {
            res.status(409).json({ error: 'Your attendance has already been recorded.' });
            return;
        }
        res.status(500).json({ error: error.message || 'Failed to record attendance check-in' });
    }
};
exports.checkInStudentAttendance = checkInStudentAttendance;
