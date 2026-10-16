import { Response } from 'express';
import mongoose from 'mongoose';
import { Assignment, IAssignmentAttachment } from '../models/Assignment';
import { AssignmentSubmission } from '../models/AssignmentSubmission';
import { AssignmentPublicationEvent, AssignmentPublicationEventType } from '../models/AssignmentPublicationEvent';
import { Enrollment } from '../models/Enrollment';
import { AuthRequest } from '../middleware/auth';
import { canAccessClass, verifyParentStudentLink } from '../middleware/role';
import { logAudit } from '../services/auditService';
import { currentEnrollmentFilter } from '../services/enrollmentAccess';
import {
  deletePrivateFiles,
  InvalidPrivateFileError,
  sendPrivateFile,
  storePrivateFiles,
  StoredPrivateFile,
} from '../services/privateFileStorage';

const uploadedFiles = (req: AuthRequest): Express.Multer.File[] =>
  Array.isArray(req.files) ? req.files as Express.Multer.File[] : [];

const parseJsonField = (value: unknown): unknown => {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
};

const parseBooleanField = (value: unknown): unknown => {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return value;
};

const normalizeAttachmentInput = (
  input: unknown,
  existingAttachments: IAssignmentAttachment[] = []
): { error?: string; attachments?: IAssignmentAttachment[] } => {
  const parsed = parseJsonField(input);
  if (!Array.isArray(parsed)) return { error: 'Attachments must be provided as a list.' };
  const attachments: IAssignmentAttachment[] = [];
  for (const item of parsed) {
    if (!item || typeof item.name !== 'string' || typeof item.fileUrl !== 'string') {
      return { error: 'Each attachment requires a name and a reference URL or uploaded file.' };
    }
    const internalId = item.fileUrl.match(/^\/api\/assignments\/files\/([0-9a-f-]{36})$/i)?.[1];
    if (internalId) {
      const existing = existingAttachments.find((attachment) => attachment.fileId === internalId);
      if (!existing) return { error: 'An uploaded attachment does not belong to this assignment.' };
      attachments.push(existing);
    } else {
      attachments.push({ name: item.name, fileUrl: item.fileUrl });
    }
  }
  return { attachments };
};

const isPublished = (assignment: { publicationStatus?: string; isPublished?: boolean }) =>
  assignment.publicationStatus === 'PUBLISHED' ||
  (!assignment.publicationStatus && assignment.isPublished === true);

const isValidWebUrl = (value: unknown): boolean => {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
};

const canManageAssignment = async (assignment: { classId: mongoose.Types.ObjectId }, req: AuthRequest) =>
  req.user!.role === 'ADMIN' ||
  (req.user!.role === 'TEACHER' &&
    (await canAccessClass(req.user!._id.toString(), req.user!.role, assignment.classId.toString())));

const isEligibleStudent = async (assignment: any, studentId: mongoose.Types.ObjectId) => {
  if (
    assignment.targetMode === 'SELECTED_STUDENTS' &&
    !assignment.targetStudentIds.some((id: mongoose.Types.ObjectId) => id.toString() === studentId.toString())
  ) {
    return false;
  }
  return Boolean(await Enrollment.findOne(currentEnrollmentFilter(studentId, assignment.classId)));
};

const publicFiles = (files: Array<{ fileId: string; originalName: string }> = []) =>
  files.map((file) => ({
    fileId: file.fileId,
    name: file.originalName,
    fileUrl: `/api/assignments/submission-files/${file.fileId}`,
  }));

const publicAttachments = (attachments: Array<Record<string, any>> = []) =>
  attachments.map(({ name, fileUrl, fileId }) => ({ name, fileUrl, ...(fileId ? { fileId } : {}) }));

const publicAssignment = (assignment: any) => {
  const data = assignment.toObject ? assignment.toObject() : assignment;
  return { ...data, attachments: publicAttachments(data.attachments || []) };
};

const staffSubmission = (submission: any) => {
  const data = submission.toObject ? submission.toObject() : submission;
  return {
    ...data,
    submissionFiles: publicFiles(data.submissionFiles || []),
    attemptHistory: (data.attemptHistory || []).map((attempt: any) => ({
      ...attempt,
      submissionFiles: publicFiles(attempt.submissionFiles || []),
    })),
  };
};

const publicSubmission = (submission: any) => ({
  _id: submission._id,
  attemptNumber: submission.attemptNumber || 1,
  submissionText: submission.submissionText,
  attachmentUrl: submission.attachmentUrl,
  submissionFiles: publicFiles(submission.submissionFiles || []),
  submittedAt: submission.submittedAt,
  status: submission.status === 'GRADED' && !submission.gradeReleasedAt ? 'SUBMITTED' : submission.status,
  ...(submission.gradeReleasedAt
    ? {
        marksAwarded: submission.marksAwarded,
        feedback: submission.feedback,
        gradedAt: submission.gradedAt,
      }
    : {}),
  attemptHistory: (submission.attemptHistory || []).map((attempt: any) => ({
    attemptNumber: attempt.attemptNumber,
    submissionText: attempt.submissionText,
    attachmentUrl: attempt.attachmentUrl,
    submissionFiles: publicFiles(attempt.submissionFiles || []),
    submittedAt: attempt.submittedAt,
    status: attempt.status === 'GRADED' && !attempt.gradeReleasedAt ? 'SUBMITTED' : attempt.status,
    ...(attempt.gradeReleasedAt
      ? { marksAwarded: attempt.marksAwarded, feedback: attempt.feedback, gradedAt: attempt.gradedAt }
      : {}),
  })),
});

