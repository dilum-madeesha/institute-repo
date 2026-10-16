export type UserRole = 'ADMIN' | 'TEACHER' | 'STUDENT' | 'PARENT';
export type UserStatus = 'ACTIVE' | 'INACTIVE';

export interface User {
  id: string;
  _id?: string;
  fullName: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  studentId?: string | null;
  guardianId?: string | null;
  lastLoginAt?: string | null;
  createdAt?: string;
}

export interface ClassItem {
  _id: string;
  id?: string;
  name: string;
  classCode: string;
  subject: string;
  description?: string;
  academicYear?: string;
  teachers: User[];
  status: 'ACTIVE' | 'INACTIVE';
  enrolledCount?: number;
  sessionCount?: number;
  createdAt: string;
}

export interface Student {
  _id: string;
  id?: string;
  studentNumber?: string;
  firstName: string;
  lastName: string;
  displayName?: string;
  dateOfBirth?: string;
  email?: string;
  phone?: string;
  address?: string;
  status: 'ACTIVE' | 'INACTIVE';
  notes?: string;
  guardians?: any[];
  enrollments?: any[];
  hasActiveGuardianEmail?: boolean;
  createdAt: string;
}

export interface Guardian {
  _id: string;
  fullName: string;
  email: string;
  phone?: string;
  status: 'ACTIVE' | 'INACTIVE';
  linkedStudents?: Array<{
    student: Student;
    relationship: string;
    receivesAttendanceEmails: boolean;
    isPrimaryContact: boolean;
  }>;
}

export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';
export type SessionStatus = 'DRAFT' | 'SUBMITTED' | 'LOCKED';

export interface ClassSession {
  _id: string;
  classId: string | any;
  sessionDate: string;
  startTime?: string;
  endTime?: string;
  title?: string;
  timeZone?: string;
  status: SessionStatus;
  isPublished?: boolean;
  publishedAt?: string | null;
  createdBy?: any;
  submittedBy?: any;
  submittedAt?: string;
  autoFinalizedAt?: string | null;
  stats?: {
    PRESENT: number;
    ABSENT: number;
    LATE: number;
    EXCUSED: number;
    TOTAL: number;
  };
}

export interface AttendanceRecord {
  _id: string;
  classSessionId: string;
  studentId: string;
  status: AttendanceStatus;
  arrivalTime?: string;
  note?: string;
  markedBy?: any;
  markedAt: string;
}

export interface EmailNotification {
  _id: string;
  studentId: any;
  guardianId?: any;
  classSessionId: any;
  attendanceRecordId: string;
  recipientEmail: string;
  recipientName?: string;
  notificationType: 'ABSENCE';
  status: 'PENDING' | 'PROCESSING' | 'SENT' | 'FAILED' | 'SKIPPED' | 'CANCELLED';
  attemptCount: number;
  lastError?: string;
  sentAt?: string;
  createdAt: string;
}

export interface AuditLog {
  _id: string;
  userId?: any;
  action: string;
  entityType: string;
  entityId?: string;
  details?: Record<string, any>;
  ipAddress?: string;
  createdAt: string;
}

export interface LessonAttachment {
  name: string;
  fileUrl: string;
  fileType: string;
  fileSize?: string;
  fileId?: string;
}

export interface Lesson {
  _id: string;
  classId: string | any;
  title: string;
  description?: string;
  videoUrl?: string;
  duration?: string;
  chapter?: string;
  topic?: string;
  attachments: LessonAttachment[];
  order: number;
  isPublished: boolean;
  publicationStatus?: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  publishedAt?: string | null;
  archivedAt?: string | null;
  isCompleted?: boolean;
  createdBy?: any;
  createdAt: string;
}

export interface Assignment {
  _id: string;
  classId: string | any;
  title: string;
  description: string;
  dueDate: string;
  totalMarks: number;
  attachments: Array<{ name: string; fileUrl: string; fileId?: string }>;
  isPublished: boolean;
  publicationStatus: 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'ARCHIVED' | 'CANCELLED';
  targetMode: 'ALL_ENROLLED' | 'SELECTED_STUDENTS';
  targetStudentIds: string[];
  submissionType: 'TEXT' | 'FILE' | 'TEXT_OR_FILE' | 'LINK_OR_TEXT';
  latePolicy: 'ALLOW' | 'REJECT' | 'ACCEPT_FLAG_LATE';
  allowResubmission: boolean;
  maxAttempts?: number | null;
  resubmissionUntil?: string | null;
  publishAt?: string | null;
  publishedAt?: string | null;
  archivedAt?: string | null;
  submissionCount?: number;
  mySubmission?: AssignmentSubmission | null;
  childSubmission?: AssignmentSubmission | null;
  createdBy?: any;
  createdAt: string;
}

