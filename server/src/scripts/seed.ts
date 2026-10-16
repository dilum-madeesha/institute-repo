import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { ENV } from '../config/env';
import { User } from '../models/User';
import { ClassModel } from '../models/Class';
import { Student } from '../models/Student';
import { Guardian } from '../models/Guardian';
import { StudentGuardian } from '../models/StudentGuardian';
import { Enrollment } from '../models/Enrollment';
import { ClassSession } from '../models/ClassSession';
import { AttendanceRecord } from '../models/AttendanceRecord';
import { AttendanceChangeLog } from '../models/AttendanceChangeLog';
import { EmailNotification } from '../models/EmailNotification';
import { AuditLog } from '../models/AuditLog';
import { Lesson } from '../models/Lesson';
import { LessonProgress } from '../models/LessonProgress';
import { Assignment } from '../models/Assignment';
import { AssignmentSubmission } from '../models/AssignmentSubmission';
import { Examination } from '../models/Examination';
import { ExamSubmission } from '../models/ExamSubmission';
import { Announcement } from '../models/Announcement';

export const seedDatabase = async () => {
  try {
    console.log('[Seed] Connecting to MongoDB...');
    await mongoose.connect(ENV.MONGODB_URI);
    console.log('[Seed] Connected.');

    await mongoose.connection.dropDatabase();
    console.log('[Seed] Database cleared for fresh setup.');

    const adminPassword = await bcrypt.hash('Admin@123456', 10);
    const teacherPassword = await bcrypt.hash('Teacher@123456', 10);
    const studentPassword = await bcrypt.hash('Student@123456', 10);
    const parentPassword = await bcrypt.hash('Parent@123456', 10);

    // 1. Staff Users
    const admin = await User.create({
      fullName: 'System Administrator',
      email: 'admin@school.com',
      passwordHash: adminPassword,
      role: 'ADMIN',
      status: 'ACTIVE',
    });

    const teacherJohn = await User.create({
      fullName: 'John Doe',
      email: 'john.doe@school.com',
      passwordHash: teacherPassword,
      role: 'TEACHER',
      status: 'ACTIVE',
    });

    const teacherSarah = await User.create({
      fullName: 'Sarah Connor',
      email: 'sarah.connor@school.com',
      passwordHash: teacherPassword,
      role: 'TEACHER',
      status: 'ACTIVE',
    });

    // 2. Classes
    const mathClass = await ClassModel.create({
      name: 'Grade 10 Mathematics – Saturday',
      classCode: 'G10-MATH-SAT',
      subject: 'Mathematics',
      description: 'Quadratic Equations, Polynomials, and Geometry Foundations',
      academicYear: '2026-2027',
      teachers: [teacherJohn._id],
      status: 'ACTIVE',
      createdBy: admin._id,
    });

    const physicsClass = await ClassModel.create({
      name: 'Grade 11 Physics – Morning',
      classCode: 'G11-PHYS-01',
      subject: 'Physics',
      description: 'Classical Mechanics, Kinematics, and Thermodynamics',
      academicYear: '2026-2027',
      teachers: [teacherSarah._id],
      status: 'ACTIVE',
      createdBy: admin._id,
    });

    const csClass = await ClassModel.create({
      name: 'Grade 12 Computer Science',
      classCode: 'G12-CS-01',
      subject: 'Computer Science',
      description: 'Data Structures, Graph Algorithms, and Modern Web Systems',
      academicYear: '2026-2027',
      teachers: [teacherJohn._id],
      status: 'ACTIVE',
      createdBy: admin._id,
    });

    // 3. Students
    const studentData = [
      { firstName: 'Alex', lastName: 'Rivera', studentNumber: 'STU-1001', email: 'alex.rivera@student.local', phone: '555-0101' },
      { firstName: 'Emily', lastName: 'Watson', studentNumber: 'STU-1002', email: 'emily.watson@student.local', phone: '555-0102' },
      { firstName: 'Michael', lastName: 'Chen', studentNumber: 'STU-1003', email: 'michael.chen@student.local', phone: '555-0103' },
      { firstName: 'Sophia', lastName: 'Patel', studentNumber: 'STU-1004', email: 'sophia.patel@student.local', phone: '555-0104' },
      { firstName: 'Daniel', lastName: 'Kim', studentNumber: 'STU-1005', email: 'daniel.kim@student.local', phone: '555-0105' },
      { firstName: 'Olivia', lastName: 'Johnson', studentNumber: 'STU-1006', email: 'olivia.j@student.local', phone: '555-0106' },
      { firstName: 'Liam', lastName: 'Brown', studentNumber: 'STU-1007', email: 'liam.brown@student.local', phone: '555-0107' },
      { firstName: 'Emma', lastName: 'Davis', studentNumber: 'STU-1008', email: 'emma.davis@student.local', phone: '555-0108' },
    ];

    const students = await Student.insertMany(
      studentData.map((s) => ({
        ...s,
        displayName: `${s.firstName} ${s.lastName}`,
        status: 'ACTIVE',
      }))
    );

    // 4. Guardians
    const guardiansData = [
      { fullName: 'Carlos Rivera', email: 'carlos.rivera@guardian.local', phone: '555-1101', studentIdx: 0, rel: 'Father' },
      { fullName: 'Helen Watson', email: 'helen.watson@guardian.local', phone: '555-1102', studentIdx: 1, rel: 'Mother' },
      { fullName: 'David Chen', email: 'david.chen@guardian.local', phone: '555-1103', studentIdx: 2, rel: 'Father' },
      { fullName: 'Priya Patel', email: 'priya.patel@guardian.local', phone: '555-1104', studentIdx: 3, rel: 'Mother' },
      { fullName: 'Robert Johnson', email: 'robert.j@guardian.local', phone: '555-1106', studentIdx: 5, rel: 'Father' },
      { fullName: 'Mary Brown', email: 'mary.brown@guardian.local', phone: '555-1107', studentIdx: 6, rel: 'Mother' },
      { fullName: 'James Davis', email: 'james.davis@guardian.local', phone: '555-1108', studentIdx: 7, rel: 'Father' },
    ];

    const guardians = [];
    for (const g of guardiansData) {
      const guardian = await Guardian.create({
        fullName: g.fullName,
        email: g.email,
        phone: g.phone,
        status: 'ACTIVE',
      });
      guardians.push(guardian);

      await StudentGuardian.create({
        studentId: students[g.studentIdx]._id,
        guardianId: guardian._id,
        relationship: g.rel,
        receivesAttendanceEmails: true,
        isPrimaryContact: true,
      });
    }

    // 5. Create Portal Login Accounts for Student (Alex) and Parent (Carlos)
    const studentUserAlex = await User.create({
      fullName: 'Alex Rivera',
      email: 'alex.rivera@student.local',
      passwordHash: studentPassword,
      role: 'STUDENT',
      studentId: students[0]._id,
      status: 'ACTIVE',
    });

    const studentUserEmily = await User.create({
      fullName: 'Emily Watson',
      email: 'emily.watson@student.local',
      passwordHash: studentPassword,
      role: 'STUDENT',
      studentId: students[1]._id,
      status: 'ACTIVE',
    });

    const parentUserCarlos = await User.create({
      fullName: 'Carlos Rivera',
      email: 'carlos.rivera@guardian.local',
      passwordHash: parentPassword,
      role: 'PARENT',
      guardianId: guardians[0]._id,
      status: 'ACTIVE',
    });

    const parentUserHelen = await User.create({
      fullName: 'Helen Watson',
      email: 'helen.watson@guardian.local',
      passwordHash: parentPassword,
      role: 'PARENT',
      guardianId: guardians[1]._id,
      status: 'ACTIVE',
    });

    console.log('[Seed] Portal logins created for Student and Parent roles.');

    // 6. Enrollments
    for (let i = 0; i < 6; i++) {
      await Enrollment.create({
        studentId: students[i]._id,
        classId: mathClass._id,
        startDate: new Date('2026-09-01'),
        status: 'ACTIVE',
        createdBy: admin._id,
      });
    }

    for (let i = 2; i < 8; i++) {
      await Enrollment.create({
        studentId: students[i]._id,
        classId: physicsClass._id,
        startDate: new Date('2026-09-01'),
        status: 'ACTIVE',
        createdBy: admin._id,
      });
    }

    for (const s of students) {
      await Enrollment.create({
        studentId: s._id,
        classId: csClass._id,
        startDate: new Date('2026-09-01'),
        status: 'ACTIVE',
        createdBy: admin._id,
      });
    }

    // 7. Video Lessons & Study Materials
    const mathLesson1 = await Lesson.create({
      classId: mathClass._id,
      title: 'Lesson 1: Quadratic Equations & The Quadratic Formula',
      description: 'Understanding parabolas, roots of quadratic functions, and applying the quadratic formula step by step.',
      videoUrl: 'https://www.youtube.com/embed/ZBalWWHYzCs',
      duration: '38 mins',
      order: 1,
      isPublished: true,
      attachments: [
        { name: 'Quadratic_Formula_Summary.pdf', fileUrl: 'https://example.com/materials/quadratic_summary.pdf', fileType: 'PDF', fileSize: '1.2 MB' },
        { name: 'Practice_Problems_Set_1.pdf', fileUrl: 'https://example.com/materials/practice_set_1.pdf', fileType: 'PDF', fileSize: '850 KB' },
      ],
      createdBy: teacherJohn._id,
    });

    const mathLesson2 = await Lesson.create({
      classId: mathClass._id,
      title: 'Lesson 2: Polynomial Factoring & Remainder Theorem',
      description: 'Factoring cubic polynomials, synthetic division, and remainder theorem proofs.',
      videoUrl: 'https://www.youtube.com/embed/P88r_5gY1rI',
      duration: '45 mins',
      order: 2,
      isPublished: true,
      attachments: [
        { name: 'Polynomial_Factoring_CheatSheet.pdf', fileUrl: 'https://example.com/materials/poly_cheat_sheet.pdf', fileType: 'PDF', fileSize: '2.1 MB' },
      ],
      createdBy: teacherJohn._id,
    });

    const csLesson1 = await Lesson.create({
      classId: csClass._id,
      title: 'Lesson 1: Asymptotic Analysis & Big-O Notation',
      description: 'Measuring time and space complexity of computational algorithms with real-world TypeScript examples.',
      videoUrl: 'https://www.youtube.com/embed/v4cd1O4zkGw',
      duration: '40 mins',
      order: 1,
      isPublished: true,
      attachments: [
        { name: 'Big_O_Cheat_Sheet.pdf', fileUrl: 'https://example.com/materials/big_o_sheet.pdf', fileType: 'PDF', fileSize: '1.5 MB' },
      ],
      createdBy: teacherJohn._id,
    });

    // Lesson Progress for Alex Rivera
    await LessonProgress.create({
      studentId: students[0]._id,
      lessonId: mathLesson1._id,
      classId: mathClass._id,
      isCompleted: true,
      completedAt: new Date('2026-10-11'),
    });

    await LessonProgress.create({
      studentId: students[0]._id,
      lessonId: csLesson1._id,
      classId: csClass._id,
      isCompleted: true,
      completedAt: new Date('2026-10-13'),
    });

    // 8. Assignments
    const mathAssignment1 = await Assignment.create({
      classId: mathClass._id,
      title: 'Assignment 1: Factoring Quadratic Expressions',
      description: 'Solve problems 1 through 15 on page 84. Show all algebraic steps clearly.',
      dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // in 5 days
      totalMarks: 100,
      attachments: [{ name: 'Assignment_1_Questions.pdf', fileUrl: 'https://example.com/assignments/math_hw_1.pdf' }],
      createdBy: teacherJohn._id,
    });

    const csAssignment1 = await Assignment.create({
      classId: csClass._id,
      title: 'Programming Lab 1: Implement Binary Search Algorithm',
      description: 'Implement an iterative and recursive binary search algorithm in TypeScript. Include test cases with array lengths up to 100,000.',
      dueDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // was due 2 days ago
      totalMarks: 100,
      attachments: [{ name: 'Lab_1_Specification.pdf', fileUrl: 'https://example.com/assignments/cs_lab_1.pdf' }],
      createdBy: teacherJohn._id,
    });

    // Submissions: Alex submitted CS Assignment and got graded!
    await AssignmentSubmission.create({
      assignmentId: csAssignment1._id,
      studentId: students[0]._id,
      classId: csClass._id,
      submissionText: 'GitHub repository: https://github.com/alexrivera/binary-search-lab. All test cases passing in O(log n) time.',
      status: 'GRADED',
      marksAwarded: 96,
      feedback: 'Outstanding implementation! The recursive depth check and edge condition handlers were cleanly designed.',
      gradedBy: teacherJohn._id,
      gradedAt: new Date('2026-10-14T14:20:00Z'),
    });

    // Emily submitted but pending grading
    await AssignmentSubmission.create({
      assignmentId: csAssignment1._id,
      studentId: students[1]._id,
      classId: csClass._id,
      submissionText: 'Submitted binary search code files with automated test suite.',
      status: 'SUBMITTED',
      submittedAt: new Date('2026-10-14T09:30:00Z'),
    });

    // 9. Examinations
    const mathExam = await Examination.create({
      classId: mathClass._id,
      title: 'Mathematics Unit 1 Midterm Assessment',
      description: 'Timed assessment covering quadratic equations, discriminant properties, and vertex form.',
      examDate: new Date('2026-10-18'),
      durationMinutes: 45,
      totalMarks: 30,
      questions: [
        {
          id: 'q1',
          questionText: 'What is the discriminant formula for the quadratic equation ax^2 + bx + c = 0?',
          questionType: 'MCQ',
          options: ['b^2 - 4ac', 'b^2 + 4ac', '2a / (b^2 - 4ac)', '-b / 2a'],
          correctAnswer: 'b^2 - 4ac',
          marks: 10,
        },
        {
          id: 'q2',
          questionText: 'If the discriminant is greater than zero (b^2 - 4ac > 0), how many real roots exist?',
          questionType: 'MCQ',
          options: ['Two distinct real roots', 'Exactly one real root', 'No real roots', 'Infinitely many'],
          correctAnswer: 'Two distinct real roots',
          marks: 10,
        },
        {
          id: 'q3',
          questionText: 'What are the roots of the equation x^2 - 9 = 0?',
          questionType: 'MCQ',
          options: ['x = 3 and x = -3', 'x = 9 and x = -9', 'x = 0', 'x = 3 only'],
          correctAnswer: 'x = 3 and x = -3',
          marks: 10,
        },
      ],
      createdBy: teacherJohn._id,
    });

    // Alex Rivera took the exam and scored 30/30!
    await ExamSubmission.create({
      examId: mathExam._id,
      studentId: students[0]._id,
      classId: mathClass._id,
      score: 30,
      status: 'GRADED',
      feedback: 'Perfect score! Excellent mathematical accuracy.',
      answers: [
        { questionId: 'q1', answerText: 'b^2 - 4ac', isCorrect: true, marksAwarded: 10 },
        { questionId: 'q2', answerText: 'Two distinct real roots', isCorrect: true, marksAwarded: 10 },
        { questionId: 'q3', answerText: 'x = 3 and x = -3', isCorrect: true, marksAwarded: 10 },
      ],
      submittedAt: new Date('2026-10-14T11:45:00Z'),
      gradedAt: new Date('2026-10-14T11:45:00Z'),
    });

    // 10. Announcements
    await Announcement.create([
      {
        classId: null, // Academy-wide
        title: 'Midterm Term Examination Schedule & Study Week',
        content: 'Midterm examinations will commence on October 20th. Library and study rooms will remain open until 8 PM daily.',
        priority: 'HIGH',
        targetRoles: ['STUDENT', 'PARENT', 'TEACHER'],
        createdBy: admin._id,
      },
      {
        classId: mathClass._id,
        title: 'Grade 10 Math – Chapter 3 Review Session',
        content: 'Join us this Thursday at 3:30 PM for a live review session before the Unit 1 examination.',
        priority: 'NORMAL',
        targetRoles: ['STUDENT', 'PARENT'],
        createdBy: teacherJohn._id,
      },
      {
        classId: null,
        title: 'Parent-Teacher Consultations Booking Portal Open',
        content: 'Parents and guardians can now schedule one-on-one progress meetings with subject teachers for next week.',
        priority: 'URGENT',
        targetRoles: ['PARENT'],
        createdBy: admin._id,
      },
    ]);

    // 11. Attendance Records
    const mathSession1 = await ClassSession.create({
      classId: mathClass._id,
      sessionDate: new Date('2026-10-10'),
      startTime: '09:00',
      endTime: '10:30',
      title: 'Polynomial Division and Remainder Theorem',
      status: 'SUBMITTED',
      createdBy: teacherJohn._id,
      submittedBy: teacherJohn._id,
      submittedAt: new Date('2026-10-10T10:35:00Z'),
    });

    const mathStatuses = ['PRESENT', 'PRESENT', 'ABSENT', 'PRESENT', 'LATE', 'PRESENT'];
    for (let i = 0; i < 6; i++) {
      await AttendanceRecord.create({
        classSessionId: mathSession1._id,
        studentId: students[i]._id,
        status: mathStatuses[i] as any,
        arrivalTime: mathStatuses[i] === 'LATE' ? '09:18' : undefined,
        note: mathStatuses[i] === 'ABSENT' ? 'Family emergency' : undefined,
        markedBy: teacherJohn._id,
        markedAt: new Date('2026-10-10T10:30:00Z'),
      });
    }

    console.log('[Seed] Database successfully populated with 4 roles and complete LMS curriculum!');
    console.log('================================================================');
    console.log('LOGIN CREDENTIALS:');
    console.log('1. ADMINISTRATOR: email: admin@school.com          password: Admin@123456');
    console.log('2. TEACHER:       email: john.doe@school.com       password: Teacher@123456');
    console.log('3. STUDENT:       email: alex.rivera@student.local password: Student@123456');
    console.log('4. PARENT:        email: carlos.rivera@guardian.local password: Parent@123456');
    console.log('================================================================');

    process.exit(0);
  } catch (error) {
    console.error('[Seed] Error seeding database:', error);
    process.exit(1);
  }
};

seedDatabase();