const validateAssignmentData = (body: any) => {
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const description = typeof body.description === 'string' ? body.description.trim() : '';
  const totalMarks = Number(body.totalMarks);
  const dueDate = new Date(body.dueDate);
  if (!title || title.length > 150) return 'Title is required and must be no more than 150 characters.';
  if (!description) return 'Assignment instructions are required.';
  if (!Number.isFinite(totalMarks) || totalMarks <= 0) return 'Maximum marks must be a positive number.';
  if (!body.dueDate || Number.isNaN(dueDate.getTime())) return 'A valid due date and time are required.';

  if (body.attachments !== undefined) {
    if (!Array.isArray(body.attachments) || body.attachments.length > 10) {
      return 'Attachments must be a list of no more than 10 reference links.';
    }
    for (const attachment of body.attachments) {
      if (
        typeof attachment?.name !== 'string' ||
        !attachment.name.trim() ||
        attachment.name.trim().length > 150 ||
        typeof attachment.fileUrl !== 'string' ||
        attachment.fileUrl.length > 2048 ||
        (!isValidWebUrl(attachment.fileUrl) &&
          !/^\/api\/assignments\/files\/[0-9a-f-]{36}$/i.test(attachment.fileUrl))
      ) {
        return 'Each attachment requires a name and a valid HTTP or HTTPS reference URL.';
      }
    }
  }

  if (
    body.targetMode !== undefined &&
    body.targetMode !== 'ALL_ENROLLED' &&
    body.targetMode !== 'SELECTED_STUDENTS'
  ) {
    return 'Choose all enrolled students or specific students.';
  }
  if (
    body.submissionType !== undefined &&
    !['TEXT', 'FILE', 'TEXT_OR_FILE', 'LINK_OR_TEXT'].includes(body.submissionType)
  ) {
    return 'Unsupported submission type.';
  }
  if (
    body.latePolicy !== undefined &&
    !['ALLOW', 'REJECT', 'ACCEPT_FLAG_LATE'].includes(body.latePolicy)
  ) {
    return 'Choose a valid late-submission policy.';
  }
  if (
    body.resubmissionUntil !== undefined &&
    body.resubmissionUntil !== null &&
    body.resubmissionUntil !== ''
  ) {
    const resubmissionUntil = new Date(body.resubmissionUntil);
    if (Number.isNaN(resubmissionUntil.getTime()) || resubmissionUntil < dueDate) {
      return 'The resubmission deadline must be on or after the assignment due date.';
    }
  }
  if (body.allowResubmission !== undefined && typeof body.allowResubmission !== 'boolean') {
    return 'Resubmission must be enabled or disabled.';
  }
  if (
    body.maxAttempts !== undefined &&
    body.maxAttempts !== null &&
    body.maxAttempts !== '' &&
    (!Number.isInteger(Number(body.maxAttempts)) || Number(body.maxAttempts) < 1)
  ) {
    return 'Maximum attempts must be a positive whole number.';
  }
  if (body.allowResubmission === false && Number(body.maxAttempts) > 1) {
    return 'Enable resubmission before setting more than one attempt.';
  }
  if (
    body.allowResubmission === true &&
    body.maxAttempts !== undefined &&
    body.maxAttempts !== null &&
    body.maxAttempts !== '' &&
    Number(body.maxAttempts) < 2
  ) {
    return 'Maximum attempts must be at least two when resubmission is enabled.';
  }
  return null;
};

const validateRecipients = async (
  classId: mongoose.Types.ObjectId,
  targetMode: string,
  targetStudentIds: unknown
): Promise<{ error?: string; ids?: mongoose.Types.ObjectId[] }> => {
  if (!Array.isArray(targetStudentIds)) return { error: 'Selected students must be provided as a list.' };
  if (targetMode === 'ALL_ENROLLED') return { ids: [] };
  if (targetStudentIds.length === 0) return { error: 'Select at least one student for a targeted assignment.' };

  const ids = [...new Set(targetStudentIds.map(String))];
  if (ids.some((id) => !mongoose.isValidObjectId(id))) return { error: 'One or more selected students are invalid.' };
  const enrolled = await Enrollment.find(
    currentEnrollmentFilter({ $in: ids }, classId)
  ).distinct('studentId');
  if (enrolled.length !== ids.length) {
    return { error: 'Every selected student must be actively enrolled in the chosen class.' };
  }
  return { ids: ids.map((id) => new mongoose.Types.ObjectId(id)) };
};

const recordPublicationEvent = async (
  assignmentId: mongoose.Types.ObjectId,
  eventType: AssignmentPublicationEventType,
  userId: mongoose.Types.ObjectId,
  details: Record<string, unknown> = {}
) => {
  await AssignmentPublicationEvent.updateOne(
    { assignmentId, eventType },
    {
      $set: { performedBy: userId, eventAt: new Date(), details },
      $setOnInsert: { assignmentId, eventType },
    },
    { upsert: true }
  );
};

