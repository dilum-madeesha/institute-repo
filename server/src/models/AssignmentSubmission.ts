import mongoose, { Document, Schema } from 'mongoose';

export type SubmissionStatus = 'SUBMITTED' | 'GRADED' | 'LATE';

export interface IAssignmentSubmission extends Document {
  assignmentId: mongoose.Types.ObjectId;
  studentId: mongoose.Types.ObjectId;
  classId: mongoose.Types.ObjectId;
  submissionText: string;
  attachmentUrl?: string;
  submittedAt: Date;
  status: SubmissionStatus;
  marksAwarded?: number | null;
  feedback?: string;
  gradedBy?: mongoose.Types.ObjectId | null;
  gradedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const AssignmentSubmissionSchema = new Schema<IAssignmentSubmission>(
  {
    assignmentId: { type: Schema.Types.ObjectId, ref: 'Assignment', required: true, index: true },
    studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true, index: true },
    classId: { type: Schema.Types.ObjectId, ref: 'Class', required: true, index: true },
    submissionText: { type: String, default: '' },
    attachmentUrl: { type: String },
    submittedAt: { type: Date, default: Date.now },
    status: {
      type: String,
      enum: ['SUBMITTED', 'GRADED', 'LATE'],
      default: 'SUBMITTED',
      index: true,
    },
    marksAwarded: { type: Number, default: null },
    feedback: { type: String, default: '' },
    gradedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    gradedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
  }
);

AssignmentSubmissionSchema.index({ assignmentId: 1, studentId: 1 }, { unique: true });

export const AssignmentSubmission = mongoose.model<IAssignmentSubmission>(
  'AssignmentSubmission',
  AssignmentSubmissionSchema
);
