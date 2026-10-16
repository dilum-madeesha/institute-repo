"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const lessonController_1 = require("../controllers/lessonController");
const auth_1 = require("../middleware/auth");
const role_1 = require("../middleware/role");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate);
// Viewing lessons is accessible to any enrolled role (handled in controller via canAccessClass)
router.get('/class/:classId', lessonController_1.getLessonsByClass);
// Teacher/Admin actions
router.post('/', role_1.requireTeacherOrAdmin, lessonController_1.createLesson);
router.patch('/:id', role_1.requireTeacherOrAdmin, lessonController_1.updateLesson);
router.delete('/:id', role_1.requireTeacherOrAdmin, lessonController_1.deleteLesson);
// Student toggle completion
router.post('/:id/progress', lessonController_1.toggleLessonProgress);
exports.default = router;
