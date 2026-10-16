import { Response } from 'express';
import mongoose from 'mongoose';
import { ClassSession } from '../models/ClassSession';
import { AttendanceRecord, AttendanceStatus } from '../models/AttendanceRecord';
import { AttendanceChangeLog } from '../models/AttendanceChangeLog';
import { Enrollment } from '../models/Enrollment';
import { ClassModel } from '../models/Class';
import { Student } from '../models/Student';
import { EmailNotification } from '../models/EmailNotification';
import { AuthRequest } from '../middleware/auth';
import { canAccessClass } from '../middleware/role';
import { queueAbsenceNotificationsForSession } from '../services/notificationWorker';
import { logAudit } from '../services/auditService';
import {
  finalizeExpiredAttendanceSessions,
  getAttendanceWindow,
  getAttendanceWindowState,
  isValidTimeZone,
} from '../services/attendanceWindow';

export const getClassSessions = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const classId = req.params.id as string;
    const hasAccess = await canAccessClass(req.user!._id.toString(), req.user!.role, classId);
    if (!hasAccess) {
      res.status(403).json({ error: 'Access denied.' });
      return;
    }

    const sessions = await ClassSession.find({ classId })
      .populate('createdBy', 'fullName')
      .populate('submittedBy', 'fullName')
      .sort({ sessionDate: -1, createdAt: -1 });

    const sessionIds = sessions.map((s) => s._id);

    // Aggregate counts for each session
    const recordCounts = await AttendanceRecord.aggregate([
      { $match: { classSessionId: { $in: sessionIds } } },
      {
        $group: {
          _id: { session: '$classSessionId', status: '$status' },
          count: { $sum: 1 },
        },
      },
    ]);

    const countMap = new Map<string, Record<string, number>>();
    recordCounts.forEach((r) => {
      const sId = r._id.session.toString();
      if (!countMap.has(sId)) {
        countMap.set(sId, { PRESENT: 0, ABSENT: 0, LATE: 0, EXCUSED: 0, TOTAL: 0 });
      }
      const item = countMap.get(sId)!;
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
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch sessions' });
  }
};

export const createClassSession = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const classId = req.params.id as string;
    const hasAccess = await canAccessClass(req.user!._id.toString(), req.user!.role, classId);
    if (!hasAccess) {
      res.status(403).json({ error: 'Access denied.' });
      return;
    }

    const { sessionDate, startTime, endTime, title, timeZone } = req.body;

    if (!sessionDate) {
      res.status(400).json({ error: 'Session date is required.' });
      return;
    }
    if (Number.isNaN(new Date(sessionDate).getTime())) {
      res.status(400).json({ error: 'A valid session date is required.' });
      return;
    }
    if (timeZone !== undefined && !isValidTimeZone(String(timeZone))) {
      res.status(400).json({ error: 'A valid session time zone is required.' });
      return;
    }
    if (
      (startTime !== undefined && !/^([01]\d|2[0-3]):[0-5]\d$/.test(String(startTime))) ||
      (endTime !== undefined && !/^([01]\d|2[0-3]):[0-5]\d$/.test(String(endTime)))
    ) {
      res.status(400).json({ error: 'Session start and end times must use HH:MM format.' });
      return;
    }

    const sessionDateValue = new Date(sessionDate);
    const sessionTimeZone = timeZone || 'Asia/Colombo';
    const { start, end } = getAttendanceWindow({
      sessionDate: sessionDateValue,
      startTime,
      endTime,
      timeZone: sessionTimeZone,
    });
    if (start >= end) {
      res.status(400).json({ error: 'Session end time must be after the start time.' });
      return;
    }
    const session = await ClassSession.create({
      classId,
      sessionDate: sessionDateValue,
      startTime: startTime ? startTime.trim() : undefined,
      endTime: endTime ? endTime.trim() : undefined,
      title: title ? title.trim() : undefined,
      timeZone: sessionTimeZone,
      status: 'DRAFT',
      createdBy: req.user!._id,
    });

    await logAudit({
      userId: req.user!._id,
      action: 'SESSION_CREATED',
      entityType: 'ClassSession',
      entityId: session._id.toString(),
      details: { classId, date: session.sessionDate },
      ipAddress: req.ip,
    });

    res.status(201).json(session);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to create session' });
  }
};

export const updateClassSession = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id: classId, sessionId } = req.params;
    const session = await ClassSession.findOne({ _id: sessionId, classId });
    if (!session) {
      res.status(404).json({ error: 'Attendance session not found.' });
      return;
    }

    const { sessionDate, startTime, endTime, title } = req.body;
    if (sessionDate !== undefined) {
      const parsedDate = new Date(sessionDate);
      if (Number.isNaN(parsedDate.getTime())) {
        res.status(400).json({ error: 'A valid session date is required.' });
        return;
      }
      session.sessionDate = parsedDate;
    }
    if (startTime !== undefined) {
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(String(startTime))) {
        res.status(400).json({ error: 'Session start time must use HH:MM format.' });
        return;
      }
      session.startTime = String(startTime).trim();
    }
    if (endTime !== undefined) {
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(String(endTime))) {
        res.status(400).json({ error: 'Session end time must use HH:MM format.' });
        return;
      }
      session.endTime = String(endTime).trim();
    }
    if (title !== undefined) session.title = String(title).trim();

    const { start, end } = getAttendanceWindow(session);
    if (start >= end) {
      res.status(400).json({ error: 'Session end time must be after the start time.' });
      return;
    }
    await session.save();
    await logAudit({
      userId: req.user!._id,
      action: 'SESSION_UPDATED',
      entityType: 'ClassSession',
      entityId: session._id.toString(),
      details: { classId, date: session.sessionDate, title: session.title },
      ipAddress: req.ip,
    });

    res.json(session);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to update session' });
  }
};

