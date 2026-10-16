import mongoose, { Document, Schema } from 'mongoose';

export interface ILessonAttachment {
  name: string;
  fileUrl: string;
  fileType: string;
  fileSize?: string;
}

export interface ILesson extends Document {
  classId: mongoose.Types.ObjectId;
  title: string;
  description?: string;
  videoUrl?: string;
  duration?: string;
  attachments: ILessonAttachment[];
  order: number;
  isPublished: boolean;
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
    attachments: [
      {
        name: { type: String, required: true },
        fileUrl: { type: String, required: true },
        fileType: { type: String, default: 'PDF' },
        fileSize: { type: String },
      },
    ],
    order: { type: Number, default: 0 },
    isPublished: { type: Boolean, default: true, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  {
    timestamps: true,
  }
);

LessonSchema.index({ classId: 1, order: 1 });

export const Lesson = mongoose.model<ILesson>('Lesson', LessonSchema);
