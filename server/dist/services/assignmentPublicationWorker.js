"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startAssignmentPublicationWorker = exports.publishScheduledAssignments = void 0;
const Assignment_1 = require("../models/Assignment");
const AssignmentPublicationEvent_1 = require("../models/AssignmentPublicationEvent");
const auditService_1 = require("./auditService");
const publishScheduledAssignments = async () => {
    const now = new Date();
    const expiredAssignments = await Assignment_1.Assignment.find({
        publicationStatus: 'SCHEDULED',
        publishAt: { $lte: now },
        dueDate: { $lte: now },
    }).select('_id title classId createdBy');
    for (const assignment of expiredAssignments) {
        const expired = await Assignment_1.Assignment.findOneAndUpdate({
            _id: assignment._id,
            publicationStatus: 'SCHEDULED',
            publishAt: { $lte: now },
            dueDate: { $lte: now },
        }, { $set: { publicationStatus: 'DRAFT', isPublished: false, publishAt: null } }, { new: true });
        if (!expired)
            continue;
        await AssignmentPublicationEvent_1.AssignmentPublicationEvent.updateOne({ assignmentId: assignment._id, eventType: 'SCHEDULE_CANCELLED' }, {
            $set: {
                performedBy: null,
                eventAt: now,
                details: { reason: 'The due date passed before the scheduled publication time.' },
            },
            $setOnInsert: { assignmentId: assignment._id, eventType: 'SCHEDULE_CANCELLED' },
        }, { upsert: true });
        await (0, auditService_1.logAudit)({
            userId: assignment.createdBy,
            action: 'ASSIGNMENT_SCHEDULE_EXPIRED',
            entityType: 'Assignment',
            entityId: assignment._id.toString(),
            details: { classId: assignment.classId, title: assignment.title },
        });
    }
    const dueAssignments = await Assignment_1.Assignment.find({
        publicationStatus: 'SCHEDULED',
        publishAt: { $lte: now },
        dueDate: { $gt: now },
    }).select('_id title classId createdBy');
    for (const assignment of dueAssignments) {
        const published = await Assignment_1.Assignment.findOneAndUpdate({
            _id: assignment._id,
            publicationStatus: 'SCHEDULED',
            publishAt: { $lte: now },
            dueDate: { $gt: now },
        }, { $set: { publicationStatus: 'PUBLISHED', isPublished: true, publishedAt: now } }, { new: true });
        if (!published)
            continue;
        await AssignmentPublicationEvent_1.AssignmentPublicationEvent.updateOne({ assignmentId: assignment._id, eventType: 'PUBLISHED' }, {
            $setOnInsert: {
                assignmentId: assignment._id,
                eventType: 'PUBLISHED',
                performedBy: null,
                eventAt: now,
                details: { source: 'SCHEDULED_PUBLICATION' },
            },
        }, { upsert: true });
        await (0, auditService_1.logAudit)({
            userId: assignment.createdBy,
            action: 'ASSIGNMENT_SCHEDULED_PUBLICATION',
            entityType: 'Assignment',
            entityId: assignment._id.toString(),
            details: { classId: assignment.classId, title: assignment.title },
        });
    }
};
exports.publishScheduledAssignments = publishScheduledAssignments;
let publicationInterval = null;
let isPublishing = false;
const startAssignmentPublicationWorker = () => {
    if (publicationInterval)
        return;
    const publish = async () => {
        if (isPublishing)
            return;
        isPublishing = true;
        try {
            await (0, exports.publishScheduledAssignments)();
        }
        catch (error) {
            console.error('[AssignmentWorker] Failed to publish scheduled assignments:', error);
        }
        finally {
            isPublishing = false;
        }
    };
    void publish();
    publicationInterval = setInterval(() => void publish(), 30000);
    console.log('[AssignmentWorker] Scheduled publication worker active (30s tick)');
};
exports.startAssignmentPublicationWorker = startAssignmentPublicationWorker;
