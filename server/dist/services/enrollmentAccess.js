"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.currentEnrollmentFilter = void 0;
const currentEnrollmentFilter = (studentId, classId, now = new Date()) => ({
    studentId,
    ...(classId ? { classId } : {}),
    status: /^ACTIVE$/i,
    $and: [
        {
            $or: [
                { startDate: { $exists: false } },
                { startDate: null },
                { startDate: { $lte: now } },
            ],
        },
        {
            $or: [
                { endDate: { $exists: false } },
                { endDate: null },
                { endDate: { $gte: now } },
            ],
        },
    ],
});
exports.currentEnrollmentFilter = currentEnrollmentFilter;
