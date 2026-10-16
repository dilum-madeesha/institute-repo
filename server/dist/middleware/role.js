"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyParentStudentLink = exports.canAccessClass = exports.requireRoles = exports.requireTeacherOrAdmin = exports.requireAdmin = void 0;
const Class_1 = require("../models/Class");
const Enrollment_1 = require("../models/Enrollment");
const StudentGuardian_1 = require("../models/StudentGuardian");
const requireAdmin = (req, res, next) => {
    if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
    }
    if (req.user.role !== 'ADMIN') {
        res.status(403).json({ error: 'Access denied. Administrator privileges required.' });
        return;
    }
    next();
};
exports.requireAdmin = requireAdmin;
const requireTeacherOrAdmin = (req, res, next) => {
    if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
    }
    if (req.user.role !== 'ADMIN' && req.user.role !== 'TEACHER') {
        res.status(403).json({ error: 'Access denied. Teacher or administrator privileges required.' });
        return;
    }
    next();
};
exports.requireTeacherOrAdmin = requireTeacherOrAdmin;
const requireRoles = (allowedRoles) => {
    return (req, res, next) => {
        if (!req.user) {
            res.status(401).json({ error: 'Authentication required' });
            return;
        }
        if (!allowedRoles.includes(req.user.role)) {
            res.status(403).json({
                error: `Access denied. Requires one of: ${allowedRoles.join(', ')}`,
            });
            return;
        }
        next();
    };
};
exports.requireRoles = requireRoles;
const canAccessClass = async (userId, userRole, classId, studentId, guardianId) => {
    if (userRole === 'ADMIN')
        return true;
    if (userRole === 'TEACHER') {
        const classObj = await Class_1.ClassModel.findById(classId);
        if (!classObj)
            return false;
        return classObj.teachers.some((tId) => tId.toString() === userId.toString());
    }
    if (userRole === 'STUDENT' && studentId) {
        const activeEnrollment = await Enrollment_1.Enrollment.findOne({
            classId,
            studentId,
            status: 'ACTIVE',
        });
        return !!activeEnrollment;
    }
    if (userRole === 'PARENT' && guardianId) {
        // Find children linked to this parent
        const links = await StudentGuardian_1.StudentGuardian.find({ guardianId });
        const childStudentIds = links.map((l) => l.studentId);
        const activeEnrollment = await Enrollment_1.Enrollment.findOne({
            classId,
            studentId: { $in: childStudentIds },
            status: 'ACTIVE',
        });
        return !!activeEnrollment;
    }
    return false;
};
exports.canAccessClass = canAccessClass;
const verifyParentStudentLink = async (guardianId, studentId) => {
    const link = await StudentGuardian_1.StudentGuardian.findOne({ guardianId, studentId });
    return !!link;
};
exports.verifyParentStudentLink = verifyParentStudentLink;
