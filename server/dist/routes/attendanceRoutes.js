"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const attendanceController_1 = require("../controllers/attendanceController");
const auth_1 = require("../middleware/auth");
const role_1 = require("../middleware/role");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate, role_1.requireTeacherOrAdmin);
// Sessions endpoints
router.get('/sessions/:sessionId/attendance', attendanceController_1.getSessionAttendance);
router.put('/sessions/:sessionId/attendance', attendanceController_1.saveDraftAttendance);
router.post('/sessions/:sessionId/submit', attendanceController_1.submitAttendance);
// Single record correction endpoints
router.patch('/attendance/:attendanceId', attendanceController_1.correctAttendanceRecord);
router.get('/attendance/:attendanceId/logs', attendanceController_1.getRecordChangeLogs);
exports.default = router;
