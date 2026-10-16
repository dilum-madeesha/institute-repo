"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteTeacher = exports.resetUserPassword = exports.toggleUserStatus = exports.updateUser = exports.createUser = exports.getUserById = exports.getUsers = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const User_1 = require("../models/User");
const Class_1 = require("../models/Class");
const auditService_1 = require("../services/auditService");
const getUsers = async (req, res) => {
    try {
        const { role, status, search } = req.query;
        const filter = {};
        if (role)
            filter.role = role;
        if (status)
            filter.status = status;
        if (search) {
            filter.$or = [
                { fullName: { $regex: String(search), $options: 'i' } },
                { email: { $regex: String(search), $options: 'i' } },
            ];
        }
        const users = await User_1.User.find(filter).sort({ createdAt: -1 });
        res.json(users);
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Failed to fetch users' });
    }
};
exports.getUsers = getUsers;
const getUserById = async (req, res) => {
    try {
        const user = await User_1.User.findById(req.params.id);
        if (!user) {
            res.status(404).json({ error: 'User not found' });
            return;
        }
        res.json(user);
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Failed to fetch user' });
    }
};
exports.getUserById = getUserById;
const createUser = async (req, res) => {
    try {
        const { fullName, email, password, role } = req.body;
        if (!fullName || !email || !password) {
            res.status(400).json({ error: 'Full name, email, and password are required.' });
            return;
        }
        if (String(password).length < 6) {
            res.status(400).json({ error: 'Password must be at least 6 characters long.' });
            return;
        }
        const normalizedEmail = email.toLowerCase().trim();
        const existing = await User_1.User.findOne({ email: normalizedEmail });
        if (existing) {
            res.status(409).json({ error: 'A user with this email address already exists.' });
            return;
        }
        const passwordHash = await bcryptjs_1.default.hash(password, 10);
        const user = await User_1.User.create({
            fullName: fullName.trim(),
            email: normalizedEmail,
            passwordHash,
            role: role === 'ADMIN' ? 'ADMIN' : 'TEACHER',
            status: 'ACTIVE',
        });
        await (0, auditService_1.logAudit)({
            userId: req.user._id,
            action: 'USER_CREATED',
            entityType: 'User',
            entityId: user._id.toString(),
            details: { email: user.email, role: user.role },
            ipAddress: req.ip,
        });
        res.status(201).json({
            message: 'User created successfully',
            user: {
                id: user._id,
                fullName: user.fullName,
                email: user.email,
                role: user.role,
                status: user.status,
            },
        });
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Failed to create user' });
    }
};
exports.createUser = createUser;
const updateUser = async (req, res) => {
    try {
        const { fullName, email, role, password } = req.body;
        const user = await User_1.User.findById(req.params.id);
        if (!user) {
            res.status(404).json({ error: 'User not found' });
            return;
        }
        if (password !== undefined && String(password).length > 0 && String(password).length < 6) {
            res.status(400).json({ error: 'Password must be at least 6 characters long.' });
            return;
        }
        if (email && email.toLowerCase().trim() !== user.email) {
            const normalizedEmail = email.toLowerCase().trim();
            const existing = await User_1.User.findOne({ email: normalizedEmail });
            if (existing) {
                res.status(409).json({ error: 'A user with this email already exists.' });
                return;
            }
            user.email = normalizedEmail;
        }
        if (fullName)
            user.fullName = fullName.trim();
        if (role)
            user.role = role;
        if (password)
            user.passwordHash = await bcryptjs_1.default.hash(String(password), 10);
        await user.save();
        await (0, auditService_1.logAudit)({
            userId: req.user._id,
            action: 'USER_UPDATED',
            entityType: 'User',
            entityId: user._id.toString(),
            details: {
                fullName: user.fullName,
                email: user.email,
                role: user.role,
                passwordChanged: Boolean(password),
            },
            ipAddress: req.ip,
        });
        res.json({ message: 'User updated successfully', user });
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Failed to update user' });
    }
};
exports.updateUser = updateUser;
const toggleUserStatus = async (req, res) => {
    try {
        const user = await User_1.User.findById(req.params.id);
        if (!user) {
            res.status(404).json({ error: 'User not found' });
            return;
        }
        // Prevent admin from deactivating themselves
        if (user._id.toString() === req.user._id.toString()) {
            res.status(400).json({ error: 'You cannot deactivate your own account.' });
            return;
        }
        user.status = user.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
        await user.save();
        await (0, auditService_1.logAudit)({
            userId: req.user._id,
            action: user.status === 'ACTIVE' ? 'USER_ACTIVATED' : 'USER_DEACTIVATED',
            entityType: 'User',
            entityId: user._id.toString(),
            details: { newStatus: user.status },
            ipAddress: req.ip,
        });
        res.json({ message: `User account is now ${user.status.toLowerCase()}.`, user });
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Failed to update user status' });
    }
};
exports.toggleUserStatus = toggleUserStatus;
const resetUserPassword = async (req, res) => {
    try {
        const { newPassword } = req.body;
        if (!newPassword || newPassword.length < 6) {
            res.status(400).json({ error: 'New password must be at least 6 characters long.' });
            return;
        }
        const user = await User_1.User.findById(req.params.id);
        if (!user) {
            res.status(404).json({ error: 'User not found' });
            return;
        }
        user.passwordHash = await bcryptjs_1.default.hash(newPassword, 10);
        await user.save();
        await (0, auditService_1.logAudit)({
            userId: req.user._id,
            action: 'USER_PASSWORD_RESET_BY_ADMIN',
            entityType: 'User',
            entityId: user._id.toString(),
            ipAddress: req.ip,
        });
        res.json({ message: `Password reset successfully for ${user.fullName}.` });
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Failed to reset password' });
    }
};
exports.resetUserPassword = resetUserPassword;
const deleteTeacher = async (req, res) => {
    try {
        const teacher = await User_1.User.findById(req.params.id);
        if (!teacher) {
            res.status(404).json({ error: 'Teacher not found.' });
            return;
        }
        if (teacher.role !== 'TEACHER') {
            res.status(400).json({ error: 'Only teacher accounts can be deleted from this endpoint.' });
            return;
        }
        await Class_1.ClassModel.updateMany({ teachers: teacher._id }, { $pull: { teachers: teacher._id } });
        await teacher.deleteOne();
        await (0, auditService_1.logAudit)({
            userId: req.user._id,
            action: 'TEACHER_DELETED',
            entityType: 'User',
            entityId: teacher._id.toString(),
            details: { fullName: teacher.fullName, email: teacher.email },
            ipAddress: req.ip,
        });
        res.json({ message: `Teacher account for ${teacher.fullName} was deleted.` });
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Failed to delete teacher' });
    }
};
exports.deleteTeacher = deleteTeacher;
