import mongoose, { Document, Schema } from 'mongoose';

export type StudentStatus = 'ACTIVE' | 'INACTIVE';

export interface IStudent extends Document {
  studentNumber?: string;
  firstName: string;
  lastName: string;
  displayName?: string;
  dateOfBirth?: Date;
  email?: string;
  phone?: string;
  address?: string;
  status: StudentStatus;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const StudentSchema = new Schema<IStudent>(
  {
    studentNumber: {
      type: String,
      trim: true,
      sparse: true,
      index: true,
    },
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    displayName: { type: String, trim: true },
    dateOfBirth: { type: Date },
    email: { type: String, trim: true, lowercase: true },
    phone: { type: String, trim: true },
    address: { type: String, trim: true },
    status: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE'],
      default: 'ACTIVE',
      index: true,
    },
    notes: { type: String, trim: true },
  },
  {
    timestamps: true,
  }
);

StudentSchema.virtual('fullName').get(function () {
  return `${this.firstName} ${this.lastName}`;
});

StudentSchema.set('toJSON', { virtuals: true });
StudentSchema.set('toObject', { virtuals: true });

export const Student = mongoose.model<IStudent>('Student', StudentSchema);
