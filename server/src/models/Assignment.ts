import mongoose, { Document, Schema } from 'mongoose';

export type AssignmentPublicationStatus = 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'ARCHIVED' | 'CANCELLED';
export type AssignmentTargetMode = 'ALL_ENROLLED' | 'SELECTED_STUDENTS';
export type AssignmentSubmissionType = 'TEXT' | 'FILE' | 'TEXT_OR_FILE' | 'LINK_OR_TEXT';
export type AssignmentLatePolicy = 'ALLOW' | 'REJECT' | 'ACCEPT_FLAG_LATE';

export interface IAssignmentAttachment {
  name: string;
  fileUrl: string;
  fileId?: string;
  storageKey?: string;
  originalName?: string;
  mimeType?: string;
  size?: number;
}

export interface IAssignment extends Document {
  classId: mongoose.Types.ObjectId;
  title: string;
  description: string;
  dueDate: Date;
  totalMarks: number;
  attachments: IAssignmentAttachment[];
  isPublished: boolean;
  publicationStatus: AssignmentPublicationStatus;
  targetMode: AssignmentTargetMode;
  targetStudentIds: mongoose.Types.ObjectId[];
  submissionType: AssignmentSubmissionType;
  latePolicy: AssignmentLatePolicy;
  allowResubmission: boolean;
  maxAttempts?: number | null;
  resubmissionUntil?: Date | null;
  publishAt?: Date | null;
  publishedAt?: Date | null;
  archivedAt?: Date | null;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const AssignmentSchema = new Schema<IAssignment>(
  {
    classId: { type: Schema.Types.ObjectId, ref: 'Class', required: true, index: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    dueDate: { type: Date, required: true },
    totalMarks: { type: Number, required: true, default: 100 },
    attachments: [
      {
        name: { type: String, required: true },
        fileUrl: { type: String, required: true },
        fileId: { type: String },
        storageKey: { type: String },
        originalName: { type: String },
        mimeType: { type: String },
        size: { type: Number, min: 0 },
      },
    ],
    isPublished: { type: Boolean, default: true, index: true },
    publicationStatus: {
      type: String,
      enum: ['DRAFT', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED', 'CANCELLED'],
      default: 'PUBLISHED',
      index: true,
    },
    targetMode: {
      type: String,
      enum: ['ALL_ENROLLED', 'SELECTED_STUDENTS'],
      default: 'ALL_ENROLLED',
    },
    targetStudentIds: [{ type: Schema.Types.ObjectId, ref: 'Student' }],
    submissionType: {
      type: String,
      enum: ['TEXT', 'FILE', 'TEXT_OR_FILE', 'LINK_OR_TEXT'],
      default: 'LINK_OR_TEXT',
    },
    latePolicy: {
      type: String,
      enum: ['ALLOW', 'REJECT', 'ACCEPT_FLAG_LATE'],
      default: 'ACCEPT_FLAG_LATE',
    },
    allowResubmission: { type: Boolean, default: false },
    maxAttempts: { type: Number, default: null, min: 1 },
    resubmissionUntil: { type: Date, default: null },
    publishAt: { type: Date, default: null, index: true },
    publishedAt: { type: Date, default: null },
    archivedAt: { type: Date, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  {
    timestamps: true,
  }
);

AssignmentSchema.index({ classId: 1, publicationStatus: 1, dueDate: 1 });
AssignmentSchema.index({ publicationStatus: 1, publishAt: 1 });

export const Assignment = mongoose.model<IAssignment>('Assignment', AssignmentSchema);
