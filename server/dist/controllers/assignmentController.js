"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.gradeSubmission = exports.getSubmissionsForAssignment = exports.submitAssignment = exports.createAssignment = exports.getAssignmentsByClass = void 0;
const Assignment_1 = require("../models/Assignment");
const AssignmentSubmission_1 = require("../models/AssignmentSubmission");
const role_1 = require("../middleware/role");
const auditService_1 = require("../services/auditService");
const getAssignmentsByClass = async (req, res) => {
    try {
        const classId = req.params.classId;
        const user = req.user;
        const hasAccess = await (0, role_1.canAccessClass)(user._id.toString(), user.role, classId, user.studentId?.toString(), user.guardianId?.toString());
        if (!hasAccess) {
            res.status(403).json({ error: 'Access denied.' });
            return;
        }
        const assignments = await Assignment_1.Assignment.find({ classId, isPublished: true })
            .sort({ dueDate: 1 })
            .populate('createdBy', 'fullName');
        // Student view: attach their individual submission
        if (user.role === 'STUDENT' && user.studentId) {
            const submissions = await AssignmentSubmission_1.AssignmentSubmission.find({
                classId,
                studentId: user.studentId,
            });
            const subMap = new Map(submissions.map((s) => [s.assignmentId.toString(), s]));
            const enriched = assignments.map((a) => ({
                ...a.toObject(),
                mySubmission: subMap.get(a._id.toString()) || null,
            }));
            res.json(enriched);
            return;
        }
        // Parent view: check linked child
        const { studentId } = req.query;
        if (user.role === 'PARENT' && user.guardianId && studentId) {
            const isLinked = await (0, role_1.verifyParentStudentLink)(user.guardianId.toString(), String(studentId));
            if (!isLinked) {
                res.status(403).json({ error: 'Access denied. Student is not linked to your parent account.' });
                return;
            }
            const submissions = await AssignmentSubmission_1.AssignmentSubmission.find({
                classId,
                studentId,
            });
            const subMap = new Map(submissions.map((s) => [s.assignmentId.toString(), s]));
            const enriched = assignments.map((a) => ({
                ...a.toObject(),
                childSubmission: subMap.get(a._id.toString()) || null,
            }));
            res.json(enriched);
            return;
        }
        // Teacher/Admin view: count total submissions
        const assignmentIds = assignments.map((a) => a._id);
        const subCounts = await AssignmentSubmission_1.AssignmentSubmission.aggregate([
            { $match: { assignmentId: { $in: assignmentIds } } },
            { $group: { _id: '$assignmentId', count: { $sum: 1 } } },
        ]);
        const countMap = new Map(subCounts.map((sc) => [sc._id.toString(), sc.count]));
        const enriched = assignments.map((a) => ({
            ...a.toObject(),
            submissionCount: countMap.get(a._id.toString()) || 0,
        }));
        res.json(enriched);
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Failed to fetch assignments' });
    }
};
exports.getAssignmentsByClass = getAssignmentsByClass;
const createAssignment = async (req, res) => {
    try {
        const { classId, title, description, dueDate, totalMarks, attachments } = req.body;
        if (!classId || !title || !dueDate) {
            res.status(400).json({ error: 'Class, title, and due date are required.' });
            return;
        }
        const assignment = await Assignment_1.Assignment.create({
            classId,
            title: title.trim(),
            description: description ? description.trim() : '',
            dueDate: new Date(dueDate),
            totalMarks: totalMarks ? Number(totalMarks) : 100,
            attachments: Array.isArray(attachments) ? attachments : [],
            createdBy: req.user._id,
        });
        await (0, auditService_1.logAudit)({
            userId: req.user._id,
            action: 'ASSIGNMENT_CREATED',
            entityType: 'Assignment',
            entityId: assignment._id.toString(),
            details: { title: assignment.title, classId },
            ipAddress: req.ip,
        });
        res.status(201).json(assignment);
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Failed to create assignment' });
    }
};
exports.createAssignment = createAssignment;
const submitAssignment = async (req, res) => {
    try {
        const assignmentId = req.params.id;
        const user = req.user;
        if (user.role !== 'STUDENT' || !user.studentId) {
            res.status(403).json({ error: 'Only registered students can submit assignments.' });
            return;
        }
        const assignment = await Assignment_1.Assignment.findById(assignmentId);
        if (!assignment) {
            res.status(404).json({ error: 'Assignment not found' });
            return;
        }
        const { submissionText, attachmentUrl } = req.body;
        if (!submissionText && !attachmentUrl) {
            res.status(400).json({ error: 'Please provide either text or a file link for your submission.' });
            return;
        }
        const now = new Date();
        const isLate = now > new Date(assignment.dueDate);
        const status = isLate ? 'LATE' : 'SUBMITTED';
        const submission = await AssignmentSubmission_1.AssignmentSubmission.findOneAndUpdate({ assignmentId: assignment._id, studentId: user.studentId }, {
            classId: assignment.classId,
            submissionText: submissionText ? submissionText.trim() : '',
            attachmentUrl: attachmentUrl ? attachmentUrl.trim() : undefined,
            submittedAt: now,
            status,
        }, { upsert: true, new: true, setDefaultsOnInsert: true });
        await (0, auditService_1.logAudit)({
            userId: user._id,
            action: 'ASSIGNMENT_SUBMITTED',
            entityType: 'AssignmentSubmission',
            entityId: submission._id.toString(),
            details: { assignmentId, isLate },
            ipAddress: req.ip,
        });
        res.json({ message: isLate ? 'Submitted late' : 'Submitted successfully', submission });
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Failed to submit assignment' });
    }
};
exports.submitAssignment = submitAssignment;
const getSubmissionsForAssignment = async (req, res) => {
    try {
        const assignmentId = req.params.id;
        const assignment = await Assignment_1.Assignment.findById(assignmentId);
        if (!assignment) {
            res.status(404).json({ error: 'Assignment not found' });
            return;
        }
        const submissions = await AssignmentSubmission_1.AssignmentSubmission.find({ assignmentId })
            .populate('studentId', 'firstName lastName displayName studentNumber')
            .populate('gradedBy', 'fullName')
            .sort({ submittedAt: -1 });
        res.json(submissions);
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Failed to fetch submissions' });
    }
};
exports.getSubmissionsForAssignment = getSubmissionsForAssignment;
const gradeSubmission = async (req, res) => {
    try {
        const submissionId = req.params.submissionId;
        const { marksAwarded, feedback } = req.body;
        if (marksAwarded === undefined || marksAwarded === null) {
            res.status(400).json({ error: 'Marks awarded are required.' });
            return;
        }
        const submission = await AssignmentSubmission_1.AssignmentSubmission.findById(submissionId);
        if (!submission) {
            res.status(404).json({ error: 'Submission not found' });
            return;
        }
        submission.marksAwarded = Number(marksAwarded);
        if (feedback !== undefined)
            submission.feedback = feedback.trim();
        submission.status = 'GRADED';
        submission.gradedBy = req.user._id;
        submission.gradedAt = new Date();
        await submission.save();
        await (0, auditService_1.logAudit)({
            userId: req.user._id,
            action: 'SUBMISSION_GRADED',
            entityType: 'AssignmentSubmission',
            entityId: submission._id.toString(),
            details: { marksAwarded: submission.marksAwarded },
            ipAddress: req.ip,
        });
        res.json({ message: 'Submission graded successfully', submission });
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Failed to grade submission' });
    }
};
exports.gradeSubmission = gradeSubmission;
