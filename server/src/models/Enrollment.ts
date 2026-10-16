import mongoose, { Document, Schema } from 'mongoose';

export type EnrollmentStatus = 'ACTIVE' | 'COMPLETED' | 'WITHDRAWN';

export interface IEnrollment extends Document {
  studentId: mongoose.Types.ObjectId;
  classId: mongoose.Types.ObjectId;
  startDate: Date;
  endDate?: Date | null;
  status: EnrollmentStatus;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const EnrollmentSchema = new Schema<IEnrollment>(
  {
    studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true, index: true },
    classId: { type: Schema.Types.ObjectId, ref: 'Class', required: true, index: true },
    startDate: { type: Date, required: true, default: Date.now },
    endDate: { type: Date, default: null },
    status: {
      type: String,
      enum: ['ACTIVE', 'COMPLETED', 'WITHDRAWN'],
      default: 'ACTIVE',
      index: true,
    },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  {
    timestamps: true,
  }
);

EnrollmentSchema.index({ classId: 1, status: 1 });
EnrollmentSchema.index({ studentId: 1, status: 1 });

export const Enrollment = mongoose.model<IEnrollment>('Enrollment', EnrollmentSchema);
