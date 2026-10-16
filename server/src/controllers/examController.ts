import { Response } from 'express';
import mongoose from 'mongoose';
import { Examination } from '../models/Examination';
import { ExamSubmission } from '../models/ExamSubmission';
import { AuthRequest } from '../middleware/auth';
import { canAccessClass, verifyParentStudentLink } from '../middleware/role';
import { logAudit } from '../services/auditService';

export const getExamsByClass = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const classId = req.params.classId as string;
    const user = req.user!;

    const hasAccess = await canAccessClass(
      user._id.toString(),
      user.role,
      classId,
      user.studentId?.toString(),
      user.guardianId?.toString()
    );

    if (!hasAccess) {
      res.status(403).json({ error: 'Access denied.' });
      return;
    }

    const exams = await Examination.find({ classId, isPublished: true })
      .sort({ examDate: 1 })
      .populate('createdBy', 'fullName');

    // Student view: attach their submission
    if (user.role === 'STUDENT' && user.studentId) {
      const submissions = await ExamSubmission.find({
        classId,
        studentId: user.studentId,
      });
      const subMap = new Map(submissions.map((s) => [s.examId.toString(), s]));

      const enriched = exams.map((ex) => ({
        ...ex.toObject(),
        mySubmission: subMap.get(ex._id.toString()) || null,
      }));
      res.json(enriched);
      return;
    }

    // Parent view: check linked child
    const { studentId } = req.query;
    if (user.role === 'PARENT' && user.guardianId && studentId) {
      const isLinked = await verifyParentStudentLink(user.guardianId.toString(), String(studentId));
      if (!isLinked) {
        res.status(403).json({ error: 'Access denied. Student is not linked to your parent account.' });
        return;
      }

      const submissions = await ExamSubmission.find({
        classId,
        studentId,
      });
      const subMap = new Map(submissions.map((s) => [s.examId.toString(), s]));

      const enriched = exams.map((ex) => ({
        ...ex.toObject(),
        childSubmission: subMap.get(ex._id.toString()) || null,
      }));
      res.json(enriched);
      return;
    }

    // Teacher/Admin view: count total submissions
    const examIds = exams.map((e) => e._id);
    const subCounts = await ExamSubmission.aggregate([
      { $match: { examId: { $in: examIds } } },
      { $group: { _id: '$examId', count: { $sum: 1 } } },
    ]);
    const countMap = new Map(subCounts.map((sc) => [sc._id.toString(), sc.count]));

    const enriched = exams.map((ex) => ({
      ...ex.toObject(),
      submissionCount: countMap.get(ex._id.toString()) || 0,
    }));

    res.json(enriched);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch exams' });
  }
};

export const createExam = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { classId, title, description, examDate, durationMinutes, totalMarks, questions } = req.body;

    if (!classId || !title || !examDate) {
      res.status(400).json({ error: 'Class ID, title, and exam date are required.' });
      return;
    }
    if (!mongoose.isValidObjectId(classId)) {
      res.status(400).json({ error: 'A valid class is required.' });
      return;
    }
    if (!(await canAccessClass(req.user!._id.toString(), req.user!.role, classId))) {
      res.status(403).json({ error: 'You can create exams only for classes assigned to you.' });
      return;
    }

    const exam = await Examination.create({
      classId,
      title: title.trim(),
      description: description ? description.trim() : '',
      examDate: new Date(examDate),
      durationMinutes: durationMinutes ? Number(durationMinutes) : 60,
      totalMarks: totalMarks ? Number(totalMarks) : 100,
      questions: Array.isArray(questions) ? questions : [],
      createdBy: req.user!._id,
    });

    await logAudit({
      userId: req.user!._id,
      action: 'EXAM_CREATED',
      entityType: 'Examination',
      entityId: exam._id.toString(),
      details: { title: exam.title, classId },
      ipAddress: req.ip,
    });

    res.status(201).json(exam);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to create exam' });
  }
};

