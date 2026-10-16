import mongoose, { Document, Schema } from 'mongoose';

export type SubmissionStatus = 'SUBMITTED' | 'GRADED' | 'LATE' | 'RETURNED';

export interface ISubmissionFile {
  fileId: string;
  storageKey: string;
  originalName: string;
  mimeType: string;
  size: number;
}

interface ISubmissionAttempt {
  attemptNumber: number;
  submissionText: string;
  attachmentUrl?: string;
  submissionFiles: ISubmissionFile[];
  submittedAt: Date;
  status: SubmissionStatus;
  marksAwarded?: number | null;
  feedback?: string;
  gradedBy?: mongoose.Types.ObjectId | null;
  gradedAt?: Date | null;
  gradeReleasedAt?: Date | null;
}

export interface IAssignmentSubmission extends Document {
  assignmentId: mongoose.Types.ObjectId;
  studentId: mongoose.Types.ObjectId;
  classId: mongoose.Types.ObjectId;
  submissionText: string;
  attachmentUrl?: string;
  submissionFiles: ISubmissionFile[];
  submittedAt: Date;
  status: SubmissionStatus;
  marksAwarded?: number | null;
  feedback?: string;
  gradedBy?: mongoose.Types.ObjectId | null;
  gradedAt?: Date | null;
  gradeReleasedAt?: Date | null;
  attemptNumber: number;
  attemptHistory: ISubmissionAttempt[];
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
    submissionFiles: [
      {
        fileId: { type: String, required: true },
        storageKey: { type: String, required: true },
        originalName: { type: String, required: true },
        mimeType: { type: String, required: true },
        size: { type: Number, required: true, min: 0 },
      },
    ],
    submittedAt: { type: Date, default: Date.now },
    status: {
      type: String,
      enum: ['SUBMITTED', 'GRADED', 'LATE', 'RETURNED'],
      default: 'SUBMITTED',
      index: true,
    },
    marksAwarded: { type: Number, default: null },
    feedback: { type: String, default: '' },
    gradedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    gradedAt: { type: Date, default: null },
    gradeReleasedAt: { type: Date, default: null },
    attemptNumber: { type: Number, default: 1, min: 1 },
    attemptHistory: [
      {
        attemptNumber: { type: Number, required: true },
        submissionText: { type: String, default: '' },
        attachmentUrl: { type: String },
        submissionFiles: [
          {
            fileId: { type: String, required: true },
            storageKey: { type: String, required: true },
            originalName: { type: String, required: true },
            mimeType: { type: String, required: true },
            size: { type: Number, required: true, min: 0 },
          },
        ],
        submittedAt: { type: Date, required: true },
        status: {
          type: String,
          enum: ['SUBMITTED', 'GRADED', 'LATE', 'RETURNED'],
          required: true,
        },
        marksAwarded: { type: Number, default: null },
        feedback: { type: String, default: '' },
        gradedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
        gradedAt: { type: Date, default: null },
        gradeReleasedAt: { type: Date, default: null },
      },
    ],
  },
  {
    timestamps: true,
    optimisticConcurrency: true,
  }
);

AssignmentSubmissionSchema.index({ assignmentId: 1, studentId: 1 }, { unique: true });
AssignmentSubmissionSchema.index({ assignmentId: 1, status: 1 });

export const AssignmentSubmission = mongoose.model<IAssignmentSubmission>(
  'AssignmentSubmission',
  AssignmentSubmissionSchema
);
