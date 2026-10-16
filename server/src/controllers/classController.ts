import { Response } from 'express';
import { ClassModel } from '../models/Class';
import { Enrollment } from '../models/Enrollment';
import { ClassSession } from '../models/ClassSession';
import { StudentGuardian } from '../models/StudentGuardian';
import { AttendanceRecord } from '../models/AttendanceRecord';
import { AttendanceChangeLog } from '../models/AttendanceChangeLog';
import { Assignment } from '../models/Assignment';
import { AssignmentSubmission } from '../models/AssignmentSubmission';
import { Examination } from '../models/Examination';
import { ExamSubmission } from '../models/ExamSubmission';
import { Lesson } from '../models/Lesson';
import { LessonProgress } from '../models/LessonProgress';
import { EmailNotification } from '../models/EmailNotification';
import { Announcement } from '../models/Announcement';
import { AuthRequest } from '../middleware/auth';
import { canAccessClass } from '../middleware/role';
import { logAudit } from '../services/auditService';
import { currentEnrollmentFilter } from '../services/enrollmentAccess';

export const getClasses = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { status, search, subject } = req.query;
    const filter: any = {};

    // Filter classes per role
    if (req.user!.role === 'TEACHER') {
      filter.teachers = req.user!._id;
    } else if (req.user!.role === 'STUDENT') {
      if (!req.user!.studentId) {
        res.status(403).json({
          error: 'This student login is not linked to a student profile. Ask an administrator to link the account.',
          code: 'STUDENT_PROFILE_NOT_LINKED',
        });
        return;
      }
      const enrollments = await Enrollment.find(currentEnrollmentFilter(req.user!.studentId));
      filter._id = { $in: enrollments.map((e) => e.classId) };
    } else if (req.user!.role === 'PARENT' && req.user!.guardianId) {
      const links = await StudentGuardian.find({ guardianId: req.user!.guardianId });
      const enrollments = await Enrollment.find(
        currentEnrollmentFilter({ $in: links.map((l) => l.studentId) })
      );
      filter._id = { $in: enrollments.map((e) => e.classId) };
    }

    if (status) filter.status = status;
    if (subject) filter.subject = subject;
    if (search) {
      filter.$or = [
        { name: { $regex: String(search), $options: 'i' } },
        { classCode: { $regex: String(search), $options: 'i' } },
        { subject: { $regex: String(search), $options: 'i' } },
      ];
    }

    const classes = await ClassModel.find(filter)
      .populate('teachers', 'fullName email')
      .sort({ createdAt: -1 });

    // Attach active enrollment counts
    const classIds = classes.map((c) => c._id);
    const enrollmentCounts = await Enrollment.aggregate([
      { $match: { classId: { $in: classIds }, status: 'ACTIVE' } },
      { $group: { _id: '$classId', count: { $sum: 1 } } },
    ]);

    const countMap = new Map(enrollmentCounts.map((e) => [e._id.toString(), e.count]));

    const response = classes.map((c) => ({
      ...c.toObject(),
      enrolledCount: countMap.get(c._id.toString()) || 0,
    }));

    res.json(response);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch classes' });
  }
};

export const getClassById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const classId = req.params.id as string;
    const hasAccess = await canAccessClass(
      req.user!._id.toString(),
      req.user!.role,
      classId,
      req.user!.studentId?.toString(),
      req.user!.guardianId?.toString()
    );
    if (!hasAccess) {
      res.status(403).json({ error: 'Access denied. You are not enrolled in or assigned to this class.' });
      return;
    }

    const classObj = await ClassModel.findById(classId).populate('teachers', 'fullName email');
    if (!classObj) {
      res.status(404).json({ error: 'Class not found' });
      return;
    }

    const enrolledCount = await Enrollment.countDocuments({ classId: classObj._id, status: 'ACTIVE' });
    const sessionCount = await ClassSession.countDocuments({ classId: classObj._id });

    res.json({
      ...classObj.toObject(),
      enrolledCount,
      sessionCount,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch class details' });
  }
};

