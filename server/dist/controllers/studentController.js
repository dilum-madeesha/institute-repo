"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getStudentAttendance = exports.deleteStudent = exports.toggleStudentStatus = exports.updateStudent = exports.createStudent = exports.getStudentById = exports.getStudents = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const Student_1 = require("../models/Student");
const Enrollment_1 = require("../models/Enrollment");
const StudentGuardian_1 = require("../models/StudentGuardian");
const AttendanceRecord_1 = require("../models/AttendanceRecord");
const AttendanceChangeLog_1 = require("../models/AttendanceChangeLog");
const AssignmentSubmission_1 = require("../models/AssignmentSubmission");
const ExamSubmission_1 = require("../models/ExamSubmission");
const LessonProgress_1 = require("../models/LessonProgress");
const EmailNotification_1 = require("../models/EmailNotification");
const User_1 = require("../models/User");
const auditService_1 = require("../services/auditService");
const getStudents = async (req, res) => {
    try {
        const { status, search, classId } = req.query;
        let studentIds = null;
        if (classId) {
            const enrollments = await Enrollment_1.Enrollment.find({
                classId,
                status: 'ACTIVE',
            }).select('studentId');
            studentIds = enrollments.map((e) => e.studentId);
        }
        const filter = {};
        if (studentIds) {
            filter._id = { $in: studentIds };
        }
        if (status)
            filter.status = status;
        if (search) {
            filter.$or = [
                { firstName: { $regex: String(search), $options: 'i' } },
                { lastName: { $regex: String(search), $options: 'i' } },
                { studentNumber: { $regex: String(search), $options: 'i' } },
                { email: { $regex: String(search), $options: 'i' } },
            ];
        }
        const students = await Student_1.Student.find(filter).sort({ lastName: 1, firstName: 1 });
        // Fetch linked guardians count and active class count for each student
        const sIds = students.map((s) => s._id);
        const guardianLinks = await StudentGuardian_1.StudentGuardian.find({ studentId: { $in: sIds } }).populate('guardianId');
        const enrollments = await Enrollment_1.Enrollment.find({ studentId: { $in: sIds }, status: 'ACTIVE' }).populate('classId', 'name classCode');
        const guardianMap = new Map();
        guardianLinks.forEach((g) => {
            const id = g.studentId.toString();
            if (!guardianMap.has(id))
                guardianMap.set(id, []);
            guardianMap.get(id).push(g);
        });
        const enrollmentMap = new Map();
        enrollments.forEach((e) => {
            const id = e.studentId.toString();
            if (!enrollmentMap.has(id))
                enrollmentMap.set(id, []);
            enrollmentMap.get(id).push(e);
        });
        const response = students.map((s) => {
            const gList = guardianMap.get(s._id.toString()) || [];
            const eList = enrollmentMap.get(s._id.toString()) || [];
            const hasActiveGuardianEmail = gList.some((g) => g.guardianId?.status === 'ACTIVE' && g.guardianId?.email && g.receivesAttendanceEmails);
            return {
                ...s.toObject(),
                guardians: gList,
                enrollments: eList,
                hasActiveGuardianEmail,
            };
        });
        res.json(response);
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Failed to fetch students' });
    }
};
exports.getStudents = getStudents;
const getStudentById = async (req, res) => {
    try {
        const student = await Student_1.Student.findById(req.params.id);
        if (!student) {
            res.status(404).json({ error: 'Student not found' });
            return;
        }
        // Enrollments
        const enrollments = await Enrollment_1.Enrollment.find({ studentId: student._id })
            .populate('classId', 'name classCode subject status')
            .sort({ createdAt: -1 });
        // Guardians
        const guardians = await StudentGuardian_1.StudentGuardian.find({ studentId: student._id })
            .populate('guardianId')
            .sort({ isPrimaryContact: -1 });
        // Attendance stats
        const attendanceRecords = await AttendanceRecord_1.AttendanceRecord.find({ studentId: student._id });
        const presentCount = attendanceRecords.filter((r) => r.status === 'PRESENT').length;
        const lateCount = attendanceRecords.filter((r) => r.status === 'LATE').length;
        const absentCount = attendanceRecords.filter((r) => r.status === 'ABSENT').length;
        const excusedCount = attendanceRecords.filter((r) => r.status === 'EXCUSED').length;
        const totalRecords = attendanceRecords.length;
        // Formula from Sec 9.7: (Present + Late) / (Present + Late + Absent) * 100
        const denominator = presentCount + lateCount + absentCount;
        const attendancePercentage = denominator > 0 ? Math.round(((presentCount + lateCount) / denominator) * 1000) / 10 : 100;
        const hasActiveGuardianEmail = guardians.some((g) => g.guardianId?.status === 'ACTIVE' && g.guardianId?.email && g.receivesAttendanceEmails);
        res.json({
            ...student.toObject(),
            enrollments,
            guardians,
            hasActiveGuardianEmail,
            attendanceStats: {
                totalRecords,
                presentCount,
                lateCount,
                absentCount,
                excusedCount,
                attendancePercentage,
            },
        });
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Failed to fetch student details' });
    }
};
exports.getStudentById = getStudentById;
const createStudent = async (req, res) => {
    try {
        const { firstName, lastName, studentNumber, displayName, dateOfBirth, email, phone, address, notes, password } = req.body;
        if (password && req.user.role !== 'ADMIN') {
            res.status(403).json({ error: 'Only administrators can create student login credentials.' });
            return;
        }
        if (!firstName || !lastName) {
            res.status(400).json({ error: 'First name and last name are required.' });
            return;
        }
        const normalizedEmail = email ? String(email).trim().toLowerCase() : '';
        if (password && !normalizedEmail) {
            res.status(400).json({ error: 'An email address is required to create a student login.' });
            return;
        }
        if (password && String(password).length < 6) {
            res.status(400).json({ error: 'Student password must be at least 6 characters long.' });
            return;
        }
        if (password && await User_1.User.findOne({ email: normalizedEmail })) {
            res.status(409).json({ error: 'A user account with this email address already exists.' });
            return;
        }
        if (studentNumber && studentNumber.trim()) {
            const normalizedNum = studentNumber.trim();
            const existing = await Student_1.Student.findOne({ studentNumber: normalizedNum });
            if (existing) {
                res.status(409).json({ error: `Student with admission number "${normalizedNum}" already exists.` });
                return;
            }
        }
        const student = await Student_1.Student.create({
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            displayName: displayName ? displayName.trim() : `${firstName.trim()} ${lastName.trim()}`,
            studentNumber: studentNumber && studentNumber.trim() ? studentNumber.trim() : undefined,
            dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
            email: normalizedEmail || undefined,
            phone: phone ? phone.trim() : undefined,
            address: address ? address.trim() : undefined,
            notes: notes ? notes.trim() : undefined,
            status: 'ACTIVE',
        });
        if (password) {
            try {
                await User_1.User.create({
                    fullName: student.displayName || `${student.firstName} ${student.lastName}`,
                    email: normalizedEmail,
                    passwordHash: await bcryptjs_1.default.hash(String(password), 10),
                    role: 'STUDENT',
                    status: 'ACTIVE',
                    studentId: student._id,
                });
            }
            catch (error) {
                await student.deleteOne();
                throw error;
            }
        }
        await (0, auditService_1.logAudit)({
            userId: req.user._id,
            action: 'STUDENT_REGISTERED',
            entityType: 'Student',
            entityId: student._id.toString(),
            details: { name: student.displayName, studentNumber: student.studentNumber, hasPortalAccount: Boolean(password) },
            ipAddress: req.ip,
        });
        res.status(201).json(student);
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Failed to register student' });
    }
};
exports.createStudent = createStudent;
const updateStudent = async (req, res) => {
    try {
        const student = await Student_1.Student.findById(req.params.id);
        if (!student) {
            res.status(404).json({ error: 'Student not found' });
            return;
        }
        const { firstName, lastName, studentNumber, displayName, dateOfBirth, email, phone, address, notes, password } = req.body;
        let studentAccount = await User_1.User.findOne({ role: 'STUDENT', studentId: student._id });
        if (password && req.user.role !== 'ADMIN') {
            res.status(403).json({ error: 'Only administrators can manage student login credentials.' });
            return;
        }
        const normalizedEmail = email !== undefined
            ? String(email).trim().toLowerCase()
            : student.email || studentAccount?.email || '';
        if (!studentAccount && normalizedEmail) {
            studentAccount = await User_1.User.findOne({
                role: 'STUDENT',
                studentId: null,
                email: normalizedEmail,
            });
        }
        const newPassword = password ? String(password) : '';
        if (newPassword && newPassword.length < 6) {
            res.status(400).json({ error: 'Student password must be at least 6 characters long.' });
            return;
        }
        if (newPassword && !normalizedEmail) {
            res.status(400).json({ error: 'An email address is required to create a student login.' });
            return;
        }
        if (req.user.role === 'ADMIN' && studentAccount && !normalizedEmail) {
            res.status(400).json({ error: 'A student login requires an email address. Update the email instead of removing it.' });
            return;
        }
        if (req.user.role === 'ADMIN' && normalizedEmail) {
            const duplicateAccount = await User_1.User.findOne({
                email: normalizedEmail,
                ...(studentAccount ? { _id: { $ne: studentAccount._id } } : {}),
            });
            if (duplicateAccount) {
                res.status(409).json({ error: 'A user account with this email address already exists.' });
                return;
            }
        }
        if (studentNumber !== undefined) {
            const normalizedNum = String(studentNumber).trim();
            if (normalizedNum && normalizedNum !== student.studentNumber) {
                const existing = await Student_1.Student.findOne({ studentNumber: normalizedNum, _id: { $ne: student._id } });
                if (existing) {
                    res.status(409).json({ error: `Student with admission number "${normalizedNum}" already exists.` });
                    return;
                }
            }
            student.studentNumber = normalizedNum || undefined;
        }
        if (firstName)
            student.firstName = firstName.trim();
        if (lastName)
            student.lastName = lastName.trim();
        if (displayName !== undefined)
            student.displayName = displayName.trim();
        if (dateOfBirth !== undefined)
            student.dateOfBirth = dateOfBirth ? new Date(dateOfBirth) : undefined;
        if (email !== undefined)
            student.email = email ? email.trim().toLowerCase() : undefined;
        if (phone !== undefined)
            student.phone = phone ? phone.trim() : undefined;
        if (address !== undefined)
            student.address = address ? address.trim() : undefined;
        if (notes !== undefined)
            student.notes = notes ? notes.trim() : undefined;
        await student.save();
        if (req.user.role === 'ADMIN' && studentAccount) {
            studentAccount.fullName = student.displayName || `${student.firstName} ${student.lastName}`;
            studentAccount.email = normalizedEmail;
            studentAccount.studentId = student._id;
            if (newPassword)
                studentAccount.passwordHash = await bcryptjs_1.default.hash(newPassword, 10);
            await studentAccount.save();
        }
        else if (req.user.role === 'ADMIN' && newPassword) {
            await User_1.User.create({
                fullName: student.displayName || `${student.firstName} ${student.lastName}`,
                email: normalizedEmail,
                passwordHash: await bcryptjs_1.default.hash(newPassword, 10),
                role: 'STUDENT',
                status: 'ACTIVE',
                studentId: student._id,
            });
        }
        await (0, auditService_1.logAudit)({
            userId: req.user._id,
            action: 'STUDENT_UPDATED',
            entityType: 'Student',
            entityId: student._id.toString(),
            details: { name: student.displayName, portalCredentialsUpdated: Boolean(newPassword || studentAccount) },
            ipAddress: req.ip,
        });
        res.json(student);
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Failed to update student' });
    }
};
exports.updateStudent = updateStudent;
const toggleStudentStatus = async (req, res) => {
    try {
        const student = await Student_1.Student.findById(req.params.id);
        if (!student) {
            res.status(404).json({ error: 'Student not found' });
            return;
        }
        student.status = student.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
        await student.save();
        await (0, auditService_1.logAudit)({
            userId: req.user._id,
            action: student.status === 'ACTIVE' ? 'STUDENT_ACTIVATED' : 'STUDENT_DEACTIVATED',
            entityType: 'Student',
            entityId: student._id.toString(),
            details: { status: student.status },
            ipAddress: req.ip,
        });
        res.json({ message: `Student is now ${student.status.toLowerCase()}.`, student });
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Failed to change student status' });
    }
};
exports.toggleStudentStatus = toggleStudentStatus;
const deleteStudent = async (req, res) => {
    try {
        const student = await Student_1.Student.findById(req.params.id);
        if (!student) {
            res.status(404).json({ error: 'Student not found.' });
            return;
        }
        const attendanceRecords = await AttendanceRecord_1.AttendanceRecord.find({ studentId: student._id }).select('_id');
        const attendanceRecordIds = attendanceRecords.map((record) => record._id);
        await Promise.all([
            EmailNotification_1.EmailNotification.deleteMany({
                $or: [{ studentId: student._id }, { attendanceRecordId: { $in: attendanceRecordIds } }],
            }),
            AttendanceChangeLog_1.AttendanceChangeLog.deleteMany({
                $or: [{ studentId: student._id }, { attendanceRecordId: { $in: attendanceRecordIds } }],
            }),
            AttendanceRecord_1.AttendanceRecord.deleteMany({ studentId: student._id }),
            AssignmentSubmission_1.AssignmentSubmission.deleteMany({ studentId: student._id }),
            ExamSubmission_1.ExamSubmission.deleteMany({ studentId: student._id }),
            LessonProgress_1.LessonProgress.deleteMany({ studentId: student._id }),
            Enrollment_1.Enrollment.deleteMany({ studentId: student._id }),
            StudentGuardian_1.StudentGuardian.deleteMany({ studentId: student._id }),
            User_1.User.deleteMany({ role: 'STUDENT', studentId: student._id }),
        ]);
        await student.deleteOne();
        await (0, auditService_1.logAudit)({
            userId: req.user._id,
            action: 'STUDENT_DELETED',
            entityType: 'Student',
            entityId: student._id.toString(),
            details: {
                name: student.displayName || `${student.firstName} ${student.lastName}`,
                studentNumber: student.studentNumber,
            },
            ipAddress: req.ip,
        });
        res.json({ message: `Student ${student.displayName || `${student.firstName} ${student.lastName}`} was deleted.` });
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Failed to delete student' });
    }
};
exports.deleteStudent = deleteStudent;
const getStudentAttendance = async (req, res) => {
    try {
        const studentId = req.params.id;
        const records = await AttendanceRecord_1.AttendanceRecord.find({ studentId })
            .populate({
            path: 'classSessionId',
            populate: { path: 'classId', select: 'name classCode' },
        })
            .populate('markedBy', 'fullName')
            .sort({ createdAt: -1 });
        res.json(records);
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Failed to fetch attendance records' });
    }
};
exports.getStudentAttendance = getStudentAttendance;
