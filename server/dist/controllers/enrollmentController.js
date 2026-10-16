"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.endEnrollment = exports.updateEnrollment = exports.enrollStudent = void 0;
const Enrollment_1 = require("../models/Enrollment");
const Student_1 = require("../models/Student");
const Class_1 = require("../models/Class");
const auditService_1 = require("../services/auditService");
const enrollStudent = async (req, res) => {
    try {
        const { studentId, classId, startDate } = req.body;
        if (!studentId || !classId) {
            res.status(400).json({ error: 'Both studentId and classId are required.' });
            return;
        }
        const student = await Student_1.Student.findById(studentId);
        if (!student) {
            res.status(404).json({ error: 'Student not found.' });
            return;
        }
        const classObj = await Class_1.ClassModel.findById(classId);
        if (!classObj) {
            res.status(404).json({ error: 'Class not found.' });
            return;
        }
        // Check for duplicate active enrollment
        const activeExisting = await Enrollment_1.Enrollment.findOne({
            studentId: student._id,
            classId: classObj._id,
            status: 'ACTIVE',
        });
        if (activeExisting) {
            res.status(409).json({ error: 'This student is already actively enrolled in this class.' });
            return;
        }
        const enrollment = await Enrollment_1.Enrollment.create({
            studentId: student._id,
            classId: classObj._id,
            startDate: startDate ? new Date(startDate) : new Date(),
            status: 'ACTIVE',
            createdBy: req.user._id,
        });
        await (0, auditService_1.logAudit)({
            userId: req.user._id,
            action: 'STUDENT_ENROLLED',
            entityType: 'Enrollment',
            entityId: enrollment._id.toString(),
            details: {
                studentId: student._id,
                studentName: student.displayName,
                classId: classObj._id,
                className: classObj.name,
            },
            ipAddress: req.ip,
        });
        const populated = await Enrollment_1.Enrollment.findById(enrollment._id)
            .populate('studentId', 'firstName lastName displayName studentNumber')
            .populate('classId', 'name classCode');
        res.status(201).json(populated);
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Failed to enroll student' });
    }
};
exports.enrollStudent = enrollStudent;
const updateEnrollment = async (req, res) => {
    try {
        const { status, endDate } = req.body;
        const enrollment = await Enrollment_1.Enrollment.findById(req.params.id);
        if (!enrollment) {
            res.status(404).json({ error: 'Enrollment record not found' });
            return;
        }
        if (status)
            enrollment.status = status;
        if (endDate !== undefined) {
            enrollment.endDate = endDate ? new Date(endDate) : null;
        }
        await enrollment.save();
        await (0, auditService_1.logAudit)({
            userId: req.user._id,
            action: 'ENROLLMENT_UPDATED',
            entityType: 'Enrollment',
            entityId: enrollment._id.toString(),
            details: { status: enrollment.status, endDate: enrollment.endDate },
            ipAddress: req.ip,
        });
        res.json(enrollment);
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Failed to update enrollment' });
    }
};
exports.updateEnrollment = updateEnrollment;
const endEnrollment = async (req, res) => {
    try {
        const enrollment = await Enrollment_1.Enrollment.findById(req.params.id);
        if (!enrollment) {
            res.status(404).json({ error: 'Enrollment not found' });
            return;
        }
        enrollment.status = 'WITHDRAWN';
        enrollment.endDate = new Date();
        await enrollment.save();
        await (0, auditService_1.logAudit)({
            userId: req.user._id,
            action: 'ENROLLMENT_WITHDRAWN',
            entityType: 'Enrollment',
            entityId: enrollment._id.toString(),
            ipAddress: req.ip,
        });
        res.json({ message: 'Enrollment marked as withdrawn. Historical attendance is preserved.', enrollment });
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Failed to end enrollment' });
    }
};
exports.endEnrollment = endEnrollment;
