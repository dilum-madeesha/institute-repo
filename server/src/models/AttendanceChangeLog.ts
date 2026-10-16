import mongoose, { Document, Schema } from 'mongoose';
import { AttendanceStatus } from './AttendanceRecord';

export interface IAttendanceChangeLog extends Document {
  attendanceRecordId: mongoose.Types.ObjectId;
  classSessionId: mongoose.Types.ObjectId;
  studentId: mongoose.Types.ObjectId;
  oldStatus: AttendanceStatus;
  newStatus: AttendanceStatus;
  reason: string;
  changedBy: mongoose.Types.ObjectId;
  changedAt: Date;
}

const AttendanceChangeLogSchema = new Schema<IAttendanceChangeLog>(
  {
    attendanceRecordId: { type: Schema.Types.ObjectId, ref: 'AttendanceRecord', required: true, index: true },
    classSessionId: { type: Schema.Types.ObjectId, ref: 'ClassSession', required: true, index: true },
    studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true, index: true },
    oldStatus: {
      type: String,
      enum: ['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'],
      required: true,
    },
    newStatus: {
      type: String,
      enum: ['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'],
      required: true,
    },
    reason: { type: String, required: true, trim: true },
    changedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    changedAt: { type: Date, default: Date.now },
  },
  {
    timestamps: false,
  }
);

export const AttendanceChangeLog = mongoose.model<IAttendanceChangeLog>('AttendanceChangeLog', AttendanceChangeLogSchema);
