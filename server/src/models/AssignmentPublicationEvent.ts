import mongoose, { Document, Schema } from 'mongoose';

export type AssignmentPublicationEventType =
  | 'DRAFT_SAVED'
  | 'SCHEDULED'
  | 'PUBLISHED'
  | 'SCHEDULE_CANCELLED'
  | 'ARCHIVED'
  | 'UPDATED';

export interface IAssignmentPublicationEvent extends Document {
  assignmentId: mongoose.Types.ObjectId;
  eventType: AssignmentPublicationEventType;
  performedBy?: mongoose.Types.ObjectId | null;
  eventAt: Date;
  details?: Record<string, unknown>;
}

const AssignmentPublicationEventSchema = new Schema<IAssignmentPublicationEvent>(
  {
    assignmentId: { type: Schema.Types.ObjectId, ref: 'Assignment', required: true, index: true },
    eventType: {
      type: String,
      enum: ['DRAFT_SAVED', 'SCHEDULED', 'PUBLISHED', 'SCHEDULE_CANCELLED', 'ARCHIVED', 'UPDATED'],
      required: true,
    },
    performedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    eventAt: { type: Date, required: true, default: Date.now },
    details: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: false }
);

AssignmentPublicationEventSchema.index({ assignmentId: 1, eventType: 1 }, { unique: true });

export const AssignmentPublicationEvent = mongoose.model<IAssignmentPublicationEvent>(
  'AssignmentPublicationEvent',
  AssignmentPublicationEventSchema
);