export const getAssignmentsByClass = async (req: AuthRequest, res: Response): Promise<void> => {
  try {

    
    const classId = req.params.classId as string;
    const user = req.user!;
    const hasAccess = await canAccessClass(
      user._id.toString(),
      user.role,
      classId,
      user.studentId?.toString(),
      user.guardianId?.toString()
    );
    if (!hasAccess) {
      res.status(403).json({ error: 'Access denied.' });
      return;
    }

    const assignments = await Assignment.find({ classId }).sort({ dueDate: 1 }).populate('createdBy', 'fullName');
    let visibleAssignments = assignments;
    if (user.role === 'STUDENT' && user.studentId) {
      visibleAssignments = [];
      for (const assignment of assignments) {
        if (isPublished(assignment) && (await isEligibleStudent(assignment, user.studentId))) {
          visibleAssignments.push(assignment);
        }
      }
      const submissions = await AssignmentSubmission.find({
        classId,
        studentId: user.studentId,
      });
      const subMap = new Map(submissions.map((submission) => [submission.assignmentId.toString(), submission]));
      res.json(
        visibleAssignments.map((assignment) => {
          const { targetStudentIds: _targetStudentIds, ...assignmentData } = publicAssignment(assignment);
          return {
            ...assignmentData,
            mySubmission: subMap.has(assignment._id.toString())
              ? publicSubmission(subMap.get(assignment._id.toString()))
              : null,
          };
        })
      );
      return;
    }

    const { studentId } = req.query;
    if (user.role === 'PARENT' && user.guardianId && studentId) {
      const isLinked = await verifyParentStudentLink(user.guardianId.toString(), String(studentId));
      if (!isLinked) {
        res.status(403).json({ error: 'Access denied. Student is not linked to your parent account.' });
        return;
      }
      if (!mongoose.isValidObjectId(String(studentId))) {
        res.status(400).json({ error: 'A valid student is required.' });
        return;
      }
      const linkedStudentId = new mongoose.Types.ObjectId(String(studentId));
      visibleAssignments = [];
      for (const assignment of assignments) {
        if (isPublished(assignment) && (await isEligibleStudent(assignment, linkedStudentId))) {
          visibleAssignments.push(assignment);
        }
      }
      const submissions = await AssignmentSubmission.find({ classId, studentId });
      const subMap = new Map(submissions.map((submission) => [submission.assignmentId.toString(), submission]));
      res.json(
        visibleAssignments.map((assignment) => {
          const { targetStudentIds: _targetStudentIds, ...assignmentData } = publicAssignment(assignment);
          return {
            ...assignmentData,
            childSubmission: subMap.has(assignment._id.toString())
              ? publicSubmission(subMap.get(assignment._id.toString()))
              : null,
          };
        })
      );
      return;
    }

    if (user.role !== 'ADMIN' && user.role !== 'TEACHER') {
      res.status(403).json({ error: 'Access denied.' });
      return;
    }
    const assignmentIds = assignments.map((assignment) => assignment._id);
    const subCounts = await AssignmentSubmission.aggregate([
      { $match: { assignmentId: { $in: assignmentIds } } },
      { $group: { _id: '$assignmentId', count: { $sum: 1 } } },
    ]);
    const countMap = new Map(subCounts.map((item) => [item._id.toString(), item.count]));
    res.json(
      assignments.map((assignment) => ({
        ...publicAssignment(assignment),
        submissionCount: countMap.get(assignment._id.toString()) || 0,
      }))
    );
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch assignments' });
  }
};

