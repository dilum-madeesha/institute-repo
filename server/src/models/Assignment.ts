import mongoose, { Document, Schema } from 'mongoose';

export interface IAssignment extends Document {
  classId: mongoose.Types.ObjectId;
  title: string;
  description: string;
  dueDate: Date;
  totalMarks: number;
  attachments: Array<{ name: string; fileUrl: string }>;
  isPublished: boolean;
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
      },
    ],
    isPublished: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  {
    timestamps: true,
  }
);

AssignmentSchema.index({ classId: 1, dueDate: 1 });

export const Assignment = mongoose.model<IAssignment>('Assignment', AssignmentSchema);
