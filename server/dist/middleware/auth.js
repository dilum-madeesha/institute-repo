"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticate = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const env_1 = require("../config/env");
const User_1 = require("../models/User");
const Student_1 = require("../models/Student");
const authenticate = async (req, res, next) => {
    try {
        let token;
        if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
            token = req.headers.authorization.split(' ')[1];
        }
        if (!token) {
            res.status(401).json({ error: 'Authentication required. Please sign in.' });
            return;
        }
        const decoded = jsonwebtoken_1.default.verify(token, env_1.ENV.JWT_SECRET);
        const user = await User_1.User.findById(decoded.id);
        if (!user) {
            res.status(401).json({ error: 'User account not found.' });
            return;
        }
        const normalizedRole = (0, User_1.normalizeUserRole)(user.role);
        if (!normalizedRole) {
            res.status(403).json({ error: 'This account has an unsupported role. Please contact an administrator.' });
            return;
        }
        if (user.role !== normalizedRole) {
            user.role = normalizedRole;
        }
        const normalizedStatus = (0, User_1.normalizeAccountStatus)(user.status);
        if (normalizedStatus !== 'ACTIVE') {
            res.status(403).json({ error: 'Account is deactivated. Please contact an administrator.' });
            return;
        }
        user.status = normalizedStatus;
        if (user.role === 'STUDENT') {
            try {
                const normalizedEmail = user.email.trim().toLowerCase();
                const linkedStudent = user.studentId
                    ? await Student_1.Student.findById(user.studentId).select('_id email status')
                    : null;
                const linkedEmail = linkedStudent?.email?.trim().toLowerCase();
                const linkMatchesLogin = Boolean(linkedStudent &&
                    String(linkedStudent.status).toUpperCase() === 'ACTIVE' &&
                    (!linkedEmail || linkedEmail === normalizedEmail));
                if (!linkMatchesLogin) {
                    const matchingStudents = await Student_1.Student.find({
                        email: { $regex: `^${normalizedEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' },
                        status: /^ACTIVE$/i,
                    })
                        .select('_id')
                        .limit(2);
                    if (matchingStudents.length === 1) {
                        const studentId = matchingStudents[0]._id;
                        const alreadyLinkedAccount = await User_1.User.exists({
                            _id: { $ne: user._id },
                            role: /^STUDENT$/i,
                            studentId,
                        });
                        if (!alreadyLinkedAccount) {
                            user.studentId = studentId;
                        }
                    }
                }
            }
            catch (error) {
                console.error('Failed to verify the student profile link:', error);
                res.status(500).json({ error: 'Unable to verify the student profile link. Please try again.' });
                return;
            }
        }
        if (user.isModified()) {
            try {
                await user.save();
            }
            catch (error) {
                console.error('Failed to normalize legacy account data:', error);
                res.status(500).json({ error: 'Unable to update account details. Please try again.' });
                return;
            }
        }
        req.user = user;
        next();
    }
    catch (error) {
        if (error instanceof jsonwebtoken_1.default.JsonWebTokenError ||
            error instanceof jsonwebtoken_1.default.TokenExpiredError ||
            error instanceof jsonwebtoken_1.default.NotBeforeError) {
            res.status(401).json({ error: 'Invalid or expired session token. Please sign in again.' });
            return;
        }
        console.error('Authentication middleware failed:', error);
        res.status(500).json({ error: 'Unable to verify your account. Please try again.' });
    }
};
exports.authenticate = authenticate;