export const createAssignment = async (req: AuthRequest, res: Response): Promise<void> => {
  let storedFiles: StoredPrivateFile[] = [];
  let assignmentCreated = false;
  try {
    const requestBody = {
      ...req.body,
      attachments: parseJsonField(req.body.attachments ?? []),
      targetStudentIds: parseJsonField(req.body.targetStudentIds ?? []),
      allowResubmission: parseBooleanField(req.body.allowResubmission ?? false),
    };
    const { classId, targetMode = 'ALL_ENROLLED', targetStudentIds = [] } = requestBody;
    if (!classId || !mongoose.isValidObjectId(classId)) {
      res.status(400).json({ error: 'A valid class is required.' });
      return;
    }
    const canAccess = await canAccessClass(req.user!._id.toString(), req.user!.role, classId);
    if (!canAccess) {
      res.status(403).json({ error: 'You can create assignments only for classes assigned to you.' });
      return;
    }
    const normalizedAttachments = normalizeAttachmentInput(requestBody.attachments);
    if (normalizedAttachments.error) {
      res.status(400).json({ error: normalizedAttachments.error });
      return;
    }
    const validationError = validateAssignmentData({ ...requestBody, attachments: normalizedAttachments.attachments });
    if (validationError) {
      res.status(400).json({ error: validationError });
      return;
    }
    const recipientResult = await validateRecipients(new mongoose.Types.ObjectId(classId), targetMode, targetStudentIds);
    if (recipientResult.error) {
      res.status(400).json({ error: recipientResult.error });
      return;
    }

    const publicationStatus = (req.body.publicationStatus || 'PUBLISHED') as
      | 'DRAFT'
      | 'SCHEDULED'
      | 'PUBLISHED';
    if (!['DRAFT', 'SCHEDULED', 'PUBLISHED'].includes(publicationStatus)) {
      res.status(400).json({ error: 'Choose draft, publish now, or schedule publication.' });
      return;
    }
    const now = new Date();
    const publishAt = publicationStatus === 'SCHEDULED' ? new Date(req.body.publishAt) : null;
    if (publicationStatus === 'SCHEDULED' && (!req.body.publishAt || Number.isNaN(publishAt!.getTime()) || publishAt! <= now)) {
      res.status(400).json({ error: 'Scheduled publication must be set to a valid future date and time.' });
      return;
    }
    const dueDate = new Date(req.body.dueDate);
    const publishTime = publicationStatus === 'SCHEDULED' ? publishAt! : now;
    if (dueDate <= publishTime) {
      res.status(400).json({ error: 'The due date must be later than the publication date.' });
      return;
    }
    const maxAttempts = req.body.maxAttempts == null || req.body.maxAttempts === ''
      ? null
      : Number(req.body.maxAttempts);
    if (maxAttempts !== null && (!Number.isInteger(maxAttempts) || maxAttempts < 1)) {
      res.status(400).json({ error: 'Maximum attempts must be a positive whole number.' });
      return;
    }
    if (maxAttempts && !requestBody.allowResubmission && maxAttempts > 1) {
      res.status(400).json({ error: 'Enable resubmission before setting more than one attempt.' });
      return;
    }

    if ((normalizedAttachments.attachments?.length || 0) + uploadedFiles(req).length > 10) {
      res.status(400).json({ error: 'Assignments support up to 10 combined links and uploaded resources.' });
      return;
    }
    storedFiles = await storePrivateFiles(uploadedFiles(req), (fileId) => `/api/assignments/files/${fileId}`);
    const assignment = await Assignment.create({
      classId,
      title: req.body.title.trim(),
      description: req.body.description.trim(),
      dueDate,
      totalMarks: Number(req.body.totalMarks),
      attachments: [
        ...(normalizedAttachments.attachments || []),
        ...storedFiles.map((file) => ({
          name: file.originalName,
          fileUrl: file.fileUrl,
          fileId: file.fileId,
          storageKey: file.storageKey,
          originalName: file.originalName,
          mimeType: file.mimeType,
          size: file.size,
        })),
      ],
      isPublished: publicationStatus === 'PUBLISHED',
      publicationStatus,
      targetMode,
      targetStudentIds: recipientResult.ids,
      submissionType: req.body.submissionType || 'LINK_OR_TEXT',
      latePolicy: req.body.latePolicy || 'ACCEPT_FLAG_LATE',
      allowResubmission: requestBody.allowResubmission,
      maxAttempts,
      resubmissionUntil: req.body.resubmissionUntil ? new Date(req.body.resubmissionUntil) : null,
      publishAt,
      publishedAt: publicationStatus === 'PUBLISHED' ? now : null,
      createdBy: req.user!._id,
    });
    assignmentCreated = true;

    await recordPublicationEvent(
      assignment._id,
      publicationStatus === 'PUBLISHED'
        ? 'PUBLISHED'
        : publicationStatus === 'SCHEDULED'
          ? 'SCHEDULED'
          : 'DRAFT_SAVED',
      req.user!._id,
      publicationStatus === 'SCHEDULED' ? { publishAt } : {}
    );
    await logAudit({
      userId: req.user!._id,
      action: 'ASSIGNMENT_CREATED',
      entityType: 'Assignment',
      entityId: assignment._id.toString(),
      details: { title: assignment.title, classId, publicationStatus },
      ipAddress: req.ip,
    });
    res.status(201).json(publicAssignment(assignment));
  } catch (error: any) {
    if (storedFiles.length && !assignmentCreated) await deletePrivateFiles(storedFiles);
    if (error instanceof InvalidPrivateFileError) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: error.message || 'Failed to create assignment' });
  }
};

