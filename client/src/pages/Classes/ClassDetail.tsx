import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  Calendar,
  Users,
  Plus,
  ArrowLeft,
  Clock,
  CheckCircle2,
  AlertTriangle,
  PlayCircle,
  FileText,
  Award,
  ExternalLink,
  Download,
  Send,
  Check,
  Video,
  BookOpen,
} from 'lucide-react';
import api from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { ClassItem, ClassSession, Lesson, Assignment, Examination } from '../../types';
import { StatusBadge } from '../../components/StatusBadge';
import { Modal } from '../../components/Modal';

export const ClassDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, isAdmin, isTeacher, isStudent, isParent } = useAuth();

  const [classObj, setClassObj] = useState<ClassItem | null>(null);
  const [sessions, setSessions] = useState<ClassSession[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [exams, setExams] = useState<Examination[]>([]);
  const [enrolledStudents, setEnrolledStudents] = useState<any[]>([]);

  const [activeTab, setActiveTab] = useState<'lessons' | 'assignments' | 'exams' | 'sessions' | 'students'>('lessons');
  const [loading, setLoading] = useState(true);

  // New Session Modal
  const [sessionModalOpen, setSessionModalOpen] = useState(false);
  const [sessionDate, setSessionDate] = useState(new Date().toISOString().split('T')[0]);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:30');
  const [sessionTitle, setSessionTitle] = useState('');

  // New Lesson Modal
  const [lessonModalOpen, setLessonModalOpen] = useState(false);
  const [lessonTitle, setLessonTitle] = useState('');
  const [lessonDesc, setLessonDesc] = useState('');
  const [lessonVideoUrl, setLessonVideoUrl] = useState('');
  const [lessonDuration, setLessonDuration] = useState('40 mins');
  const [attachmentName, setAttachmentName] = useState('');
  const [attachmentUrl, setAttachmentUrl] = useState('');

  // New Assignment Modal
  const [assignmentModalOpen, setAssignmentModalOpen] = useState(false);
  const [asgTitle, setAsgTitle] = useState('');
  const [asgDesc, setAsgDesc] = useState('');
  const [asgDueDate, setAsgDueDate] = useState(new Date().toISOString().split('T')[0]);
  const [asgMarks, setAsgMarks] = useState(100);

  // Submit Assignment Modal
  const [submitAsgModalOpen, setSubmitAsgModalOpen] = useState(false);
  const [activeAsg, setActiveAsg] = useState<Assignment | null>(null);
  const [submissionText, setSubmissionText] = useState('');
  const [submitError, setSubmitError] = useState('');

  // Grade Submissions Modal
  const [gradeModalOpen, setGradeModalOpen] = useState(false);
  const [activeSubmissions, setActiveSubmissions] = useState<any[]>([]);
  const [gradingSubId, setGradingSubId] = useState<string | null>(null);
  const [marksAwarded, setMarksAwarded] = useState<number>(0);
  const [gradeFeedback, setGradeFeedback] = useState('');

  // Online Exam Taking Modal
  const [takeExamModalOpen, setTakeExamModalOpen] = useState(false);
  const [examToTake, setExamToTake] = useState<any>(null);
  const [studentAnswers, setStudentAnswers] = useState<Record<string, string>>({});
  const [examSubmittedResult, setExamSubmittedResult] = useState<any>(null);

  const fetchClassDetails = async () => {
    try {
      setLoading(true);
      const [classRes, sessionsRes, lessonsRes, asgRes, examsRes] = await Promise.all([
        api.get(`/classes/${id}`),
        api.get(`/classes/${id}/sessions`),
        api.get(`/lessons/class/${id}`),
        api.get(`/assignments/class/${id}`),
        api.get(`/exams/class/${id}`),
      ]);

      setClassObj(classRes.data);
      setSessions(sessionsRes.data);
      setLessons(lessonsRes.data);
      setAssignments(asgRes.data);
      setExams(examsRes.data);

      if (isAdmin || isTeacher) {
        const studentsRes = await api.get(`/classes/${id}/students`);
        setEnrolledStudents(studentsRes.data);
      }
    } catch (err) {
      console.error('Failed to load class details:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClassDetails();
  }, [id]);

  // Lesson handlers
  const handleCreateLesson = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const attachments = attachmentName && attachmentUrl ? [{ name: attachmentName, fileUrl: attachmentUrl, fileType: 'PDF' }] : [];
      await api.post('/lessons', {
        classId: id,
        title: lessonTitle,
        description: lessonDesc,
        videoUrl: lessonVideoUrl,
        duration: lessonDuration,
        attachments,
      });
      setLessonModalOpen(false);
      setLessonTitle('');
      setLessonDesc('');
      setLessonVideoUrl('');
      fetchClassDetails();
    } catch (err) {
      console.error('Failed to create lesson:', err);
    }
  };

  const handleToggleLessonProgress = async (lessonId: string) => {
    try {
      await api.post(`/lessons/${lessonId}/progress`);
      fetchClassDetails();
    } catch (err) {
      console.error('Failed to toggle progress:', err);
    }
  };

  // Assignment handlers
  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/assignments', {
        classId: id,
        title: asgTitle,
        description: asgDesc,
        dueDate: asgDueDate,
        totalMarks: asgMarks,
      });
      setAssignmentModalOpen(false);
      setAsgTitle('');
      setAsgDesc('');
      fetchClassDetails();
    } catch (err) {
      console.error('Failed to create assignment:', err);
    }
  };

  const openSubmitAssignment = (asg: Assignment) => {
    setActiveAsg(asg);
    setSubmissionText('');
    setSubmitError('');
    setSubmitAsgModalOpen(true);
  };

  const handleSubmitAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeAsg) return;
    try {
      await api.post(`/assignments/${activeAsg._id}/submit`, { submissionText });
      setSubmitAsgModalOpen(false);
      fetchClassDetails();
    } catch (err: any) {
      setSubmitError(err.response?.data?.error || 'Failed to submit assignment');
    }
  };

  const openSubmissionsForGrading = async (asgId: string) => {
    try {
      const res = await api.get(`/assignments/${asgId}/submissions`);
      setActiveSubmissions(res.data);
      setGradeModalOpen(true);
    } catch (err) {
      console.error('Failed to load submissions:', err);
    }
  };

  const handleSaveGrade = async (subId: string) => {
    try {
      await api.patch(`/assignments/submissions/${subId}/grade`, {
        marksAwarded,
        feedback: gradeFeedback,
      });
      setGradingSubId(null);
      if (activeAsg) openSubmissionsForGrading(activeAsg._id);
      fetchClassDetails();
    } catch (err) {
      console.error('Failed to save grade:', err);
    }
  };

  // Exam handlers
  const startExam = async (examId: string) => {
    try {
      const res = await api.get(`/exams/${examId}/take`);
      setExamToTake(res.data);
      setStudentAnswers({});
      setExamSubmittedResult(null);
      setTakeExamModalOpen(true);
    } catch (err) {
      console.error('Failed to load exam:', err);
    }
  };

  const handleSubmitExamAnswers = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!examToTake) return;

    const answersArray = Object.entries(studentAnswers).map(([questionId, answerText]) => ({
      questionId,
      answerText,
    }));

    try {
      const res = await api.post(`/exams/${examToTake._id}/submit`, { answers: answersArray });
      setExamSubmittedResult(res.data);
      fetchClassDetails();
    } catch (err) {
      console.error('Failed to submit exam:', err);
    }
  };

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.post(`/classes/${id}/sessions`, {
        sessionDate,
        startTime,
        endTime,
        title: sessionTitle,
      });
      setSessionModalOpen(false);
      navigate(`/classes/${id}/sessions/${res.data._id}`);
    } catch (err) {
      console.error('Failed to create session:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  if (!classObj) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-500">Class not found or access denied.</p>
        <Link to="/classes" className="text-blue-600 hover:underline mt-2 inline-block">
          &larr; Back to classes
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back button */}
      <div>
        <Link
          to={isStudent ? '/dashboard' : '/classes'}
          className="inline-flex items-center space-x-1 text-sm font-semibold text-slate-500 hover:text-slate-800 transition"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to {isStudent ? 'My Portal' : 'Classes'}</span>
        </Link>
      </div>

      {/* Class Banner Card */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-6 sm:p-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-3 mb-2">
              <span className="px-3 py-1 bg-blue-100 text-blue-800 font-mono font-bold text-xs rounded-lg uppercase tracking-wider">
                {classObj.classCode}
              </span>
              <StatusBadge status={classObj.status} />
              <span className="text-xs font-semibold text-slate-400">
                {classObj.subject} {classObj.academicYear && `• ${classObj.academicYear}`}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              {classObj.name}
            </h1>
            {classObj.description && (
              <p className="text-sm text-slate-600 mt-2 max-w-2xl">{classObj.description}</p>
            )}
          </div>

          {(isAdmin || isTeacher) && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setLessonModalOpen(true)}
                className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-sm transition"
              >
                <Video className="h-3.5 w-3.5" />
                <span>Add Lesson</span>
              </button>
              <button
                onClick={() => setAssignmentModalOpen(true)}
                className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-xl transition"
              >
                <FileText className="h-3.5 w-3.5" />
                <span>New Homework</span>
              </button>
              <button
                onClick={() => setSessionModalOpen(true)}
                className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-xl transition"
              >
                <Calendar className="h-3.5 w-3.5" />
                <span>Attendance Session</span>
              </button>
            </div>
          )}
        </div>

        {/* Tab Navigation */}
        <div className="flex space-x-6 border-b border-slate-100 mt-8 overflow-x-auto">
          <button
            onClick={() => setActiveTab('lessons')}
            className={`pb-3 text-sm font-bold border-b-2 whitespace-nowrap transition ${
              activeTab === 'lessons'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Video Lessons & Materials ({lessons.length})
          </button>
          <button
            onClick={() => setActiveTab('assignments')}
            className={`pb-3 text-sm font-bold border-b-2 whitespace-nowrap transition ${
              activeTab === 'assignments'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Assignments & Homework ({assignments.length})
          </button>
          <button
            onClick={() => setActiveTab('exams')}
            className={`pb-3 text-sm font-bold border-b-2 whitespace-nowrap transition ${
              activeTab === 'exams'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Examinations ({exams.length})
          </button>
          {(isAdmin || isTeacher) && (
            <>
              <button
                onClick={() => setActiveTab('sessions')}
                className={`pb-3 text-sm font-bold border-b-2 whitespace-nowrap transition ${
                  activeTab === 'sessions'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                Attendance Registers ({sessions.length})
              </button>
              <button
                onClick={() => setActiveTab('students')}
                className={`pb-3 text-sm font-bold border-b-2 whitespace-nowrap transition ${
                  activeTab === 'students'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                Roster ({enrolledStudents.length})
              </button>
            </>
          )}
        </div>
      </div>

      {/* TAB 1: VIDEO LESSONS & MATERIALS */}
      {activeTab === 'lessons' && (
        <div className="space-y-4">
          {lessons.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 text-center border border-slate-200">
              <Video className="h-12 w-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-slate-700">No video lessons uploaded yet</h3>
              <p className="text-sm text-slate-400 mt-1">Teachers can upload video lessons and PDFs here.</p>
            </div>
          ) : (
            lessons.map((lesson) => (
              <div
                key={lesson._id}
                className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-6 sm:p-7 flex flex-col md:flex-row gap-6"
              >
                {/* Video Preview / Embed */}
                <div className="w-full md:w-80 h-48 bg-slate-900 rounded-2xl overflow-hidden shrink-0 relative flex items-center justify-center">
                  {lesson.videoUrl && lesson.videoUrl.includes('youtube.com/embed') ? (
                    <iframe
                      src={lesson.videoUrl}
                      title={lesson.title}
                      className="w-full h-full border-0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  ) : (
                    <div className="text-center p-4">
                      <PlayCircle className="h-12 w-12 text-blue-400 mx-auto mb-2" />
                      <a
                        href={lesson.videoUrl || '#'}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-blue-300 font-bold hover:underline"
                      >
                        Watch Video Lesson &rarr;
                      </a>
                    </div>
                  )}
                </div>

                {/* Lesson Info */}
                <div className="flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center space-x-2 text-xs font-semibold text-blue-600 mb-1">
                      <span>Order #{lesson.order}</span>
                      {lesson.duration && <span>• {lesson.duration}</span>}
                    </div>
                    <h3 className="text-lg font-bold text-slate-900">{lesson.title}</h3>
                    <p className="text-sm text-slate-600 mt-1 leading-relaxed">{lesson.description}</p>

                    {/* Attachments / Study notes */}
                    {lesson.attachments && lesson.attachments.length > 0 && (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {lesson.attachments.map((att, idx) => (
                          <a
                            key={idx}
                            href={att.fileUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 text-xs font-semibold rounded-xl border border-slate-200 transition"
                          >
                            <Download className="h-3.5 w-3.5" />
                            <span>{att.name}</span>
                            {att.fileSize && <span className="text-[10px] text-slate-400">({att.fileSize})</span>}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Student completion toggle */}
                  {isStudent && (
                    <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
                      <button
                        onClick={() => handleToggleLessonProgress(lesson._id)}
                        className={`inline-flex items-center space-x-2 px-3.5 py-1.5 text-xs font-bold rounded-xl transition ${
                          lesson.isCompleted
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        <Check className="h-3.5 w-3.5" />
                        <span>{lesson.isCompleted ? 'Watched & Completed' : 'Mark as Watched'}</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* TAB 2: ASSIGNMENTS & HOMEWORK */}
      {activeTab === 'assignments' && (
        <div className="space-y-4">
          {assignments.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 text-center border border-slate-200">
              <FileText className="h-12 w-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-slate-700">No assignments published yet</h3>
              <p className="text-sm text-slate-400 mt-1">Assignments and homework deadlines will appear here.</p>
            </div>
          ) : (
            assignments.map((asg) => (
              <div
                key={asg._id}
                className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-6 sm:p-7 flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div>
                  <div className="flex items-center space-x-2 text-xs font-semibold text-slate-400 mb-1">
                    <span className="text-rose-600 font-bold">Due: {new Date(asg.dueDate).toLocaleDateString()}</span>
                    <span>• {asg.totalMarks} Total Marks</span>
                  </div>
                  <h3 className="text-base font-bold text-slate-900">{asg.title}</h3>
                  <p className="text-sm text-slate-600 mt-1 max-w-2xl">{asg.description}</p>

                  {/* Attachments */}
                  {asg.attachments && asg.attachments.length > 0 && (
                    <div className="mt-2 flex gap-2">
                      {asg.attachments.map((att, idx) => (
                        <a
                          key={idx}
                          href={att.fileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-blue-600 font-semibold hover:underline inline-flex items-center space-x-1"
                        >
                          <Download className="h-3 w-3" />
                          <span>{att.name}</span>
                        </a>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  {/* Student View */}
                  {isStudent && (
                    <div>
                      {asg.mySubmission ? (
                        <div className="text-right">
                          <StatusBadge status={asg.mySubmission.status} />
                          {asg.mySubmission.marksAwarded !== null && (
                            <p className="text-xs font-bold text-emerald-700 mt-1">
                              Marks: {asg.mySubmission.marksAwarded} / {asg.totalMarks}
                            </p>
                          )}
                          {asg.mySubmission.feedback && (
                            <p className="text-[11px] text-slate-500 italic max-w-xs truncate">
                              "{asg.mySubmission.feedback}"
                            </p>
                          )}
                        </div>
                      ) : (
                        <button
                          onClick={() => openSubmitAssignment(asg)}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-sm transition"
                        >
                          Submit Homework
                        </button>
                      )}
                    </div>
                  )}

                  {/* Parent View */}
                  {isParent && asg.childSubmission && (
                    <div className="text-right">
                      <StatusBadge status={asg.childSubmission.status} />
                      {asg.childSubmission.marksAwarded !== null && (
                        <p className="text-xs font-bold text-emerald-700 mt-1">
                          Marks: {asg.childSubmission.marksAwarded} / {asg.totalMarks}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Teacher View */}
                  {(isAdmin || isTeacher) && (
                    <button
                      onClick={() => openSubmissionsForGrading(asg._id)}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition"
                    >
                      Submissions ({asg.submissionCount || 0})
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* TAB 3: ONLINE EXAMINATIONS */}
      {activeTab === 'exams' && (
        <div className="space-y-4">
          {exams.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 text-center border border-slate-200">
              <Award className="h-12 w-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-slate-700">No examinations scheduled</h3>
              <p className="text-sm text-slate-400 mt-1">Scheduled online tests and exams will appear here.</p>
            </div>
          ) : (
            exams.map((ex) => (
              <div
                key={ex._id}
                className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-6 sm:p-7 flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div>
                  <div className="flex items-center space-x-2 text-xs font-semibold text-slate-400 mb-1">
                    <span>Date: {new Date(ex.examDate).toLocaleDateString()}</span>
                    <span>• {ex.durationMinutes} Minutes</span>
                    <span>• {ex.totalMarks} Marks</span>
                  </div>
                  <h3 className="text-base font-bold text-slate-900">{ex.title}</h3>
                  <p className="text-sm text-slate-600 mt-1 max-w-2xl">{ex.description}</p>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  {/* Student View */}
                  {isStudent && (
                    <div>
                      {ex.mySubmission ? (
                        <div className="text-right">
                          <span className="inline-block px-3 py-1 bg-emerald-100 text-emerald-800 font-bold text-xs rounded-full">
                            Score: {ex.mySubmission.score} / {ex.totalMarks}
                          </span>
                        </div>
                      ) : (
                        <button
                          onClick={() => startExam(ex._id)}
                          className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 text-white text-xs font-bold rounded-xl shadow-sm transition"
                        >
                          Take Online Quiz
                        </button>
                      )}
                    </div>
                  )}

                  {/* Parent View */}
                  {isParent && ex.childSubmission && (
                    <div className="text-right">
                      <span className="inline-block px-3 py-1 bg-purple-100 text-purple-800 font-bold text-xs rounded-full">
                        Score: {ex.childSubmission.score} / {ex.totalMarks}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* TAB 4: SESSIONS & ATTENDANCE (Teachers / Admin) */}
      {activeTab === 'sessions' && (isAdmin || isTeacher) && (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50/80 text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="py-4 px-6">Date</th>
                  <th className="py-4 px-6">Session Title</th>
                  <th className="py-4 px-6">Status</th>
                  <th className="py-4 px-6">Summary</th>
                  <th className="py-4 px-6 text-right">Register</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sessions.map((ses) => (
                  <tr key={ses._id} className="hover:bg-slate-50/50 transition">
                    <td className="py-4 px-6 font-semibold text-slate-900 whitespace-nowrap">
                      {new Date(ses.sessionDate).toLocaleDateString()}
                    </td>
                    <td className="py-4 px-6 font-medium text-slate-800">{ses.title || 'Regular Session'}</td>
                    <td className="py-4 px-6">
                      <StatusBadge status={ses.status} />
                    </td>
                    <td className="py-4 px-6 text-xs">
                      {ses.stats ? (
                        <span>
                          P: {ses.stats.PRESENT} • A: {ses.stats.ABSENT} • L: {ses.stats.LATE}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="py-4 px-6 text-right whitespace-nowrap">
                      <Link
                        to={`/classes/${classObj._id}/sessions/${ses._id}`}
                        className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold text-xs rounded-lg transition"
                      >
                        Open Register &rarr;
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: ROSTER (Teachers / Admin) */}
      {activeTab === 'students' && (isAdmin || isTeacher) && (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50/80 text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="py-4 px-6">Adm #</th>
                  <th className="py-4 px-6">Student Name</th>
                  <th className="py-4 px-6">Parent Email Alert Status</th>
                  <th className="py-4 px-6 text-right">Enrolled Since</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {enrolledStudents.map((st) => (
                  <tr key={st._id} className="hover:bg-slate-50/50 transition">
                    <td className="py-4 px-6 font-mono text-xs text-slate-500">{st.studentNumber || '—'}</td>
                    <td className="py-4 px-6 font-semibold text-slate-900">{st.displayName || st.firstName}</td>
                    <td className="py-4 px-6">
                      {st.hasActiveGuardianEmail ? (
                        <span className="text-xs font-semibold text-emerald-700">✓ Active</span>
                      ) : (
                        <span className="text-xs font-semibold text-amber-600">⚠ Missing Email</span>
                      )}
                    </td>
                    <td className="py-4 px-6 text-right text-xs text-slate-400">
                      {new Date(st.enrollmentStartDate).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Lesson Modal */}
      <Modal isOpen={lessonModalOpen} onClose={() => setLessonModalOpen(false)} title="Upload Video Lesson & Notes">
        <form onSubmit={handleCreateLesson} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Lesson Title *
            </label>
            <input
              type="text"
              required
              value={lessonTitle}
              onChange={(e) => setLessonTitle(e.target.value)}
              placeholder="e.g. Lesson 3: Matrix Transformations"
              className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Video Embed URL / Link
            </label>
            <input
              type="text"
              value={lessonVideoUrl}
              onChange={(e) => setLessonVideoUrl(e.target.value)}
              placeholder="https://www.youtube.com/embed/..."
              className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Duration (e.g. 45 mins)
              </label>
              <input
                type="text"
                value={lessonDuration}
                onChange={(e) => setLessonDuration(e.target.value)}
                className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Study Material Name (Optional)
              </label>
              <input
                type="text"
                value={attachmentName}
                onChange={(e) => setAttachmentName(e.target.value)}
                placeholder="e.g. Chapter_3_Notes.pdf"
                className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Study Material Download URL
            </label>
            <input
              type="text"
              value={attachmentUrl}
              onChange={(e) => setAttachmentUrl(e.target.value)}
              placeholder="https://example.com/materials/notes.pdf"
              className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Lesson Description
            </label>
            <textarea
              rows={3}
              value={lessonDesc}
              onChange={(e) => setLessonDesc(e.target.value)}
              placeholder="Summary of learning objectives..."
              className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setLessonModalOpen(false)}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition"
            >
              Save Lesson
            </button>
          </div>
        </form>
      </Modal>

      {/* New Assignment Modal */}
      <Modal isOpen={assignmentModalOpen} onClose={() => setAssignmentModalOpen(false)} title="Create Class Assignment">
        <form onSubmit={handleCreateAssignment} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Assignment Title *
            </label>
            <input
              type="text"
              required
              value={asgTitle}
              onChange={(e) => setAsgTitle(e.target.value)}
              placeholder="e.g. Problem Set 2"
              className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Due Date *
              </label>
              <input
                type="date"
                required
                value={asgDueDate}
                onChange={(e) => setAsgDueDate(e.target.value)}
                className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Total Marks
              </label>
              <input
                type="number"
                value={asgMarks}
                onChange={(e) => setAsgMarks(Number(e.target.value))}
                className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Instructions
            </label>
            <textarea
              rows={3}
              value={asgDesc}
              onChange={(e) => setAsgDesc(e.target.value)}
              placeholder="Provide assignment questions and instructions..."
              className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setAssignmentModalOpen(false)}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition"
            >
              Publish Assignment
            </button>
          </div>
        </form>
      </Modal>

      {/* Student Submit Homework Modal */}
      <Modal
        isOpen={submitAsgModalOpen}
        onClose={() => setSubmitAsgModalOpen(false)}
        title={`Submit: ${activeAsg?.title}`}
      >
        <form onSubmit={handleSubmitAssignment} className="space-y-4">
          {submitError && (
            <div className="p-3 bg-red-50 text-red-700 text-xs rounded-lg">{submitError}</div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Your Answer / Repository Link / Solution *
            </label>
            <textarea
              required
              rows={5}
              value={submissionText}
              onChange={(e) => setSubmissionText(e.target.value)}
              placeholder="Type your answer, or paste GitHub/Google Drive link to your homework..."
              className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setSubmitAsgModalOpen(false)}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition"
            >
              Confirm Submission
            </button>
          </div>
        </form>
      </Modal>

      {/* Teacher Grade Submissions Modal */}
      <Modal
        isOpen={gradeModalOpen}
        onClose={() => setGradeModalOpen(false)}
        title="Student Submissions & Grading Desk"
        maxWidth="max-w-3xl"
      >
        <div className="space-y-4 max-h-[70vh] overflow-y-auto">
          {activeSubmissions.length === 0 ? (
            <p className="text-xs text-slate-400 py-6 text-center">No student submissions received yet.</p>
          ) : (
            activeSubmissions.map((sub) => (
              <div key={sub._id} className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-900 text-sm">
                      {sub.studentId?.displayName || sub.studentId?.firstName}
                    </span>
                    <span className="text-xs font-mono text-slate-400 ml-2">({sub.studentId?.studentNumber})</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <StatusBadge status={sub.status} />
                    {sub.marksAwarded !== null && (
                      <span className="text-xs font-bold text-emerald-700">Score: {sub.marksAwarded}</span>
                    )}
                  </div>
                </div>

                <div className="p-3 bg-white rounded-xl border border-slate-100 text-xs text-slate-700 whitespace-pre-line font-mono">
                  {sub.submissionText}
                </div>

                {gradingSubId === sub._id ? (
                  <div className="pt-3 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-2 items-center">
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-500">Marks Awarded</label>
                      <input
                        type="number"
                        value={marksAwarded}
                        onChange={(e) => setMarksAwarded(Number(e.target.value))}
                        className="w-full px-2 py-1 text-xs border rounded-lg"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-[10px] font-bold uppercase text-slate-500">Teacher Feedback</label>
                      <div className="flex space-x-2">
                        <input
                          type="text"
                          value={gradeFeedback}
                          onChange={(e) => setGradeFeedback(e.target.value)}
                          placeholder="Feedback comment..."
                          className="w-full px-2 py-1 text-xs border rounded-lg"
                        />
                        <button
                          onClick={() => handleSaveGrade(sub._id)}
                          className="px-3 py-1 bg-emerald-600 text-white text-xs font-bold rounded-lg shrink-0"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      setGradingSubId(sub._id);
                      setMarksAwarded(sub.marksAwarded || 0);
                      setGradeFeedback(sub.feedback || '');
                    }}
                    className="text-xs font-bold text-blue-600 hover:underline"
                  >
                    {sub.status === 'GRADED' ? 'Edit Grade & Feedback' : 'Grade Submission'}
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </Modal>

      {/* Online Test Taking Modal */}
      <Modal
        isOpen={takeExamModalOpen}
        onClose={() => setTakeExamModalOpen(false)}
        title={examToTake?.title || 'Online Examination'}
        maxWidth="max-w-2xl"
      >
        {examSubmittedResult ? (
          <div className="p-6 text-center space-y-4">
            <CheckCircle2 className="h-14 w-14 text-emerald-500 mx-auto" />
            <h3 className="text-xl font-bold text-slate-900">Exam Finished!</h3>
            <div className="text-3xl font-black text-purple-700">
              {examSubmittedResult.score} / {examToTake?.totalMarks} Marks
            </div>
            <p className="text-xs text-slate-500">Your score has been recorded in your academic transcript.</p>
            <button
              onClick={() => setTakeExamModalOpen(false)}
              className="px-5 py-2.5 bg-blue-600 text-white text-xs font-bold rounded-xl"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmitExamAnswers} className="space-y-6">
            <div className="p-3 bg-purple-50 text-purple-800 text-xs font-semibold rounded-xl flex items-center justify-between">
              <span>Duration: {examToTake?.durationMinutes} mins</span>
              <span>Total: {examToTake?.totalMarks} marks</span>
            </div>

            <div className="space-y-5">
              {examToTake?.questions?.map((q: any, idx: number) => (
                <div key={q.id} className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-3">
                  <p className="font-bold text-sm text-slate-900">
                    {idx + 1}. {q.questionText} <span className="text-xs text-purple-600 font-semibold">({q.marks} marks)</span>
                  </p>

                  {q.questionType === 'MCQ' && q.options && (
                    <div className="space-y-2">
                      {q.options.map((opt: string, optIdx: number) => (
                        <label
                          key={optIdx}
                          className={`flex items-center space-x-3 p-2.5 rounded-xl border text-xs font-semibold cursor-pointer transition ${
                            studentAnswers[q.id] === opt
                              ? 'bg-purple-50 border-purple-500 text-purple-900'
                              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <input
                            type="radio"
                            name={`q_${q.id}`}
                            value={opt}
                            checked={studentAnswers[q.id] === opt}
                            onChange={() => setStudentAnswers({ ...studentAnswers, [q.id]: opt })}
                            className="text-purple-600"
                          />
                          <span>{opt}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100">
              <button
                type="submit"
                className="px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl shadow-md transition"
              >
                Submit Exam Answers
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* New Attendance Session Modal */}
      <Modal isOpen={sessionModalOpen} onClose={() => setSessionModalOpen(false)} title="Create Attendance Session">
        <form onSubmit={handleCreateSession} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Session Date *
            </label>
            <input
              type="date"
              required
              value={sessionDate}
              onChange={(e) => setSessionDate(e.target.value)}
              className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Start Time
              </label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                End Time
              </label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Topic / Note (Optional)
            </label>
            <input
              type="text"
              value={sessionTitle}
              onChange={(e) => setSessionTitle(e.target.value)}
              placeholder="e.g. Unit 3 Lab or Chapter 4 Review"
              className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setSessionModalOpen(false)}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition"
            >
              Create & Open Register
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
