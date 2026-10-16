import { Response } from 'express';
import { Guardian } from '../models/Guardian';
import { StudentGuardian } from '../models/StudentGuardian';
import { Student } from '../models/Student';
import { EmailNotification } from '../models/EmailNotification';
import { User } from '../models/User';
import { AuthRequest } from '../middleware/auth';
import { logAudit } from '../services/auditService';

export const getGuardians = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { search, status } = req.query;
    const filter: any = {};
    if (status) filter.status = status;
    if (search) {
      filter.$or = [
        { fullName: { $regex: String(search), $options: 'i' } },
        { email: { $regex: String(search), $options: 'i' } },
        { phone: { $regex: String(search), $options: 'i' } },
      ];
    }

    const guardians = await Guardian.find(filter).sort({ fullName: 1 });
    const gIds = guardians.map((g) => g._id);

    const links = await StudentGuardian.find({ guardianId: { $in: gIds } }).populate(
      'studentId',
      'firstName lastName displayName studentNumber status'
    );

    const studentMap = new Map<string, any[]>();
    links.forEach((l) => {
      const gId = l.guardianId.toString();
      if (!studentMap.has(gId)) studentMap.set(gId, []);
      studentMap.get(gId)!.push({
        student: l.studentId,
        relationship: l.relationship,
        receivesAttendanceEmails: l.receivesAttendanceEmails,
        isPrimaryContact: l.isPrimaryContact,
      });
    });

    const response = guardians.map((g) => ({
      ...g.toObject(),
      linkedStudents: studentMap.get(g._id.toString()) || [],
    }));

    res.json(response);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch guardians' });
  }
};

export const createGuardian = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { fullName, email, phone, studentId, relationship, receivesAttendanceEmails, isPrimaryContact } = req.body;

    if (!fullName || !email) {
      res.status(400).json({ error: 'Guardian full name and email are required.' });
      return;
    }

    const normalizedEmail = email.toLowerCase().trim();
    let guardian = await Guardian.findOne({ email: normalizedEmail });

    if (!guardian) {
      guardian = await Guardian.create({
        fullName: fullName.trim(),
        email: normalizedEmail,
        phone: phone ? phone.trim() : undefined,
        status: 'ACTIVE',
      });

      await logAudit({
        userId: req.user!._id,
        action: 'GUARDIAN_CREATED',
        entityType: 'Guardian',
        entityId: guardian._id.toString(),
        details: { name: guardian.fullName, email: guardian.email },
        ipAddress: req.ip,
      });
    }

    // If studentId was supplied, link them
    if (studentId) {
      const student = await Student.findById(studentId);
      if (student) {
        await StudentGuardian.findOneAndUpdate(
          { studentId: student._id, guardianId: guardian._id },
          {
            relationship: relationship || 'Guardian',
            receivesAttendanceEmails: receivesAttendanceEmails !== undefined ? receivesAttendanceEmails : true,
            isPrimaryContact: Boolean(isPrimaryContact),
          },
          { upsert: true, new: true }
        );
      }
    }

    res.status(201).json(guardian);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to create guardian' });
  }
};

export const updateGuardian = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { fullName, email, phone, status } = req.body;
    const guardian = await Guardian.findById(req.params.id);
    if (!guardian) {
      res.status(404).json({ error: 'Guardian not found' });
      return;
    }

    if (fullName) guardian.fullName = fullName.trim();
    if (email) guardian.email = email.toLowerCase().trim();
    if (phone !== undefined) guardian.phone = phone.trim();
    if (status) guardian.status = status;

    await guardian.save();

    await logAudit({
      userId: req.user!._id,
      action: 'GUARDIAN_UPDATED',
      entityType: 'Guardian',
      entityId: guardian._id.toString(),
      details: { name: guardian.fullName, email: guardian.email },
      ipAddress: req.ip,
    });

    res.json(guardian);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to update guardian' });
  }
};

export const deleteGuardian = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const guardian = await Guardian.findById(req.params.id);
    if (!guardian) {
      res.status(404).json({ error: 'Guardian not found.' });
      return;
    }

    await Promise.all([
      StudentGuardian.deleteMany({ guardianId: guardian._id }),
      EmailNotification.updateMany({ guardianId: guardian._id }, { $set: { guardianId: null } }),
      User.deleteMany({ role: 'PARENT', guardianId: guardian._id }),
    ]);
    await guardian.deleteOne();

    await logAudit({
      userId: req.user!._id,
      action: 'GUARDIAN_DELETED',
      entityType: 'Guardian',
      entityId: guardian._id.toString(),
      details: { name: guardian.fullName, email: guardian.email },
      ipAddress: req.ip,
    });

    res.json({ message: `Guardian ${guardian.fullName} was deleted.` });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to delete guardian' });
  }
};

export const linkGuardianToStudent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const studentId = req.params.id;
    const { guardianId, relationship, receivesAttendanceEmails, isPrimaryContact } = req.body;

    if (!guardianId) {
      res.status(400).json({ error: 'Guardian ID is required to link.' });
      return;
    }

    const student = await Student.findById(studentId);
    if (!student) {
      res.status(404).json({ error: 'Student not found' });
      return;
    }

    const guardian = await Guardian.findById(guardianId);
    if (!guardian) {
      res.status(404).json({ error: 'Guardian not found' });
      return;
    }

    const link = await StudentGuardian.findOneAndUpdate(
      { studentId: student._id, guardianId: guardian._id },
      {
        relationship: relationship || 'Guardian',
        receivesAttendanceEmails: receivesAttendanceEmails !== undefined ? receivesAttendanceEmails : true,
        isPrimaryContact: Boolean(isPrimaryContact),
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    await logAudit({
      userId: req.user!._id,
      action: 'GUARDIAN_LINKED_TO_STUDENT',
      entityType: 'StudentGuardian',
      entityId: link._id.toString(),
      details: { studentId, guardianId, relationship: link.relationship },
      ipAddress: req.ip,
    });

    res.json({ message: 'Guardian linked successfully', link });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to link guardian' });
  }
};

export const updateStudentGuardianLink = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id: studentId, guardianId } = req.params;
    const { relationship, receivesAttendanceEmails, isPrimaryContact } = req.body;

    const link = await StudentGuardian.findOne({ studentId, guardianId });
    if (!link) {
      res.status(404).json({ error: 'Guardian link not found' });
      return;
    }

    if (relationship !== undefined) link.relationship = relationship;
    if (receivesAttendanceEmails !== undefined) link.receivesAttendanceEmails = Boolean(receivesAttendanceEmails);
    if (isPrimaryContact !== undefined) link.isPrimaryContact = Boolean(isPrimaryContact);

    await link.save();

    await logAudit({
      userId: req.user!._id,
      action: 'GUARDIAN_LINK_UPDATED',
      entityType: 'StudentGuardian',
      entityId: link._id.toString(),
      details: { receivesAttendanceEmails: link.receivesAttendanceEmails },
      ipAddress: req.ip,
    });

    res.json({ message: 'Link updated successfully', link });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to update link' });
  }
};

export const unlinkGuardianFromStudent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id: studentId, guardianId } = req.params;

    const link = await StudentGuardian.findOneAndDelete({ studentId, guardianId });
    if (!link) {
      res.status(404).json({ error: 'Guardian link not found' });
      return;
    }

    await logAudit({
      userId: req.user!._id,
      action: 'GUARDIAN_UNLINKED',
      entityType: 'StudentGuardian',
      entityId: link._id.toString(),
      details: { studentId, guardianId },
      ipAddress: req.ip,
    });

    res.json({ message: 'Guardian unlinked successfully from student' });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to unlink guardian' });
  }
};