export const updateAssignment = async (req: AuthRequest, res: Response): Promise<void> => {
  let storedFiles: StoredPrivateFile[] = [];
  let assignmentSaved = false;
  try {
    const assignment = await Assignment.findById(req.params.id);
    if (!assignment) {
      res.status(404).json({ error: 'Assignment not found.' });
      return;
    }
    if (!(await canManageAssignment(assignment, req))) {
      res.status(403).json({ error: 'You are not authorized to edit this assignment.' });
      return;
    }
    if (['ARCHIVED', 'CANCELLED'].includes(assignment.publicationStatus)) {
      res.status(409).json({ error: 'Archived or cancelled assignments cannot be edited.' });
      return;
    }
    const requestBody = {
      ...req.body,
      attachments: parseJsonField(req.body.attachments),
      targetStudentIds: parseJsonField(req.body.targetStudentIds),
      allowResubmission: parseBooleanField(req.body.allowResubmission),
    };
    const normalizedAttachments = normalizeAttachmentInput(
      requestBody.attachments ?? assignment.attachments,
      assignment.attachments
    );
    if (normalizedAttachments.error) {
      res.status(400).json({ error: normalizedAttachments.error });
      return;
    }
    const nextData = {
      title: requestBody.title ?? assignment.title,
      description: requestBody.description ?? assignment.description,
      dueDate: requestBody.dueDate ?? assignment.dueDate,
      totalMarks: requestBody.totalMarks ?? assignment.totalMarks,
      attachments: normalizedAttachments.attachments,
      targetMode: requestBody.targetMode ?? assignment.targetMode,
      submissionType: requestBody.submissionType ?? assignment.submissionType,
      latePolicy: requestBody.latePolicy ?? assignment.latePolicy,
      allowResubmission: requestBody.allowResubmission ?? assignment.allowResubmission,
      maxAttempts: Object.prototype.hasOwnProperty.call(requestBody, 'maxAttempts')
        ? requestBody.maxAttempts
        : assignment.maxAttempts,
      resubmissionUntil: Object.prototype.hasOwnProperty.call(requestBody, 'resubmissionUntil')
        ? requestBody.resubmissionUntil
        : assignment.resubmissionUntil,
    };
    const validationError = validateAssignmentData(nextData);
    if (validationError) {
      res.status(400).json({ error: validationError });
      return;
    }
    if (
      assignment.publicationStatus === 'SCHEDULED' &&
      (!assignment.publishAt || new Date(nextData.dueDate) <= assignment.publishAt)
    ) {
      res.status(400).json({ error: 'The due date must be later than the scheduled publication time.' });
      return;
    }
    const targetMode = requestBody.targetMode ?? assignment.targetMode;
    const targetStudentIds = requestBody.targetStudentIds ?? assignment.targetStudentIds;
    const recipientResult = await validateRecipients(assignment.classId, targetMode, targetStudentIds);
    if (recipientResult.error) {
      res.status(400).json({ error: recipientResult.error });
      return;
    }

    if ((nextData.attachments?.length || 0) + uploadedFiles(req).length > 10) {
      res.status(400).json({ error: 'Assignments support up to 10 combined links and uploaded resources.' });
      return;
    }
    const previousPrivateFiles = assignment.attachments
      .filter((attachment) => attachment.storageKey)
      .map((attachment) => ({ storageKey: attachment.storageKey! }));
    storedFiles = await storePrivateFiles(uploadedFiles(req), (fileId) => `/api/assignments/files/${fileId}`);
    assignment.title = nextData.title.trim();
    assignment.description = nextData.description.trim();
    assignment.dueDate = new Date(nextData.dueDate);
    assignment.totalMarks = Number(nextData.totalMarks);
    assignment.attachments = [
      ...(nextData.attachments || []),
      ...storedFiles.map((file) => ({
        name: file.originalName,
        fileUrl: file.fileUrl,
        fileId: file.fileId,
        storageKey: file.storageKey,
        originalName: file.originalName,
        mimeType: file.mimeType,
        size: file.size,
      })),
    ];
    assignment.targetMode = targetMode;
    assignment.targetStudentIds = recipientResult.ids!;
    assignment.submissionType = nextData.submissionType;
    assignment.latePolicy = nextData.latePolicy;
    assignment.allowResubmission = nextData.allowResubmission;
    assignment.maxAttempts = nextData.maxAttempts === '' || nextData.maxAttempts == null
      ? null
      : Number(nextData.maxAttempts);
    assignment.resubmissionUntil = nextData.resubmissionUntil ? new Date(nextData.resubmissionUntil) : null;
    await assignment.save();
    assignmentSaved = true;
    const retainedStorageKeys = new Set(
      assignment.attachments.map((attachment) => attachment.storageKey).filter(Boolean)
    );
    await deletePrivateFiles(previousPrivateFiles.filter((file) => !retainedStorageKeys.has(file.storageKey)));
    await recordPublicationEvent(assignment._id, 'UPDATED', req.user!._id);
    await logAudit({
      userId: req.user!._id,
      action: 'ASSIGNMENT_UPDATED',
      entityType: 'Assignment',
      entityId: assignment._id.toString(),
      details: { title: assignment.title },
      ipAddress: req.ip,
    });
    res.json(publicAssignment(assignment));
  } catch (error: any) {
    if (storedFiles.length && !assignmentSaved) await deletePrivateFiles(storedFiles);
    if (error instanceof InvalidPrivateFileError) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: error.message || 'Failed to update assignment' });
  }
};

export const publishAssignment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const assignment = await Assignment.findById(req.params.id);
    if (!assignment) {
      res.status(404).json({ error: 'Assignment not found.' });
      return;
    }
    if (!(await canManageAssignment(assignment, req))) {
      res.status(403).json({ error: 'You are not authorized to publish this assignment.' });
      return;
    }
    if (assignment.publicationStatus === 'PUBLISHED') {
      res.json(publicAssignment(assignment));
      return;
    }
    if (!['DRAFT', 'SCHEDULED'].includes(assignment.publicationStatus)) {
      res.status(409).json({ error: 'This assignment cannot be published in its current state.' });
      return;
    }
    if (assignment.dueDate <= new Date()) {
      res.status(400).json({ error: 'The due date must be in the future before publishing.' });
      return;
    }
    assignment.publicationStatus = 'PUBLISHED';
    assignment.isPublished = true;
    assignment.publishAt = null;
    assignment.publishedAt = new Date();
    await assignment.save();
    await recordPublicationEvent(assignment._id, 'PUBLISHED', req.user!._id);
    await logAudit({
      userId: req.user!._id,
      action: 'ASSIGNMENT_PUBLISHED',
      entityType: 'Assignment',
      entityId: assignment._id.toString(),
      details: { title: assignment.title },
      ipAddress: req.ip,
    });
    res.json(publicAssignment(assignment));
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to publish assignment' });
  }
};

