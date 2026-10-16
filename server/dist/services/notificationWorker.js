"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startNotificationWorker = exports.retryNotificationManually = exports.processPendingNotifications = exports.queueAbsenceNotificationsForSession = void 0;
const EmailNotification_1 = require("../models/EmailNotification");
const AttendanceRecord_1 = require("../models/AttendanceRecord");
const ClassSession_1 = require("../models/ClassSession");
const Class_1 = require("../models/Class");
const Student_1 = require("../models/Student");
const StudentGuardian_1 = require("../models/StudentGuardian");
const emailService_1 = require("./emailService");
const auditService_1 = require("./auditService");
const queueAbsenceNotificationsForSession = async (sessionId, reqUserId) => {
    const session = await ClassSession_1.ClassSession.findById(sessionId);
    if (!session)
        return;
    const classObj = await Class_1.ClassModel.findById(session.classId).populate('teachers', 'fullName email');
    if (!classObj)
        return;
    // Retrieve absent attendance records for this session
    const absentRecords = await AttendanceRecord_1.AttendanceRecord.find({
        classSessionId: session._id,
        status: 'ABSENT',
    });
    const teacher = (classObj.teachers && classObj.teachers[0]);
    const teacherName = teacher?.fullName;
    const teacherEmail = teacher?.email;
    const sessionDateFormatted = new Date(session.sessionDate).toLocaleDateString('en-US', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    });
    for (const record of absentRecords) {
        const student = await Student_1.Student.findById(record.studentId);
        if (!student)
            continue;
        const studentName = student.displayName || `${student.firstName} ${student.lastName}`;
        // Find linked guardians who opted in to attendance emails
        const studentGuardians = await StudentGuardian_1.StudentGuardian.find({
            studentId: student._id,
            receivesAttendanceEmails: true,
        }).populate('guardianId');
        const activeGuardians = studentGuardians.filter((sg) => sg.guardianId && sg.guardianId.status === 'ACTIVE' && sg.guardianId.email);
        if (activeGuardians.length === 0) {
            // Create a SKIPPED record so staff and reports clearly see missing parent contact
            const dedupKey = `${session._id}_${student._id}_NO_EMAIL_ABSENCE`;
            const existing = await EmailNotification_1.EmailNotification.findOne({ dedupKey });
            if (!existing) {
                await EmailNotification_1.EmailNotification.create({
                    studentId: student._id,
                    guardianId: null,
                    classSessionId: session._id,
                    attendanceRecordId: record._id,
                    recipientEmail: 'unassigned@no-guardian.local',
                    recipientName: 'No Active Guardian with Email',
                    notificationType: 'ABSENCE',
                    status: 'SKIPPED',
                    attemptCount: 0,
                    lastError: 'No active parent/guardian email linked to student.',
                    dedupKey,
                });
            }
            continue;
        }
        for (const sg of activeGuardians) {
            const guardian = sg.guardianId;
            const recipientEmail = guardian.email.toLowerCase().trim();
            const dedupKey = `${session._id}_${student._id}_${recipientEmail}_ABSENCE`;
            // Check if duplicate job already exists
            const existing = await EmailNotification_1.EmailNotification.findOne({ dedupKey });
            if (existing)
                continue;
            await EmailNotification_1.EmailNotification.create({
                studentId: student._id,
                guardianId: guardian._id,
                classSessionId: session._id,
                attendanceRecordId: record._id,
                recipientEmail,
                recipientName: guardian.fullName,
                notificationType: 'ABSENCE',
                status: 'PENDING',
                attemptCount: 0,
                dedupKey,
            });
        }
    }
    // Trigger immediate dispatch in background
    setImmediate(() => {
        (0, exports.processPendingNotifications)().catch((err) => console.error('[NotificationWorker] Error processing pending:', err));
    });
};
exports.queueAbsenceNotificationsForSession = queueAbsenceNotificationsForSession;
const processPendingNotifications = async () => {
    const pendingList = await EmailNotification_1.EmailNotification.find({
        status: { $in: ['PENDING', 'PROCESSING'] },
        $or: [{ nextAttemptAt: null }, { nextAttemptAt: { $lte: new Date() } }],
    })
        .limit(20)
        .populate('studentId', 'firstName lastName displayName')
        .populate('guardianId', 'fullName email')
        .populate('classSessionId');
    for (const notif of pendingList) {
        try {
            notif.status = 'PROCESSING';
            notif.attemptCount += 1;
            await notif.save();
            const session = await ClassSession_1.ClassSession.findById(notif.classSessionId);
            if (!session) {
                notif.status = 'SKIPPED';
                notif.lastError = 'Class session no longer exists';
                await notif.save();
                continue;
            }
            const classObj = await Class_1.ClassModel.findById(session.classId).populate('teachers', 'fullName email');
            const student = notif.studentId;
            const guardian = notif.guardianId;
            const studentName = student?.displayName || `${student?.firstName} ${student?.lastName}`;
            const guardianName = guardian?.fullName || notif.recipientName || 'Parent / Guardian';
            const teacher = (classObj?.teachers && classObj.teachers[0]);
            const sessionDateFormatted = new Date(session.sessionDate).toLocaleDateString('en-US', {
                weekday: 'short',
                year: 'numeric',
                month: 'short',
                day: 'numeric',
            });
            const result = await (0, emailService_1.sendAbsenceNotificationEmail)({
                recipientEmail: notif.recipientEmail,
                guardianName,
                studentName,
                className: classObj?.name || 'Class',
                sessionDate: sessionDateFormatted,
                teacherName: teacher?.fullName,
                teacherEmail: teacher?.email,
            });
            notif.status = 'SENT';
            notif.providerMessageId = result.messageId;
            notif.sentAt = new Date();
            notif.lastError = null;
            await notif.save();
            console.log(`[NotificationWorker] Sent absence email to ${notif.recipientEmail} for student ${studentName}`);
        }
        catch (err) {
            console.error(`[NotificationWorker] Failed to send email to ${notif.recipientEmail}:`, err.message);
            const maxRetries = 3;
            if (notif.attemptCount < maxRetries) {
                notif.status = 'PENDING';
                // Exponential backoff: 2 min, 4 min, 8 min
                const delayMinutes = Math.pow(2, notif.attemptCount);
                notif.nextAttemptAt = new Date(Date.now() + delayMinutes * 60 * 1000);
                notif.lastError = `Attempt ${notif.attemptCount} failed: ${err.message || 'Unknown error'}`;
            }
            else {
                notif.status = 'FAILED';
                notif.lastError = `Max retries (${maxRetries}) reached. Error: ${err.message || 'Unknown error'}`;
            }
            await notif.save();
        }
    }
};
exports.processPendingNotifications = processPendingNotifications;
const retryNotificationManually = async (notificationId, userId) => {
    const notif = await EmailNotification_1.EmailNotification.findById(notificationId);
    if (!notif) {
        throw new Error('Notification not found');
    }
    notif.status = 'PENDING';
    notif.nextAttemptAt = new Date();
    notif.lastError = `Manual retry requested by user at ${new Date().toISOString()}`;
    await notif.save();
    await (0, auditService_1.logAudit)({
        userId,
        action: 'NOTIFICATION_MANUAL_RETRY',
        entityType: 'EmailNotification',
        entityId: notif._id.toString(),
        details: { recipientEmail: notif.recipientEmail },
    });
    setImmediate(() => {
        (0, exports.processPendingNotifications)().catch((err) => console.error('[NotificationWorker] Manual retry processing error:', err));
    });
    return notif;
};
exports.retryNotificationManually = retryNotificationManually;
// Start background recurring worker (every 60 seconds)
let workerInterval = null;
const startNotificationWorker = () => {
    if (workerInterval)
        return;
    workerInterval = setInterval(() => {
        (0, exports.processPendingNotifications)().catch((err) => console.error('[NotificationWorker] Periodic runner error:', err));
    }, 60000);
    console.log('[NotificationWorker] Background notification worker active (60s tick)');
};
exports.startNotificationWorker = startNotificationWorker;
