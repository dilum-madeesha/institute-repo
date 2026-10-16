import mongoose, { Document, Schema } from 'mongoose';

export interface ILessonAttachment {
  name: string;
  fileUrl: string;
  fileType: string;
  fileSize?: string;
  fileId?: string;
  storageKey?: string;
  originalName?: string;
  mimeType?: string;
  size?: number;
}

export type LessonPublicationStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

export interface ILesson extends Document {
  classId: mongoose.Types.ObjectId;
  title: string;
  description?: string;
  videoUrl?: string;
  duration?: string;
  chapter?: string;
  topic?: string;
  attachments: ILessonAttachment[];
  order: number;
  isPublished: boolean;
  publicationStatus: LessonPublicationStatus;
  publishedAt?: Date | null;
  archivedAt?: Date | null;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const LessonSchema = new Schema<ILesson>(
  {
    classId: { type: Schema.Types.ObjectId, ref: 'Class', required: true, index: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: '' },
    videoUrl: { type: String, trim: true, default: '' },
    duration: { type: String, trim: true, default: '' },
    chapter: { type: String, trim: true, default: '' },
    topic: { type: String, trim: true, default: '' },
    attachments: [
      {
        name: { type: String, required: true },
        fileUrl: { type: String, required: true },
        fileType: { type: String, default: 'PDF' },
        fileSize: { type: String },
        fileId: { type: String },
        storageKey: { type: String },
        originalName: { type: String },
        mimeType: { type: String },
        size: { type: Number, min: 0 },
      },
    ],
    order: { type: Number, default: 0 },
    isPublished: { type: Boolean, default: true, index: true },
    publicationStatus: {
      type: String,
      enum: ['DRAFT', 'PUBLISHED', 'ARCHIVED'],
      default: 'PUBLISHED',
      index: true,
    },
    publishedAt: { type: Date, default: null },
    archivedAt: { type: Date, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  {
    timestamps: true,
  }
);

LessonSchema.index({ classId: 1, order: 1 });
LessonSchema.index({ classId: 1, publicationStatus: 1, order: 1 });

export const Lesson = mongoose.model<ILesson>('Lesson', LessonSchema);
