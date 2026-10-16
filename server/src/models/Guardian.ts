import mongoose, { Document, Schema } from 'mongoose';

export type GuardianStatus = 'ACTIVE' | 'INACTIVE';

export interface IGuardian extends Document {
  fullName: string;
  email: string;
  phone?: string;
  status: GuardianStatus;
  createdAt: Date;
  updatedAt: Date;
}

const GuardianSchema = new Schema<IGuardian>(
  {
    fullName: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    phone: { type: String, trim: true },
    status: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE'],
      default: 'ACTIVE',
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

export const Guardian = mongoose.model<IGuardian>('Guardian', GuardianSchema);
