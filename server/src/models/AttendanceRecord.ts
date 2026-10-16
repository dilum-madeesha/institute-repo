import mongoose, { Document, Schema } from 'mongoose';

export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';

export interface IAttendanceRecord extends Document {
  classSessionId: mongoose.Types.ObjectId;
  studentId: mongoose.Types.ObjectId;
  status: AttendanceStatus;
  arrivalTime?: string;
  note?: string;
  markedBy: mongoose.Types.ObjectId;
  markedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const AttendanceRecordSchema = new Schema<IAttendanceRecord>(
  {
    classSessionId: { type: Schema.Types.ObjectId, ref: 'ClassSession', required: true, index: true },
    studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true, index: true },
    status: {
      type: String,
      enum: ['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'],
      required: true,
      index: true,
    },
    arrivalTime: { type: String, trim: true },
    note: { type: String, trim: true },
    markedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    markedAt: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
  }
);

AttendanceRecordSchema.index({ classSessionId: 1, studentId: 1 }, { unique: true });

export const AttendanceRecord = mongoose.model<IAttendanceRecord>('AttendanceRecord', AttendanceRecordSchema);
