"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.unlinkGuardianFromStudent = exports.updateStudentGuardianLink = exports.linkGuardianToStudent = exports.deleteGuardian = exports.updateGuardian = exports.createGuardian = exports.getGuardians = void 0;
const Guardian_1 = require("../models/Guardian");
const StudentGuardian_1 = require("../models/StudentGuardian");
const Student_1 = require("../models/Student");
const EmailNotification_1 = require("../models/EmailNotification");
const User_1 = require("../models/User");
const auditService_1 = require("../services/auditService");
const getGuardians = async (req, res) => {
    try {
        const { search, status } = req.query;
        const filter = {};
        if (status)
            filter.status = status;
        if (search) {
            filter.$or = [
                { fullName: { $regex: String(search), $options: 'i' } },
                { email: { $regex: String(search), $options: 'i' } },
                { phone: { $regex: String(search), $options: 'i' } },
            ];
        }
        const guardians = await Guardian_1.Guardian.find(filter).sort({ fullName: 1 });
        const gIds = guardians.map((g) => g._id);
        const links = await StudentGuardian_1.StudentGuardian.find({ guardianId: { $in: gIds } }).populate('studentId', 'firstName lastName displayName studentNumber status');
        const studentMap = new Map();
        links.forEach((l) => {
            const gId = l.guardianId.toString();
            if (!studentMap.has(gId))
                studentMap.set(gId, []);
            studentMap.get(gId).push({
                student: l.studentId,
                relationship: l.relationship,
                receivesAttendanceEmails: l.receivesAttendanceEmails,
                isPrimaryContact: l.isPrimaryContact,
            });
        });
        const response = guardians.map((g) => ({
            ...g.toObject(),
            linkedStudents: studentMap.get(g._id.toString()) || [],
        }));
        res.json(response);
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Failed to fetch guardians' });
    }
};
exports.getGuardians = getGuardians;
const createGuardian = async (req, res) => {
    try {
        const { fullName, email, phone, studentId, relationship, receivesAttendanceEmails, isPrimaryContact } = req.body;
        if (!fullName || !email) {
            res.status(400).json({ error: 'Guardian full name and email are required.' });
            return;
        }
        const normalizedEmail = email.toLowerCase().trim();
        let guardian = await Guardian_1.Guardian.findOne({ email: normalizedEmail });
        if (!guardian) {
            guardian = await Guardian_1.Guardian.create({
                fullName: fullName.trim(),
                email: normalizedEmail,
                phone: phone ? phone.trim() : undefined,
                status: 'ACTIVE',
            });
            await (0, auditService_1.logAudit)({
                userId: req.user._id,
                action: 'GUARDIAN_CREATED',
                entityType: 'Guardian',
                entityId: guardian._id.toString(),
                details: { name: guardian.fullName, email: guardian.email },
                ipAddress: req.ip,
            });
        }
        // If studentId was supplied, link them
        if (studentId) {
            const student = await Student_1.Student.findById(studentId);
            if (student) {
                await StudentGuardian_1.StudentGuardian.findOneAndUpdate({ studentId: student._id, guardianId: guardian._id }, {
                    relationship: relationship || 'Guardian',
                    receivesAttendanceEmails: receivesAttendanceEmails !== undefined ? receivesAttendanceEmails : true,
                    isPrimaryContact: Boolean(isPrimaryContact),
                }, { upsert: true, new: true });
            }
        }
        res.status(201).json(guardian);
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Failed to create guardian' });
    }
};
exports.createGuardian = createGuardian;
const updateGuardian = async (req, res) => {
    try {
        const { fullName, email, phone, status } = req.body;
        const guardian = await Guardian_1.Guardian.findById(req.params.id);
        if (!guardian) {
            res.status(404).json({ error: 'Guardian not found' });
            return;
        }
        if (fullName)
            guardian.fullName = fullName.trim();
        if (email)
            guardian.email = email.toLowerCase().trim();
        if (phone !== undefined)
            guardian.phone = phone.trim();
        if (status)
            guardian.status = status;
        await guardian.save();
        await (0, auditService_1.logAudit)({
            userId: req.user._id,
            action: 'GUARDIAN_UPDATED',
            entityType: 'Guardian',
            entityId: guardian._id.toString(),
            details: { name: guardian.fullName, email: guardian.email },
            ipAddress: req.ip,
        });
        res.json(guardian);
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Failed to update guardian' });
    }
};
exports.updateGuardian = updateGuardian;
const deleteGuardian = async (req, res) => {
    try {
        const guardian = await Guardian_1.Guardian.findById(req.params.id);
        if (!guardian) {
            res.status(404).json({ error: 'Guardian not found.' });
            return;
        }
        await Promise.all([
            StudentGuardian_1.StudentGuardian.deleteMany({ guardianId: guardian._id }),
            EmailNotification_1.EmailNotification.updateMany({ guardianId: guardian._id }, { $set: { guardianId: null } }),
            User_1.User.deleteMany({ role: 'PARENT', guardianId: guardian._id }),
        ]);
        await guardian.deleteOne();
        await (0, auditService_1.logAudit)({
            userId: req.user._id,
            action: 'GUARDIAN_DELETED',
            entityType: 'Guardian',
            entityId: guardian._id.toString(),
            details: { name: guardian.fullName, email: guardian.email },
            ipAddress: req.ip,
        });
        res.json({ message: `Guardian ${guardian.fullName} was deleted.` });
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Failed to delete guardian' });
    }
};
exports.deleteGuardian = deleteGuardian;
const linkGuardianToStudent = async (req, res) => {
    try {
        const studentId = req.params.id;
        const { guardianId, relationship, receivesAttendanceEmails, isPrimaryContact } = req.body;
        if (!guardianId) {
            res.status(400).json({ error: 'Guardian ID is required to link.' });
            return;
        }
        const student = await Student_1.Student.findById(studentId);
        if (!student) {
            res.status(404).json({ error: 'Student not found' });
            return;
        }
        const guardian = await Guardian_1.Guardian.findById(guardianId);
        if (!guardian) {
            res.status(404).json({ error: 'Guardian not found' });
            return;
        }
        const link = await StudentGuardian_1.StudentGuardian.findOneAndUpdate({ studentId: student._id, guardianId: guardian._id }, {
            relationship: relationship || 'Guardian',
            receivesAttendanceEmails: receivesAttendanceEmails !== undefined ? receivesAttendanceEmails : true,
            isPrimaryContact: Boolean(isPrimaryContact),
        }, { upsert: true, new: true, setDefaultsOnInsert: true });
        await (0, auditService_1.logAudit)({
            userId: req.user._id,
            action: 'GUARDIAN_LINKED_TO_STUDENT',
            entityType: 'StudentGuardian',
            entityId: link._id.toString(),
            details: { studentId, guardianId, relationship: link.relationship },
            ipAddress: req.ip,
        });
        res.json({ message: 'Guardian linked successfully', link });
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Failed to link guardian' });
    }
};
exports.linkGuardianToStudent = linkGuardianToStudent;
const updateStudentGuardianLink = async (req, res) => {
    try {
        const { id: studentId, guardianId } = req.params;
        const { relationship, receivesAttendanceEmails, isPrimaryContact } = req.body;
        const link = await StudentGuardian_1.StudentGuardian.findOne({ studentId, guardianId });
        if (!link) {
            res.status(404).json({ error: 'Guardian link not found' });
            return;
        }
        if (relationship !== undefined)
            link.relationship = relationship;
        if (receivesAttendanceEmails !== undefined)
            link.receivesAttendanceEmails = Boolean(receivesAttendanceEmails);
        if (isPrimaryContact !== undefined)
            link.isPrimaryContact = Boolean(isPrimaryContact);
        await link.save();
        await (0, auditService_1.logAudit)({
            userId: req.user._id,
            action: 'GUARDIAN_LINK_UPDATED',
            entityType: 'StudentGuardian',
            entityId: link._id.toString(),
            details: { receivesAttendanceEmails: link.receivesAttendanceEmails },
            ipAddress: req.ip,
        });
        res.json({ message: 'Link updated successfully', link });
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Failed to update link' });
    }
};
exports.updateStudentGuardianLink = updateStudentGuardianLink;
const unlinkGuardianFromStudent = async (req, res) => {
    try {
        const { id: studentId, guardianId } = req.params;
        const link = await StudentGuardian_1.StudentGuardian.findOneAndDelete({ studentId, guardianId });
        if (!link) {
            res.status(404).json({ error: 'Guardian link not found' });
            return;
        }
        await (0, auditService_1.logAudit)({
            userId: req.user._id,
            action: 'GUARDIAN_UNLINKED',
            entityType: 'StudentGuardian',
            entityId: link._id.toString(),
            details: { studentId, guardianId },
            ipAddress: req.ip,
        });
        res.json({ message: 'Guardian unlinked successfully from student' });
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Failed to unlink guardian' });
    }
};
exports.unlinkGuardianFromStudent = unlinkGuardianFromStudent;
