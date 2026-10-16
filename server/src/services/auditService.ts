import mongoose from 'mongoose';
import { AuditLog } from '../models/AuditLog';

interface AuditLogParams {
  userId?: string | mongoose.Types.ObjectId | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  details?: Record<string, any>;
  ipAddress?: string;
}

export const logAudit = async (params: AuditLogParams): Promise<void> => {
  try {
    const cleanDetails = { ...params.details };
    // Never record sensitive data such as password or token
    if (cleanDetails.password) delete cleanDetails.password;
    if (cleanDetails.currentPassword) delete cleanDetails.currentPassword;
    if (cleanDetails.newPassword) delete cleanDetails.newPassword;
    if (cleanDetails.token) delete cleanDetails.token;

    await AuditLog.create({
      userId: params.userId || null,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId || null,
      details: cleanDetails,
      ipAddress: params.ipAddress,
    });
  } catch (error) {
    console.error('[AuditService] Failed to create audit log:', error);
  }
};
