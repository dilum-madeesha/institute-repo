import mongoose, { Document, Schema } from 'mongoose';

export type NotificationStatus = 'PENDING' | 'PROCESSING' | 'SENT' | 'FAILED' | 'SKIPPED' | 'CANCELLED';
export type NotificationType = 'ABSENCE';

export interface IEmailNotification extends Document {
  studentId: mongoose.Types.ObjectId;
  guardianId?: mongoose.Types.ObjectId | null;
  classSessionId: mongoose.Types.ObjectId;
  attendanceRecordId: mongoose.Types.ObjectId;
  recipientEmail: string;
  recipientName?: string;
  notificationType: NotificationType;
  status: NotificationStatus;
  attemptCount: number;
  providerMessageId?: string | null;
  lastError?: string | null;
  nextAttemptAt?: Date | null;
  sentAt?: Date | null;
  dedupKey: string;
  createdAt: Date;
  updatedAt: Date;
}

const EmailNotificationSchema = new Schema<IEmailNotification>(
  {
    studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true, index: true },
    guardianId: { type: Schema.Types.ObjectId, ref: 'Guardian', default: null },
    classSessionId: { type: Schema.Types.ObjectId, ref: 'ClassSession', required: true, index: true },
    attendanceRecordId: { type: Schema.Types.ObjectId, ref: 'AttendanceRecord', required: true, index: true },
    recipientEmail: { type: String, required: true, trim: true, lowercase: true },
    recipientName: { type: String, trim: true },
    notificationType: {
      type: String,
      enum: ['ABSENCE'],
      default: 'ABSENCE',
      required: true,
    },
    status: {
      type: String,
      enum: ['PENDING', 'PROCESSING', 'SENT', 'FAILED', 'SKIPPED', 'CANCELLED'],
      default: 'PENDING',
      index: true,
    },
    attemptCount: { type: Number, default: 0 },
    providerMessageId: { type: String, default: null },
    lastError: { type: String, default: null },
    nextAttemptAt: { type: Date, default: null },
    sentAt: { type: Date, default: null },
    dedupKey: { type: String, required: true, unique: true, index: true },
  },
  {
    timestamps: true,
  }
);

EmailNotificationSchema.index({ status: 1, nextAttemptAt: 1 });

export const EmailNotification = mongoose.model<IEmailNotification>('EmailNotification', EmailNotificationSchema);
