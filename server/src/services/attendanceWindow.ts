import { ClassSession, IClassSession } from '../models/ClassSession';
import { AttendanceRecord } from '../models/AttendanceRecord';
import { Enrollment } from '../models/Enrollment';
import { logAudit } from './auditService';
import { queueAbsenceNotificationsForSession } from './notificationWorker';

const DEFAULT_TIME_ZONE = 'Asia/Colombo';

export type AttendanceWindowState = 'UPCOMING' | 'OPEN' | 'CLOSED';

const localTimeToUtc = (date: string, time: string, timeZone: string): Date => {
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
    const representedTimestamp = Date.UTC(
      Number(values.year),
      Number(values.month) - 1,
      Number(values.day),
      Number(values.hour),
      Number(values.minute),
      Number(values.second)
    );
    timestamp = localTimestamp - (representedTimestamp - timestamp);
  }

  return new Date(timestamp);
};

export const isValidTimeZone = (timeZone: string): boolean => {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone }).format();
    return true;
  } catch {
    return false;
  }
};

export const getAttendanceWindow = (
  session: Pick<IClassSession, 'sessionDate' | 'startTime' | 'endTime' | 'timeZone'>
) => {
  const date = session.sessionDate.toISOString().slice(0, 10);
  const timeZone = session.timeZone || DEFAULT_TIME_ZONE;
  const start = localTimeToUtc(date, session.startTime || '00:00', timeZone);
  const end = localTimeToUtc(date, session.endTime || '23:59', timeZone);

  return { start, end };
};

export const getAttendanceWindowState = (
  session: IClassSession,
  now = new Date()
): AttendanceWindowState => {
  const { start, end } = getAttendanceWindow(session);
  if (now < start) return 'UPCOMING';
  if (now < end) return 'OPEN';
  return 'CLOSED';
};

export const finalizeExpiredAttendanceSessions = async (): Promise<void> => {
  const now = new Date();
  const draftSessions = await ClassSession.find({
    status: 'DRAFT',
    $or: [{ isPublished: true }, { isPublished: { $exists: false } }],
  });

  for (const session of draftSessions) {
    const { end } = getAttendanceWindow(session);
    if (now < end) continue;

    const sessionDate = new Date(session.sessionDate);
    const enrollments = await Enrollment.find({
      classId: session.classId,
      startDate: { $lte: sessionDate },
      $or: [{ endDate: null }, { endDate: { $gte: sessionDate } }],
      status: { $in: ['ACTIVE', 'COMPLETED'] },
    }).populate('studentId', '_id status');
    const studentIds = enrollments
      .map((enrollment) => enrollment.studentId as any)
      .filter((student) => student && student.status === 'ACTIVE')
      .map((student) => student._id);

    const markedRecords = await AttendanceRecord.find({
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
              status: 'ABSENT' as const,
              markedBy: session.createdBy,
              markedAt: end,
            },
          },
          upsert: true,
        },
      }));

    if (absentRecords.length > 0) {
      await AttendanceRecord.bulkWrite(absentRecords);
    }

    const finalizedSession = await ClassSession.findOneAndUpdate(
      { _id: session._id, status: 'DRAFT' },
      {
        $set: {
          status: 'SUBMITTED',
          submittedAt: now,
          autoFinalizedAt: now,
        },
      },
      { new: true }
    );

    if (!finalizedSession) continue;

    await logAudit({
      userId: session.createdBy,
      action: 'ATTENDANCE_AUTO_FINALIZED',
      entityType: 'ClassSession',
      entityId: session._id.toString(),
      details: { classId: session.classId, absentCount: absentRecords.length },
    });
    await queueAbsenceNotificationsForSession(session._id, session.createdBy);
  }
};

let attendanceWindowInterval: NodeJS.Timeout | null = null;
let isFinalizingExpiredSessions = false;

export const startAttendanceWindowWorker = (): void => {
  if (attendanceWindowInterval) return;

  const finalize = async () => {
    if (isFinalizingExpiredSessions) return;
    isFinalizingExpiredSessions = true;
    try {
      await finalizeExpiredAttendanceSessions();
    } catch (error) {
      console.error('[AttendanceWorker] Failed to finalize expired sessions:', error);
    } finally {
      isFinalizingExpiredSessions = false;
    }
  };

  void finalize();
  attendanceWindowInterval = setInterval(() => {
    void finalize();
  }, 30000);
  console.log('[AttendanceWorker] Attendance session timeout worker active (30s tick)');
};
