import mongoose, { Document, Schema } from 'mongoose';

export type SessionStatus = 'DRAFT' | 'SUBMITTED' | 'LOCKED';

export interface IClassSession extends Document {
  classId: mongoose.Types.ObjectId;
  sessionDate: Date;
  startTime?: string;
  endTime?: string;
  title?: string;
  timeZone?: string;
  status: SessionStatus;
  isPublished: boolean;
  publishedAt?: Date | null;
  createdBy: mongoose.Types.ObjectId;
  submittedBy?: mongoose.Types.ObjectId | null;
  submittedAt?: Date | null;
  autoFinalizedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const ClassSessionSchema = new Schema<IClassSession>(
  {
    classId: { type: Schema.Types.ObjectId, ref: 'Class', required: true, index: true },
    sessionDate: { type: Date, required: true },
    startTime: { type: String, trim: true },
    endTime: { type: String, trim: true },
    title: { type: String, trim: true, default: '' },
    timeZone: { type: String, trim: true, default: 'Asia/Colombo' },
    status: {
      type: String,
      enum: ['DRAFT', 'SUBMITTED', 'LOCKED'],
      default: 'DRAFT',
      index: true,
    },
    isPublished: { type: Boolean, default: true, index: true },
    publishedAt: { type: Date, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    submittedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    submittedAt: { type: Date, default: null },
    autoFinalizedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
  }
);

ClassSessionSchema.index({ classId: 1, sessionDate: 1 });
ClassSessionSchema.index({ classId: 1, isPublished: 1, sessionDate: -1 });

export const ClassSession = mongoose.model<IClassSession>('ClassSession', ClassSessionSchema);