export interface AssignmentSubmission {
  _id: string;
  assignmentId: string | any;
  studentId: string | any;
  classId: string | any;
  submissionText: string;
  attachmentUrl?: string;
  submissionFiles?: Array<{ fileId: string; name: string; fileUrl: string }>;
  submittedAt: string;
  status: 'SUBMITTED' | 'GRADED' | 'LATE' | 'RETURNED';
  marksAwarded?: number | null;
  feedback?: string;
  gradeReleasedAt?: string | null;
  attemptNumber?: number;
  attemptHistory?: Array<{
    attemptNumber: number;
    submissionText: string;
    attachmentUrl?: string;
    submissionFiles?: Array<{ fileId: string; name: string; fileUrl: string }>;
    submittedAt: string;
    status: 'SUBMITTED' | 'GRADED' | 'LATE' | 'RETURNED';
    marksAwarded?: number | null;
    feedback?: string;
    gradeReleasedAt?: string | null;
  }>;
  gradedBy?: any;
  gradedAt?: string;
}

export interface ExamQuestion {
  id: string;
  questionText: string;
  questionType: 'MCQ' | 'SHORT';
  options?: string[];
  correctAnswer?: string;
  marks: number;
}

export interface Examination {
  _id: string;
  classId: string | any;
  title: string;
  description?: string;
  examDate: string;
  durationMinutes: number;
  totalMarks: number;
  questions: ExamQuestion[];
  isPublished: boolean;
  submissionCount?: number;
  mySubmission?: ExamSubmission | null;
  childSubmission?: ExamSubmission | null;
  createdBy?: any;
  createdAt: string;
}

export interface ExamSubmission {
  _id: string;
  examId: string | any;
  studentId: string | any;
  classId: string | any;
  score: number;
  status: 'SUBMITTED' | 'GRADED';
  feedback?: string;
  submittedAt: string;
  gradedAt?: string;
  answers?: Array<{
    questionId: string;
    answerText: string;
    isCorrect?: boolean;
    marksAwarded?: number;
  }>;
}

export interface Announcement {
  _id: string;
  classId?: any;
  title: string;
  content: string;
  priority: 'NORMAL' | 'HIGH' | 'URGENT';
  targetRoles: string[];
  createdBy?: any;
  createdAt: string;
}

export interface AttendanceOverviewItem {
  day: string;
  present: number;
  absent: number;
  late: number;
}

export interface ClassDistributionItem {
  name: string;
  count: number;
  percentage: number;
  color: string;
}

export interface UpcomingEventItem {
  id: string;
  date: string;
  title: string;
  time: string;
  type: string;
  badgeColor: string;
}

export interface DashboardStats {
  role: UserRole;
  totalActiveStudents?: number;
  totalActiveClasses?: number;
  totalActiveTeachers?: number;
  totalActiveGuardians?: number;
  pendingNotificationsCount?: number;
  todaySessionsCount?: number;
  pendingDraftSessions?: number;
  failedNotificationsCount?: number;
  skippedNotificationsCount?: number;
  attendanceOverview?: AttendanceOverviewItem[];
  classDistribution?: ClassDistributionItem[];
  upcomingEvents?: UpcomingEventItem[];
  recentAuditLogs?: any[];
  systemStatus?: {
    database: string;
    emailService: string;
    fileStorage: string;
    server: string;
  };
  // Teacher stats
  assignedClassesCount?: number;
  missingGuardiansCount?: number;
  recentSessions?: any[];
  totalAssignments?: number;
  pendingGradingCount?: number;
  // Student stats
  enrolledClassesCount?: number;
  attendancePercentage?: number;
  absentCount?: number;
  pendingAssignmentsCount?: number;
  pendingExamsCount?: number;
  completedLessonsCount?: number;
  // Parent stats
  linkedChildrenCount?: number;
  avgAttendanceRate?: number;
  absentAlertsCount?: number;
}
