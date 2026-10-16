"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startAttendanceWindowWorker = exports.finalizeExpiredAttendanceSessions = exports.getAttendanceWindowState = exports.getAttendanceWindow = exports.isValidTimeZone = void 0;
const ClassSession_1 = require("../models/ClassSession");
const AttendanceRecord_1 = require("../models/AttendanceRecord");
const Enrollment_1 = require("../models/Enrollment");
const auditService_1 = require("./auditService");
const notificationWorker_1 = require("./notificationWorker");
const DEFAULT_TIME_ZONE = 'Asia/Colombo';
const localTimeToUtc = (date, time, timeZone) => {
    const [year, month, day] = date.split('-').map(Number);
    const [hour, minute] = time.split(':').map(Number);
    const localTimestamp = Date.UTC(year, month - 1, day, hour, minute);
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hourCycle: 'h23',
    });
    let timestamp = localTimestamp;
    for (let attempt = 0; attempt < 2; attempt += 1) {
        const parts = formatter.formatToParts(new Date(timestamp));
        const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
        const representedTimestamp = Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day), Number(values.hour), Number(values.minute), Number(values.second));
        timestamp = localTimestamp - (representedTimestamp - timestamp);
    }
    return new Date(timestamp);
};
const isValidTimeZone = (timeZone) => {
    try {
        new Intl.DateTimeFormat('en-US', { timeZone }).format();
        return true;
    }
    catch {
        return false;
    }
};
exports.isValidTimeZone = isValidTimeZone;
const getAttendanceWindow = (session) => {
    const date = session.sessionDate.toISOString().slice(0, 10);
    const timeZone = session.timeZone || DEFAULT_TIME_ZONE;
    const start = localTimeToUtc(date, session.startTime || '00:00', timeZone);
    const end = localTimeToUtc(date, session.endTime || '23:59', timeZone);
    return { start, end };
};
exports.getAttendanceWindow = getAttendanceWindow;
const getAttendanceWindowState = (session, now = new Date()) => {
    const { start, end } = (0, exports.getAttendanceWindow)(session);
    if (now < start)
        return 'UPCOMING';
    if (now < end)
        return 'OPEN';
    return 'CLOSED';
};
exports.getAttendanceWindowState = getAttendanceWindowState;
const finalizeExpiredAttendanceSessions = async () => {
    const now = new Date();
    const draftSessions = await ClassSession_1.ClassSession.find({
        status: 'DRAFT',
        $or: [{ isPublished: true }, { isPublished: { $exists: false } }],
    });
    for (const session of draftSessions) {
        const { end } = (0, exports.getAttendanceWindow)(session);
        if (now < end)
            continue;
        const sessionDate = new Date(session.sessionDate);
        const enrollments = await Enrollment_1.Enrollment.find({
            classId: session.classId,
            startDate: { $lte: sessionDate },
            $or: [{ endDate: null }, { endDate: { $gte: sessionDate } }],
            status: { $in: ['ACTIVE', 'COMPLETED'] },
        }).populate('studentId', '_id status');
        const studentIds = enrollments
            .map((enrollment) => enrollment.studentId)
            .filter((student) => student && student.status === 'ACTIVE')
            .map((student) => student._id);
        const markedRecords = await AttendanceRecord_1.AttendanceRecord.find({
            classSessionId: session._id,
            studentId: { $in: studentIds },
        }).select('studentId');
        const markedStudentIds = new Set(markedRecords.map((record) => record.studentId.toString()));
        const absentRecords = studentIds
            .filter((studentId) => !markedStudentIds.has(studentId.toString()))
            .map((studentId) => ({
            updateOne: {
                filter: { classSessionId: session._id, studentId },
                update: {
                    $setOnInsert: {
                        classSessionId: session._id,
                        studentId,
                        status: 'ABSENT',
                        markedBy: session.createdBy,
                        markedAt: end,
                    },
                },
                upsert: true,
            },
        }));
        if (absentRecords.length > 0) {
            await AttendanceRecord_1.AttendanceRecord.bulkWrite(absentRecords);
        }
        const finalizedSession = await ClassSession_1.ClassSession.findOneAndUpdate({ _id: session._id, status: 'DRAFT' }, {
            $set: {
                status: 'SUBMITTED',
                submittedAt: now,
                autoFinalizedAt: now,
            },
        }, { new: true });
        if (!finalizedSession)
            continue;
        await (0, auditService_1.logAudit)({
            userId: session.createdBy,
            action: 'ATTENDANCE_AUTO_FINALIZED',
            entityType: 'ClassSession',
            entityId: session._id.toString(),
            details: { classId: session.classId, absentCount: absentRecords.length },
        });
        await (0, notificationWorker_1.queueAbsenceNotificationsForSession)(session._id, session.createdBy);
    }
};
exports.finalizeExpiredAttendanceSessions = finalizeExpiredAttendanceSessions;
let attendanceWindowInterval = null;
let isFinalizingExpiredSessions = false;
const startAttendanceWindowWorker = () => {
    if (attendanceWindowInterval)
        return;
    const finalize = async () => {
        if (isFinalizingExpiredSessions)
            return;
        isFinalizingExpiredSessions = true;
        try {
            await (0, exports.finalizeExpiredAttendanceSessions)();
        }
        catch (error) {
            console.error('[AttendanceWorker] Failed to finalize expired sessions:', error);
        }
        finally {
            isFinalizingExpiredSessions = false;
        }
    };
    void finalize();
    attendanceWindowInterval = setInterval(() => {
        void finalize();
    }, 30000);
    console.log('[AttendanceWorker] Attendance session timeout worker active (30s tick)');
};
exports.startAttendanceWindowWorker = startAttendanceWindowWorker;
