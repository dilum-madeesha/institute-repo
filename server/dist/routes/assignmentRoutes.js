"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const assignmentController_1 = require("../controllers/assignmentController");
const auth_1 = require("../middleware/auth");
const role_1 = require("../middleware/role");
const privateFileStorage_1 = require("../services/privateFileStorage");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate);
router.get('/files/:fileId', assignmentController_1.downloadAssignmentAttachment);
router.get('/submission-files/:fileId', assignmentController_1.downloadSubmissionFile);
// Get assignments for class (filtered per role)
router.get('/class/:classId', assignmentController_1.getAssignmentsByClass);
// Teacher creates assignment
router.post('/', role_1.requireTeacherOrAdmin, (0, privateFileStorage_1.receivePrivateFiles)(), assignmentController_1.createAssignment);
router.patch('/:id', role_1.requireTeacherOrAdmin, (0, privateFileStorage_1.receivePrivateFiles)(), assignmentController_1.updateAssignment);
router.post('/:id/publish', role_1.requireTeacherOrAdmin, assignmentController_1.publishAssignment);
router.post('/:id/cancel-schedule', role_1.requireTeacherOrAdmin, assignmentController_1.cancelScheduledAssignment);
router.post('/:id/archive', role_1.requireTeacherOrAdmin, assignmentController_1.archiveAssignment);
// Student submits assignment
router.post('/:id/submit', (0, role_1.requireRoles)(['STUDENT']), (0, privateFileStorage_1.receivePrivateFiles)(), assignmentController_1.submitAssignment);
// Teacher views submissions and grades
router.get('/:id/submissions', role_1.requireTeacherOrAdmin, assignmentController_1.getSubmissionsForAssignment);
router.patch('/submissions/:submissionId/grade', role_1.requireTeacherOrAdmin, assignmentController_1.gradeSubmission);
router.post('/submissions/:submissionId/release-grade', role_1.requireTeacherOrAdmin, assignmentController_1.releaseSubmissionGrade);
router.post('/submissions/:submissionId/return', role_1.requireTeacherOrAdmin, assignmentController_1.returnSubmissionForRevision);
exports.default = router;
