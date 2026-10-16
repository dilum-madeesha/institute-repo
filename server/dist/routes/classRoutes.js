"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const classController_1 = require("../controllers/classController");
const attendanceController_1 = require("../controllers/attendanceController");
const auth_1 = require("../middleware/auth");
const role_1 = require("../middleware/role");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate);
// List classes and single class (accessible to Admin, Teacher, Student, Parent with internal access checks)
router.get('/', classController_1.getClasses);
router.get('/:id', classController_1.getClassById);
// Admin-only class creation & status
router.post('/', role_1.requireAdmin, classController_1.createClass);
router.patch('/:id/status', role_1.requireAdmin, classController_1.toggleClassStatus);
// Teacher or Admin modification & roster viewing
router.patch('/:id', role_1.requireTeacherOrAdmin, classController_1.updateClass);
router.get('/:id/students', role_1.requireTeacherOrAdmin, classController_1.getClassStudents);
// Sessions nested under classes
router.get('/:id/sessions', role_1.requireTeacherOrAdmin, attendanceController_1.getClassSessions);
router.post('/:id/sessions', role_1.requireTeacherOrAdmin, attendanceController_1.createClassSession);
exports.default = router;