export const getExamForTaking = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const examId = req.params.id as string;
    const exam = await Examination.findById(examId);

    if (!exam) {
      res.status(404).json({ error: 'Exam not found' });
      return;
    }
    if (!exam.isPublished) {
      res.status(404).json({ error: 'Published exam not found.' });
      return;
    }
    const hasAccess = await canAccessClass(
      req.user!._id.toString(),
      req.user!.role,
      exam.classId.toString(),
      req.user!.studentId?.toString(),
      req.user!.guardianId?.toString()
    );
    if (!hasAccess) {
      res.status(403).json({ error: 'You are not authorized to access this exam.' });
      return;
    }

    // For students, strip out correctAnswer from the questions payload!
    const sanitizedQuestions = exam.questions.map((q) => ({
      id: q.id,
      questionText: q.questionText,
      questionType: q.questionType,
      options: q.options,
      marks: q.marks,
    }));

    res.json({
      _id: exam._id,
      classId: exam.classId,
      title: exam.title,
      description: exam.description,
      examDate: exam.examDate,
      durationMinutes: exam.durationMinutes,
      totalMarks: exam.totalMarks,
      questions: sanitizedQuestions,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to load exam' });
  }
};

export const submitExam = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const examId = req.params.id as string;
    const user = req.user!;

    if (user.role !== 'STUDENT' || !user.studentId) {
      res.status(403).json({ error: 'Only registered students can take exams.' });
      return;
    }

    const exam = await Examination.findById(examId);
    if (!exam) {
      res.status(404).json({ error: 'Exam not found' });
      return;
    }
    if (!exam.isPublished) {
      res.status(404).json({ error: 'Published exam not found.' });
      return;
    }
    if (!(await canAccessClass(
      user._id.toString(),
      user.role,
      exam.classId.toString(),
      user.studentId?.toString(),
      user.guardianId?.toString()
    ))) {
      res.status(403).json({ error: 'You are not authorized to submit answers for this exam.' });
      return;
    }

    const { answers } = req.body; // array of { questionId, answerText }
    if (!Array.isArray(answers)) {
      res.status(400).json({ error: 'Expected answers array' });
      return;
    }

    // Auto-grade MCQs
    let totalScore = 0;
    const questionMap = new Map(exam.questions.map((q) => [q.id, q]));

    const gradedAnswers = answers.map((ans: any) => {
      const q = questionMap.get(ans.questionId);
      if (!q) return ans;

      const isCorrect =
        q.questionType === 'MCQ' &&
        q.correctAnswer &&
        q.correctAnswer.trim().toLowerCase() === String(ans.answerText || '').trim().toLowerCase();

      const marksAwarded = isCorrect ? q.marks : 0;
      totalScore += marksAwarded;

      return {
        questionId: ans.questionId,
        answerText: ans.answerText,
        isCorrect,
        marksAwarded,
      };
    });

    const submission = await ExamSubmission.findOneAndUpdate(
      { examId: exam._id, studentId: user.studentId },
      {
        classId: exam.classId,
        answers: gradedAnswers,
        score: totalScore,
        status: 'GRADED',
        submittedAt: new Date(),
        gradedAt: new Date(),
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    await logAudit({
      userId: user._id,
      action: 'EXAM_SUBMITTED',
      entityType: 'ExamSubmission',
      entityId: submission._id.toString(),
      details: { examId, score: totalScore },
      ipAddress: req.ip,
    });

    res.json({ message: 'Exam submitted and graded successfully', score: totalScore, submission });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to submit exam' });
  }
};

export const getSubmissionsForExam = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const examId = req.params.id as string;
    const submissions = await ExamSubmission.find({ examId })
      .populate('studentId', 'firstName lastName displayName studentNumber')
      .sort({ score: -1 });

    res.json(submissions);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch exam results' });
  }
};

export const gradeExamSubmission = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const submissionId = req.params.submissionId as string;
    const { score, feedback } = req.body;

    const submission = await ExamSubmission.findById(submissionId);
    if (!submission) {
      res.status(404).json({ error: 'Exam submission not found' });
      return;
    }

    if (score !== undefined) submission.score = Number(score);
    if (feedback !== undefined) submission.feedback = feedback.trim();
    submission.status = 'GRADED';
    submission.gradedAt = new Date();
    await submission.save();

    res.json({ message: 'Exam grade updated', submission });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to update grade' });
  }
};
