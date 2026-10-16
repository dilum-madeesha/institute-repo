import mongoose from 'mongoose';

export const currentEnrollmentFilter = (
  studentId: mongoose.Types.ObjectId | string | { $in: Array<mongoose.Types.ObjectId | string> },
  classId?: mongoose.Types.ObjectId | string,
  now = new Date()
): Record<string, unknown> => ({
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
