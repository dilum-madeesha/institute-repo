"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.retryNotification = exports.getNotificationById = exports.getNotifications = void 0;
const EmailNotification_1 = require("../models/EmailNotification");
const notificationWorker_1 = require("../services/notificationWorker");
const getNotifications = async (req, res) => {
    try {
        const { status, search, sessionId, limit = 100 } = req.query;
        const filter = {};
        if (status)
            filter.status = status;
        if (sessionId)
            filter.classSessionId = sessionId;
        if (search) {
            filter.$or = [
                { recipientEmail: { $regex: String(search), $options: 'i' } },
                { recipientName: { $regex: String(search), $options: 'i' } },
            ];
        }
        const notifications = await EmailNotification_1.EmailNotification.find(filter)
            .populate('studentId', 'firstName lastName displayName studentNumber')
            .populate('guardianId', 'fullName email phone')
            .populate({
            path: 'classSessionId',
            populate: { path: 'classId', select: 'name classCode' },
        })
            .sort({ createdAt: -1 })
            .limit(Number(limit));
        res.json(notifications);
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Failed to fetch notifications' });
    }
};
exports.getNotifications = getNotifications;
const getNotificationById = async (req, res) => {
    try {
        const notif = await EmailNotification_1.EmailNotification.findById(req.params.id)
            .populate('studentId')
            .populate('guardianId')
            .populate({
            path: 'classSessionId',
            populate: { path: 'classId', select: 'name classCode' },
        });
        if (!notif) {
            res.status(404).json({ error: 'Notification record not found' });
            return;
        }
        res.json(notif);
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Failed to fetch notification' });
    }
};
exports.getNotificationById = getNotificationById;
const retryNotification = async (req, res) => {
    try {
        const updated = await (0, notificationWorker_1.retryNotificationManually)(req.params.id, req.user._id.toString());
        res.json({ message: 'Notification scheduled for retry.', notification: updated });
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Failed to retry notification' });
    }
};
exports.retryNotification = retryNotification;