export const createClass = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, classCode, subject, description, academicYear, teachers } = req.body;

    if (!name || !classCode || !subject) {
      res.status(400).json({ error: 'Class name, unique class code, and subject are required.' });
      return;
    }

    const normalizedCode = classCode.toUpperCase().trim();
    const existing = await ClassModel.findOne({ classCode: normalizedCode });
    if (existing) {
      res.status(409).json({ error: `A class with code "${normalizedCode}" already exists.` });
      return;
    }

    const newClass = await ClassModel.create({
      name: name.trim(),
      classCode: normalizedCode,
      subject: subject.trim(),
      description: description ? description.trim() : '',
      academicYear: academicYear ? academicYear.trim() : '',
      teachers: Array.isArray(teachers) ? teachers : [],
      status: 'ACTIVE',
      createdBy: req.user!._id,
    });

    await logAudit({
      userId: req.user!._id,
      action: 'CLASS_CREATED',
      entityType: 'Class',
      entityId: newClass._id.toString(),
      details: { name: newClass.name, code: newClass.classCode },
      ipAddress: req.ip,
    });

    const populated = await ClassModel.findById(newClass._id).populate('teachers', 'fullName email');
    res.status(201).json(populated);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to create class' });
  }
};

export const updateClass = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const classId = req.params.id as string;
    const hasAccess = await canAccessClass(req.user!._id.toString(), req.user!.role, classId);
    if (!hasAccess) {
      res.status(403).json({ error: 'Access denied.' });
      return;
    }

    const { name, classCode, subject, description, academicYear, teachers } = req.body;
    const classObj = await ClassModel.findById(classId);
    if (!classObj) {
      res.status(404).json({ error: 'Class not found' });
      return;
    }

    if (classCode && classCode.toUpperCase().trim() !== classObj.classCode) {
      const normalizedCode = classCode.toUpperCase().trim();
      const existing = await ClassModel.findOne({ classCode: normalizedCode });
      if (existing) {
        res.status(409).json({ error: `Class code "${normalizedCode}" is already in use.` });
        return;
      }
      classObj.classCode = normalizedCode;
    }

    if (name) classObj.name = name.trim();
    if (subject) classObj.subject = subject.trim();
    if (description !== undefined) classObj.description = description.trim();
    if (academicYear !== undefined) classObj.academicYear = academicYear.trim();

    // Only admin can reassign teachers
    if (req.user!.role === 'ADMIN' && teachers !== undefined) {
      classObj.teachers = Array.isArray(teachers) ? teachers : [];
    }

    await classObj.save();

    await logAudit({
      userId: req.user!._id,
      action: 'CLASS_UPDATED',
      entityType: 'Class',
      entityId: classObj._id.toString(),
      details: { name: classObj.name, classCode: classObj.classCode },
      ipAddress: req.ip,
    });

    const populated = await ClassModel.findById(classObj._id).populate('teachers', 'fullName email');
    res.json(populated);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to update class' });
  }
};

export const toggleClassStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const classObj = await ClassModel.findById(req.params.id);
    if (!classObj) {
      res.status(404).json({ error: 'Class not found' });
      return;
    }

    classObj.status = classObj.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    await classObj.save();

    await logAudit({
      userId: req.user!._id,
      action: classObj.status === 'ACTIVE' ? 'CLASS_ACTIVATED' : 'CLASS_DEACTIVATED',
      entityType: 'Class',
      entityId: classObj._id.toString(),
      details: { status: classObj.status },
      ipAddress: req.ip,
    });

    res.json({ message: `Class is now ${classObj.status.toLowerCase()}.`, class: classObj });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to change class status' });
  }
};

