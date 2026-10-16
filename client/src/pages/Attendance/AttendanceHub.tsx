import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, School, Clock, CheckCircle2, AlertTriangle, ArrowRight, Plus, Search, Users, Mail, Pencil, Trash2 } from 'lucide-react';
import api from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { ClassItem, ClassSession } from '../../types';
import { StatusBadge } from '../../components/StatusBadge';
import { Modal } from '../../components/Modal';

const getLocalDateInputValue = () => {
  const today = new Date();
  const offset = today.getTimezoneOffset() * 60000;
  return new Date(today.getTime() - offset).toISOString().split('T')[0];
};

export const AttendanceHub: React.FC = () => {
  const { isAdmin, isTeacher } = useAuth();
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [sessions, setSessions] = useState<ClassSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // New Session Modal
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<ClassSession | null>(null);
  const [modalClassId, setModalClassId] = useState('');
  const [sessionDate, setSessionDate] = useState(getLocalDateInputValue);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:30');
  const [sessionTitle, setSessionTitle] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [actionError, setActionError] = useState('');
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);

  const fetchClasses = async () => {
    try {
      setLoading(true);
      const res = await api.get('/classes?status=ACTIVE');
      setClasses(res.data);
      if (res.data.length > 0 && !selectedClassId) {
        setSelectedClassId(res.data[0]._id);
      }
    } catch (err) {
      console.error('Failed to load classes:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSessions = async (classId: string) => {
    if (!classId) return;
    try {
      const res = await api.get(`/classes/${classId}/sessions`);
      setSessions(res.data);
    } catch (err) {
      console.error('Failed to load sessions:', err);
    }
  };

  useEffect(() => {
    fetchClasses();
  }, []);

  useEffect(() => {
    if (selectedClassId) {
      fetchSessions(selectedClassId);
    }
  }, [selectedClassId]);

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetId = editingSession ? selectedClassId : modalClassId || selectedClassId;
    if (!targetId) return;

    try {
      setIsSubmitting(true);
      setFormError('');
      const sessionData = {
        sessionDate,
        startTime,
        endTime,
        title: sessionTitle || 'Regular Session',
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Colombo',
      };
      if (editingSession) {
        await api.patch(`/classes/${targetId}/sessions/${editingSession._id}`, sessionData);
      } else {
        await api.post(`/classes/${targetId}/sessions`, sessionData);
      }
      setCreateModalOpen(false);
      setEditingSession(null);
      setSessionTitle('');
      setSelectedClassId(targetId);
      await fetchSessions(targetId);
    } catch (err: any) {
      console.error('Failed to create session:', err);
      setFormError(err.response?.data?.error || `Failed to ${editingSession ? 'update' : 'create'} attendance session.`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditSession = (session: ClassSession) => {
    setEditingSession(session);
    setModalClassId(selectedClassId);
    setSessionDate(new Date(session.sessionDate).toISOString().split('T')[0]);
    setStartTime(session.startTime || '');
    setEndTime(session.endTime || '');
    setSessionTitle(session.title || '');
    setFormError('');
    setCreateModalOpen(true);
  };

  const closeSessionModal = () => {
    setCreateModalOpen(false);
    setEditingSession(null);
    setFormError('');
    setSessionTitle('');
  };

  const openCreateSession = () => {
    setEditingSession(null);
    setModalClassId(selectedClassId);
    setSessionDate(getLocalDateInputValue());
    setStartTime('09:00');
    setEndTime('10:30');
    setSessionTitle('');
    setFormError('');
    setCreateModalOpen(true);
  };

  const handleDeleteSession = async (session: ClassSession) => {
    const title = session.title || 'this attendance session';
    if (!window.confirm(`Delete "${title}"? This will permanently remove its attendance records and guardian notification history.`)) {
      return;
    }

    try {
      setActionError('');
      setDeletingSessionId(session._id);
      await api.delete(`/classes/${selectedClassId}/sessions/${session._id}`);
      setSessions((current) => current.filter((item) => item._id !== session._id));
    } catch (err: any) {
      console.error('Failed to delete attendance session:', err);
      setActionError(err.response?.data?.error || 'Failed to delete attendance session.');
    } finally {
      setDeletingSessionId(null);
    }
  };

  const activeClass = classes.find((c) => c._id === selectedClassId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Attendance Center</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Record session registers, track student punctuality, and monitor automatic guardian absence notices
          </p>
        </div>

        {(isAdmin || isTeacher) && (
          <button
            onClick={openCreateSession}
            className="inline-flex items-center space-x-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl shadow-md shadow-blue-500/20 transition"
          >
            <Plus className="h-4 w-4" />
            <span>Open Attendance Session</span>
          </button>
        )}
      </div>

      {/* Class Selector Pills */}
      <div className="flex items-center space-x-2 overflow-x-auto pb-2 scrollbar-none">
        {classes.map((cls) => {
          const isSelected = cls._id === selectedClassId;
          return (
            <button
              key={cls._id}
              onClick={() => setSelectedClassId(cls._id)}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition flex items-center space-x-2 ${
                isSelected
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                  : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200/80'
              }`}
            >
              <School className={`h-3.5 w-3.5 ${isSelected ? 'text-white' : 'text-slate-400'}`} />
              <span>{cls.name}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded ${isSelected ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-600'}`}>
                {cls.classCode}
              </span>
            </button>
          );
        })}
      </div>

      {/* Sessions Grid */}
      {actionError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{actionError}</div>
      )}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
        </div>
      ) : sessions.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200/80 p-12 text-center">
          <Calendar className="h-12 w-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-700">No attendance sessions recorded</h3>
          <p className="text-sm text-slate-400 mt-1">Open a new session to begin recording student attendance.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-500 font-semibold uppercase tracking-wider px-2">
            <span>Sessions for {activeClass?.name || 'Class'} ({sessions.length})</span>
            <span>Status & Action</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sessions.map((sess) => {
              const dateFormatted = new Date(sess.sessionDate).toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              });

              return (
                <div
                  key={sess._id}
                  className="bg-white rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition p-5 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <span className="text-xs font-bold text-slate-900 bg-slate-100 px-2.5 py-1 rounded-lg">
                        {dateFormatted}
                      </span>
                      <StatusBadge status={sess.status} />
                    </div>

                    <h4 className="font-bold text-slate-900 text-base">{sess.title || 'Curriculum Session'}</h4>
                    <p className="text-xs text-slate-500 mt-1 flex items-center space-x-1.5">
                      <Clock className="h-3.5 w-3.5 text-slate-400" />
                      <span>{sess.startTime || '09:00'} - {sess.endTime || '10:30'}</span>
                    </p>

                    {sess.stats && (
                      <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-slate-100 text-center">
                        <div className="bg-emerald-50 rounded-lg p-1.5">
                          <p className="text-[10px] text-emerald-700 font-bold uppercase">Present</p>
                          <p className="text-sm font-bold text-emerald-800">{sess.stats.PRESENT}</p>
                        </div>
                        <div className="bg-amber-50 rounded-lg p-1.5">
                          <p className="text-[10px] text-amber-700 font-bold uppercase">Late</p>
                          <p className="text-sm font-bold text-amber-800">{sess.stats.LATE}</p>
                        </div>
                        <div className="bg-rose-50 rounded-lg p-1.5">
                          <p className="text-[10px] text-rose-700 font-bold uppercase">Absent</p>
                          <p className="text-sm font-bold text-rose-800">{sess.stats.ABSENT}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                    <span className="text-[11px] text-slate-400">
                      {sess.status === 'SUBMITTED' ? 'Dispatched to parents' : 'Draft register'}
                    </span>
                    <div className="flex items-center gap-2">
                      {isAdmin && (
                        <>
                          <button
                            type="button"
                            onClick={() => openEditSession(sess)}
                            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 hover:text-slate-900 bg-slate-100 px-3 py-1.5 rounded-lg transition"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            <span>Edit</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDeleteSession(sess)}
                            disabled={deletingSessionId === sess._id}
                            className="inline-flex items-center gap-1.5 text-xs font-bold text-red-700 hover:text-red-800 bg-red-50 px-3 py-1.5 rounded-lg transition disabled:opacity-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span>{deletingSessionId === sess._id ? 'Deleting...' : 'Delete'}</span>
                          </button>
                        </>
                      )}
                      <Link
                        to={`/classes/${selectedClassId}/sessions/${sess._id}`}
                        className="inline-flex items-center space-x-1.5 text-xs font-bold text-blue-600 hover:text-blue-700 bg-blue-50 px-3 py-1.5 rounded-lg transition"
                      >
                        <span>{sess.status === 'DRAFT' ? 'Take Attendance' : 'View Register'}</span>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Create Session Modal */}
      <Modal
        isOpen={createModalOpen}
        onClose={closeSessionModal}
        title={editingSession ? 'Edit Attendance Session' : 'Open New Attendance Session'}
      >
        <form onSubmit={handleCreateSession} className="space-y-4">
          {formError && (
            <div className="p-3 rounded-lg bg-red-50 text-red-700 text-xs border border-red-200">{formError}</div>
          )}
          {!editingSession && (
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Select Class *
              </label>
              <select
                value={modalClassId || selectedClassId}
                onChange={(e) => setModalClassId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {classes.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name} ({c.classCode})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Session Title
            </label>
            <input
              type="text"
              value={sessionTitle}
              onChange={(e) => setSessionTitle(e.target.value)}
              placeholder="e.g. Chapter 4 Review & Practical Lab"
              className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Date *
              </label>
              <input
                type="date"
                required
                value={sessionDate}
                onChange={(e) => setSessionDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Start Time
              </label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {!editingSession && (
            <p className="text-xs text-slate-500">
              Students can check in from the session start until the end time. The register closes automatically when time expires.
            </p>
          )}

          <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={closeSessionModal}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition disabled:opacity-50"
            >
              {isSubmitting ? (editingSession ? 'Saving...' : 'Opening...') : (editingSession ? 'Save Changes' : 'Start Session')}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