export const cancelScheduledAssignment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const assignment = await Assignment.findById(req.params.id);
    if (!assignment) {
      res.status(404).json({ error: 'Assignment not found.' });
      return;
    }
    if (!(await canManageAssignment(assignment, req))) {
      res.status(403).json({ error: 'You are not authorized to cancel this schedule.' });
      return;
    }
    if (assignment.publicationStatus !== 'SCHEDULED') {
      res.status(409).json({ error: 'Only scheduled assignments can be cancelled.' });
      return;
    }
    assignment.publicationStatus = 'DRAFT';
    assignment.isPublished = false;
    assignment.publishAt = null;
    await assignment.save();
    await recordPublicationEvent(assignment._id, 'SCHEDULE_CANCELLED', req.user!._id);
    await logAudit({
      userId: req.user!._id,
      action: 'ASSIGNMENT_SCHEDULE_CANCELLED',
      entityType: 'Assignment',
      entityId: assignment._id.toString(),
      ipAddress: req.ip,
    });
    res.json(publicAssignment(assignment));
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to cancel scheduled publication' });
  }
};

export const archiveAssignment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const assignment = await Assignment.findById(req.params.id);
    if (!assignment) {
      res.status(404).json({ error: 'Assignment not found.' });
      return;
    }
    if (!(await canManageAssignment(assignment, req))) {
      res.status(403).json({ error: 'You are not authorized to archive this assignment.' });
      return;
    }
    assignment.publicationStatus = 'ARCHIVED';
    assignment.isPublished = false;
    assignment.archivedAt = new Date();
    await assignment.save();
    await recordPublicationEvent(assignment._id, 'ARCHIVED', req.user!._id);
    await logAudit({
      userId: req.user!._id,
      action: 'ASSIGNMENT_ARCHIVED',
      entityType: 'Assignment',
      entityId: assignment._id.toString(),
      ipAddress: req.ip,
    });
    res.json(publicAssignment(assignment));
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to archive assignment' });
  }
};

export const submitAssignment = async (req: AuthRequest, res: Response): Promise<void> => {
  let storedFiles: StoredPrivateFile[] = [];
  let submissionSaved = false;
  try {
    const user = req.user!;
    if (user.role !== 'STUDENT' || !user.studentId) {
      res.status(403).json({ error: 'Only registered students can submit assignments.' });
      return;
    }
    const assignment = await Assignment.findById(req.params.id);
    if (!assignment || !isPublished(assignment)) {
      res.status(404).json({ error: 'Published assignment not found.' });
      return;
    }
    if (!(await isEligibleStudent(assignment, user.studentId))) {
      res.status(403).json({ error: 'This assignment is not available to your account.' });
      return;
    }
    const { submissionText = '', attachmentUrl = '' } = req.body;
    const cleanText = typeof submissionText === 'string' ? submissionText.trim() : '';
    const cleanUrl = typeof attachmentUrl === 'string' ? attachmentUrl.trim() : '';
    if (cleanText.length > 20000 || cleanUrl.length > 2048) {
      res.status(400).json({ error: 'Text answers are limited to 20,000 characters and links to 2,048 characters.' });
      return;
    }
    const incomingFiles = uploadedFiles(req);
    if (assignment.submissionType === 'TEXT' && !cleanText) {
      res.status(400).json({ error: 'Enter your text answer before submitting.' });
      return;
    }
    if (assignment.submissionType === 'FILE' && incomingFiles.length === 0) {
      res.status(400).json({ error: 'Upload a file before submitting this assignment.' });
      return;
    }
    if (assignment.submissionType === 'TEXT_OR_FILE' && !cleanText && incomingFiles.length === 0) {
      res.status(400).json({ error: 'Provide a text answer or upload a file.' });
      return;
    }
    if (!cleanText && !cleanUrl && incomingFiles.length === 0) {
      res.status(400).json({ error: 'Provide a text answer, a valid submission link, or an uploaded file.' });
      return;
    }
    if (cleanUrl && !isValidWebUrl(cleanUrl)) {
      res.status(400).json({ error: 'Submission links must use HTTP or HTTPS.' });
      return;
    }

    const now = new Date();
    const isLate = now > assignment.dueDate;
    if (isLate && assignment.latePolicy === 'REJECT') {
      res.status(400).json({ error: 'The deadline has passed and late submissions are not accepted.' });
      return;
    }
    if (assignment.resubmissionUntil && now > assignment.resubmissionUntil) {
      res.status(400).json({ error: 'The resubmission window has closed.' });
      return;
    }

    let submission = await AssignmentSubmission.findOne({
      assignmentId: assignment._id,
      studentId: user.studentId,
    });
    let attemptNumber = 1;
    if (submission) {
      if (!assignment.allowResubmission) {
        res.status(409).json({ error: 'Resubmission is not allowed for this assignment.' });
        return;
      }
      attemptNumber = (submission.attemptNumber || 1) + 1;
      if (assignment.maxAttempts && attemptNumber > assignment.maxAttempts) {
        res.status(409).json({ error: 'You have reached the maximum number of attempts.' });
        return;
      }
      submission.attemptHistory.push({
        attemptNumber: submission.attemptNumber || 1,
        submissionText: submission.submissionText,
        attachmentUrl: submission.attachmentUrl,
        submissionFiles: submission.submissionFiles || [],
        submittedAt: submission.submittedAt,
        status: submission.status,
        marksAwarded: submission.marksAwarded,
        feedback: submission.feedback,
        gradedBy: submission.gradedBy,
        gradedAt: submission.gradedAt,
        gradeReleasedAt: submission.gradeReleasedAt,
      });
    } else {
      submission = new AssignmentSubmission({
        assignmentId: assignment._id,
        studentId: user.studentId,
      });
    }

    storedFiles = await storePrivateFiles(
      incomingFiles,
      (fileId) => `/api/assignments/submission-files/${fileId}`
    );
    submission.classId = assignment.classId;
    submission.submissionText = cleanText;
    submission.attachmentUrl = cleanUrl || undefined;
    submission.submissionFiles = storedFiles.map((file) => ({
      fileId: file.fileId,
      storageKey: file.storageKey,
      originalName: file.originalName,
      mimeType: file.mimeType,
      size: file.size,
    }));
    submission.submittedAt = now;
    submission.status = isLate && assignment.latePolicy === 'ACCEPT_FLAG_LATE' ? 'LATE' : 'SUBMITTED';
    submission.marksAwarded = null;
    submission.feedback = '';
    submission.gradedBy = null;
    submission.gradedAt = null;
    submission.gradeReleasedAt = null;
    submission.attemptNumber = attemptNumber;
    await submission.save();
    submissionSaved = true;

    await logAudit({
      userId: user._id,
      action: attemptNumber > 1 ? 'ASSIGNMENT_RESUBMITTED' : 'ASSIGNMENT_SUBMITTED',
      entityType: 'AssignmentSubmission',
      entityId: submission._id.toString(),
      details: { assignmentId: assignment._id, attemptNumber, isLate },
      ipAddress: req.ip,
    });
    res.status(201).json({
      message: isLate ? 'Late submission received.' : 'Submission received successfully.',
      receipt: {
        submissionId: submission._id,
        attemptNumber,
        submittedAt: submission.submittedAt,
        status: submission.status,
      },
      submission: publicSubmission(submission),
    });
  } catch (error: any) {
    if (storedFiles.length && !submissionSaved) await deletePrivateFiles(storedFiles);
    if (error instanceof InvalidPrivateFileError) {
      res.status(400).json({ error: error.message });
      return;
    }
    if (error?.code === 11000 || error?.name === 'VersionError') {
      res.status(409).json({ error: 'A submission was updated at the same time. Refresh the assignment and try again.' });
      return;
    }
    res.status(500).json({ error: error.message || 'Failed to submit assignment' });
  }
};

