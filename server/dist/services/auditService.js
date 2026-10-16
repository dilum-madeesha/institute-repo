"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logAudit = void 0;
const AuditLog_1 = require("../models/AuditLog");
const logAudit = async (params) => {
    try {
        const cleanDetails = { ...params.details };
        // Never record sensitive data such as password or token
        if (cleanDetails.password)
            delete cleanDetails.password;
        if (cleanDetails.currentPassword)
            delete cleanDetails.currentPassword;
        if (cleanDetails.newPassword)
            delete cleanDetails.newPassword;
        if (cleanDetails.token)
            delete cleanDetails.token;
        await AuditLog_1.AuditLog.create({
            userId: params.userId || null,
            action: params.action,
            entityType: params.entityType,
            entityId: params.entityId || null,
            details: cleanDetails,
            ipAddress: params.ipAddress,
        });
    }
    catch (error) {
        console.error('[AuditService] Failed to create audit log:', error);
    }
};
exports.logAudit = logAudit;