export const deleteClassSession = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id: classId, sessionId } = req.params;
    const session = await ClassSession.findOne({ _id: sessionId, classId });
    if (!session) {
      res.status(404).json({ error: 'Attendance session not found.' });
      return;
    }

    const records = await AttendanceRecord.find({ classSessionId: session._id }).select('_id');
    const attendanceRecordIds = records.map((record) => record._id);

    await Promise.all([
      EmailNotification.deleteMany({
        $or: [
          { classSessionId: session._id },
          { attendanceRecordId: { $in: attendanceRecordIds } },
        ],
      }),
      AttendanceChangeLog.deleteMany({
        $or: [
          { classSessionId: session._id },
          { attendanceRecordId: { $in: attendanceRecordIds } },
        ],
      }),
      AttendanceRecord.deleteMany({ classSessionId: session._id }),
    ]);
    await session.deleteOne();

    await logAudit({
      userId: req.user!._id,
      action: 'SESSION_DELETED',
      entityType: 'ClassSession',
      entityId: session._id.toString(),
      details: { classId, date: session.sessionDate, title: session.title },
      ipAddress: req.ip,
    });

    res.json({ message: 'Attendance session and its related records were deleted.' });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to delete attendance session' });
  }
};

export const getSessionAttendance = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { sessionId } = req.params;
    const session = await ClassSession.findById(sessionId)
      .populate('classId', 'name classCode subject teachers')
      .populate('createdBy', 'fullName')
      .populate('submittedBy', 'fullName');

    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    const classObj = session.classId as any;
    const hasAccess = await canAccessClass(req.user!._id.toString(), req.user!.role, classObj._id.toString());
    if (!hasAccess) {
      res.status(403).json({ error: 'Access denied.' });
      return;
    }

    // Find students enrolled in the class as of the session date
    const sessionDate = new Date(session.sessionDate);
    const enrollments = await Enrollment.find({
      classId: classObj._id,
      startDate: { $lte: sessionDate },
      $or: [{ endDate: null }, { endDate: { $gte: sessionDate } }],
      status: { $in: ['ACTIVE', 'COMPLETED'] },
    }).populate('studentId');

    const enrolledStudents = enrollments
      .map((e) => e.studentId as any)
      .filter((s) => s && s.status === 'ACTIVE');

    // Existing attendance records
    const records = await AttendanceRecord.find({ classSessionId: session._id });
    const recordMap = new Map<string, any>(records.map((r) => [r.studentId.toString(), r]));

    // Notification statuses
    const notifications = await EmailNotification.find({ classSessionId: session._id });
    const notifMap = new Map<string, any[]>();
    notifications.forEach((n) => {
      const sId = n.studentId.toString();
      if (!notifMap.has(sId)) notifMap.set(sId, []);
      notifMap.get(sId)!.push(n);
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
        timeZone: session.timeZone,
        status: session.status,
        submittedAt: session.submittedAt,
        submittedBy: session.submittedBy,
        autoFinalizedAt: session.autoFinalizedAt,
      },
      roster: studentRoster,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch session attendance' });
  }
};

export const saveDraftAttendance = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { sessionId } = req.params;
    const { items } = req.body; // array of { studentId, status, arrivalTime, note }

    if (!Array.isArray(items)) {
      res.status(400).json({ error: 'Expected items array with attendance records' });
      return;
    }

    const session = await ClassSession.findById(sessionId);
    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    if (session.status !== 'DRAFT') {
      res.status(400).json({ error: 'This attendance session is finalized and can no longer be edited.' });
      return;
    }

    const hasAccess = await canAccessClass(req.user!._id.toString(), req.user!.role, session.classId.toString());
    if (!hasAccess) {
      res.status(403).json({ error: 'Access denied.' });
      return;
    }

    for (const item of items) {
      if (!item.studentId || !item.status) continue;

      await AttendanceRecord.findOneAndUpdate(
        { classSessionId: session._id, studentId: item.studentId },
        {
          status: item.status,
          arrivalTime: item.arrivalTime || null,
          note: item.note || null,
          markedBy: req.user!._id,
          markedAt: new Date(),
        },
        { upsert: true, new: true }
      );
    }

    res.json({ message: 'Attendance draft saved successfully.' });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to save attendance draft' });
  }
};