export const getSubmissionsForAssignment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const assignment = await Assignment.findById(req.params.id);
    if (!assignment) {
      res.status(404).json({ error: 'Assignment not found.' });
      return;
    }
    if (!(await canManageAssignment(assignment, req))) {
      res.status(403).json({ error: 'You are not authorized to view these submissions.' });
      return;
    }
    const submissions = await AssignmentSubmission.find({ assignmentId: assignment._id })
      .populate('studentId', 'firstName lastName displayName studentNumber')
      .populate('gradedBy', 'fullName')
      .sort({ submittedAt: -1 });
    res.json(submissions.map(staffSubmission));
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch submissions' });
  }
};

export const gradeSubmission = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const submission = await AssignmentSubmission.findById(req.params.submissionId);
    if (!submission) {
      res.status(404).json({ error: 'Submission not found.' });
      return;
    }
    const assignment = await Assignment.findById(submission.assignmentId);
    if (!assignment || !(await canManageAssignment(assignment, req))) {
      res.status(403).json({ error: 'You are not authorized to grade this submission.' });
      return;
    }
    const marksAwarded = Number(req.body.marksAwarded);
    if (!Number.isFinite(marksAwarded) || marksAwarded < 0 || marksAwarded > assignment.totalMarks) {
      res.status(400).json({ error: `Marks must be between 0 and ${assignment.totalMarks}.` });
      return;
    }
    const feedback = typeof req.body.feedback === 'string' ? req.body.feedback.trim() : '';
    submission.marksAwarded = marksAwarded;
    submission.feedback = feedback;
    submission.status = 'GRADED';
    submission.gradedBy = req.user!._id;
    submission.gradedAt = new Date();
    submission.gradeReleasedAt = null;
    await submission.save();

    await logAudit({
      userId: req.user!._id,
      action: 'SUBMISSION_GRADED',
      entityType: 'AssignmentSubmission',
      entityId: submission._id.toString(),
      details: { assignmentId: assignment._id, marksAwarded },
      ipAddress: req.ip,
    });
    res.json({
      message: 'Grade saved. Release it to make marks and feedback visible to the student.',
      submission: staffSubmission(submission),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to grade submission' });
  }
};

export const releaseSubmissionGrade = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const submission = await AssignmentSubmission.findById(req.params.submissionId);
    if (!submission) {
      res.status(404).json({ error: 'Submission not found.' });
      return;
    }
    const assignment = await Assignment.findById(submission.assignmentId);
    if (!assignment || !(await canManageAssignment(assignment, req))) {
      res.status(403).json({ error: 'You are not authorized to release this grade.' });
      return;
    }
    if (submission.status !== 'GRADED' || submission.marksAwarded == null) {
      res.status(409).json({ error: 'Save a grade before releasing it.' });
      return;
    }
    submission.gradeReleasedAt = new Date();
    await submission.save();
    await logAudit({
      userId: req.user!._id,
      action: 'ASSIGNMENT_GRADE_RELEASED',
      entityType: 'AssignmentSubmission',
      entityId: submission._id.toString(),
      details: { assignmentId: assignment._id },
      ipAddress: req.ip,
    });
    res.json({ message: 'Grade and feedback released to the student.', submission: staffSubmission(submission) });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to release grade' });
  }
};

