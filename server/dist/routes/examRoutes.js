"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const examController_1 = require("../controllers/examController");
const auth_1 = require("../middleware/auth");
const role_1 = require("../middleware/role");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate);
// Get exams for class
router.get('/class/:classId', examController_1.getExamsByClass);
// Teacher creates exam
router.post('/', role_1.requireTeacherOrAdmin, examController_1.createExam);
// Student fetches sanitized exam & submits
router.get('/:id/take', examController_1.getExamForTaking);
router.post('/:id/submit', examController_1.submitExam);
// Teacher results review & manual grading
router.get('/:id/submissions', role_1.requireTeacherOrAdmin, examController_1.getSubmissionsForExam);
router.patch('/submissions/:submissionId/grade', role_1.requireTeacherOrAdmin, examController_1.gradeExamSubmission);
exports.default = router;
