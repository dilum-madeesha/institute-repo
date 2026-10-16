import { Response } from 'express';
import { Enrollment } from '../models/Enrollment';
import { Student } from '../models/Student';
import { ClassModel } from '../models/Class';
import { AuthRequest } from '../middleware/auth';
import { logAudit } from '../services/auditService';

export const enrollStudent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { studentId, classId, startDate } = req.body;

    if (!studentId || !classId) {
      res.status(400).json({ error: 'Both studentId and classId are required.' });
      return;
    }

    const student = await Student.findById(studentId);
    if (!student) {
      res.status(404).json({ error: 'Student not found.' });
      return;
    }

    const classObj = await ClassModel.findById(classId);
    if (!classObj) {
      res.status(404).json({ error: 'Class not found.' });
      return;
    }

    // Check for duplicate active enrollment
    const activeExisting = await Enrollment.findOne({
      studentId: student._id,
      classId: classObj._id,
      status: 'ACTIVE',
    });

    if (activeExisting) {
      res.status(409).json({ error: 'This student is already actively enrolled in this class.' });
      return;
    }

    const enrollment = await Enrollment.create({
      studentId: student._id,
      classId: classObj._id,
      startDate: startDate ? new Date(startDate) : new Date(),
      status: 'ACTIVE',
      createdBy: req.user!._id,
    });

    await logAudit({
      userId: req.user!._id,
      action: 'STUDENT_ENROLLED',
      entityType: 'Enrollment',
      entityId: enrollment._id.toString(),
      details: {
        studentId: student._id,
        studentName: student.displayName,
        classId: classObj._id,
        className: classObj.name,
      },
      ipAddress: req.ip,
    });

    const populated = await Enrollment.findById(enrollment._id)
      .populate('studentId', 'firstName lastName displayName studentNumber')
      .populate('classId', 'name classCode');

    res.status(201).json(populated);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to enroll student' });
  }
};

export const updateEnrollment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { status, endDate } = req.body;
    const enrollment = await Enrollment.findById(req.params.id);
    if (!enrollment) {
      res.status(404).json({ error: 'Enrollment record not found' });
      return;
    }

    if (status) enrollment.status = status;
    if (endDate !== undefined) {
      enrollment.endDate = endDate ? new Date(endDate) : null;
    }

    await enrollment.save();

    await logAudit({
      userId: req.user!._id,
      action: 'ENROLLMENT_UPDATED',
      entityType: 'Enrollment',
      entityId: enrollment._id.toString(),
      details: { status: enrollment.status, endDate: enrollment.endDate },
      ipAddress: req.ip,
    });

    res.json(enrollment);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to update enrollment' });
  }
};

export const endEnrollment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const enrollment = await Enrollment.findById(req.params.id);
    if (!enrollment) {
      res.status(404).json({ error: 'Enrollment not found' });
      return;
    }

    enrollment.status = 'WITHDRAWN';
    enrollment.endDate = new Date();
    await enrollment.save();

    await logAudit({
      userId: req.user!._id,
      action: 'ENROLLMENT_WITHDRAWN',
      entityType: 'Enrollment',
      entityId: enrollment._id.toString(),
      ipAddress: req.ip,
    });

    res.json({ message: 'Enrollment marked as withdrawn. Historical attendance is preserved.', enrollment });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to end enrollment' });
  }
};
