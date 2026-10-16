import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Save,
  Send,
  Edit3,
  History,
  Mail,
  Check,
  X,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import api from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { AttendanceStatus, SessionStatus } from '../../types';
import { StatusBadge } from '../../components/StatusBadge';
import { Modal } from '../../components/Modal';

interface StudentRosterItem {
  student: {
    id: string;
    firstName: string;
    lastName: string;
    displayName: string;
    studentNumber?: string;
  };
  record: {
    id: string;
    status: AttendanceStatus;
    arrivalTime?: string;
    note?: string;
    markedAt?: string;
  } | null;
  notifications: Array<{
    id: string;
    status: string;
    recipientEmail: string;
    lastError?: string;
    sentAt?: string;
  }>;
}

export const AttendanceRegister: React.FC = () => {
  const { classId, sessionId } = useParams<{ classId: string; sessionId: string }>();
  const { user } = useAuth();

  const [session, setSession] = useState<any>(null);
  const [roster, setRoster] = useState<StudentRosterItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form entries map: studentId -> { status, arrivalTime, note }
  const [entries, setEntries] = useState<
    Record<string, { status: AttendanceStatus | ''; arrivalTime: string; note: string }>
  >({});

  // Unmarked warning modal
  const [unmarkedModalOpen, setUnmarkedModalOpen] = useState(false);
  const [unmarkedStudentsList, setUnmarkedStudentsList] = useState<any[]>([]);

  // Correction modal
  const [correctionModalOpen, setCorrectionModalOpen] = useState(false);
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [correctionStudentName, setCorrectionStudentName] = useState('');
  const [correctionNewStatus, setCorrectionNewStatus] = useState<AttendanceStatus>('PRESENT');
  const [correctionReason, setCorrectionReason] = useState('');
  const [correctionNote, setCorrectionNote] = useState('');
  const [correctionArrivalTime, setCorrectionArrivalTime] = useState('');
  const [correctionError, setCorrectionError] = useState('');

  // Change logs modal
  const [changeLogsModalOpen, setChangeLogsModalOpen] = useState(false);
  const [activeChangeLogs, setActiveChangeLogs] = useState<any[]>([]);

  const fetchSessionAttendance = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/sessions/${sessionId}/attendance`);
      setSession(res.data.session);
      setRoster(res.data.roster);

      // Populate draft entries from existing records
      const initialMap: Record<string, any> = {};
      res.data.roster.forEach((item: StudentRosterItem) => {
        initialMap[item.student.id] = {
          status: item.record ? item.record.status : '',
          arrivalTime: item.record?.arrivalTime || '',
          note: item.record?.note || '',
        };
      });
      setEntries(initialMap);
    } catch (err: any) {
      console.error('Failed to load session attendance:', err);
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to load register.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessionAttendance();
  }, [sessionId]);

  const handleStatusChange = (studentId: string, status: AttendanceStatus) => {
    if (session?.status === 'SUBMITTED' || session?.status === 'LOCKED') return;

    setEntries((prev) => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        status,
        arrivalTime: status === 'LATE' && !prev[studentId]?.arrivalTime ? '09:15' : prev[studentId]?.arrivalTime,
      },
    }));
  };

  const handleFieldChange = (studentId: string, field: 'arrivalTime' | 'note', value: string) => {
    setEntries((prev) => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        [field]: value,
      },
    }));
  };

  const markAllPresent = () => {
    if (session?.status === 'SUBMITTED' || session?.status === 'LOCKED') return;

    setEntries((prev) => {
      const updated = { ...prev };
      roster.forEach((item) => {
        if (!updated[item.student.id]?.status) {
          updated[item.student.id] = {
            ...updated[item.student.id],
            status: 'PRESENT',
          };
        }
      });
      return updated;
    });
  };

  const buildItemsPayload = () => {
    return Object.entries(entries)
      .filter(([_, data]) => data.status !== '')
      .map(([studentId, data]) => ({
        studentId,
        status: data.status,
        arrivalTime: data.status === 'LATE' ? data.arrivalTime : undefined,
        note: data.note,
      }));
  };

  const handleSaveDraft = async () => {
    try {
      setIsSaving(true);
      setMessage(null);
      const items = buildItemsPayload();

      await api.put(`/sessions/${sessionId}/attendance`, { items });
      setMessage({ type: 'success', text: 'Attendance draft saved successfully.' });
      fetchSessionAttendance();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to save draft.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmitAttendance = async (allowPartial = false) => {
    try {
      setIsSaving(true);
      setMessage(null);
      const items = buildItemsPayload();

      await api.post(`/sessions/${sessionId}/submit`, { items, allowPartial });
      setMessage({
        type: 'success',
        text: 'Attendance finalized and submitted! Guardian absence emails have been queued.',
      });
      setUnmarkedModalOpen(false);
      fetchSessionAttendance();
    } catch (err: any) {
      if (err.response?.data?.warning === 'UNMARKED_STUDENTS') {
        setUnmarkedStudentsList(err.response.data.unmarkedStudents || []);
        setUnmarkedModalOpen(true);
      } else {
        setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to submit attendance.' });
      }
    } finally {
      setIsSaving(false);
    }
  };

  // Open correction modal
  const openCorrection = (item: StudentRosterItem) => {
    if (!item.record) return;
    setSelectedRecordId(item.record.id);
    setCorrectionStudentName(item.student.displayName || `${item.student.firstName} ${item.student.lastName}`);
    setCorrectionNewStatus(item.record.status);
    setCorrectionReason('');
    setCorrectionNote(item.record.note || '');
    setCorrectionArrivalTime(item.record.arrivalTime || '');
    setCorrectionError('');
    setCorrectionModalOpen(true);
  };

  const handleSaveCorrection = async (e: React.FormEvent) => {
    e.preventDefault();
    setCorrectionError('');

    if (!correctionReason.trim()) {
      setCorrectionError('A mandatory explanation reason is required for any attendance correction.');
      return;
    }

    try {
      await api.patch(`/attendance/${selectedRecordId}`, {
        newStatus: correctionNewStatus,
        reason: correctionReason,
        note: correctionNote,
        arrivalTime: correctionNewStatus === 'LATE' ? correctionArrivalTime : undefined,
      });

      setCorrectionModalOpen(false);
      setMessage({ type: 'success', text: 'Attendance record corrected and logged to audit trail.' });
      fetchSessionAttendance();
    } catch (err: any) {
      setCorrectionError(err.response?.data?.error || 'Failed to save correction.');
    }
  };

  const viewChangeLogs = async (recordId: string) => {
    try {
      const res = await api.get(`/attendance/${recordId}/logs`);
      setActiveChangeLogs(res.data);
      setChangeLogsModalOpen(true);
    } catch (err) {
      console.error('Failed to load change logs:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  // Calculate live counters
  let presentCount = 0;
  let absentCount = 0;
  let lateCount = 0;
  let excusedCount = 0;
  let unmarkedCount = 0;

  roster.forEach((item) => {
    const st = entries[item.student.id]?.status;
    if (st === 'PRESENT') presentCount++;
    else if (st === 'ABSENT') absentCount++;
    else if (st === 'LATE') lateCount++;
    else if (st === 'EXCUSED') excusedCount++;
    else unmarkedCount++;
  });

  const isSubmitted = session?.status === 'SUBMITTED' || session?.status === 'LOCKED';

  return (
    <div className="space-y-6">
      {/* Back button */}
      <div>
        <Link
          to={`/classes/${classId}`}
          className="inline-flex items-center space-x-1 text-sm font-semibold text-slate-500 hover:text-slate-800 transition"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to {session?.className || 'Class'}</span>
        </Link>
      </div>

      {/* Session Title & Metadata Card */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-6 sm:p-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-3 mb-2">
              <span className="px-2.5 py-1 bg-blue-100 text-blue-800 font-mono font-bold text-xs rounded-lg uppercase">
                {session?.classCode}
              </span>
              <StatusBadge status={session?.status} />
              <span className="text-xs text-slate-400 font-medium">
                {session?.startTime && `${session.startTime} - ${session.endTime}`}
                {session?.timeZone && ` (${session.timeZone})`}
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              {session?.className} – Attendance Register
            </h1>
            <p className="text-sm font-semibold text-blue-600 mt-1">
              Session Date:{' '}
              {new Date(session?.sessionDate).toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
              {session?.title && ` • ${session.title}`}
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-3">
            {!isSubmitted && (
              <>
                <button
                  onClick={markAllPresent}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition"
                >
                  Mark Unmarked as Present
                </button>
                <button
                  onClick={handleSaveDraft}
                  disabled={isSaving}
                  className="inline-flex items-center space-x-1.5 px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl shadow-sm transition disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />
                  <span>Save Draft</span>
                </button>
                <button
                  onClick={() => handleSubmitAttendance(false)}
                  disabled={isSaving}
                  className="inline-flex items-center space-x-1.5 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md shadow-blue-500/20 transition disabled:opacity-50"
                >
                  <Send className="h-4 w-4" />
                  <span>Submit & Finalize</span>
                </button>
              </>
            )}

            {isSubmitted && (
              <div className="flex items-center space-x-2 text-xs font-semibold text-blue-700 bg-blue-50 px-3.5 py-2 rounded-xl border border-blue-200">
                <CheckCircle2 className="h-4 w-4 text-blue-600" />
                <span>
                  {session?.autoFinalizedAt
                    ? `Automatically finalized after check-in closed on ${new Date(session.autoFinalizedAt).toLocaleString()}`
                    : `Submitted by ${session?.submittedBy?.fullName || 'Teacher'} on ${new Date(session?.submittedAt).toLocaleDateString()}`}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Live Counters Pill */}
        <div className="mt-8 pt-6 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
          <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100">
            <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-600">Present</p>
            <p className="text-xl font-bold text-emerald-800 mt-0.5">{presentCount}</p>
          </div>
          <div className="p-3 bg-rose-50 rounded-xl border border-rose-100">
            <p className="text-[11px] font-bold uppercase tracking-wider text-rose-600">Absent</p>
            <p className="text-xl font-bold text-rose-800 mt-0.5">{absentCount}</p>
          </div>
          <div className="p-3 bg-amber-50 rounded-xl border border-amber-100">
            <p className="text-[11px] font-bold uppercase tracking-wider text-amber-600">Late</p>
            <p className="text-xl font-bold text-amber-800 mt-0.5">{lateCount}</p>
          </div>
          <div className="p-3 bg-purple-50 rounded-xl border border-purple-100">
            <p className="text-[11px] font-bold uppercase tracking-wider text-purple-600">Excused</p>
            <p className="text-xl font-bold text-purple-800 mt-0.5">{excusedCount}</p>
          </div>
          <div className={`p-3 rounded-xl border ${unmarkedCount > 0 ? 'bg-amber-100/60 border-amber-300' : 'bg-slate-50 border-slate-200'}`}>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Unmarked</p>
            <p className={`text-xl font-bold mt-0.5 ${unmarkedCount > 0 ? 'text-amber-800' : 'text-slate-600'}`}>{unmarkedCount}</p>
          </div>
        </div>
      </div>

      {/* Feedback banner */}
      {message && (
        <div
          className={`p-4 rounded-2xl flex items-center justify-between text-sm ${
            message.type === 'success'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-center space-x-2">
            {message.type === 'success' ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="h-5 w-5 text-rose-600 shrink-0" />
            )}
            <span className="font-semibold">{message.text}</span>
          </div>
          <button onClick={() => setMessage(null)} className="text-xs font-bold hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Register Table Card */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50/80 text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
              <tr>
                <th className="py-4 px-6">Adm #</th>
                <th className="py-4 px-6">Student Name</th>
                <th className="py-4 px-6">Attendance Status</th>
                <th className="py-4 px-6">Time / Notes</th>
                <th className="py-4 px-6">Parent Alert Status</th>
                {isSubmitted && <th className="py-4 px-6 text-right">Correction</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {roster.map((item) => {
                const current = entries[item.student.id] || { status: '', arrivalTime: '', note: '' };
                const isItemLate = current.status === 'LATE';

                return (
                  <tr key={item.student.id} className="hover:bg-slate-50/50 transition">
                    <td className="py-4 px-6 font-mono text-xs text-slate-500 whitespace-nowrap">
                      {item.student.studentNumber || '—'}
                    </td>
                    <td className="py-4 px-6 font-semibold text-slate-900 whitespace-nowrap">
                      <Link
                        to={`/students/${item.student.id}`}
                        className="hover:text-blue-600 transition"
                      >
                        {item.student.displayName || `${item.student.firstName} ${item.student.lastName}`}
                      </Link>
                    </td>
                    <td className="py-4 px-6 whitespace-nowrap">
                      {isSubmitted ? (
                        <StatusBadge status={current.status || 'UNMARKED'} />
                      ) : (
                        <div className="inline-flex rounded-xl p-1 bg-slate-100 space-x-1">
                          <button
                            type="button"
                            onClick={() => handleStatusChange(item.student.id, 'PRESENT')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                              current.status === 'PRESENT'
                                ? 'bg-emerald-600 text-white shadow-sm'
                                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                            }`}
                          >
                            Present
                          </button>
                          <button
                            type="button"
                            onClick={() => handleStatusChange(item.student.id, 'ABSENT')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                              current.status === 'ABSENT'
                                ? 'bg-rose-600 text-white shadow-sm'
                                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                            }`}
                          >
                            Absent
                          </button>
                          <button
                            type="button"
                            onClick={() => handleStatusChange(item.student.id, 'LATE')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                              current.status === 'LATE'
                                ? 'bg-amber-600 text-white shadow-sm'
                                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                            }`}
                          >
                            Late
                          </button>
                          <button
                            type="button"
                            onClick={() => handleStatusChange(item.student.id, 'EXCUSED')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                              current.status === 'EXCUSED'
                                ? 'bg-purple-600 text-white shadow-sm'
                                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                            }`}
                          >
                            Excused
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="py-4 px-6 min-w-[200px]">
                      {isSubmitted ? (
                        <div className="text-xs">
                          {current.status === 'LATE' && current.arrivalTime && (
                            <span className="font-semibold text-amber-700 block">
                              Arrived: {current.arrivalTime}
                            </span>
                          )}
                          <span className="text-slate-500">{current.note || '—'}</span>
                        </div>
                      ) : (
                        <div className="flex flex-col space-y-1.5">
                          {isItemLate && (
                            <div className="flex items-center space-x-1.5">
                              <span className="text-[11px] font-bold text-amber-700">Time:</span>
                              <input
                                type="time"
                                value={current.arrivalTime}
                                onChange={(e) =>
                                  handleFieldChange(item.student.id, 'arrivalTime', e.target.value)
                                }
                                className="px-2 py-1 text-xs border border-amber-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500"
                              />
                            </div>
                          )}
                          <input
                            type="text"
                            placeholder="Optional note / reason..."
                            value={current.note}
                            onChange={(e) =>
                              handleFieldChange(item.student.id, 'note', e.target.value)
                            }
                            className="w-full px-2.5 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </div>
                      )}
                    </td>
                    <td className="py-4 px-6 whitespace-nowrap">
                      {current.status === 'ABSENT' ? (
                        item.notifications && item.notifications.length > 0 ? (
                          <div className="flex flex-col space-y-1">
                            {item.notifications.map((n) => (
                              <div key={n.id} className="flex items-center space-x-1.5">
                                <StatusBadge status={n.status} />
                                <span className="text-[11px] text-slate-500 truncate max-w-[120px]">
                                  {n.recipientEmail}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : isSubmitted ? (
                          <span className="text-xs text-slate-400">Processing queue...</span>
                        ) : (
                          <span className="text-xs text-slate-400">Sends on submit</span>
                        )
                      ) : (
                        <span className="text-xs text-slate-300">—</span>
                      )}
                    </td>
                    {isSubmitted && (
                      <td className="py-4 px-6 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => openCorrection(item)}
                            className="inline-flex items-center space-x-1 px-2.5 py-1 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition"
                          >
                            <Edit3 className="h-3 w-3" />
                            <span>Correct</span>
                          </button>
                          {item.record && (
                            <button
                              onClick={() => viewChangeLogs(item.record!.id)}
                              className="p-1 text-slate-400 hover:text-slate-600 rounded"
                              title="View Correction History"
                            >
                              <History className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Unmarked Students Warning Modal */}
      <Modal
        isOpen={unmarkedModalOpen}
        onClose={() => setUnmarkedModalOpen(false)}
        title="Unmarked Students Warning"
      >
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm flex items-start space-x-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Attention: Some students are still unmarked.</p>
              <p className="mt-1 text-xs text-amber-700">
                You have {unmarkedStudentsList.length} student(s) with no attendance status recorded.
                Per policy, attendance must not assume unmarked students are absent.
              </p>
            </div>
          </div>

          <div className="max-h-48 overflow-y-auto divide-y divide-slate-100 rounded-lg border border-slate-200 bg-slate-50">
            {unmarkedStudentsList.map((st) => (
              <div key={st.id} className="p-2.5 text-xs flex justify-between font-medium text-slate-700">
                <span>{st.name}</span>
                <span className="font-mono text-slate-400">{st.studentNumber || 'No Adm #'}</span>
              </div>
            ))}
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100">
            <button
              onClick={() => setUnmarkedModalOpen(false)}
              className="px-4 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
            >
              Go Back to Mark Them
            </button>
            <button
              onClick={() => handleSubmitAttendance(true)}
              className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition"
            >
              Submit Anyway (Allow Partial)
            </button>
          </div>
        </div>
      </Modal>

      {/* Attendance Correction Modal */}
      <Modal
        isOpen={correctionModalOpen}
        onClose={() => setCorrectionModalOpen(false)}
        title={`Correct Attendance – ${correctionStudentName}`}
      >
        <form onSubmit={handleSaveCorrection} className="space-y-4">
          {correctionError && (
            <div className="p-3 rounded-lg bg-red-50 text-red-700 text-xs border border-red-200">
              {correctionError}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              New Status *
            </label>
            <div className="grid grid-cols-4 gap-2">
              {(['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'] as AttendanceStatus[]).map((st) => (
                <button
                  type="button"
                  key={st}
                  onClick={() => setCorrectionNewStatus(st)}
                  className={`py-2 text-xs font-bold rounded-lg border transition ${
                    correctionNewStatus === st
                      ? 'border-blue-600 bg-blue-50 text-blue-700 ring-2 ring-blue-500/20'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          {correctionNewStatus === 'LATE' && (
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Actual Arrival Time
              </label>
              <input
                type="time"
                value={correctionArrivalTime}
                onChange={(e) => setCorrectionArrivalTime(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Mandatory Reason for Correction *
            </label>
            <textarea
              required
              rows={3}
              value={correctionReason}
              onChange={(e) => setCorrectionReason(e.target.value)}
              placeholder="e.g. Student presented valid medical hall pass; marked absent by mistake."
              className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              This explanation is permanently preserved in the audit change log.
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Updated Notes (Optional)
            </label>
            <input
              type="text"
              value={correctionNote}
              onChange={(e) => setCorrectionNote(e.target.value)}
              placeholder="Additional internal notes..."
              className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setCorrectionModalOpen(false)}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition"
            >
              Save Correction & Log Audit
            </button>
          </div>
        </form>
      </Modal>

      {/* Change Logs History Modal */}
      <Modal
        isOpen={changeLogsModalOpen}
        onClose={() => setChangeLogsModalOpen(false)}
        title="Attendance Correction History"
      >
        <div className="space-y-3">
          {activeChangeLogs.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-6">No historical corrections recorded for this record.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {activeChangeLogs.map((log) => (
                <div key={log._id} className="py-3 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-800">
                      Changed from <span className="text-rose-600 font-bold">{log.oldStatus}</span> to{' '}
                      <span className="text-emerald-600 font-bold">{log.newStatus}</span>
                    </span>
                    <span className="text-slate-400 text-[11px]">
                      {new Date(log.changedAt).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-slate-600 italic">"{log.reason}"</p>
                  <p className="text-[11px] text-slate-400">Changed by: {log.changedBy?.fullName || 'Teacher'}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};
