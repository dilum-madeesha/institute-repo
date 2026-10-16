import { Response } from 'express';
import { StudentGuardian } from '../models/StudentGuardian';
import { Student } from '../models/Student';
import { Enrollment } from '../models/Enrollment';
import { AttendanceRecord } from '../models/AttendanceRecord';
import { AssignmentSubmission } from '../models/AssignmentSubmission';
import { ExamSubmission } from '../models/ExamSubmission';
import { LessonProgress } from '../models/LessonProgress';
import { Lesson } from '../models/Lesson';
import { AuthRequest } from '../middleware/auth';

export const getParentDashboard = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    if (user.role !== 'PARENT' || !user.guardianId) {
      res.status(403).json({ error: 'Access denied. Only registered parent accounts can access this portal.' });
      return;
    }

    // 1. Fetch strictly linked children
    const links = await StudentGuardian.find({ guardianId: user.guardianId }).populate('studentId');
    const linkedStudents = links
      .map((l) => ({
        student: l.studentId as any,
        relationship: l.relationship,
        receivesAttendanceEmails: l.receivesAttendanceEmails,
        isPrimaryContact: l.isPrimaryContact,
      }))
      .filter((item) => item.student && item.student.status === 'ACTIVE');

    const childrenOverview: any[] = [];

    for (const item of linkedStudents) {
      const student = item.student;
      const sId = student._id;

      // Enrollments
      const enrollments = await Enrollment.find({ studentId: sId, status: 'ACTIVE' })
        .populate({
          path: 'classId',
          select: 'name classCode subject teachers',
          populate: { path: 'teachers', select: 'fullName email' },
        });

      const classIds = enrollments.map((e) => (e.classId as any)?._id).filter(Boolean);

      // Attendance records
      const attendance = await AttendanceRecord.find({ studentId: sId })
        .populate({
          path: 'classSessionId',
          populate: { path: 'classId', select: 'name classCode' },
        })
        .sort({ markedAt: -1 });

      const presentCount = attendance.filter((r) => r.status === 'PRESENT').length;
      const lateCount = attendance.filter((r) => r.status === 'LATE').length;
      const absentCount = attendance.filter((r) => r.status === 'ABSENT').length;
      const excusedCount = attendance.filter((r) => r.status === 'EXCUSED').length;

      const denominator = presentCount + lateCount + absentCount;
      const attendancePercentage =
        denominator > 0 ? Math.round(((presentCount + lateCount) / denominator) * 1000) / 10 : 100;

      // Recent absences
      const recentAbsences = attendance
        .filter((r) => r.status === 'ABSENT')
        .slice(0, 5)
        .map((r: any) => ({
          date: r.classSessionId?.sessionDate,
          className: r.classSessionId?.classId?.name,
          note: r.note,
        }));

      // Recent assignment submissions & marks
      const submissions = await AssignmentSubmission.find({ studentId: sId })
        .populate('assignmentId', 'title totalMarks dueDate')
        .populate('classId', 'name classCode')
        .sort({ submittedAt: -1 })
        .limit(6);

      // Recent exam scores
      const examSubmissions = await ExamSubmission.find({ studentId: sId })
        .populate('examId', 'title totalMarks examDate')
        .populate('classId', 'name classCode')
        .sort({ submittedAt: -1 })
        .limit(6);

      // Lesson completion
      const totalLessonsInClasses = await Lesson.countDocuments({ classId: { $in: classIds } });
      const completedLessons = await LessonProgress.countDocuments({
        studentId: sId,
        isCompleted: true,
      });

      childrenOverview.push({
        student: {
          id: student._id,
          name: student.displayName || `${student.firstName} ${student.lastName}`,
          studentNumber: student.studentNumber,
          relationship: item.relationship,
          receivesAttendanceEmails: item.receivesAttendanceEmails,
          isPrimaryContact: item.isPrimaryContact,
        },
        attendanceStats: {
          presentCount,
          lateCount,
          absentCount,
          excusedCount,
          attendancePercentage,
          recentAbsences,
        },
        learningProgress: {
          completedLessons,
          totalLessons: totalLessonsInClasses,
          progressPercentage:
            totalLessonsInClasses > 0
              ? Math.round((completedLessons / totalLessonsInClasses) * 100)
              : 0,
        },
        enrolledClasses: enrollments.map((e: any) => ({
          id: e.classId?._id,
          name: e.classId?.name,
          classCode: e.classId?.classCode,
          subject: e.classId?.subject,
          teachers: e.classId?.teachers || [],
        })),
        recentAssignments: submissions.map((s: any) => ({
          id: s._id,
          title: s.assignmentId?.title,
          className: s.classId?.name,
          status: s.status,
          marksAwarded: s.marksAwarded,
          totalMarks: s.assignmentId?.totalMarks,
          feedback: s.feedback,
          submittedAt: s.submittedAt,
        })),
        recentExams: examSubmissions.map((ex: any) => ({
          id: ex._id,
          title: ex.examId?.title,
          className: ex.classId?.name,
          score: ex.score,
          totalMarks: ex.examId?.totalMarks,
          submittedAt: ex.submittedAt,
        })),
      });
    }

    res.json({
      guardianName: user.fullName,
      children: childrenOverview,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch parent dashboard' });
  }
};
