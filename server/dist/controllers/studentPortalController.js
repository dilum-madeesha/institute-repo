"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getStudentPortalOverview = void 0;
const Enrollment_1 = require("../models/Enrollment");
const AttendanceRecord_1 = require("../models/AttendanceRecord");
const Assignment_1 = require("../models/Assignment");
const AssignmentSubmission_1 = require("../models/AssignmentSubmission");
const Examination_1 = require("../models/Examination");
const ExamSubmission_1 = require("../models/ExamSubmission");
const Lesson_1 = require("../models/Lesson");
const LessonProgress_1 = require("../models/LessonProgress");
const getStudentPortalOverview = async (req, res) => {
    try {
        const user = req.user;
        if (user.role !== 'STUDENT' || !user.studentId) {
            res.status(403).json({ error: 'Access denied. Only registered student accounts can access this portal.' });
            return;
        }
        const sId = user.studentId;
        // 1. Enrolled classes
        const enrollments = await Enrollment_1.Enrollment.find({ studentId: sId, status: 'ACTIVE' }).populate({
            path: 'classId',
            select: 'name classCode subject teachers description',
            populate: { path: 'teachers', select: 'fullName email' },
        });
        const classIds = enrollments.map((e) => e.classId?._id).filter(Boolean);
        // 2. Personal attendance
        const attendance = await AttendanceRecord_1.AttendanceRecord.find({ studentId: sId })
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
        const attendancePercentage = denominator > 0 ? Math.round(((presentCount + lateCount) / denominator) * 1000) / 10 : 100;
        // 3. Lessons completion
        const totalLessons = await Lesson_1.Lesson.countDocuments({ classId: { $in: classIds }, isPublished: true });
        const completedProgress = await LessonProgress_1.LessonProgress.find({ studentId: sId, isCompleted: true });
        const completedCount = completedProgress.length;
        // 4. Assignments & submissions
        const allAssignments = await Assignment_1.Assignment.find({ classId: { $in: classIds }, isPublished: true })
            .populate('classId', 'name classCode')
            .sort({ dueDate: 1 });
        const submissions = await AssignmentSubmission_1.AssignmentSubmission.find({ studentId: sId });
        const subMap = new Map(submissions.map((s) => [s.assignmentId.toString(), s]));
        const assignmentList = allAssignments.map((a) => {
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
        // 5. Examinations & submissions
        const allExams = await Examination_1.Examination.find({ classId: { $in: classIds }, isPublished: true })
            .populate('classId', 'name classCode')
            .sort({ examDate: 1 });
        const examSubs = await ExamSubmission_1.ExamSubmission.find({ studentId: sId });
        const examSubMap = new Map(examSubs.map((es) => [es.examId.toString(), es]));
        const examList = allExams.map((ex) => {
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
            classes: enrollments.map((e) => e.classId),
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
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Failed to fetch student portal' });
    }
};
exports.getStudentPortalOverview = getStudentPortalOverview;
