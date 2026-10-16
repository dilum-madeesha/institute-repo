import mongoose, { Document, Schema } from 'mongoose';

export type UserRole = 'ADMIN' | 'TEACHER' | 'STUDENT' | 'PARENT';
export type UserStatus = 'ACTIVE' | 'INACTIVE';

const userRoles: UserRole[] = ['ADMIN', 'TEACHER', 'STUDENT', 'PARENT'];

export const normalizeUserRole = (value: unknown): UserRole | null => {
  if (typeof value !== 'string') return null;
  const normalizedRole = value.trim().toUpperCase();
  return userRoles.includes(normalizedRole as UserRole)
    ? normalizedRole as UserRole
    : null;
};

export const normalizeAccountStatus = (value: unknown): 'ACTIVE' | 'INACTIVE' | null => {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toUpperCase();
  return normalized === 'ACTIVE' || normalized === 'INACTIVE' ? normalized : null;
};

export interface IUser extends Document {
  fullName: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  status: UserStatus;
  studentId?: mongoose.Types.ObjectId | null;
  guardianId?: mongoose.Types.ObjectId | null;
  lastLoginAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    fullName: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    passwordHash: { type: String, required: true },
    role: {
      type: String,
      enum: ['ADMIN', 'TEACHER', 'STUDENT', 'PARENT'],
      required: true,
      default: 'TEACHER',
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE'],
      required: true,
      default: 'ACTIVE',
    },
    studentId: { type: Schema.Types.ObjectId, ref: 'Student', default: null },
    guardianId: { type: Schema.Types.ObjectId, ref: 'Guardian', default: null },
    lastLoginAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret) => {
        delete (ret as any).passwordHash;
        return ret;
      },
    },
  }
);

export const User = mongoose.model<IUser>('User', UserSchema);
