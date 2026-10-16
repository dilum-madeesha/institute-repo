import mongoose, { Document, Schema } from 'mongoose';

export interface IExamQuestion {
  id: string;
  questionText: string;
  questionType: 'MCQ' | 'SHORT';
  options?: string[];
  correctAnswer?: string;
  marks: number;
}

export interface IExamination extends Document {
  classId: mongoose.Types.ObjectId;
  title: string;
  description: string;
  examDate: Date;
  durationMinutes: number;
  totalMarks: number;
  questions: IExamQuestion[];
  isPublished: boolean;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ExaminationSchema = new Schema<IExamination>(
  {
    classId: { type: Schema.Types.ObjectId, ref: 'Class', required: true, index: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: '' },
    examDate: { type: Date, required: true },
    durationMinutes: { type: Number, required: true, default: 60 },
    totalMarks: { type: Number, required: true, default: 100 },
    questions: [
      {
        id: { type: String, required: true },
        questionText: { type: String, required: true },
        questionType: { type: String, enum: ['MCQ', 'SHORT'], default: 'MCQ' },
        options: [{ type: String }],
        correctAnswer: { type: String },
        marks: { type: Number, default: 5 },
      },
    ],
    isPublished: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  {
    timestamps: true,
  }
);

ExaminationSchema.index({ classId: 1, examDate: 1 });

export const Examination = mongoose.model<IExamination>('Examination', ExaminationSchema);
