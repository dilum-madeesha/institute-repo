import React, { useState, useEffect } from 'react';
import { BookOpen, Plus, Search, Calendar, Award, CheckCircle2, School, Send, FileText, Check, Pencil, Archive, Clock, ExternalLink, XCircle } from 'lucide-react';
import * as apiService from '../../api';
import { useAuth } from '../../context/AuthContext';
import { Assignment, AssignmentSubmission, ClassItem, Student } from '../../types';
import { StatusBadge } from '../../components/StatusBadge';
import { Modal } from '../../components/Modal';

const toLocalDateTimeInput = (value?: string | Date | null) => {
  if (!value) return '';
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};

export const AssignmentPortal: React.FC = () => {
  const { isAdmin, isTeacher, isStudent } = useAuth();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');

  // Create Assignment Modal
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<Assignment | null>(null);
  const [classId, setClassId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [totalMarks, setTotalMarks] = useState(100);
  const [publicationStatus, setPublicationStatus] = useState<'DRAFT' | 'PUBLISHED' | 'SCHEDULED'>('DRAFT');
  const [publishAt, setPublishAt] = useState('');
  const [targetMode, setTargetMode] = useState<'ALL_ENROLLED' | 'SELECTED_STUDENTS'>('ALL_ENROLLED');
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [classStudents, setClassStudents] = useState<Student[]>([]);
  const [submissionType, setSubmissionType] = useState<'TEXT' | 'FILE' | 'TEXT_OR_FILE' | 'LINK_OR_TEXT'>('LINK_OR_TEXT');
  const [latePolicy, setLatePolicy] = useState<'ALLOW' | 'REJECT' | 'ACCEPT_FLAG_LATE'>('ACCEPT_FLAG_LATE');
  const [allowResubmission, setAllowResubmission] = useState(false);
  const [maxAttempts, setMaxAttempts] = useState('');
  const [resubmissionUntil, setResubmissionUntil] = useState('');
  const [resources, setResources] = useState<Array<{ name: string; fileUrl: string }>>([{ name: '', fileUrl: '' }]);
  const [resourceFiles, setResourceFiles] = useState<File[]>([]);
  const [formError, setFormError] = useState('');
  const [actionError, setActionError] = useState('');
  const [receipt, setReceipt] = useState<{ submissionId: string; attemptNumber: number; submittedAt: string; status: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Submit Homework Modal
  const [submitModalOpen, setSubmitModalOpen] = useState(false);
  const [activeAsg, setActiveAsg] = useState<Assignment | null>(null);
  const [submissionText, setSubmissionText] = useState('');
  const [submissionUrl, setSubmissionUrl] = useState('');
  const [submissionFilesToUpload, setSubmissionFilesToUpload] = useState<File[]>([]);
  const [isSubmittingHomework, setIsSubmittingHomework] = useState(false);

  // Grade Modal
  const [gradeModalOpen, setGradeModalOpen] = useState(false);
  const [submissionsList, setSubmissionsList] = useState<AssignmentSubmission[]>([]);
  const [gradingAssignment, setGradingAssignment] = useState<Assignment | null>(null);
  const [gradingMaxMarks, setGradingMaxMarks] = useState(100);
  const [gradingSubId, setGradingSubId] = useState<string | null>(null);
  const [marksAwarded, setMarksAwarded] = useState<number>(0);
  const [gradeFeedback, setGradeFeedback] = useState('');

  const fetchData = async () => {
    try {
      setLoading(true);
      setLoadError('');
      const classesRes = await apiService.getClasses({ status: 'ACTIVE' });
      if (!Array.isArray(classesRes.data)) {
        throw new Error('The class list response was invalid. Refresh the page or contact an administrator.');
      }
      setClasses(classesRes.data);

      const targetClass = classesRes.data.some((item: ClassItem) => item._id === selectedClassId)
        ? selectedClassId
        : classesRes.data[0]?._id || '';
      setSelectedClassId(targetClass);
      if (!targetClass) {
        setAssignments([]);
        return;
      }
      const assignmentsRes = await apiService.getClassAssignments(targetClass);
      if (!Array.isArray(assignmentsRes.data)) {
        throw new Error('The assignment list response was invalid. Refresh the page or contact an administrator.');
      }
      setAssignments(assignmentsRes.data);
    } catch (err: any) {
      console.error('Failed to load assignments:', err);
      setLoadError(err.response?.data?.error || err.message || 'Failed to load assignments. Please try again.');
      setAssignments([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedClassId]);

  const loadClassStudents = async (targetClassId: string) => {
    if (!targetClassId) {
      setClassStudents([]);
      return;
    }
    try {
      const response = await apiService.getClassStudents(targetClassId);
      setClassStudents(response.data);
    } catch (err) {
      console.error('Failed to load enrolled students:', err);
      setActionError('Could not load the enrolled students for this class.');
    }
  };

  const resetAssignmentForm = () => {
    setEditingAssignment(null);
    setClassId(selectedClassId);
    setTitle('');
    setDescription('');
    setDueDate('');
    setTotalMarks(100);
    setPublicationStatus('DRAFT');
    setPublishAt('');
    setTargetMode('ALL_ENROLLED');
    setSelectedStudentIds([]);
    setSubmissionType('LINK_OR_TEXT');
    setLatePolicy('ACCEPT_FLAG_LATE');
    setAllowResubmission(false);
    setMaxAttempts('');
    setResubmissionUntil('');
    setResources([{ name: '', fileUrl: '' }]);
    setResourceFiles([]);
    setFormError('');
  };

  const openCreateAssignment = () => {
    resetAssignmentForm();
    setActionError('');
    setCreateModalOpen(true);
    void loadClassStudents(selectedClassId);
  };

  const openEditAssignment = (assignment: Assignment) => {
    resetAssignmentForm();
    setEditingAssignment(assignment);
    setClassId(typeof assignment.classId === 'string' ? assignment.classId : assignment.classId._id);
    setTitle(assignment.title);
    setDescription(assignment.description);
    setDueDate(toLocalDateTimeInput(assignment.dueDate));
    setTotalMarks(assignment.totalMarks);
    setTargetMode(assignment.targetMode || 'ALL_ENROLLED');
    setSelectedStudentIds(assignment.targetStudentIds || []);
    setSubmissionType(assignment.submissionType || 'LINK_OR_TEXT');
    setLatePolicy(assignment.latePolicy || 'ACCEPT_FLAG_LATE');
    setAllowResubmission(assignment.allowResubmission || false);
    setMaxAttempts(assignment.maxAttempts ? String(assignment.maxAttempts) : '');
    setResubmissionUntil(toLocalDateTimeInput(assignment.resubmissionUntil));
    setResources(assignment.attachments?.length ? assignment.attachments : [{ name: '', fileUrl: '' }]);
    setResourceFiles([]);
    setPublicationStatus(assignment.publicationStatus === 'SCHEDULED' ? 'SCHEDULED' : 'DRAFT');
    setPublishAt(toLocalDateTimeInput(assignment.publishAt));
    setFormError('');
    setActionError('');
    setCreateModalOpen(true);
    void loadClassStudents(typeof assignment.classId === 'string' ? assignment.classId : assignment.classId._id);
  };

  const handleSaveAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (resources.some((resource) => Boolean(resource.name.trim()) !== Boolean(resource.fileUrl.trim()))) {
      setFormError('Enter both a resource title and its reference URL for every resource.');
      return;
    }
    if (targetMode === 'SELECTED_STUDENTS' && selectedStudentIds.length === 0) {
      setFormError('Select at least one student, or choose all enrolled students.');
      return;
    }
    if (publicationStatus === 'SCHEDULED' && !publishAt) {
      setFormError('Choose a publication date and time for scheduled assignments.');
      return;
    }
    if (allowResubmission && maxAttempts && Number(maxAttempts) < 2) {
      setFormError('Maximum attempts must be at least two when resubmission is enabled.');
      return;
    }
    try {
      setIsSubmitting(true);
      const payload = {
        title,
        description,
        dueDate: new Date(dueDate).toISOString(),
        totalMarks,
        attachments: resources
          .filter((resource) => resource.name.trim() && resource.fileUrl.trim())
          .map((resource) => ({ name: resource.name.trim(), fileUrl: resource.fileUrl.trim() })),
        targetMode,
        targetStudentIds: targetMode === 'SELECTED_STUDENTS' ? selectedStudentIds : [],
        submissionType,
        latePolicy,
        allowResubmission,
        maxAttempts: allowResubmission ? maxAttempts || null : null,
        resubmissionUntil: allowResubmission && resubmissionUntil
          ? new Date(resubmissionUntil).toISOString()
          : null,
        publicationStatus: editingAssignment ? undefined : publicationStatus,
        publishAt: publicationStatus === 'SCHEDULED' ? new Date(publishAt).toISOString() : null,
      };
      const formData = new FormData();
      Object.entries(payload).forEach(([key, value]) => {
        if (value === undefined) return;
        formData.append(key, value === null ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value));
      });
      resourceFiles.forEach((file) => formData.append('files', file));
      if (editingAssignment) {
        await apiService.updateAssignment(editingAssignment._id, formData);
      } else {
        formData.append('classId', classId || selectedClassId);
        await apiService.createAssignment(formData);
      }

      setCreateModalOpen(false);
      resetAssignmentForm();
      const targetClassId = classId || selectedClassId;
      setSelectedClassId(targetClassId);
      const res = await apiService.getClassAssignments(targetClassId);
      setAssignments(res.data);
    } catch (err: any) {
      console.error('Failed to save assignment:', err);
      setFormError(err.response?.data?.error || 'Failed to save assignment.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitHomework = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeAsg) return;
    if (!window.confirm(`Submit your work for "${activeAsg.title}" now?`)) return;

    try {
      setIsSubmittingHomework(true);
      const formData = new FormData();
      formData.append('submissionText', submissionText);
      formData.append('attachmentUrl', submissionUrl);
      submissionFilesToUpload.forEach((file) => formData.append('files', file));
      const response = await apiService.submitAssignment(activeAsg._id, formData);

      setReceipt(response.data.receipt);
      setSubmissionText('');
      setSubmissionUrl('');
      setSubmissionFilesToUpload([]);
      if (selectedClassId) {
        const res = await apiService.getClassAssignments(selectedClassId);
        setAssignments(res.data);
      }
    } catch (err: any) {
      console.error('Failed to submit assignment:', err);
      setActionError(err.response?.data?.error || 'Failed to submit assignment.');
    } finally {
      setIsSubmittingHomework(false);
    }
  };

  const downloadProtectedFile = async (fileUrl: string, fileName: string) => {
    try {
      const apiPath = fileUrl.replace(/^\/api\//, '');
      const response = await apiService.downloadAssignmentFile(apiPath);
      const objectUrl = URL.createObjectURL(response.data);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = fileName;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch (err: any) {
      console.error('Failed to download protected file:', err);
      setActionError(err.response?.data?.error || 'Failed to download file.');
    }
  };

  const handleOpenGrading = async (assignment: Assignment) => {
    try {
      const res = await apiService.getAssignmentSubmissions(assignment._id);
      setSubmissionsList(res.data);
      setGradingAssignment(assignment);
      setGradingMaxMarks(assignment.totalMarks);
      setActionError('');
      setGradeModalOpen(true);
    } catch (err: any) {
      console.error('Failed to load submissions:', err);
      setActionError(err.response?.data?.error || 'Failed to load assignment submissions.');
    }
  };

  const handleSaveGrade = async (subId: string) => {
    try {
      await apiService.gradeAssignmentSubmission(subId, {
        marksAwarded,
        feedback: gradeFeedback,
      });

      setSubmissionsList((prev) =>
        prev.map((s) => (s._id === subId ? { ...s, marksAwarded, feedback: gradeFeedback, status: 'GRADED', gradeReleasedAt: null } : s))
      );
      setGradingSubId(null);
    } catch (err: any) {
      console.error('Failed to save grade:', err);
      setActionError(err.response?.data?.error || 'Failed to save grade.');
    }
  };

  const handleAssignmentAction = async (assignment: Assignment, action: 'publish' | 'cancel-schedule' | 'archive') => {
    const labels = { publish: 'publish', 'cancel-schedule': 'cancel this scheduled publication for', archive: 'archive' };
    if (!window.confirm(`Are you sure you want to ${labels[action]} "${assignment.title}"?`)) return;
    try {
      setActionError('');
      await apiService.updateAssignmentPublication(assignment._id, action);
      await fetchData();
    } catch (err: any) {
      console.error(`Failed to ${action} assignment:`, err);
      setActionError(err.response?.data?.error || `Failed to ${action} assignment.`);
    }
  };

  const handleReleaseGrade = async (submissionId: string) => {
    try {
      setActionError('');
      const response = await apiService.releaseAssignmentGrade(submissionId);
      setSubmissionsList((current) =>
        current.map((submission) =>
          submission._id === submissionId ? response.data.submission : submission
        )
      );
    } catch (err: any) {
      console.error('Failed to release grade:', err);
      setActionError(err.response?.data?.error || 'Failed to release grade.');
    }
  };

  const handleReturnSubmission = async (submission: AssignmentSubmission) => {
    const feedback = window.prompt('Give the student clear instructions for revising this work:');
    if (feedback === null) return;
    try {
      setActionError('');
      await apiService.returnAssignmentSubmission(submission._id, feedback);
      setSubmissionsList((current) =>
        current.map((item) =>
          item._id === submission._id
            ? { ...item, status: 'RETURNED', marksAwarded: null, feedback, gradeReleasedAt: new Date().toISOString() }
            : item
        )
      );
    } catch (err: any) {
      console.error('Failed to return submission:', err);
      setActionError(err.response?.data?.error || 'Failed to return submission for revision.');
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
            onClick={openCreateAssignment}
            className="inline-flex items-center space-x-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl shadow-md shadow-blue-500/20 transition"
          >
            <Plus className="h-4 w-4" />
            <span>Create Assignment</span>
          </button>
        )}
      </div>

      {loadError && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {loadError}
          <button type="button" onClick={() => void fetchData()} className="ml-2 font-semibold underline">
            Retry
          </button>
        </div>
      )}

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

      {!loading && !loadError && classes.length === 0 && isStudent && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          No active class enrollment is linked to this student account. Assignments are shown only for currently
          enrolled classes. Ask an administrator to verify your student profile and enrollment dates.
        </div>
      )}

      {/* Search */}
      {actionError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{actionError}</div>
      )}
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
          <h3 className="text-base font-semibold text-slate-700">No assignments found</h3>
          <p className="text-sm text-slate-400 mt-1">
            {isStudent ? 'Published work for this class will appear here.' : 'Create an assignment or adjust your search.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredAssignments.map((asg) => {
            const isDueSoon = new Date(asg.dueDate) > new Date();
            const now = new Date();
            const assignmentPublicationStatus =
              asg.publicationStatus || (asg.isPublished ? 'PUBLISHED' : 'DRAFT');
            const submission = asg.mySubmission;
            const hasGrade = Boolean(submission?.gradeReleasedAt);
            const attemptsUsed = submission?.attemptNumber || 0;
            const attemptsReached = Boolean(
              submission && asg.maxAttempts && attemptsUsed >= asg.maxAttempts
            );
            const resubmissionClosed = Boolean(
              asg.resubmissionUntil && now > new Date(asg.resubmissionUntil)
            );
            const deadlineRejected = now > new Date(asg.dueDate) && asg.latePolicy === 'REJECT';
            const canSubmit =
              !attemptsReached &&
              !resubmissionClosed &&
              !deadlineRejected &&
              (!submission || asg.allowResubmission);

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
                    <div className="flex flex-col items-end gap-1">
                      {(isAdmin || isTeacher) && <StatusBadge status={assignmentPublicationStatus} />}
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        isDueSoon ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'
                      }`}>
                        Due {new Date(asg.dueDate).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <h3 className="text-base font-bold text-slate-900">{asg.title}</h3>
                  <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                    {asg.description || 'Complete the assignment instructions.'}
                  </p>

                  {asg.attachments?.length > 0 && (
                    <div className="mt-3 space-y-1">
                      {asg.attachments.map((attachment, index) => (
                        <a
                          key={`${attachment.fileUrl}-${index}`}
                          href={attachment.fileUrl}
                          target={attachment.fileUrl.startsWith('/api/') ? undefined : '_blank'}
                          rel={attachment.fileUrl.startsWith('/api/') ? undefined : 'noreferrer'}
                          onClick={(event) => {
                            if (!attachment.fileUrl.startsWith('/api/')) return;
                            event.preventDefault();
                            void downloadProtectedFile(attachment.fileUrl, attachment.name);
                          }}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 hover:underline"
                        >
                          <FileText className="h-3.5 w-3.5" />
                          <span>{attachment.name}</span>
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      ))}
                    </div>
                  )}

                  {/* Submission Status for Student */}
                  {isStudent && (
                    <div className="mt-4 p-3 bg-emerald-50 border border-emerald-100 rounded-xl space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-emerald-700 uppercase">Your Status</span>
                        <StatusBadge status={submission?.status || (new Date(asg.dueDate) < new Date() ? 'MISSING' : 'NOT SUBMITTED')} />
                      </div>
                      {submission && (
                        <p className="text-xs text-emerald-800">
                          Attempt {submission.attemptNumber || 1} · Submitted {new Date(submission.submittedAt).toLocaleString()}
                        </p>
                      )}
                      {hasGrade && submission?.marksAwarded !== undefined && submission.marksAwarded !== null && (
                        <p className="text-sm font-black text-emerald-900">
                          Score: {submission.marksAwarded} / {asg.totalMarks}
                        </p>
                      )}
                      {hasGrade && submission?.feedback && (
                        <p className="text-xs text-emerald-800 italic mt-1">"{submission.feedback}"</p>
                      )}
                      {submission?.submissionFiles?.map((file) => (
                        <button
                          key={file.fileId}
                          type="button"
                          onClick={() => void downloadProtectedFile(file.fileUrl, file.name)}
                          className="block text-left text-xs font-semibold text-blue-700 hover:underline"
                        >
                          Download submitted file: {file.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="mt-6 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400">
                    Deadline: {new Date(asg.dueDate).toLocaleString()}
                  </span>

                  {isStudent && (
                    <button
                      onClick={() => {
                        setActiveAsg(asg);
                        setSubmissionText(submission?.submissionText || '');
                        setSubmissionUrl(submission?.attachmentUrl || '');
                        setSubmissionFilesToUpload([]);
                        setReceipt(null);
                        setSubmitModalOpen(true);
                      }}
                      disabled={!canSubmit || isSubmittingHomework}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition disabled:cursor-not-allowed disabled:bg-slate-300"
                    >
                      {submission
                        ? attemptsReached
                          ? 'Attempt Limit Reached'
                          : resubmissionClosed
                            ? 'Resubmission Closed'
                            : asg.allowResubmission
                              ? 'Submit Another Attempt'
                              : 'Already Submitted'
                        : deadlineRejected
                          ? 'Deadline Passed'
                          : 'Submit Assignment'}
                    </button>
                  )}

                  {(isAdmin || isTeacher) && (
                    <div className="flex flex-wrap justify-end gap-2">
                      {assignmentPublicationStatus === 'DRAFT' && (
                        <button type="button" onClick={() => void handleAssignmentAction(asg, 'publish')} className="rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700">
                          Publish
                        </button>
                      )}
                      {assignmentPublicationStatus === 'SCHEDULED' && (
                        <button type="button" onClick={() => void handleAssignmentAction(asg, 'cancel-schedule')} className="rounded-lg bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-700">
                          Cancel Schedule
                        </button>
                      )}
                      {!['ARCHIVED', 'CANCELLED'].includes(assignmentPublicationStatus) && (
                        <>
                          <button type="button" onClick={() => openEditAssignment(asg)} className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700">
                            <Pencil className="h-3 w-3" /> Edit
                          </button>
                          <button type="button" onClick={() => void handleAssignmentAction(asg, 'archive')} className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700">
                            <Archive className="h-3 w-3" /> Archive
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => handleOpenGrading(asg)}
                        className="inline-flex items-center space-x-1.5 text-xs font-bold text-blue-600 hover:text-blue-700 bg-blue-50 px-3 py-1.5 rounded-lg transition"
                      >
                        <Award className="h-3.5 w-3.5" />
                        <span>Submissions ({asg.submissionCount || 0})</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Submit Homework Modal */}
      <Modal
        isOpen={submitModalOpen}
        onClose={() => {
          setSubmitModalOpen(false);
          setReceipt(null);
        }}
        title={receipt ? 'Submission Receipt' : `Submit: ${activeAsg?.title || ''}`}
      >
        {receipt ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <div className="flex items-center gap-2 font-bold text-emerald-800">
                <CheckCircle2 className="h-5 w-5" />
                <span>Submission received</span>
              </div>
              <p className="mt-2 text-sm text-emerald-800">Receipt ID: {receipt.submissionId}</p>
              <p className="text-sm text-emerald-800">Attempt {receipt.attemptNumber} · {new Date(receipt.submittedAt).toLocaleString()}</p>
              <p className="text-sm text-emerald-800">Status: {receipt.status}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setSubmitModalOpen(false);
                setReceipt(null);
              }}
              className="w-full rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmitHomework} className="space-y-4">
            <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
              <p className="font-semibold text-slate-800">{activeAsg?.description}</p>
              <p className="mt-2">Maximum marks: {activeAsg?.totalMarks}</p>
              <p>Deadline: {activeAsg?.dueDate && new Date(activeAsg.dueDate).toLocaleString()}</p>
              {activeAsg?.allowResubmission && <p>Attempts used: {activeAsg.mySubmission?.attemptNumber || 0}</p>}
            </div>
            {(activeAsg?.submissionType === 'TEXT' || activeAsg?.submissionType === 'TEXT_OR_FILE') && (
              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-700">
                  Your answer {activeAsg?.submissionType === 'TEXT' ? '*' : ''}
                </label>
                <textarea
                  required={activeAsg?.submissionType === 'TEXT'}
                  rows={6}
                  value={submissionText}
                  onChange={(event) => setSubmissionText(event.target.value)}
                  placeholder="Write your answer here..."
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}
            {(activeAsg?.submissionType === 'LINK_OR_TEXT' || activeAsg?.submissionType === 'TEXT_OR_FILE') && (
              <>
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-700">Text answer</label>
                  <textarea
                    rows={5}
                    value={submissionText}
                    onChange={(event) => setSubmissionText(event.target.value)}
                    placeholder="Write your answer..."
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                {activeAsg?.submissionType === 'LINK_OR_TEXT' && <div>
                  <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-700">Answer or file-sharing link</label>
                  <input
                    type="url"
                    value={submissionUrl}
                    onChange={(event) => setSubmissionUrl(event.target.value)}
                    placeholder="https://..."
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="mt-1 text-xs text-slate-500">You may paste a shareable link or upload supported files below.</p>
                </div>}
              </>
            )}
            {activeAsg?.submissionType !== 'TEXT' && (
              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-700">
                  Upload your work {activeAsg?.submissionType === 'FILE' ? '*' : '(optional)'}
                </label>
                <input
                  type="file"
                  multiple
                  required={activeAsg?.submissionType === 'FILE'}
                  accept=".pdf,.docx,.jpg,.jpeg,.png,.webp"
                  onChange={(event) => setSubmissionFilesToUpload(Array.from(event.target.files || []))}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
                <p className="mt-1 text-xs text-slate-500">
                  PDF, DOCX, JPG, PNG, or WEBP; max 10 MB each and 25 MB total.
                  {submissionFilesToUpload.length > 0 && ` Selected: ${submissionFilesToUpload.map((file) => file.name).join(', ')}`}
                </p>
              </div>
            )}
            <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => setSubmitModalOpen(false)}
                className="rounded-lg px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmittingHomework}
                className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {isSubmittingHomework ? 'Submitting...' : 'Submit Assignment'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Grading Modal */}
      <Modal isOpen={gradeModalOpen} onClose={() => setGradeModalOpen(false)} title="Student Submissions & Grading">
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          {actionError && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">{actionError}</div>}
          {submissionsList.length === 0 ? (
            <p className="text-sm text-slate-400 py-6 text-center">No student submissions submitted yet.</p>
          ) : (
            submissionsList.map((sub) => {
              const now = new Date();
              const canReturn =
                Boolean(gradingAssignment?.isPublished) &&
                Boolean(gradingAssignment?.allowResubmission) &&
                ['SUBMITTED', 'LATE'].includes(sub.status) &&
                !(gradingAssignment?.maxAttempts && (sub.attemptNumber || 1) >= gradingAssignment.maxAttempts) &&
                !(gradingAssignment?.resubmissionUntil && now > new Date(gradingAssignment.resubmissionUntil)) &&
                !(gradingAssignment?.latePolicy === 'REJECT' && now > new Date(gradingAssignment.dueDate));
              return (
              <div key={sub._id} className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-slate-900">{sub.studentId?.displayName || 'Student'}</span>
                  <StatusBadge status={sub.status} />
                </div>

                <div className="p-3 bg-white rounded-xl border border-slate-200 text-xs text-slate-700 whitespace-pre-line">
                  {sub.submissionText}
                  {sub.attachmentUrl && (
                    <a href={sub.attachmentUrl} target="_blank" rel="noreferrer" className="mt-2 block font-semibold text-blue-700 underline">
                      Open submitted resource link
                    </a>
                  )}
                  {sub.submissionFiles?.map((file) => (
                    <button
                      key={file.fileId}
                      type="button"
                      onClick={() => void downloadProtectedFile(file.fileUrl, file.name)}
                      className="mt-2 block font-semibold text-blue-700 underline"
                    >
                      Download {file.name}
                    </button>
                  ))}
                </div>
                {(sub.attemptHistory?.length ?? 0) > 0 && (
                  <details className="rounded-lg border border-slate-200 bg-white p-3">
                    <summary className="cursor-pointer text-xs font-semibold text-slate-600">
                      Previous attempts ({sub.attemptHistory?.length ?? 0})
                    </summary>
                    <div className="mt-2 space-y-2">
                      {(sub.attemptHistory || []).map((attempt: any) => (
                        <div key={attempt.attemptNumber} className="border-t border-slate-100 pt-2 text-xs text-slate-600">
                          <p>Attempt {attempt.attemptNumber} · {new Date(attempt.submittedAt).toLocaleString()} · {attempt.status}</p>
                          {attempt.submissionText && <p className="mt-1 whitespace-pre-line">{attempt.submissionText}</p>}
                          {attempt.attachmentUrl && <a href={attempt.attachmentUrl} target="_blank" rel="noreferrer" className="text-blue-700 underline">Open previous link</a>}
                          {attempt.submissionFiles?.map((file: { fileId: string; name: string; fileUrl: string }) => (
                            <button
                              key={file.fileId}
                              type="button"
                              onClick={() => void downloadProtectedFile(file.fileUrl, file.name)}
                              className="block text-blue-700 underline"
                            >
                              Download {file.name}
                            </button>
                          ))}
                        </div>
                      ))}
                    </div>
                  </details>
                )}

                {gradingSubId === sub._id ? (
                  <div className="p-3 bg-blue-50/60 rounded-xl space-y-3 border border-blue-200/60">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                          Marks Awarded (out of {gradingMaxMarks})
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={gradingMaxMarks}
                          step="any"
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
                      Score: {sub.marksAwarded !== null && sub.marksAwarded !== undefined ? `${sub.marksAwarded} / ${gradingMaxMarks}` : 'Not graded'}
                    </span>
                    <div className="flex gap-2">
                      {sub.status === 'GRADED' && !sub.gradeReleasedAt && (
                        <button
                          type="button"
                          onClick={() => void handleReleaseGrade(sub._id)}
                          className="rounded-lg bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 hover:bg-emerald-100"
                        >
                          Release Grade
                        </button>
                      )}
                      {canReturn && (
                        <button
                          type="button"
                          onClick={() => void handleReturnSubmission(sub)}
                          className="rounded-lg bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700 hover:bg-amber-100"
                        >
                          Return for Revision
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setGradingSubId(sub._id);
                          setMarksAwarded(sub.marksAwarded ?? 0);
                          setGradeFeedback(sub.feedback || '');
                        }}
                        className="px-3 py-1 text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition"
                      >
                        {sub.status === 'GRADED' ? 'Edit Marks' : 'Grade Submission'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
              );
            })
          )}
        </div>
      </Modal>

      {/* Create / Edit Assignment Modal */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => {
          setCreateModalOpen(false);
          resetAssignmentForm();
        }}
        title={editingAssignment ? 'Edit Assignment' : 'Create Assignment'}
      >
        <form onSubmit={handleSaveAssignment} className="max-h-[75vh] space-y-4 overflow-y-auto pr-1">
          {formError && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">{formError}</div>}

          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-700">Class *</label>
            <select
              required
              value={classId || selectedClassId}
              onChange={(event) => {
                setClassId(event.target.value);
                setSelectedStudentIds([]);
                void loadClassStudents(event.target.value);
              }}
              disabled={Boolean(editingAssignment)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100"
            >
              {classes.map((item) => <option key={item._id} value={item._id}>{item.name} ({item.classCode}) — {item.subject}</option>)}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-700">Assignment title *</label>
            <input
              type="text"
              required
              maxLength={150}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="e.g. Chapter 05 — Mathematics Worksheet"
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="mt-1 text-right text-[11px] text-slate-400">{title.length}/150</p>
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-700">Instructions *</label>
            <textarea
              required
              rows={5}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Explain the required work, learning outcomes, and submission expectations."
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <fieldset className="rounded-xl border border-slate-200 p-3">
            <legend className="px-1 text-xs font-bold uppercase tracking-wider text-slate-700">Recipients</legend>
            <div className="flex flex-wrap gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input type="radio" checked={targetMode === 'ALL_ENROLLED'} onChange={() => setTargetMode('ALL_ENROLLED')} />
                All enrolled students
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" checked={targetMode === 'SELECTED_STUDENTS'} onChange={() => setTargetMode('SELECTED_STUDENTS')} />
                Select specific students
              </label>
            </div>
            {targetMode === 'SELECTED_STUDENTS' && (
              <div className="mt-3 max-h-36 space-y-2 overflow-y-auto border-t border-slate-100 pt-3">
                {classStudents.length === 0 ? (
                  <p className="text-xs text-slate-500">No active students are enrolled in this class.</p>
                ) : classStudents.map((student) => (
                  <label key={student._id} className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={selectedStudentIds.includes(student._id)}
                      onChange={(event) => setSelectedStudentIds((current) =>
                        event.target.checked
                          ? [...current, student._id]
                          : current.filter((studentId) => studentId !== student._id)
                      )}
                    />
                    {student.displayName || `${student.firstName} ${student.lastName}`}
                    {student.studentNumber && <span className="text-xs text-slate-400">({student.studentNumber})</span>}
                  </label>
                ))}
              </div>
            )}
          </fieldset>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-700">Maximum marks *</label>
              <input
                type="number"
                required
                min={0.01}
                step="any"
                value={totalMarks}
                onChange={(event) => setTotalMarks(Number(event.target.value))}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-700">Due date & time *</label>
              <input
                type="datetime-local"
                required
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-700">Submission type</label>
              <select value={submissionType} onChange={(event) => setSubmissionType(event.target.value as typeof submissionType)} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm">
                <option value="TEXT">Text answer only</option>
                <option value="FILE">File upload only</option>
                <option value="TEXT_OR_FILE">Text answer or file upload</option>
                <option value="LINK_OR_TEXT">Text, link, or file upload</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-700">Late submissions</label>
              <select value={latePolicy} onChange={(event) => setLatePolicy(event.target.value as typeof latePolicy)} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm">
                <option value="ACCEPT_FLAG_LATE">Accept and mark late</option>
                <option value="ALLOW">Accept without late flag</option>
                <option value="REJECT">Reject after deadline</option>
              </select>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 p-3">
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <input type="checkbox" checked={allowResubmission} onChange={(event) => setAllowResubmission(event.target.checked)} />
              Allow students to submit additional attempts
            </label>
            {allowResubmission && (
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-700">Maximum attempts (optional)</label>
                  <input
                    type="number"
                    min={2}
                    step={1}
                    value={maxAttempts}
                    onChange={(event) => setMaxAttempts(event.target.value)}
                    placeholder="No fixed limit"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-700">Resubmission deadline (optional)</label>
                  <input
                    type="datetime-local"
                    min={dueDate}
                    value={resubmissionUntil}
                    onChange={(event) => setResubmissionUntil(event.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>
            )}
          </div>

          <fieldset className="space-y-3 rounded-xl border border-slate-200 p-3">
            <legend className="px-1 text-xs font-bold uppercase tracking-wider text-slate-700">Learning resources</legend>
            {resources.map((resource, index) => (
              <div key={index} className="grid grid-cols-1 items-end gap-3 sm:grid-cols-[1fr_1.5fr_auto]">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">Resource name</label>
                  <input
                    type="text"
                    maxLength={150}
                    value={resource.name}
                    onChange={(event) => setResources((current) =>
                      current.map((item, itemIndex) => itemIndex === index ? { ...item, name: event.target.value } : item)
                    )}
                    placeholder="Worksheet or reference material"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">Resource URL</label>
                  <input
                    type="url"
                    maxLength={2048}
                    value={resource.fileUrl}
                    onChange={(event) => setResources((current) =>
                      current.map((item, itemIndex) => itemIndex === index ? { ...item, fileUrl: event.target.value } : item)
                    )}
                    placeholder="https://..."
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                {resources.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setResources((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                    aria-label={`Remove resource ${index + 1}`}
                    className="mb-1 rounded-lg p-2 text-slate-500 hover:bg-red-50 hover:text-red-600"
                  >
                    <XCircle className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              disabled={resources.length >= 10}
              onClick={() => setResources((current) => [...current, { name: '', fileUrl: '' }])}
              className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus className="h-3.5 w-3.5" /> Add resource
            </button>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">Upload resource files (optional)</label>
              <input
                type="file"
                multiple
                accept=".pdf,.docx,.jpg,.jpeg,.png,.webp"
                onChange={(event) => setResourceFiles(Array.from(event.target.files || []))}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
              <p className="mt-1 text-xs text-slate-500">
                PDF, DOCX, JPG, PNG, or WEBP; max 10 MB each. Up to 10 links and files combined.
                {resourceFiles.length > 0 && ` Selected: ${resourceFiles.map((file) => file.name).join(', ')}`}
              </p>
            </div>
          </fieldset>
          <p className="text-xs text-slate-500">Resources use secure-validated HTTP/HTTPS links. Private file uploads need a storage provider and are not enabled in this project.</p>

          {!editingAssignment ? (
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-700">Publication</label>
              <select value={publicationStatus} onChange={(event) => setPublicationStatus(event.target.value as typeof publicationStatus)} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm">
                <option value="DRAFT">Save as draft</option>
                <option value="PUBLISHED">Publish now</option>
                <option value="SCHEDULED">Schedule publication</option>
              </select>
              {publicationStatus === 'SCHEDULED' && (
                <div className="mt-3">
                  <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-700">Publish date & time *</label>
                  <input type="datetime-local" required value={publishAt} onChange={(event) => setPublishAt(event.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
                  <p className="mt-1 text-xs text-slate-500">Times are interpreted in your device timezone and stored in UTC.</p>
                </div>
              )}
            </div>
          ) : (
            <p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
              Current publication status: <strong>{editingAssignment.publicationStatus}</strong>. Use the assignment card actions to publish, cancel a schedule, or archive.
            </p>
          )}

          <div className="flex flex-wrap justify-end gap-3 border-t border-slate-100 pt-4">
            <button type="button" onClick={() => { setCreateModalOpen(false); resetAssignmentForm(); }} className="rounded-lg px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100">
              Cancel
            </button>
            <button type="submit" disabled={isSubmitting} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50">
              {publicationStatus === 'SCHEDULED' && !editingAssignment ? <Clock className="h-4 w-4" /> : publicationStatus === 'PUBLISHED' && !editingAssignment ? <Send className="h-4 w-4" /> : <Check className="h-4 w-4" />}
              {isSubmitting ? 'Saving...' : editingAssignment ? 'Save Changes' : publicationStatus === 'DRAFT' ? 'Save Draft' : publicationStatus === 'SCHEDULED' ? 'Schedule Assignment' : 'Publish Assignment'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