export const returnSubmissionForRevision = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const submission = await AssignmentSubmission.findById(req.params.submissionId);
    if (!submission) {
      res.status(404).json({ error: 'Submission not found.' });
      return;
    }
    const assignment = await Assignment.findById(submission.assignmentId);
    if (!assignment || !(await canManageAssignment(assignment, req))) {
      res.status(403).json({ error: 'You are not authorized to return this submission.' });
      return;
    }
    if (!isPublished(assignment)) {
      res.status(409).json({ error: 'Only published assignments can be returned for revision.' });
      return;
    }
    if (!assignment.allowResubmission) {
      res.status(409).json({ error: 'Resubmission is disabled for this assignment.' });
      return;
    }
    if (!['SUBMITTED', 'LATE'].includes(submission.status)) {
      res.status(409).json({ error: 'Only ungraded submissions can be returned for revision.' });
      return;
    }
    if (assignment.maxAttempts && submission.attemptNumber >= assignment.maxAttempts) {
      res.status(409).json({ error: 'The student has no attempts remaining for this assignment.' });
      return;
    }
    const now = new Date();
    if (
      (assignment.resubmissionUntil && now > assignment.resubmissionUntil) ||
      (now > assignment.dueDate && assignment.latePolicy === 'REJECT')
    ) {
      res.status(409).json({ error: 'The student can no longer submit a revised attempt.' });
      return;
    }
    const feedback = typeof req.body.feedback === 'string' ? req.body.feedback.trim() : '';
    if (!feedback || feedback.length > 4000) {
      res.status(400).json({ error: 'Provide revision feedback (up to 4,000 characters).' });
      return;
    }

    submission.status = 'RETURNED';
    submission.marksAwarded = null;
    submission.feedback = feedback;
    submission.gradedBy = null;
    submission.gradedAt = null;
    submission.gradeReleasedAt = now;
    await submission.save();
    await logAudit({
      userId: req.user!._id,
      action: 'SUBMISSION_RETURNED_FOR_REVISION',
      entityType: 'AssignmentSubmission',
      entityId: submission._id.toString(),
      details: { assignmentId: assignment._id, attemptNumber: submission.attemptNumber },
      ipAddress: req.ip,
    });
    res.json({ message: 'Submission returned with revision feedback.', submission: staffSubmission(submission) });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to return submission' });
  }
};

export const downloadAssignmentAttachment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const assignment = await Assignment.findOne({ 'attachments.fileId': req.params.fileId });
    if (!assignment) {
      res.status(404).json({ error: 'Assignment attachment not found.' });
      return;
    }
    const user = req.user!;
    if (user.role === 'STUDENT' && user.studentId) {
      if (!isPublished(assignment) || !(await isEligibleStudent(assignment, user.studentId))) {
        res.status(403).json({ error: 'You are not authorized to access this assignment attachment.' });
        return;
      }
    } else if (
      (user.role !== 'ADMIN' && user.role !== 'TEACHER') ||
      !(await canManageAssignment(assignment, req))
    ) {
      res.status(403).json({ error: 'You are not authorized to access this assignment attachment.' });
      return;
    }
    const attachment = assignment.attachments.find((item) => item.fileId === req.params.fileId);
    if (!attachment?.storageKey || !attachment.originalName || !attachment.mimeType) {
      res.status(404).json({ error: 'Assignment attachment not found.' });
      return;
    }
    await sendPrivateFile(res, {
      storageKey: attachment.storageKey,
      originalName: attachment.originalName,
      mimeType: attachment.mimeType,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to download assignment attachment' });
  }
};

export const downloadSubmissionFile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const submission = await AssignmentSubmission.findOne({
      $or: [
        { 'submissionFiles.fileId': req.params.fileId },
        { 'attemptHistory.submissionFiles.fileId': req.params.fileId },
      ],
    });
    if (!submission) {
      res.status(404).json({ error: 'Submission file not found.' });
      return;
    }
    const assignment = await Assignment.findById(submission.assignmentId);
    if (!assignment) {
      res.status(404).json({ error: 'Assignment not found.' });
      return;
    }
    const user = req.user!;
    if (user.role === 'STUDENT' && user.studentId) {
      if (
        !isPublished(assignment) ||
        submission.studentId.toString() !== user.studentId.toString() ||
        !(await isEligibleStudent(assignment, user.studentId))
      ) {
        res.status(403).json({ error: 'You are not authorized to access this submission file.' });
        return;
      }
    } else if (
      (user.role !== 'ADMIN' && user.role !== 'TEACHER') ||
      !(await canManageAssignment(assignment, req))
    ) {
      res.status(403).json({ error: 'You are not authorized to access this submission file.' });
      return;
    }
    const file =
      submission.submissionFiles.find((item) => item.fileId === req.params.fileId) ||
      submission.attemptHistory
        .flatMap((attempt) => attempt.submissionFiles || [])
        .find((item) => item.fileId === req.params.fileId);
    if (!file) {
      res.status(404).json({ error: 'Submission file not found.' });
      return;
    }
    await sendPrivateFile(res, file);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to download submission file' });
  }
};
