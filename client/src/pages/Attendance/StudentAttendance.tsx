import React, { useCallback, useEffect, useState } from 'react';
import { CalendarCheck, CheckCircle2, Clock, RefreshCw } from 'lucide-react';
import * as apiService from '../../api';
import { AttendanceStatus } from '../../types';

interface StudentAttendanceSession {
  _id: string;
  title?: string;
  sessionDate: string;
  startTime?: string;
  endTime?: string;
  timeZone?: string;
  status: 'DRAFT' | 'SUBMITTED' | 'LOCKED';
  autoFinalizedAt?: string | null;
  checkInState: 'UPCOMING' | 'OPEN' | 'CLOSED' | 'FINALIZED';
  class: { _id: string; name: string; classCode: string; subject?: string; teachers?: Array<{ fullName: string }> } | null;
  attendance: { status: AttendanceStatus; arrivalTime?: string; markedAt?: string } | null;
}

export const StudentAttendance: React.FC = () => {
  const [sessions, setSessions] = useState<StudentAttendanceSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [checkingIn, setCheckingIn] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const loadSessions = useCallback(async (showLoading = false) => {
    try {
      if (showLoading) setLoading(true);
      setError('');
      const response = await apiService.getStudentAttendanceSessions();
      setSessions(response.data);
    } catch (err: any) {
      console.error('Failed to load student attendance sessions:', err);
      setError(err.response?.data?.error || 'Failed to load attendance sessions.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadSessions(true);
    const interval = window.setInterval(() => void loadSessions(), 30000);
    return () => window.clearInterval(interval);
  }, [loadSessions]);

  const handleCheckIn = async (session: StudentAttendanceSession) => {
    try {
      setCheckingIn(session._id);
      setError('');
      setMessage('');
      await apiService.checkInStudentAttendance(session._id);
      setMessage(`Your attendance for ${session.class?.name || 'this class'} was recorded.`);
      await loadSessions();
    } catch (err: any) {
      console.error('Failed to check in for attendance:', err);
      setError(err.response?.data?.error || 'Failed to record attendance check-in.');
      await loadSessions();
    } finally {
      setCheckingIn(null);
    }
  };

  const formatSessionDate = (value: string) => {
    const dateOnly = value.slice(0, 10);
    return new Date(`${dateOnly}T12:00:00`).toLocaleDateString(undefined, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getWindowLabel = (session: StudentAttendanceSession) => {
    if (session.attendance) {
      if (session.attendance.status === 'ABSENT') return 'Marked absent';
      if (session.attendance.status === 'EXCUSED') return 'Absence excused';
      return `${session.attendance.status === 'LATE' ? 'Checked in late' : 'Present'}${session.attendance.arrivalTime ? ` at ${session.attendance.arrivalTime}` : ''}`;
    }
    if (session.checkInState === 'UPCOMING') return 'Check-in opens at session start';
    if (session.checkInState === 'OPEN') return 'Check-in is open';
    if (session.checkInState === 'CLOSED') return 'Check-in window closed';
    return session.autoFinalizedAt ? 'Session finalized after check-in closed' : 'Session finalized';
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">My Attendance</h1>
          <p className="text-sm text-slate-500 mt-1">
            Check in during the scheduled session window. Check-in closes automatically at the session end time.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setRefreshing(true);
            void loadSessions();
          }}
          disabled={refreshing}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {message && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{message}</div>}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
        </div>
      ) : sessions.length === 0 ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center">
          <CalendarCheck className="mx-auto mb-3 h-12 w-12 text-slate-300" />
          <h2 className="text-base font-semibold text-slate-700">No attendance sessions available</h2>
          <p className="mt-1 text-sm text-slate-500">
            Sessions appear here after staff publish them for your currently enrolled classes. If you expect a session,
            ask an administrator to verify your student account link and active enrollment.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {sessions.map((session) => (
            <article key={session._id} className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-blue-600">
                      {session.class?.name || 'Class'}
                      {session.class?.classCode ? ` · ${session.class.classCode}` : ''}
                    </p>
                    {session.class?.subject && <p className="mt-1 text-xs text-slate-500">{session.class.subject}</p>}
                    <h2 className="mt-1 text-lg font-bold text-slate-900">{session.title || 'Attendance Session'}</h2>
                  </div>
                  {session.attendance ? (
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
                  ) : (
                    <Clock className={`h-5 w-5 shrink-0 ${session.checkInState === 'OPEN' ? 'text-blue-600' : 'text-slate-400'}`} />
                  )}
                </div>
                <p className="mt-4 text-sm text-slate-600">{formatSessionDate(session.sessionDate)}</p>
                <p className="mt-1 text-sm text-slate-500">
                  {session.startTime || '00:00'} – {session.endTime || '23:59'}
                  <span className="ml-1 text-xs">({session.timeZone || 'Asia/Colombo'})</span>
                </p>
                <p className={`mt-3 text-sm font-semibold ${
                  session.attendance ? 'text-emerald-700' : session.checkInState === 'OPEN' ? 'text-blue-700' : 'text-slate-500'
                }`}>
                  {getWindowLabel(session)}
                </p>
              </div>

              {session.checkInState === 'OPEN' && !session.attendance ? (
                <button
                  type="button"
                  onClick={() => void handleCheckIn(session)}
                  disabled={checkingIn === session._id}
                  className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-blue-700 disabled:opacity-50"
                >
                  <CalendarCheck className="h-4 w-4" />
                  <span>{checkingIn === session._id ? 'Checking in...' : 'Mark My Attendance'}</span>
                </button>
              ) : (
                <div className="mt-5 h-10" />
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
};
