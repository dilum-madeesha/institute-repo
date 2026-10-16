import React, { useState, useEffect } from 'react';
import { Award, Plus, Search, Calendar, Clock, CheckCircle2, AlertCircle, School, Check, FileQuestion, Users } from 'lucide-react';
import api from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { Examination, ClassItem } from '../../types';
import { StatusBadge } from '../../components/StatusBadge';
import { Modal } from '../../components/Modal';

export const ExamPortal: React.FC = () => {
  const { user, isAdmin, isTeacher, isStudent } = useAuth();
  const [exams, setExams] = useState<Examination[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Create Exam Modal
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [examClassId, setExamClassId] = useState('');
  const [examTitle, setExamTitle] = useState('');
  const [examDesc, setExamDesc] = useState('');
  const [examDate, setExamDate] = useState(new Date().toISOString().split('T')[0]);
  const [duration, setDuration] = useState(60);
  const [qText, setQText] = useState('');
  const [optA, setOptA] = useState('');
  const [optB, setOptB] = useState('');
  const [optC, setOptC] = useState('');
  const [optD, setOptD] = useState('');
  const [correctOpt, setCorrectOpt] = useState('A');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Take Exam Modal
  const [takeModalOpen, setTakeModalOpen] = useState(false);
  const [activeExam, setActiveExam] = useState<any>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [examResult, setExamResult] = useState<any>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const classesRes = await api.get('/classes?status=ACTIVE');
      setClasses(classesRes.data);

      const targetClass = selectedClassId || (classesRes.data.length > 0 ? classesRes.data[0]._id : '');
      if (targetClass) {
        setSelectedClassId(targetClass);
        const examsRes = await api.get(`/exams/class/${targetClass}`);
        setExams(examsRes.data);
      }
    } catch (err) {
      console.error('Failed to load exams:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedClassId]);

  const handleCreateExam = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      await api.post('/exams', {
        classId: examClassId || selectedClassId,
        title: examTitle,
        description: examDesc,
        examDate,
        durationMinutes: duration,
        questions: [
          {
            id: 'q1',
            questionText: qText,
            questionType: 'MCQ',
            options: [optA, optB, optC, optD].filter(Boolean),
            correctAnswer: correctOpt,
            marks: 100,
          },
        ],
      });

      setCreateModalOpen(false);
      setExamTitle('');
      setExamDesc('');
      setQText('');
      setOptA('');
      setOptB('');
      setOptC('');
      setOptD('');
      if (selectedClassId) {
        const res = await api.get(`/exams/class/${selectedClassId}`);
        setExams(res.data);
      }
    } catch (err) {
      console.error('Failed to create exam:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartExam = async (examId: string) => {
    try {
      const res = await api.get(`/exams/${examId}/take`);
      setActiveExam(res.data);
      setAnswers({});
      setExamResult(null);
      setTakeModalOpen(true);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Cannot take exam right now.');
    }
  };

  const handleSubmitExamAnswers = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeExam) return;

    try {
      setIsSubmitting(true);
      const formattedAnswers = Object.entries(answers).map(([qId, ans]) => ({
        questionId: qId,
        answerText: ans,
      }));

      const res = await api.post(`/exams/${activeExam._id}/submit`, {
        answers: formattedAnswers,
      });

      setExamResult(res.data);
      if (selectedClassId) {
        const exRes = await api.get(`/exams/class/${selectedClassId}`);
        setExams(exRes.data);
      }
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to submit exam.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredExams = exams.filter(
    (e) =>
      e.title.toLowerCase().includes(search.toLowerCase()) ||
      (e.description && e.description.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Examinations & Assessments</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Timed multiple-choice examinations, instant auto-scoring, result publication, and performance transcripts
          </p>
        </div>

        {(isAdmin || isTeacher) && (
          <button
            onClick={() => {
              setExamClassId(selectedClassId);
              setCreateModalOpen(true);
            }}
            className="inline-flex items-center space-x-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl shadow-md shadow-blue-500/20 transition"
          >
            <Plus className="h-4 w-4" />
            <span>Create New Exam</span>
          </button>
        )}
      </div>

      {/* Class Pills */}
      <div className="flex items-center space-x-2 overflow-x-auto pb-2 scrollbar-none">
        {classes.map((cls) => {
          const isSelected = cls._id === selectedClassId;
          return (
            <button
              key={cls._id}
              onClick={() => setSelectedClassId(cls._id)}
              className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition flex items-center space-x-2 ${
                isSelected
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                  : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200/80'
              }`}
            >
              <School className={`h-3.5 w-3.5 ${isSelected ? 'text-white' : 'text-slate-400'}`} />
              <span>{cls.name}</span>
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search examinations..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
          />
        </div>
      </div>

      {/* Exams Grid */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
        </div>
      ) : filteredExams.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200/80 p-12 text-center">
          <Award className="h-12 w-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-700">No examinations scheduled</h3>
          <p className="text-sm text-slate-400 mt-1">Check back later for scheduled term tests or online quizzes.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredExams.map((exam) => (
            <div
              key={exam._id}
              className="bg-white rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition p-6 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <span className="text-xs font-bold text-slate-900 bg-purple-50 text-purple-700 px-2.5 py-1 rounded-lg">
                    {exam.durationMinutes} mins
                  </span>
                  <StatusBadge status={exam.isPublished ? 'ACTIVE' : 'INACTIVE'} />
                </div>

                <h3 className="text-base font-bold text-slate-900">{exam.title}</h3>
                <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                  {exam.description || 'Comprehensive evaluation assessment.'}
                </p>

                <div className="mt-4 pt-3 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs text-slate-600">
                  <div className="flex items-center space-x-1.5">
                    <Calendar className="h-3.5 w-3.5 text-slate-400" />
                    <span>{new Date(exam.examDate).toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <Award className="h-3.5 w-3.5 text-slate-400" />
                    <span>{exam.totalMarks} Marks</span>
                  </div>
                </div>

                {/* Submissions or Score badge */}
                {exam.mySubmission && (
                  <div className="mt-4 p-3 bg-emerald-50 border border-emerald-100 rounded-xl flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-bold text-emerald-700 uppercase">Your Exam Score</p>
                      <p className="text-base font-black text-emerald-900">
                        {exam.mySubmission.score} / {exam.totalMarks}
                      </p>
                    </div>
                    <span className="text-xs font-bold px-2 py-0.5 rounded bg-emerald-200 text-emerald-800">
                      {Math.round((exam.mySubmission.score / exam.totalMarks) * 100)}%
                    </span>
                  </div>
                )}
              </div>

              <div className="mt-6 pt-3 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[11px] text-slate-400">
                  {exam.questions?.length || 1} Question{exam.questions?.length !== 1 ? 's' : ''}
                </span>

                {isStudent && (
                  exam.mySubmission ? (
                    <span className="text-xs font-bold text-emerald-600 flex items-center space-x-1">
                      <CheckCircle2 className="h-4 w-4" />
                      <span>Completed</span>
                    </span>
                  ) : (
                    <button
                      onClick={() => handleStartExam(exam._id)}
                      className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition"
                    >
                      Start Examination
                    </button>
                  )
                )}

                {(isAdmin || isTeacher) && (
                  <span className="text-xs font-semibold text-slate-500">
                    {exam.submissionCount || 0} Submissions
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Online Exam Taking Modal */}
      <Modal isOpen={takeModalOpen} onClose={() => setTakeModalOpen(false)} title={activeExam?.title || 'Examination'}>
        {examResult ? (
          <div className="text-center py-6 space-y-4">
            <div className="h-16 w-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
              <Check className="h-8 w-8" />
            </div>
            <h3 className="text-xl font-bold text-slate-900">Exam Submitted Successfully!</h3>
            <div className="p-4 bg-slate-50 rounded-2xl max-w-xs mx-auto border border-slate-200">
              <p className="text-xs text-slate-500 font-semibold uppercase">Total Score Awarded</p>
              <p className="text-3xl font-black text-blue-600 mt-1">
                {examResult.score} / {examResult.totalMarks}
              </p>
              <p className="text-xs text-slate-500 mt-1">Grade: {examResult.percentage}%</p>
            </div>
            <button
              onClick={() => setTakeModalOpen(false)}
              className="px-6 py-2 bg-blue-600 text-white font-bold text-xs rounded-xl"
            >
              Done & Close
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmitExamAnswers} className="space-y-6">
            <div className="p-3 bg-blue-50 text-blue-800 rounded-xl text-xs flex items-center justify-between">
              <span className="font-semibold">Duration: {activeExam?.durationMinutes} Minutes</span>
              <span className="font-mono font-bold">Auto-scoring active</span>
            </div>

            <div className="space-y-6">
              {activeExam?.questions?.map((q: any, idx: number) => (
                <div key={q.id || idx} className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3">
                  <p className="text-sm font-bold text-slate-900">
                    Question {idx + 1}: {q.questionText}
                  </p>
                  <div className="space-y-2">
                    {q.options?.map((opt: string, optIdx: number) => {
                      const optKey = ['A', 'B', 'C', 'D'][optIdx] || opt;
                      const isSelected = answers[q.id || `q${idx + 1}`] === optKey;
                      return (
                        <label
                          key={optIdx}
                          onClick={() => setAnswers({ ...answers, [q.id || `q${idx + 1}`]: optKey })}
                          className={`flex items-center space-x-3 p-3 rounded-xl border text-xs font-semibold cursor-pointer transition ${
                            isSelected
                              ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          <span
                            className={`h-6 w-6 rounded-lg flex items-center justify-center font-bold text-xs ${
                              isSelected ? 'bg-white text-blue-600' : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {optKey}
                          </span>
                          <span>{opt}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setTakeModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md transition disabled:opacity-50"
              >
                {isSubmitting ? 'Evaluating...' : 'Submit Answers'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Create Exam Modal */}
      <Modal isOpen={createModalOpen} onClose={() => setCreateModalOpen(false)} title="Create New Examination">
        <form onSubmit={handleCreateExam} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Select Class *
            </label>
            <select
              value={examClassId || selectedClassId}
              onChange={(e) => setExamClassId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {classes.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name} ({c.classCode})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Exam Title *
            </label>
            <input
              type="text"
              required
              value={examTitle}
              onChange={(e) => setExamTitle(e.target.value)}
              placeholder="e.g. Midterm Evaluation – Algebra & Geometry"
              className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Exam Date
              </label>
              <input
                type="date"
                required
                value={examDate}
                onChange={(e) => setExamDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Duration (Minutes)
              </label>
              <input
                type="number"
                required
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
            <p className="text-xs font-bold text-slate-800 uppercase tracking-wider">Sample Question (MCQ)</p>
            <input
              type="text"
              required
              value={qText}
              onChange={(e) => setQText(e.target.value)}
              placeholder="Question text..."
              className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                required
                value={optA}
                onChange={(e) => setOptA(e.target.value)}
                placeholder="Option A"
                className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs"
              />
              <input
                type="text"
                required
                value={optB}
                onChange={(e) => setOptB(e.target.value)}
                placeholder="Option B"
                className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs"
              />
              <input
                type="text"
                required
                value={optC}
                onChange={(e) => setOptC(e.target.value)}
                placeholder="Option C"
                className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs"
              />
              <input
                type="text"
                required
                value={optD}
                onChange={(e) => setOptD(e.target.value)}
                placeholder="Option D"
                className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Correct Option</label>
              <select
                value={correctOpt}
                onChange={(e) => setCorrectOpt(e.target.value)}
                className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs"
              >
                <option value="A">Option A</option>
                <option value="B">Option B</option>
                <option value="C">Option C</option>
                <option value="D">Option D</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setCreateModalOpen(false)}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition disabled:opacity-50"
            >
              {isSubmitting ? 'Creating...' : 'Publish Examination'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
