"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAuditLogs = void 0;
const AuditLog_1 = require("../models/AuditLog");
const getAuditLogs = async (req, res) => {
    try {
        const { action, entityType, limit = 50 } = req.query;
        const filter = {};
        if (action)
            filter.action = action;
        if (entityType)
            filter.entityType = entityType;
        const logs = await AuditLog_1.AuditLog.find(filter)
            .populate('userId', 'fullName email role')
            .sort({ createdAt: -1 })
            .limit(Number(limit));
        res.json(logs);
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Failed to fetch audit logs' });
    }
};
exports.getAuditLogs = getAuditLogs;
