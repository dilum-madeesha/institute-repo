import mongoose, { Document, Schema } from 'mongoose';

export interface IExamSubmissionAnswer {
  questionId: string;
  answerText: string;
  isCorrect?: boolean;
  marksAwarded?: number;
}

export interface IExamSubmission extends Document {
  examId: mongoose.Types.ObjectId;
  studentId: mongoose.Types.ObjectId;
  classId: mongoose.Types.ObjectId;
  answers: IExamSubmissionAnswer[];
  score: number;
  status: 'SUBMITTED' | 'GRADED';
  feedback?: string;
  submittedAt: Date;
  gradedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const ExamSubmissionSchema = new Schema<IExamSubmission>(
  {
    examId: { type: Schema.Types.ObjectId, ref: 'Examination', required: true, index: true },
    studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true, index: true },
    classId: { type: Schema.Types.ObjectId, ref: 'Class', required: true, index: true },
    answers: [
      {
        questionId: { type: String, required: true },
        answerText: { type: String, default: '' },
        isCorrect: { type: Boolean, default: false },
        marksAwarded: { type: Number, default: 0 },
      },
    ],
    score: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ['SUBMITTED', 'GRADED'],
      default: 'SUBMITTED',
      index: true,
    },
    feedback: { type: String, default: '' },
    submittedAt: { type: Date, default: Date.now },
    gradedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
  }
);

ExamSubmissionSchema.index({ examId: 1, studentId: 1 }, { unique: true });

export const ExamSubmission = mongoose.model<IExamSubmission>('ExamSubmission', ExamSubmissionSchema);
