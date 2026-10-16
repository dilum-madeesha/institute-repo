"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getClassStudents = exports.toggleClassStatus = exports.updateClass = exports.createClass = exports.getClassById = exports.getClasses = void 0;
const Class_1 = require("../models/Class");
const Enrollment_1 = require("../models/Enrollment");
const ClassSession_1 = require("../models/ClassSession");
const StudentGuardian_1 = require("../models/StudentGuardian");
const role_1 = require("../middleware/role");
const auditService_1 = require("../services/auditService");
const getClasses = async (req, res) => {
    try {
        const { status, search, subject } = req.query;
        const filter = {};
        // Filter classes per role
        if (req.user.role === 'TEACHER') {
            filter.teachers = req.user._id;
        }
        else if (req.user.role === 'STUDENT' && req.user.studentId) {
            const enrollments = await Enrollment_1.Enrollment.find({ studentId: req.user.studentId, status: 'ACTIVE' });
            filter._id = { $in: enrollments.map((e) => e.classId) };
        }
        else if (req.user.role === 'PARENT' && req.user.guardianId) {
            const links = await StudentGuardian_1.StudentGuardian.find({ guardianId: req.user.guardianId });
            const enrollments = await Enrollment_1.Enrollment.find({ studentId: { $in: links.map((l) => l.studentId) }, status: 'ACTIVE' });
            filter._id = { $in: enrollments.map((e) => e.classId) };
        }
        if (status)
            filter.status = status;
        if (subject)
            filter.subject = subject;
        if (search) {
            filter.$or = [
                { name: { $regex: String(search), $options: 'i' } },
                { classCode: { $regex: String(search), $options: 'i' } },
                { subject: { $regex: String(search), $options: 'i' } },
            ];
        }
        const classes = await Class_1.ClassModel.find(filter)
            .populate('teachers', 'fullName email')
            .sort({ createdAt: -1 });
        // Attach active enrollment counts
        const classIds = classes.map((c) => c._id);
        const enrollmentCounts = await Enrollment_1.Enrollment.aggregate([
            { $match: { classId: { $in: classIds }, status: 'ACTIVE' } },
            { $group: { _id: '$classId', count: { $sum: 1 } } },
        ]);
        const countMap = new Map(enrollmentCounts.map((e) => [e._id.toString(), e.count]));
        const response = classes.map((c) => ({
            ...c.toObject(),
            enrolledCount: countMap.get(c._id.toString()) || 0,
        }));
        res.json(response);
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Failed to fetch classes' });
    }
};
exports.getClasses = getClasses;
const getClassById = async (req, res) => {
    try {
        const classId = req.params.id;
        const hasAccess = await (0, role_1.canAccessClass)(req.user._id.toString(), req.user.role, classId, req.user.studentId?.toString(), req.user.guardianId?.toString());
        if (!hasAccess) {
            res.status(403).json({ error: 'Access denied. You are not enrolled in or assigned to this class.' });
            return;
        }
        const classObj = await Class_1.ClassModel.findById(classId).populate('teachers', 'fullName email');
        if (!classObj) {
            res.status(404).json({ error: 'Class not found' });
            return;
        }
        const enrolledCount = await Enrollment_1.Enrollment.countDocuments({ classId: classObj._id, status: 'ACTIVE' });
        const sessionCount = await ClassSession_1.ClassSession.countDocuments({ classId: classObj._id });
        res.json({
            ...classObj.toObject(),
            enrolledCount,
            sessionCount,
        });
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Failed to fetch class details' });
    }
};
exports.getClassById = getClassById;
const createClass = async (req, res) => {
    try {
        const { name, classCode, subject, description, academicYear, teachers } = req.body;
        if (!name || !classCode || !subject) {
            res.status(400).json({ error: 'Class name, unique class code, and subject are required.' });
            return;
        }
        const normalizedCode = classCode.toUpperCase().trim();
        const existing = await Class_1.ClassModel.findOne({ classCode: normalizedCode });
        if (existing) {
            res.status(409).json({ error: `A class with code "${normalizedCode}" already exists.` });
            return;
        }
        const newClass = await Class_1.ClassModel.create({
            name: name.trim(),
            classCode: normalizedCode,
            subject: subject.trim(),
            description: description ? description.trim() : '',
            academicYear: academicYear ? academicYear.trim() : '',
            teachers: Array.isArray(teachers) ? teachers : [],
            status: 'ACTIVE',
            createdBy: req.user._id,
        });
        await (0, auditService_1.logAudit)({
            userId: req.user._id,
            action: 'CLASS_CREATED',
            entityType: 'Class',
            entityId: newClass._id.toString(),
            details: { name: newClass.name, code: newClass.classCode },
            ipAddress: req.ip,
        });
        const populated = await Class_1.ClassModel.findById(newClass._id).populate('teachers', 'fullName email');
        res.status(201).json(populated);
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Failed to create class' });
    }
};
exports.createClass = createClass;
const updateClass = async (req, res) => {
    try {
        const classId = req.params.id;
        const hasAccess = await (0, role_1.canAccessClass)(req.user._id.toString(), req.user.role, classId);
        if (!hasAccess) {
            res.status(403).json({ error: 'Access denied.' });
            return;
        }
        const { name, classCode, subject, description, academicYear, teachers } = req.body;
        const classObj = await Class_1.ClassModel.findById(classId);
        if (!classObj) {
            res.status(404).json({ error: 'Class not found' });
            return;
        }
        if (classCode && classCode.toUpperCase().trim() !== classObj.classCode) {
            const normalizedCode = classCode.toUpperCase().trim();
            const existing = await Class_1.ClassModel.findOne({ classCode: normalizedCode });
            if (existing) {
                res.status(409).json({ error: `Class code "${normalizedCode}" is already in use.` });
                return;
            }
            classObj.classCode = normalizedCode;
        }
        if (name)
            classObj.name = name.trim();
        if (subject)
            classObj.subject = subject.trim();
        if (description !== undefined)
            classObj.description = description.trim();
        if (academicYear !== undefined)
            classObj.academicYear = academicYear.trim();
        // Only admin can reassign teachers
        if (req.user.role === 'ADMIN' && teachers !== undefined) {
            classObj.teachers = Array.isArray(teachers) ? teachers : [];
        }
        await classObj.save();
        await (0, auditService_1.logAudit)({
            userId: req.user._id,
            action: 'CLASS_UPDATED',
            entityType: 'Class',
            entityId: classObj._id.toString(),
            details: { name: classObj.name, classCode: classObj.classCode },
            ipAddress: req.ip,
        });
        const populated = await Class_1.ClassModel.findById(classObj._id).populate('teachers', 'fullName email');
        res.json(populated);
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Failed to update class' });
    }
};
exports.updateClass = updateClass;
const toggleClassStatus = async (req, res) => {
    try {
        const classObj = await Class_1.ClassModel.findById(req.params.id);
        if (!classObj) {
            res.status(404).json({ error: 'Class not found' });
            return;
        }
        classObj.status = classObj.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
        await classObj.save();
        await (0, auditService_1.logAudit)({
            userId: req.user._id,
            action: classObj.status === 'ACTIVE' ? 'CLASS_ACTIVATED' : 'CLASS_DEACTIVATED',
            entityType: 'Class',
            entityId: classObj._id.toString(),
            details: { status: classObj.status },
            ipAddress: req.ip,
        });
        res.json({ message: `Class is now ${classObj.status.toLowerCase()}.`, class: classObj });
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Failed to change class status' });
    }
};
exports.toggleClassStatus = toggleClassStatus;
const getClassStudents = async (req, res) => {
    try {
        const classId = req.params.id;
        const hasAccess = await (0, role_1.canAccessClass)(req.user._id.toString(), req.user.role, classId);
        if (!hasAccess) {
            res.status(403).json({ error: 'Access denied.' });
            return;
        }
        const enrollments = await Enrollment_1.Enrollment.find({
            classId,
            status: 'ACTIVE',
        })
            .populate({
            path: 'studentId',
            match: { status: 'ACTIVE' },
        })
            .sort({ createdAt: 1 });
        const studentIds = enrollments.map((e) => e.studentId?._id).filter(Boolean);
        // Fetch linked guardians for each student to flag missing parent emails
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
        const studentsWithEnrollment = enrollments
            .filter((e) => e.studentId)
            .map((e) => {
            const student = e.studentId.toObject();
            const guardians = guardianMap.get(student._id.toString()) || [];
            const hasActiveGuardianEmail = guardians.some((g) => g.guardianId?.status === 'ACTIVE' && g.guardianId?.email && g.receivesAttendanceEmails);
            return {
                ...student,
                enrollmentId: e._id,
                enrollmentStartDate: e.startDate,
                enrollmentStatus: e.status,
                guardians,
                hasActiveGuardianEmail,
            };
        });
        res.json(studentsWithEnrollment);
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Failed to fetch class students' });
    }
};
exports.getClassStudents = getClassStudents;
