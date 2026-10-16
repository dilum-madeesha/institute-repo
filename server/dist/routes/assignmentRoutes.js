"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const assignmentController_1 = require("../controllers/assignmentController");
const auth_1 = require("../middleware/auth");
const role_1 = require("../middleware/role");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate);
// Get assignments for class (filtered per role)
router.get('/class/:classId', assignmentController_1.getAssignmentsByClass);
// Teacher creates assignment
router.post('/', role_1.requireTeacherOrAdmin, assignmentController_1.createAssignment);
// Student submits assignment
router.post('/:id/submit', assignmentController_1.submitAssignment);
// Teacher views submissions and grades
router.get('/:id/submissions', role_1.requireTeacherOrAdmin, assignmentController_1.getSubmissionsForAssignment);
router.patch('/submissions/:submissionId/grade', role_1.requireTeacherOrAdmin, assignmentController_1.gradeSubmission);
exports.default = router;
