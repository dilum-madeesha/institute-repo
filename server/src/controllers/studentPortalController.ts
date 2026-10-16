import { Response } from 'express';
import { Enrollment } from '../models/Enrollment';
import { AttendanceRecord } from '../models/AttendanceRecord';
import { Assignment } from '../models/Assignment';
import { AssignmentSubmission } from '../models/AssignmentSubmission';
import { Examination } from '../models/Examination';
import { ExamSubmission } from '../models/ExamSubmission';
import { Lesson } from '../models/Lesson';
import { LessonProgress } from '../models/LessonProgress';
import { Student } from '../models/Student';
import { AuthRequest } from '../middleware/auth';

export const getStudentPortalOverview = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    if (user.role !== 'STUDENT' || !user.studentId) {
      res.status(403).json({ error: 'Access denied. Only registered student accounts can access this portal.' });
      return;
    }

    const sId = user.studentId;
    const studentProfile = await Student.findById(sId).select(
      'firstName lastName displayName studentNumber email phone address'
    );

    const enrollments = await Enrollment.find({ studentId: sId, status: 'ACTIVE' }).populate({
      path: 'classId',
      select: 'name classCode subject teachers description',
      populate: { path: 'teachers', select: 'fullName email' },
    });

    const classIds = enrollments.map((e) => (e.classId as any)?._id).filter(Boolean);

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

    const totalLessons = await Lesson.countDocuments({ classId: { $in: classIds }, isPublished: true });
    const completedProgress = await LessonProgress.find({ studentId: sId, isCompleted: true });
    const completedCount = completedProgress.length;

    const allAssignments = await Assignment.find({ classId: { $in: classIds }, isPublished: true })
      .populate('classId', 'name classCode')
      .sort({ dueDate: 1 });

    const submissions = await AssignmentSubmission.find({ studentId: sId });
    const subMap = new Map(submissions.map((s) => [s.assignmentId.toString(), s]));

    const assignmentList = allAssignments.map((a: any) => {
      const sub = subMap.get(a._id.toString());
      return {
        id: a._id,
        title: a.title,
        description: a.description,
        dueDate: a.dueDate,
        totalMarks: a.totalMarks,
        className: a.classId?.name,
        classCode: a.classId?.classCode,
        isSubmitted: !!sub,
        submissionStatus: sub ? sub.status : 'PENDING',
        marksAwarded: sub ? sub.marksAwarded : null,
        feedback: sub ? sub.feedback : null,
      };
    });

    const allExams = await Examination.find({ classId: { $in: classIds }, isPublished: true })
      .populate('classId', 'name classCode')
      .sort({ examDate: 1 });

    const examSubs = await ExamSubmission.find({ studentId: sId });
    const examSubMap = new Map(examSubs.map((es) => [es.examId.toString(), es]));

    const examList = allExams.map((ex: any) => {
      const es = examSubMap.get(ex._id.toString());
      return {
        id: ex._id,
        title: ex.title,
        description: ex.description,
        examDate: ex.examDate,
        durationMinutes: ex.durationMinutes,
        totalMarks: ex.totalMarks,
        className: ex.classId?.name,
        classCode: ex.classId?.classCode,
        isCompleted: !!es,
        score: es ? es.score : null,
        status: es ? es.status : 'PENDING',
      };
    });

    res.json({
      studentName: user.fullName,
      profile: studentProfile
        ? {
            firstName: studentProfile.firstName,
            lastName: studentProfile.lastName,
            displayName: studentProfile.displayName,
            studentNumber: studentProfile.studentNumber,
            email: user.email,
            phone: studentProfile.phone,
            address: studentProfile.address,
          }
        : { displayName: user.fullName, email: user.email },
      classes: enrollments.map((e: any) => e.classId),
      attendanceStats: {
        presentCount,
        lateCount,
        absentCount,
        excusedCount,
        attendancePercentage,
        recentRecords: attendance.slice(0, 5),
      },
      learningProgress: {
        totalLessons,
        completedLessons: completedCount,
        progressPercentage: totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0,
      },
      assignments: assignmentList,
      exams: examList,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch student portal' });
  }
};
