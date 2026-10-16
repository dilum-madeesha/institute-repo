import mongoose, { Document, Schema } from 'mongoose';

export interface IStudentGuardian extends Document {
  studentId: mongoose.Types.ObjectId;
  guardianId: mongoose.Types.ObjectId;
  relationship: string;
  receivesAttendanceEmails: boolean;
  isPrimaryContact: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const StudentGuardianSchema = new Schema<IStudentGuardian>(
  {
    studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true, index: true },
    guardianId: { type: Schema.Types.ObjectId, ref: 'Guardian', required: true, index: true },
    relationship: { type: String, required: true, default: 'Guardian' },
    receivesAttendanceEmails: { type: Boolean, default: true },
    isPrimaryContact: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  }
);

// Enforce unique link between student and guardian
StudentGuardianSchema.index({ studentId: 1, guardianId: 1 }, { unique: true });

export const StudentGuardian = mongoose.model<IStudentGuardian>('StudentGuardian', StudentGuardianSchema);
