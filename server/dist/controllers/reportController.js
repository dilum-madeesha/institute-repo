"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.exportReportCsv = exports.getMissingGuardiansReport = exports.getAbsenceListReport = exports.getAttendanceSummaryReport = void 0;
const AttendanceRecord_1 = require("../models/AttendanceRecord");
const ClassSession_1 = require("../models/ClassSession");
const Student_1 = require("../models/Student");
const StudentGuardian_1 = require("../models/StudentGuardian");
const Enrollment_1 = require("../models/Enrollment");
const EmailNotification_1 = require("../models/EmailNotification");
const getAttendanceSummaryReport = async (req, res) => {
    try {
        const { classId, startDate, endDate } = req.query;
        const sessionQuery = { status: 'SUBMITTED' };
        if (classId)
            sessionQuery.classId = classId;
        if (startDate || endDate) {
            sessionQuery.sessionDate = {};
            if (startDate)
                sessionQuery.sessionDate.$gte = new Date(String(startDate));
            if (endDate)
                sessionQuery.sessionDate.$lte = new Date(String(endDate));
        }
        const sessions = await ClassSession_1.ClassSession.find(sessionQuery);
        const sessionIds = sessions.map((s) => s._id);
        // Get attendance records in these sessions
        const records = await AttendanceRecord_1.AttendanceRecord.find({
            classSessionId: { $in: sessionIds },
        }).populate('studentId', 'firstName lastName displayName studentNumber status');
        // Aggregate by student
        const studentStats = new Map();
        for (const rec of records) {
            const student = rec.studentId;
            if (!student)
                continue;
            const sId = student._id.toString();
            if (!studentStats.has(sId)) {
                studentStats.set(sId, {
                    studentId: sId,
                    studentName: student.displayName || `${student.firstName} ${student.lastName}`,
                    studentNumber: student.studentNumber || 'N/A',
                    present: 0,
                    late: 0,
                    absent: 0,
                    excused: 0,
                    total: 0,
                });
            }
            const st = studentStats.get(sId);
            st.total += 1;
            if (rec.status === 'PRESENT')
                st.present += 1;
            else if (rec.status === 'LATE')
                st.late += 1;
            else if (rec.status === 'ABSENT')
                st.absent += 1;
            else if (rec.status === 'EXCUSED')
                st.excused += 1;
        }
        const reportData = Array.from(studentStats.values()).map((st) => {
            // Sec 9.7 formula: (Present + Late) / (Present + Late + Absent) * 100
            const denominator = st.present + st.late + st.absent;
            const percentage = denominator > 0 ? Math.round(((st.present + st.late) / denominator) * 1000) / 10 : 100;
            return {
                ...st,
                attendancePercentage: percentage,
            };
        });
        res.json(reportData);
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Failed to generate attendance summary' });
    }
};
exports.getAttendanceSummaryReport = getAttendanceSummaryReport;
const getAbsenceListReport = async (req, res) => {
    try {
        const { classId, startDate, endDate } = req.query;
        const sessionQuery = { status: 'SUBMITTED' };
        if (classId)
            sessionQuery.classId = classId;
        if (startDate || endDate) {
            sessionQuery.sessionDate = {};
            if (startDate)
                sessionQuery.sessionDate.$gte = new Date(String(startDate));
            if (endDate)
                sessionQuery.sessionDate.$lte = new Date(String(endDate));
        }
        const sessions = await ClassSession_1.ClassSession.find(sessionQuery).populate('classId', 'name classCode');
        const sessionIds = sessions.map((s) => s._id);
        const absentRecords = await AttendanceRecord_1.AttendanceRecord.find({
            classSessionId: { $in: sessionIds },
            status: 'ABSENT',
        })
            .populate('studentId', 'firstName lastName displayName studentNumber')
            .populate('classSessionId')
            .sort({ createdAt: -1 });
        const notifications = await EmailNotification_1.EmailNotification.find({
            classSessionId: { $in: sessionIds },
            notificationType: 'ABSENCE',
        });
        const notifMap = new Map();
        notifications.forEach((n) => {
            const key = `${n.classSessionId.toString()}_${n.studentId.toString()}`;
            notifMap.set(key, n);
        });
        const result = absentRecords.map((rec) => {
            const student = rec.studentId;
            const session = rec.classSessionId;
            const notifKey = `${session._id.toString()}_${student._id.toString()}`;
            const notif = notifMap.get(notifKey);
            return {
                recordId: rec._id,
                sessionId: session._id,
                sessionDate: session.sessionDate,
                studentId: student._id,
                studentName: student.displayName || `${student.firstName} ${student.lastName}`,
                studentNumber: student.studentNumber || 'N/A',
                note: rec.note || '',
                notificationStatus: notif ? notif.status : 'NO_JOB',
                recipientEmail: notif ? notif.recipientEmail : null,
            };
        });
        res.json(result);
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Failed to generate absence report' });
    }
};
exports.getAbsenceListReport = getAbsenceListReport;
const getMissingGuardiansReport = async (req, res) => {
    try {
        // Find active students with active enrollments
        const activeEnrollments = await Enrollment_1.Enrollment.find({ status: 'ACTIVE' }).select('studentId classId');
        const studentIds = Array.from(new Set(activeEnrollments.map((e) => e.studentId.toString())));
        const students = await Student_1.Student.find({
            _id: { $in: studentIds },
            status: 'ACTIVE',
        });
        const studentGuardians = await StudentGuardian_1.StudentGuardian.find({
            studentId: { $in: studentIds },
        }).populate('guardianId');
        const guardianMap = new Map();
        studentGuardians.forEach((sg) => {
            const sId = sg.studentId.toString();
            if (!guardianMap.has(sId))
                guardianMap.set(sId, []);
            guardianMap.get(sId).push(sg);
        });
        const missingList = [];
        for (const st of students) {
            const sId = st._id.toString();
            const links = guardianMap.get(sId) || [];
            const hasValidEmail = links.some((l) => l.guardianId && l.guardianId.status === 'ACTIVE' && l.guardianId.email && l.receivesAttendanceEmails);
            if (!hasValidEmail) {
                missingList.push({
                    studentId: st._id,
                    studentName: st.displayName || `${st.firstName} ${st.lastName}`,
                    studentNumber: st.studentNumber || 'N/A',
                    email: st.email || 'N/A',
                    phone: st.phone || 'N/A',
                    guardianCount: links.length,
                    reason: links.length === 0
                        ? 'No parent/guardian linked'
                        : 'Linked guardians lack email or notifications are disabled',
                });
            }
        }
        res.json(missingList);
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Failed to fetch missing guardians' });
    }
};
exports.getMissingGuardiansReport = getMissingGuardiansReport;
const exportReportCsv = async (req, res) => {
    try {
        const { type, classId, startDate, endDate } = req.query;
        if (type === 'absences') {
            const sessionQuery = { status: 'SUBMITTED' };
            if (classId)
                sessionQuery.classId = classId;
            if (startDate || endDate) {
                sessionQuery.sessionDate = {};
                if (startDate)
                    sessionQuery.sessionDate.$gte = new Date(String(startDate));
                if (endDate)
                    sessionQuery.sessionDate.$lte = new Date(String(endDate));
            }
            const sessions = await ClassSession_1.ClassSession.find(sessionQuery).populate('classId', 'name classCode');
            const sessionIds = sessions.map((s) => s._id);
            const absentRecords = await AttendanceRecord_1.AttendanceRecord.find({
                classSessionId: { $in: sessionIds },
                status: 'ABSENT',
            })
                .populate('studentId', 'firstName lastName displayName studentNumber')
                .populate('classSessionId');
            const headers = ['Student Name', 'Admission No', 'Session Date', 'Class', 'Note'];
            const rows = absentRecords.map((r) => [
                `"${r.studentId?.displayName || `${r.studentId?.firstName} ${r.studentId?.lastName}`}"`,
                `"${r.studentId?.studentNumber || ''}"`,
                `"${new Date(r.classSessionId?.sessionDate).toISOString().split('T')[0]}"`,
                `"${r.classSessionId?.title || ''}"`,
                `"${(r.note || '').replace(/"/g, '""')}"`,
            ]);
            const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename="absence_report.csv"');
            res.send(csvContent);
            return;
        }
        // Default: summary report CSV
        const sessionQuery = { status: 'SUBMITTED' };
        if (classId)
            sessionQuery.classId = classId;
        const sessions = await ClassSession_1.ClassSession.find(sessionQuery);
        const sessionIds = sessions.map((s) => s._id);
        const records = await AttendanceRecord_1.AttendanceRecord.find({ classSessionId: { $in: sessionIds } }).populate('studentId');
        const studentStats = new Map();
        for (const rec of records) {
            const student = rec.studentId;
            if (!student)
                continue;
            const sId = student._id.toString();
            if (!studentStats.has(sId)) {
                studentStats.set(sId, {
                    name: student.displayName || `${student.firstName} ${student.lastName}`,
                    number: student.studentNumber || 'N/A',
                    present: 0,
                    late: 0,
                    absent: 0,
                    excused: 0,
                });
            }
            const st = studentStats.get(sId);
            if (rec.status === 'PRESENT')
                st.present += 1;
            else if (rec.status === 'LATE')
                st.late += 1;
            else if (rec.status === 'ABSENT')
                st.absent += 1;
            else if (rec.status === 'EXCUSED')
                st.excused += 1;
        }
        const headers = ['Student Name', 'Admission No', 'Present', 'Late', 'Absent', 'Excused', 'Attendance %'];
        const rows = Array.from(studentStats.values()).map((s) => {
            const denom = s.present + s.late + s.absent;
            const pct = denom > 0 ? Math.round(((s.present + s.late) / denom) * 1000) / 10 : 100;
            return [
                `"${s.name}"`,
                `"${s.number}"`,
                s.present,
                s.late,
                s.absent,
                s.excused,
                `"${pct}%"`,
            ];
        });
        const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="attendance_summary.csv"');
        res.send(csvContent);
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Failed to export CSV' });
    }
};
exports.exportReportCsv = exportReportCsv;
