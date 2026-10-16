"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.changePassword = exports.logout = exports.getMe = exports.login = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const User_1 = require("../models/User");
const env_1 = require("../config/env");
const auditService_1 = require("../services/auditService");
const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            res.status(400).json({ error: 'Please enter both email and password.' });
            return;
        }
        const normalizedEmail = email.toLowerCase().trim();
        const user = await User_1.User.findOne({ email: normalizedEmail });
        if (!user) {
            await (0, auditService_1.logAudit)({
                action: 'LOGIN_FAILED',
                entityType: 'User',
                details: { email: normalizedEmail, reason: 'User not found' },
                ipAddress: req.ip,
            });
            res.status(401).json({ error: 'Invalid email or password.' });
            return;
        }
        if (user.status !== 'ACTIVE') {
            await (0, auditService_1.logAudit)({
                userId: user._id,
                action: 'LOGIN_BLOCKED',
                entityType: 'User',
                entityId: user._id.toString(),
                details: { reason: 'Account inactive' },
                ipAddress: req.ip,
            });
            res.status(403).json({ error: 'Your account is deactivated. Please contact an administrator.' });
            return;
        }
        const isMatch = await bcryptjs_1.default.compare(password, user.passwordHash);
        if (!isMatch) {
            await (0, auditService_1.logAudit)({
                userId: user._id,
                action: 'LOGIN_FAILED',
                entityType: 'User',
                entityId: user._id.toString(),
                details: { reason: 'Incorrect password' },
                ipAddress: req.ip,
            });
            res.status(401).json({ error: 'Invalid email or password.' });
            return;
        }
        user.lastLoginAt = new Date();
        await user.save();
        const token = jsonwebtoken_1.default.sign({ id: user._id, role: user.role, email: user.email }, env_1.ENV.JWT_SECRET, { expiresIn: '7d' });
        await (0, auditService_1.logAudit)({
            userId: user._id,
            action: 'LOGIN_SUCCESS',
            entityType: 'User',
            entityId: user._id.toString(),
            ipAddress: req.ip,
        });
        res.json({
            message: 'Login successful',
            token,
            user: {
                id: user._id,
                fullName: user.fullName,
                email: user.email,
                role: user.role,
                status: user.status,
                studentId: user.studentId,
                guardianId: user.guardianId,
                lastLoginAt: user.lastLoginAt,
            },
        });
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Failed to sign in' });
    }
};
exports.login = login;
const getMe = async (req, res) => {
    if (!req.user) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
    }
    res.json({
        user: {
            id: req.user._id,
            fullName: req.user.fullName,
            email: req.user.email,
            role: req.user.role,
            status: req.user.status,
            studentId: req.user.studentId,
            guardianId: req.user.guardianId,
            lastLoginAt: req.user.lastLoginAt,
        },
    });
};
exports.getMe = getMe;
const logout = async (req, res) => {
    if (req.user) {
        await (0, auditService_1.logAudit)({
            userId: req.user._id,
            action: 'LOGOUT',
            entityType: 'User',
            entityId: req.user._id.toString(),
            ipAddress: req.ip,
        });
    }
    res.json({ message: 'Logged out successfully' });
};
exports.logout = logout;
const changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        if (!currentPassword || !newPassword) {
            res.status(400).json({ error: 'Please provide both current and new password.' });
            return;
        }
        if (newPassword.length < 6) {
            res.status(400).json({ error: 'New password must be at least 6 characters long.' });
            return;
        }
        const user = await User_1.User.findById(req.user._id);
        if (!user) {
            res.status(404).json({ error: 'User not found' });
            return;
        }
        const isMatch = await bcryptjs_1.default.compare(currentPassword, user.passwordHash);
        if (!isMatch) {
            res.status(400).json({ error: 'Current password does not match.' });
            return;
        }
        user.passwordHash = await bcryptjs_1.default.hash(newPassword, 10);
        await user.save();
        await (0, auditService_1.logAudit)({
            userId: user._id,
            action: 'PASSWORD_CHANGED',
            entityType: 'User',
            entityId: user._id.toString(),
            ipAddress: req.ip,
        });
        res.json({ message: 'Password changed successfully.' });
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Failed to change password' });
    }
};
exports.changePassword = changePassword;
