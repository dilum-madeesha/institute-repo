import React, { useState, useEffect } from 'react';
import { BookOpen, Plus, Search, Calendar, Award, CheckCircle2, AlertTriangle, School, Send, FileText, Check } from 'lucide-react';
import api from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { Assignment, ClassItem } from '../../types';
import { StatusBadge } from '../../components/StatusBadge';
import { Modal } from '../../components/Modal';

export const AssignmentPortal: React.FC = () => {
  const { user, isAdmin, isTeacher, isStudent } = useAuth();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Create Assignment Modal
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [classId, setClassId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState(new Date().toISOString().split('T')[0]);
  const [totalMarks, setTotalMarks] = useState(100);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Submit Homework Modal
  const [submitModalOpen, setSubmitModalOpen] = useState(false);
  const [activeAsg, setActiveAsg] = useState<Assignment | null>(null);
  const [submissionText, setSubmissionText] = useState('');
  const [isSubmittingHomework, setIsSubmittingHomework] = useState(false);

  // Grade Modal
  const [gradeModalOpen, setGradeModalOpen] = useState(false);
  const [submissionsList, setSubmissionsList] = useState<any[]>([]);
  const [gradingSubId, setGradingSubId] = useState<string | null>(null);
  const [marksAwarded, setMarksAwarded] = useState<number>(0);
  const [gradeFeedback, setGradeFeedback] = useState('');

  const fetchData = async () => {
    try {
      setLoading(true);
      const classesRes = await api.get('/classes?status=ACTIVE');
      setClasses(classesRes.data);

      const targetClass = selectedClassId || (classesRes.data.length > 0 ? classesRes.data[0]._id : '');
      if (targetClass) {
        setSelectedClassId(targetClass);
        const asgRes = await api.get(`/assignments/class/${targetClass}`);
        setAssignments(asgRes.data);
      }
    } catch (err) {
      console.error('Failed to load assignments:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedClassId]);

  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      await api.post('/assignments', {
        classId: classId || selectedClassId,
        title,
        description,
        dueDate,
        totalMarks,
      });

      setCreateModalOpen(false);
      setTitle('');
      setDescription('');
      if (selectedClassId) {
        const res = await api.get(`/assignments/class/${selectedClassId}`);
        setAssignments(res.data);
      }
    } catch (err) {
      console.error('Failed to create assignment:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitHomework = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeAsg) return;

    try {
      setIsSubmittingHomework(true);
      await api.post(`/assignments/${activeAsg._id}/submit`, {
        submissionText,
      });

      setSubmitModalOpen(false);
      setSubmissionText('');
      if (selectedClassId) {
        const res = await api.get(`/assignments/class/${selectedClassId}`);
        setAssignments(res.data);
      }
    } catch (err) {
      console.error('Failed to submit assignment:', err);
    } finally {
      setIsSubmittingHomework(false);
    }
  };

  const handleOpenGrading = async (asgId: string) => {
    try {
      const res = await api.get(`/assignments/${asgId}/submissions`);
      setSubmissionsList(res.data);
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

      setSubmissionsList((prev) =>
        prev.map((s) => (s._id === subId ? { ...s, marksAwarded, feedback: gradeFeedback, status: 'GRADED' } : s))
      );
      setGradingSubId(null);
    } catch (err) {
      console.error('Failed to save grade:', err);
    }
  };

  const filteredAssignments = assignments.filter(
    (a) =>
      a.title.toLowerCase().includes(search.toLowerCase()) ||
      (a.description && a.description.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Homework & Assignments</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Manage course coursework, assignment deadlines, student submissions, and teacher feedback
          </p>
        </div>

        {(isAdmin || isTeacher) && (
          <button
            onClick={() => {
              setClassId(selectedClassId);
              setCreateModalOpen(true);
            }}
            className="inline-flex items-center space-x-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl shadow-md shadow-blue-500/20 transition"
          >
            <Plus className="h-4 w-4" />
            <span>Create Assignment</span>
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
            placeholder="Search assignments by title or description..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
          />
        </div>
      </div>

      {/* Assignments Grid */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
        </div>
      ) : filteredAssignments.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200/80 p-12 text-center">
          <BookOpen className="h-12 w-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-700">No assignments created yet</h3>
          <p className="text-sm text-slate-400 mt-1">Check back later or post a new coursework assignment.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredAssignments.map((asg) => {
            const isDueSoon = new Date(asg.dueDate) > new Date();

            return (
              <div
                key={asg._id}
                className="bg-white rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition p-6 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <span className="text-xs font-bold text-slate-900 bg-blue-50 text-blue-700 px-2.5 py-1 rounded-lg">
                      {asg.totalMarks} Marks
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        isDueSoon ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      Due {new Date(asg.dueDate).toLocaleDateString()}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-slate-900">{asg.title}</h3>
                  <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                    {asg.description || 'Complete the assignment instructions.'}
                  </p>

                  {/* Submission Status for Student */}
                  {asg.mySubmission && (
                    <div className="mt-4 p-3 bg-emerald-50 border border-emerald-100 rounded-xl space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-emerald-700 uppercase">Your Submission</span>
                        <StatusBadge status={asg.mySubmission.status} />
                      </div>
                      {asg.mySubmission.marksAwarded !== undefined && asg.mySubmission.marksAwarded !== null && (
                        <p className="text-sm font-black text-emerald-900">
                          Score: {asg.mySubmission.marksAwarded} / {asg.totalMarks}
                        </p>
                      )}
                      {asg.mySubmission.feedback && (
                        <p className="text-xs text-emerald-800 italic mt-1">"{asg.mySubmission.feedback}"</p>
                      )}
                    </div>
                  )}
                </div>

                <div className="mt-6 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400">
                    Deadline: {new Date(asg.dueDate).toLocaleDateString()}
                  </span>

                  {isStudent && (
                    <button
                      onClick={() => {
                        setActiveAsg(asg);
                        setSubmitModalOpen(true);
                      }}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition"
                    >
                      {asg.mySubmission ? 'Resubmit Homework' : 'Submit Homework'}
                    </button>
                  )}

                  {(isAdmin || isTeacher) && (
                    <button
                      onClick={() => handleOpenGrading(asg._id)}
                      className="inline-flex items-center space-x-1.5 text-xs font-bold text-blue-600 hover:text-blue-700 bg-blue-50 px-3 py-1.5 rounded-lg transition"
                    >
                      <Award className="h-3.5 w-3.5" />
                      <span>Grade ({asg.submissionCount || 0})</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Submit Homework Modal */}
      <Modal isOpen={submitModalOpen} onClose={() => setSubmitModalOpen(false)} title={`Submit: ${activeAsg?.title || ''}`}>
        <form onSubmit={handleSubmitHomework} className="space-y-4">
          <p className="text-xs text-slate-500 leading-relaxed">{activeAsg?.description}</p>
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Your Homework Submission (Text / Shared Doc Link) *
            </label>
            <textarea
              required
              rows={5}
              value={submissionText}
              onChange={(e) => setSubmissionText(e.target.value)}
              placeholder="Paste your essay, working out, or cloud link (Google Drive, GitHub)..."
              className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setSubmitModalOpen(false)}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmittingHomework}
              className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition disabled:opacity-50"
            >
              {isSubmittingHomework ? 'Submitting...' : 'Upload Submission'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Grading Modal */}
      <Modal isOpen={gradeModalOpen} onClose={() => setGradeModalOpen(false)} title="Student Submissions & Grading">
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          {submissionsList.length === 0 ? (
            <p className="text-sm text-slate-400 py-6 text-center">No student submissions submitted yet.</p>
          ) : (
            submissionsList.map((sub) => (
              <div key={sub._id} className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-slate-900">{sub.studentId?.displayName || 'Student'}</span>
                  <StatusBadge status={sub.status} />
                </div>

                <div className="p-3 bg-white rounded-xl border border-slate-200 text-xs text-slate-700 whitespace-pre-line">
                  {sub.submissionText}
                </div>

                {gradingSubId === sub._id ? (
                  <div className="p-3 bg-blue-50/60 rounded-xl space-y-3 border border-blue-200/60">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                          Marks Awarded (out of 100)
                        </label>
                        <input
                          type="number"
                          value={marksAwarded}
                          onChange={(e) => setMarksAwarded(Number(e.target.value))}
                          className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                          Teacher Feedback
                        </label>
                        <input
                          type="text"
                          value={gradeFeedback}
                          onChange={(e) => setGradeFeedback(e.target.value)}
                          placeholder="Well articulated work..."
                          className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end space-x-2">
                      <button
                        onClick={() => setGradingSubId(null)}
                        className="px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleSaveGrade(sub._id)}
                        className="px-3 py-1 text-xs font-semibold bg-blue-600 text-white rounded hover:bg-blue-700"
                      >
                        Save Grade
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between pt-2">
                    <span className="text-xs font-bold text-slate-700">
                      Score: {sub.marksAwarded !== null && sub.marksAwarded !== undefined ? `${sub.marksAwarded} / 100` : 'Not graded'}
                    </span>
                    <button
                      onClick={() => {
                        setGradingSubId(sub._id);
                        setMarksAwarded(sub.marksAwarded || 85);
                        setGradeFeedback(sub.feedback || '');
                      }}
                      className="px-3 py-1 text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition"
                    >
                      {sub.status === 'GRADED' ? 'Edit Marks' : 'Grade Submission'}
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </Modal>

      {/* Create Modal */}
      <Modal isOpen={createModalOpen} onClose={() => setCreateModalOpen(false)} title="Create New Assignment">
        <form onSubmit={handleCreateAssignment} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Select Class *
            </label>
            <select
              value={classId || selectedClassId}
              onChange={(e) => setClassId(e.target.value)}
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
              Assignment Title *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Chapter 5 Worksheet – Quadratic Equations"
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
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Total Marks
              </label>
              <input
                type="number"
                value={totalMarks}
                onChange={(e) => setTotalMarks(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Instructions & Questions
            </label>
            <textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide assignment guidelines or problem sets..."
              className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
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
              {isSubmitting ? 'Posting...' : 'Create Assignment'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
