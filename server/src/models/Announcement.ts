import mongoose, { Document, Schema } from 'mongoose';

export type AnnouncementPriority = 'NORMAL' | 'HIGH' | 'URGENT';

export interface IAnnouncement extends Document {
  classId?: mongoose.Types.ObjectId | null;
  title: string;
  content: string;
  priority: AnnouncementPriority;
  targetRoles: string[];
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const AnnouncementSchema = new Schema<IAnnouncement>(
  {
    classId: { type: Schema.Types.ObjectId, ref: 'Class', default: null, index: true },
    title: { type: String, required: true, trim: true },
    content: { type: String, required: true, trim: true },
    priority: {
      type: String,
      enum: ['NORMAL', 'HIGH', 'URGENT'],
      default: 'NORMAL',
    },
    targetRoles: [{ type: String, enum: ['STUDENT', 'PARENT', 'TEACHER'] }],
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  {
    timestamps: true,
  }
);

export const Announcement = mongoose.model<IAnnouncement>('Announcement', AnnouncementSchema);
