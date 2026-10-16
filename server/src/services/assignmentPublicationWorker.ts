import { Assignment } from '../models/Assignment';
import { AssignmentPublicationEvent } from '../models/AssignmentPublicationEvent';
import { logAudit } from './auditService';

export const publishScheduledAssignments = async (): Promise<void> => {
  const now = new Date();
  const expiredAssignments = await Assignment.find({
    publicationStatus: 'SCHEDULED',
    publishAt: { $lte: now },
    dueDate: { $lte: now },
  }).select('_id title classId createdBy');

  for (const assignment of expiredAssignments) {
    const expired = await Assignment.findOneAndUpdate(
      {
        _id: assignment._id,
        publicationStatus: 'SCHEDULED',
        publishAt: { $lte: now },
        dueDate: { $lte: now },
      },
      { $set: { publicationStatus: 'DRAFT', isPublished: false, publishAt: null } },
      { new: true }
    );
    if (!expired) continue;

    await AssignmentPublicationEvent.updateOne(
      { assignmentId: assignment._id, eventType: 'SCHEDULE_CANCELLED' },
      {
        $set: {
          performedBy: null,
          eventAt: now,
          details: { reason: 'The due date passed before the scheduled publication time.' },
        },
        $setOnInsert: { assignmentId: assignment._id, eventType: 'SCHEDULE_CANCELLED' },
      },
      { upsert: true }
    );
    await logAudit({
      userId: assignment.createdBy,
      action: 'ASSIGNMENT_SCHEDULE_EXPIRED',
      entityType: 'Assignment',
      entityId: assignment._id.toString(),
      details: { classId: assignment.classId, title: assignment.title },
    });
  }

  const dueAssignments = await Assignment.find({
    publicationStatus: 'SCHEDULED',
    publishAt: { $lte: now },
    dueDate: { $gt: now },
  }).select('_id title classId createdBy');

  for (const assignment of dueAssignments) {
    const published = await Assignment.findOneAndUpdate(
      {
        _id: assignment._id,
        publicationStatus: 'SCHEDULED',
        publishAt: { $lte: now },
        dueDate: { $gt: now },
      },
      { $set: { publicationStatus: 'PUBLISHED', isPublished: true, publishedAt: now } },
      { new: true }
    );
    if (!published) continue;

    await AssignmentPublicationEvent.updateOne(
      { assignmentId: assignment._id, eventType: 'PUBLISHED' },
      {
        $setOnInsert: {
          assignmentId: assignment._id,
          eventType: 'PUBLISHED',
          performedBy: null,
          eventAt: now,
          details: { source: 'SCHEDULED_PUBLICATION' },
        },
      },
      { upsert: true }
    );
    await logAudit({
      userId: assignment.createdBy,
      action: 'ASSIGNMENT_SCHEDULED_PUBLICATION',
      entityType: 'Assignment',
      entityId: assignment._id.toString(),
      details: { classId: assignment.classId, title: assignment.title },
    });
  }
};

let publicationInterval: NodeJS.Timeout | null = null;
let isPublishing = false;

export const startAssignmentPublicationWorker = (): void => {
  if (publicationInterval) return;

  const publish = async () => {
    if (isPublishing) return;
    isPublishing = true;
    try {
      await publishScheduledAssignments();
    } catch (error) {
      console.error('[AssignmentWorker] Failed to publish scheduled assignments:', error);
    } finally {
      isPublishing = false;
    }
  };

  void publish();
  publicationInterval = setInterval(() => void publish(), 30000);
  console.log('[AssignmentWorker] Scheduled publication worker active (30s tick)');
};
