"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getStudentAttendance = exports.toggleStudentStatus = exports.updateStudent = exports.createStudent = exports.getStudentById = exports.getStudents = void 0;
const Student_1 = require("../models/Student");
const Enrollment_1 = require("../models/Enrollment");
const StudentGuardian_1 = require("../models/StudentGuardian");
const AttendanceRecord_1 = require("../models/AttendanceRecord");
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
        const { firstName, lastName, studentNumber, displayName, dateOfBirth, email, phone, address, notes } = req.body;
        if (!firstName || !lastName) {
            res.status(400).json({ error: 'First name and last name are required.' });
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
            email: email ? email.trim().toLowerCase() : undefined,
            phone: phone ? phone.trim() : undefined,
            address: address ? address.trim() : undefined,
            notes: notes ? notes.trim() : undefined,
            status: 'ACTIVE',
        });
        await (0, auditService_1.logAudit)({
            userId: req.user._id,
            action: 'STUDENT_REGISTERED',
            entityType: 'Student',
            entityId: student._id.toString(),
            details: { name: student.displayName, studentNumber: student.studentNumber },
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
        const { firstName, lastName, studentNumber, displayName, dateOfBirth, email, phone, address, notes } = req.body;
        if (studentNumber && studentNumber.trim() !== student.studentNumber) {
            const normalizedNum = studentNumber.trim();
            const existing = await Student_1.Student.findOne({ studentNumber: normalizedNum });
            if (existing) {
                res.status(409).json({ error: `Student with admission number "${normalizedNum}" already exists.` });
                return;
            }
            student.studentNumber = normalizedNum;
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
        await (0, auditService_1.logAudit)({
            userId: req.user._id,
            action: 'STUDENT_UPDATED',
            entityType: 'Student',
            entityId: student._id.toString(),
            details: { name: student.displayName },
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
