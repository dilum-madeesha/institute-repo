"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRecordChangeLogs = exports.correctAttendanceRecord = exports.submitAttendance = exports.saveDraftAttendance = exports.getSessionAttendance = exports.createClassSession = exports.getClassSessions = void 0;
const ClassSession_1 = require("../models/ClassSession");
const AttendanceRecord_1 = require("../models/AttendanceRecord");
const AttendanceChangeLog_1 = require("../models/AttendanceChangeLog");
const Enrollment_1 = require("../models/Enrollment");
const EmailNotification_1 = require("../models/EmailNotification");
const role_1 = require("../middleware/role");
const notificationWorker_1 = require("../services/notificationWorker");
const auditService_1 = require("../services/auditService");
const getClassSessions = async (req, res) => {
    try {
        const classId = req.params.id;
        const hasAccess = await (0, role_1.canAccessClass)(req.user._id.toString(), req.user.role, classId);
        if (!hasAccess) {
            res.status(403).json({ error: 'Access denied.' });
            return;
        }
        const sessions = await ClassSession_1.ClassSession.find({ classId })
            .populate('createdBy', 'fullName')
            .populate('submittedBy', 'fullName')
            .sort({ sessionDate: -1, createdAt: -1 });
        const sessionIds = sessions.map((s) => s._id);
        // Aggregate counts for each session
        const recordCounts = await AttendanceRecord_1.AttendanceRecord.aggregate([
            { $match: { classSessionId: { $in: sessionIds } } },
            {
                $group: {
                    _id: { session: '$classSessionId', status: '$status' },
                    count: { $sum: 1 },
                },
            },
        ]);
        const countMap = new Map();
        recordCounts.forEach((r) => {
            const sId = r._id.session.toString();
            if (!countMap.has(sId)) {
                countMap.set(sId, { PRESENT: 0, ABSENT: 0, LATE: 0, EXCUSED: 0, TOTAL: 0 });
            }
            const item = countMap.get(sId);
            item[r._id.status] = r.count;
            item.TOTAL += r.count;
        });
        const response = sessions.map((s) => ({
            ...s.toObject(),
            stats: countMap.get(s._id.toString()) || {
                PRESENT: 0,
                ABSENT: 0,
                LATE: 0,
                EXCUSED: 0,
                TOTAL: 0,
            },
        }));
        res.json(response);
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Failed to fetch sessions' });
    }
};
exports.getClassSessions = getClassSessions;
const createClassSession = async (req, res) => {
    try {
        const classId = req.params.id;
        const hasAccess = await (0, role_1.canAccessClass)(req.user._id.toString(), req.user.role, classId);
        if (!hasAccess) {
            res.status(403).json({ error: 'Access denied.' });
            return;
        }
        const { sessionDate, startTime, endTime, title } = req.body;
        if (!sessionDate) {
            res.status(400).json({ error: 'Session date is required.' });
            return;
        }
        const session = await ClassSession_1.ClassSession.create({
            classId,
            sessionDate: new Date(sessionDate),
            startTime: startTime ? startTime.trim() : undefined,
            endTime: endTime ? endTime.trim() : undefined,
            title: title ? title.trim() : undefined,
            status: 'DRAFT',
            createdBy: req.user._id,
        });
        await (0, auditService_1.logAudit)({
            userId: req.user._id,
            action: 'SESSION_CREATED',
            entityType: 'ClassSession',
            entityId: session._id.toString(),
            details: { classId, date: session.sessionDate },
            ipAddress: req.ip,
        });
        res.status(201).json(session);
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Failed to create session' });
    }
};
exports.createClassSession = createClassSession;
const getSessionAttendance = async (req, res) => {
    try {
        const { sessionId } = req.params;
        const session = await ClassSession_1.ClassSession.findById(sessionId)
            .populate('classId', 'name classCode subject teachers')
            .populate('createdBy', 'fullName')
            .populate('submittedBy', 'fullName');
        if (!session) {
            res.status(404).json({ error: 'Session not found' });
            return;
        }
        const classObj = session.classId;
        const hasAccess = await (0, role_1.canAccessClass)(req.user._id.toString(), req.user.role, classObj._id.toString());
        if (!hasAccess) {
            res.status(403).json({ error: 'Access denied.' });
            return;
        }
        // Find students enrolled in the class as of the session date
        const sessionDate = new Date(session.sessionDate);
        const enrollments = await Enrollment_1.Enrollment.find({
            classId: classObj._id,
            startDate: { $lte: sessionDate },
            $or: [{ endDate: null }, { endDate: { $gte: sessionDate } }],
            status: { $in: ['ACTIVE', 'COMPLETED'] },
        }).populate('studentId');
        const enrolledStudents = enrollments
            .map((e) => e.studentId)
            .filter((s) => s && s.status === 'ACTIVE');
        // Existing attendance records
        const records = await AttendanceRecord_1.AttendanceRecord.find({ classSessionId: session._id });
        const recordMap = new Map(records.map((r) => [r.studentId.toString(), r]));
        // Notification statuses
        const notifications = await EmailNotification_1.EmailNotification.find({ classSessionId: session._id });
        const notifMap = new Map();
        notifications.forEach((n) => {
            const sId = n.studentId.toString();
            if (!notifMap.has(sId))
                notifMap.set(sId, []);
            notifMap.get(sId).push(n);
        });
        const studentRoster = enrolledStudents.map((st) => {
            const rec = recordMap.get(st._id.toString());
            const notifs = notifMap.get(st._id.toString()) || [];
            return {
                student: {
                    id: st._id,
                    firstName: st.firstName,
                    lastName: st.lastName,
                    displayName: st.displayName,
                    studentNumber: st.studentNumber,
                },
                record: rec
                    ? {
                        id: rec._id,
                        status: rec.status,
                        arrivalTime: rec.arrivalTime,
                        note: rec.note,
                        markedAt: rec.markedAt,
                    }
                    : null,
                notifications: notifs.map((n) => ({
                    id: n._id,
                    status: n.status,
                    recipientEmail: n.recipientEmail,
                    lastError: n.lastError,
                    sentAt: n.sentAt,
                })),
            };
        });
        res.json({
            session: {
                id: session._id,
                classId: classObj._id,
                className: classObj.name,
                classCode: classObj.classCode,
                sessionDate: session.sessionDate,
                startTime: session.startTime,
                endTime: session.endTime,
                title: session.title,
                status: session.status,
                submittedAt: session.submittedAt,
                submittedBy: session.submittedBy,
            },
            roster: studentRoster,
        });
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Failed to fetch session attendance' });
    }
};
exports.getSessionAttendance = getSessionAttendance;
const saveDraftAttendance = async (req, res) => {
    try {
        const { sessionId } = req.params;
        const { items } = req.body; // array of { studentId, status, arrivalTime, note }
        if (!Array.isArray(items)) {
            res.status(400).json({ error: 'Expected items array with attendance records' });
            return;
        }
        const session = await ClassSession_1.ClassSession.findById(sessionId);
        if (!session) {
            res.status(404).json({ error: 'Session not found' });
            return;
        }
        if (session.status === 'LOCKED') {
            res.status(400).json({ error: 'Cannot modify a locked session.' });
            return;
        }
        const hasAccess = await (0, role_1.canAccessClass)(req.user._id.toString(), req.user.role, session.classId.toString());
        if (!hasAccess) {
            res.status(403).json({ error: 'Access denied.' });
            return;
        }
        for (const item of items) {
            if (!item.studentId || !item.status)
                continue;
            await AttendanceRecord_1.AttendanceRecord.findOneAndUpdate({ classSessionId: session._id, studentId: item.studentId }, {
                status: item.status,
                arrivalTime: item.arrivalTime || null,
                note: item.note || null,
                markedBy: req.user._id,
                markedAt: new Date(),
            }, { upsert: true, new: true });
        }
        res.json({ message: 'Attendance draft saved successfully.' });
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Failed to save attendance draft' });
    }
};
exports.saveDraftAttendance = saveDraftAttendance;
const submitAttendance = async (req, res) => {
    try {
        const { sessionId } = req.params;
        const { items, allowPartial } = req.body;
        const session = await ClassSession_1.ClassSession.findById(sessionId);
        if (!session) {
            res.status(404).json({ error: 'Session not found' });
            return;
        }
        if (session.status === 'LOCKED') {
            res.status(400).json({ error: 'Cannot modify a locked session.' });
            return;
        }
        const hasAccess = await (0, role_1.canAccessClass)(req.user._id.toString(), req.user.role, session.classId.toString());
        if (!hasAccess) {
            res.status(403).json({ error: 'Access denied.' });
            return;
        }
        // Save/update any provided items
        if (Array.isArray(items)) {
            for (const item of items) {
                if (!item.studentId || !item.status)
                    continue;
                await AttendanceRecord_1.AttendanceRecord.findOneAndUpdate({ classSessionId: session._id, studentId: item.studentId }, {
                    status: item.status,
                    arrivalTime: item.arrivalTime || null,
                    note: item.note || null,
                    markedBy: req.user._id,
                    markedAt: new Date(),
                }, { upsert: true, new: true });
            }
        }
        // Verify all enrolled students are marked
        const sessionDate = new Date(session.sessionDate);
        const enrollments = await Enrollment_1.Enrollment.find({
            classId: session.classId,
            startDate: { $lte: sessionDate },
            $or: [{ endDate: null }, { endDate: { $gte: sessionDate } }],
            status: { $in: ['ACTIVE', 'COMPLETED'] },
        }).populate('studentId', 'firstName lastName displayName studentNumber status');
        const enrolledStudents = enrollments
            .map((e) => e.studentId)
            .filter((s) => s && s.status === 'ACTIVE');
        const recorded = await AttendanceRecord_1.AttendanceRecord.find({ classSessionId: session._id });
        const markedStudentIds = new Set(recorded.map((r) => r.studentId.toString()));
        const unmarkedStudents = enrolledStudents.filter((s) => !markedStudentIds.has(s._id.toString()));
        if (unmarkedStudents.length > 0 && !allowPartial) {
            res.status(400).json({
                warning: 'UNMARKED_STUDENTS',
                message: `There are ${unmarkedStudents.length} student(s) still unmarked in this register.`,
                unmarkedStudents: unmarkedStudents.map((s) => ({
                    id: s._id,
                    name: s.displayName || `${s.firstName} ${s.lastName}`,
                    studentNumber: s.studentNumber,
                })),
            });
            return;
        }
        // Finalize session
        session.status = 'SUBMITTED';
        session.submittedBy = req.user._id;
        session.submittedAt = new Date();
        await session.save();
        await (0, auditService_1.logAudit)({
            userId: req.user._id,
            action: 'ATTENDANCE_SUBMITTED',
            entityType: 'ClassSession',
            entityId: session._id.toString(),
            details: { classId: session.classId, totalMarked: recorded.length },
            ipAddress: req.ip,
        });
        // Queue parent absence email notifications
        await (0, notificationWorker_1.queueAbsenceNotificationsForSession)(session._id, req.user._id);
        res.json({
            message: 'Attendance finalized and submitted successfully. Absence notifications queued.',
            session,
        });
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Failed to submit attendance' });
    }
};
exports.submitAttendance = submitAttendance;
const correctAttendanceRecord = async (req, res) => {
    try {
        const { attendanceId } = req.params;
        const { newStatus, reason, note, arrivalTime } = req.body;
        if (!newStatus || !reason || !reason.trim()) {
            res.status(400).json({ error: 'Both new status and an explanation reason are required for corrections.' });
            return;
        }
        const record = await AttendanceRecord_1.AttendanceRecord.findById(attendanceId);
        if (!record) {
            res.status(404).json({ error: 'Attendance record not found' });
            return;
        }
        const session = await ClassSession_1.ClassSession.findById(record.classSessionId);
        if (!session) {
            res.status(404).json({ error: 'Session not found' });
            return;
        }
        const hasAccess = await (0, role_1.canAccessClass)(req.user._id.toString(), req.user.role, session.classId.toString());
        if (!hasAccess) {
            res.status(403).json({ error: 'Access denied. You cannot edit records for this class.' });
            return;
        }
        const oldStatus = record.status;
        record.status = newStatus;
        if (note !== undefined)
            record.note = note.trim();
        if (arrivalTime !== undefined)
            record.arrivalTime = arrivalTime.trim();
        await record.save();
        // Log in change history
        await AttendanceChangeLog_1.AttendanceChangeLog.create({
            attendanceRecordId: record._id,
            classSessionId: session._id,
            studentId: record.studentId,
            oldStatus,
            newStatus,
            reason: reason.trim(),
            changedBy: req.user._id,
            changedAt: new Date(),
        });
        await (0, auditService_1.logAudit)({
            userId: req.user._id,
            action: 'ATTENDANCE_CORRECTED',
            entityType: 'AttendanceRecord',
            entityId: record._id.toString(),
            details: { oldStatus, newStatus, reason: reason.trim() },
            ipAddress: req.ip,
        });
        // If new status is ABSENT and session was submitted, queue notification
        if (newStatus === 'ABSENT' && session.status === 'SUBMITTED') {
            await (0, notificationWorker_1.queueAbsenceNotificationsForSession)(session._id, req.user._id);
        }
        // If corrected from ABSENT to something else, cancel any pending notification
        if (oldStatus === 'ABSENT' && newStatus !== 'ABSENT') {
            await EmailNotification_1.EmailNotification.updateMany({ attendanceRecordId: record._id, status: 'PENDING' }, { status: 'CANCELLED', lastError: `Cancelled due to attendance correction to ${newStatus}` });
        }
        res.json({ message: 'Attendance record corrected successfully.', record });
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Failed to correct record' });
    }
};
exports.correctAttendanceRecord = correctAttendanceRecord;
const getRecordChangeLogs = async (req, res) => {
    try {
        const { attendanceId } = req.params;
        const logs = await AttendanceChangeLog_1.AttendanceChangeLog.find({ attendanceRecordId: attendanceId })
            .populate('changedBy', 'fullName')
            .sort({ changedAt: -1 });
        res.json(logs);
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Failed to fetch change history' });
    }
};
exports.getRecordChangeLogs = getRecordChangeLogs;