export const deleteClass = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const classObj = await ClassModel.findById(req.params.id);
    if (!classObj) {
      res.status(404).json({ error: 'Class not found.' });
      return;
    }

    const [sessions, assignments, examinations, lessons] = await Promise.all([
      ClassSession.find({ classId: classObj._id }).select('_id'),
      Assignment.find({ classId: classObj._id }).select('_id'),
      Examination.find({ classId: classObj._id }).select('_id'),
      Lesson.find({ classId: classObj._id }).select('_id'),
    ]);
    const sessionIds = sessions.map((session) => session._id);
    const assignmentIds = assignments.map((assignment) => assignment._id);
    const examinationIds = examinations.map((examination) => examination._id);
    const lessonIds = lessons.map((lesson) => lesson._id);

    const attendanceRecords = await AttendanceRecord.find({ classSessionId: { $in: sessionIds } }).select('_id');
    const attendanceRecordIds = attendanceRecords.map((record) => record._id);

    await Promise.all([
      EmailNotification.deleteMany({
        $or: [
          { classSessionId: { $in: sessionIds } },
          { attendanceRecordId: { $in: attendanceRecordIds } },
        ],
      }),
      AttendanceChangeLog.deleteMany({
        $or: [
          { classSessionId: { $in: sessionIds } },
          { attendanceRecordId: { $in: attendanceRecordIds } },
        ],
      }),
      AttendanceRecord.deleteMany({ classSessionId: { $in: sessionIds } }),
      ClassSession.deleteMany({ classId: classObj._id }),
      Enrollment.deleteMany({ classId: classObj._id }),
      AssignmentSubmission.deleteMany({
        $or: [{ classId: classObj._id }, { assignmentId: { $in: assignmentIds } }],
      }),
      Assignment.deleteMany({ classId: classObj._id }),
      ExamSubmission.deleteMany({
        $or: [{ classId: classObj._id }, { examId: { $in: examinationIds } }],
      }),
      Examination.deleteMany({ classId: classObj._id }),
      LessonProgress.deleteMany({
        $or: [{ classId: classObj._id }, { lessonId: { $in: lessonIds } }],
      }),
      Lesson.deleteMany({ classId: classObj._id }),
      Announcement.deleteMany({ classId: classObj._id }),
    ]);
    await classObj.deleteOne();

    await logAudit({
      userId: req.user!._id,
      action: 'CLASS_DELETED',
      entityType: 'Class',
      entityId: classObj._id.toString(),
      details: { name: classObj.name, classCode: classObj.classCode },
      ipAddress: req.ip,
    });

    res.json({ message: `Class ${classObj.classCode} was deleted.` });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to delete class' });
  }
};

export const getClassStudents = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const classId = req.params.id as string;
    const hasAccess = await canAccessClass(req.user!._id.toString(), req.user!.role, classId);
    if (!hasAccess) {
      res.status(403).json({ error: 'Access denied.' });
      return;
    }

    const enrollments = await Enrollment.find({
      classId,
      status: 'ACTIVE',
    })
      .populate({
        path: 'studentId',
        match: { status: 'ACTIVE' },
      })
      .sort({ createdAt: 1 });

    const studentIds = enrollments.map((e) => (e.studentId as any)?._id).filter(Boolean);

    // Fetch linked guardians for each student to flag missing parent emails
    const studentGuardians = await StudentGuardian.find({
      studentId: { $in: studentIds },
    }).populate('guardianId');

    const guardianMap = new Map<string, any[]>();
    studentGuardians.forEach((sg) => {
      const sId = sg.studentId.toString();
      if (!guardianMap.has(sId)) guardianMap.set(sId, []);
      guardianMap.get(sId)!.push(sg);
    });

    const studentsWithEnrollment = enrollments
      .filter((e) => e.studentId)
      .map((e) => {
        const student = (e.studentId as any).toObject();
        const guardians = guardianMap.get(student._id.toString()) || [];
        const hasActiveGuardianEmail = guardians.some(
          (g) => g.guardianId?.status === 'ACTIVE' && g.guardianId?.email && g.receivesAttendanceEmails
        );

        return {
          ...student,
          enrollmentId: e._id,
          enrollmentStartDate: e.startDate,
          enrollmentStatus: e.status,
          guardians,
          hasActiveGuardianEmail,
        };
      });

    res.json(studentsWithEnrollment);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch class students' });
  }
};