export const submitAttendance = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { sessionId } = req.params;
    const { items, allowPartial } = req.body;

    const session = await ClassSession.findById(sessionId);
    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    if (session.status !== 'DRAFT') {
      res.status(400).json({ error: 'This attendance session is finalized and can no longer be submitted.' });
      return;
    }

    const hasAccess = await canAccessClass(req.user!._id.toString(), req.user!.role, session.classId.toString());
    if (!hasAccess) {
      res.status(403).json({ error: 'Access denied.' });
      return;
    }
    if (getAttendanceWindowState(session) === 'CLOSED') {
      await finalizeExpiredAttendanceSessions();
      res.status(409).json({ error: 'The attendance session has timed out and was finalized automatically.' });
      return;
    }

    // Save/update any provided items
    if (Array.isArray(items)) {
      for (const item of items) {
        if (!item.studentId || !item.status) continue;
        await AttendanceRecord.findOneAndUpdate(
          { classSessionId: session._id, studentId: item.studentId },
          {
            status: item.status,
            arrivalTime: item.arrivalTime || null,
            note: item.note || null,
            markedBy: req.user!._id,
            markedAt: new Date(),
          },
          { upsert: true, new: true }
        );
      }
    }

    // Verify all enrolled students are marked
    const sessionDate = new Date(session.sessionDate);
    const enrollments = await Enrollment.find({
      classId: session.classId,
      startDate: { $lte: sessionDate },
      $or: [{ endDate: null }, { endDate: { $gte: sessionDate } }],
      status: { $in: ['ACTIVE', 'COMPLETED'] },
    }).populate('studentId', 'firstName lastName displayName studentNumber status');

    const enrolledStudents = enrollments
      .map((e) => e.studentId as any)
      .filter((s) => s && s.status === 'ACTIVE');

    const recorded = await AttendanceRecord.find({ classSessionId: session._id });
    const markedStudentIds = new Set(recorded.map((r) => r.studentId.toString()));

    const unmarkedStudents = enrolledStudents.filter(
      (s) => !markedStudentIds.has(s._id.toString())
    );

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
    session.submittedBy = req.user!._id;
    session.submittedAt = new Date();
    await session.save();

    await logAudit({
      userId: req.user!._id,
      action: 'ATTENDANCE_SUBMITTED',
      entityType: 'ClassSession',
      entityId: session._id.toString(),
      details: { classId: session.classId, totalMarked: recorded.length },
      ipAddress: req.ip,
    });

    // Queue parent absence email notifications
    await queueAbsenceNotificationsForSession(session._id, req.user!._id);

    res.json({
      message: 'Attendance finalized and submitted successfully. Absence notifications queued.',
      session,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to submit attendance' });
  }
};

export const correctAttendanceRecord = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { attendanceId } = req.params;
    const { newStatus, reason, note, arrivalTime } = req.body;

    if (!newStatus || !reason || !reason.trim()) {
      res.status(400).json({ error: 'Both new status and an explanation reason are required for corrections.' });
      return;
    }

    const record = await AttendanceRecord.findById(attendanceId);
    if (!record) {
      res.status(404).json({ error: 'Attendance record not found' });
      return;
    }

    const session = await ClassSession.findById(record.classSessionId);
    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    const hasAccess = await canAccessClass(req.user!._id.toString(), req.user!.role, session.classId.toString());
    if (!hasAccess) {
      res.status(403).json({ error: 'Access denied. You cannot edit records for this class.' });
      return;
    }

    const oldStatus = record.status;
    record.status = newStatus as AttendanceStatus;
    if (note !== undefined) record.note = note.trim();
    if (arrivalTime !== undefined) record.arrivalTime = arrivalTime.trim();
    await record.save();

    // Log in change history
    await AttendanceChangeLog.create({
      attendanceRecordId: record._id,
      classSessionId: session._id,
      studentId: record.studentId,
      oldStatus,
      newStatus,
      reason: reason.trim(),
      changedBy: req.user!._id,
      changedAt: new Date(),
    });

    await logAudit({
      userId: req.user!._id,
      action: 'ATTENDANCE_CORRECTED',
      entityType: 'AttendanceRecord',
      entityId: record._id.toString(),
      details: { oldStatus, newStatus, reason: reason.trim() },
      ipAddress: req.ip,
    });

    // If new status is ABSENT and session was submitted, queue notification
    if (newStatus === 'ABSENT' && session.status === 'SUBMITTED') {
      await queueAbsenceNotificationsForSession(session._id, req.user!._id);
    }

    // If corrected from ABSENT to something else, cancel any pending notification
    if (oldStatus === 'ABSENT' && newStatus !== 'ABSENT') {
      await EmailNotification.updateMany(
        { attendanceRecordId: record._id, status: 'PENDING' },
        { status: 'CANCELLED', lastError: `Cancelled due to attendance correction to ${newStatus}` }
      );
    }

    res.json({ message: 'Attendance record corrected successfully.', record });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to correct record' });
  }
};

export const getRecordChangeLogs = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { attendanceId } = req.params;
    const logs = await AttendanceChangeLog.find({ attendanceRecordId: attendanceId })
      .populate('changedBy', 'fullName')
      .sort({ changedAt: -1 });

    res.json(logs);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch change history' });
  }
};
