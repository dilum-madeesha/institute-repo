import mongoose, { Document, Schema } from 'mongoose';

export type ClassStatus = 'ACTIVE' | 'INACTIVE';

export interface IClass extends Document {
  name: string;
  classCode: string;
  subject: string;
  description?: string;
  academicYear?: string;
  teachers: mongoose.Types.ObjectId[];
  status: ClassStatus;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ClassSchema = new Schema<IClass>(
  {
    name: { type: String, required: true, trim: true },
    classCode: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    subject: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: '' },
    academicYear: { type: String, trim: true, default: '' },
    teachers: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    status: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE'],
      default: 'ACTIVE',
      index: true,
    },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  {
    timestamps: true,
  }
);

export const ClassModel = mongoose.model<IClass>('Class', ClassSchema);
