"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getStudentPortalOverview = void 0;
const Enrollment_1 = require("../models/Enrollment");
const AttendanceRecord_1 = require("../models/AttendanceRecord");
const ClassSession_1 = require("../models/ClassSession");
const Assignment_1 = require("../models/Assignment");
const AssignmentSubmission_1 = require("../models/AssignmentSubmission");
const Examination_1 = require("../models/Examination");
const ExamSubmission_1 = require("../models/ExamSubmission");
const Lesson_1 = require("../models/Lesson");
const LessonProgress_1 = require("../models/LessonProgress");
const Student_1 = require("../models/Student");
const attendanceWindow_1 = require("../services/attendanceWindow");
const enrollmentAccess_1 = require("../services/enrollmentAccess");
const getStudentPortalOverview = async (req, res) => {
    try {
        const user = req.user;
        if (user.role !== 'STUDENT') {
            res.status(403).json({ error: 'Access denied. Only student accounts can access this portal.' });
            return;
        }
        if (!user.studentId) {
            res.status(403).json({
                error: 'This student login is not linked to a student profile. Ask an administrator to match the account email to the student profile or set the student login password again.',
                code: 'STUDENT_PROFILE_NOT_LINKED',
            });
            return;
        }
        const sId = user.studentId;
        const studentProfile = await Student_1.Student.findById(sId).select('firstName lastName displayName studentNumber email phone address status');
        if (!studentProfile || String(studentProfile.status).toUpperCase() !== 'ACTIVE') {
            res.status(403).json({
                error: 'The student profile linked to this login is missing or inactive. Ask an administrator to review the student account.',
                code: 'STUDENT_PROFILE_UNAVAILABLE',
            });
            return;
        }
        const enrollments = await Enrollment_1.Enrollment.find((0, enrollmentAccess_1.currentEnrollmentFilter)(sId)).populate({
            path: 'classId',
            select: 'name classCode subject teachers description',
            populate: { path: 'teachers', select: 'fullName email' },
        });
        const classIds = enrollments.map((e) => e.classId?._id).filter(Boolean);
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
        const publishedLessons = await Lesson_1.Lesson.find({
            classId: { $in: classIds },
            isPublished: true,
            $or: [{ publicationStatus: 'PUBLISHED' }, { publicationStatus: { $exists: false } }],
        })
            .select('_id title chapter topic classId order')
            .populate('classId', 'name subject')
            .sort({ chapter: 1, order: 1, createdAt: 1 });
        const totalLessons = publishedLessons.length;
        const completedProgress = await LessonProgress_1.LessonProgress.find({
            studentId: sId,
            lessonId: { $in: publishedLessons.map((lesson) => lesson._id) },
            isCompleted: true,
        });
        const completedCount = completedProgress.length;
        const completedLessonIds = new Set(completedProgress.map((progress) => progress.lessonId.toString()));
        const attendanceSessions = await ClassSession_1.ClassSession.find({
            classId: { $in: classIds },
            $or: [{ isPublished: true }, { isPublished: { $exists: false } }],
        })
            .populate('classId', 'name classCode subject')
            .sort({ sessionDate: -1 })
            .limit(50);
        const existingSessionRecords = await AttendanceRecord_1.AttendanceRecord.find({
            studentId: sId,
            classSessionId: { $in: attendanceSessions.map((session) => session._id) },
        }).select('classSessionId status');
        const recordBySession = new Map(existingSessionRecords.map((record) => [record.classSessionId.toString(), record]));
        const attendanceSessionList = attendanceSessions.map((session) => ({
            id: session._id,
            title: session.title,
            sessionDate: session.sessionDate,
            startTime: session.startTime,
            endTime: session.endTime,
            timeZone: session.timeZone,
            status: session.status,
            checkInState: session.status === 'DRAFT' ? (0, attendanceWindow_1.getAttendanceWindowState)(session) : 'FINALIZED',
            attendance: recordBySession.get(session._id.toString())?.status || null,
            class: session.classId,
        }));
        const allAssignments = await Assignment_1.Assignment.find({
            classId: { $in: classIds },
            $and: [
                { $or: [{ publicationStatus: 'PUBLISHED' }, { publicationStatus: { $exists: false }, isPublished: true }] },
                { $or: [{ targetMode: { $ne: 'SELECTED_STUDENTS' } }, { targetStudentIds: sId }] },
            ],
        })
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
                submissionStatus: sub
                    ? sub.status === 'GRADED' && !sub.gradeReleasedAt
                        ? 'SUBMITTED'
                        : sub.status
                    : 'PENDING',
                marksAwarded: sub?.gradeReleasedAt ? sub.marksAwarded : null,
                feedback: sub?.gradeReleasedAt ? sub.feedback : null,
            };
        });
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
            classes: enrollments.map((e) => e.classId),
            attendanceStats: {
                presentCount,
                lateCount,
                absentCount,
                excusedCount,
                attendancePercentage,
                recentRecords: attendance.slice(0, 5),
            },
            attendanceSessions: attendanceSessionList,
            learningProgress: {
                totalLessons,
                completedLessons: completedCount,
                progressPercentage: totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0,
                lessons: publishedLessons.slice(0, 10).map((lesson) => ({
                    id: lesson._id,
                    title: lesson.title,
                    chapter: lesson.chapter,
                    topic: lesson.topic,
                    class: lesson.classId,
                    isCompleted: completedLessonIds.has(lesson._id.toString()),
                })),
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
