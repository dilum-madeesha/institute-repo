import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Mail, Search, Filter, RotateCw, AlertCircle, CheckCircle2, AlertTriangle, Clock } from 'lucide-react';
import api from '../../api/client';
import { EmailNotification } from '../../types';
import { StatusBadge } from '../../components/StatusBadge';

export const NotificationList: React.FC = () => {
  const [notifications, setNotifications] = useState<EmailNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (statusFilter) params.status = statusFilter;
      if (search) params.search = search;

      const res = await api.get('/notifications', { params });
      setNotifications(res.data);
    } catch (err) {
      console.error('Failed to load notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, [statusFilter, search]);

  const handleManualRetry = async (id: string) => {
    try {
      setRetryingId(id);
      setActionMessage(null);
      await api.post(`/notifications/${id}/retry`);
      setActionMessage('Notification queued for immediate dispatch.');
      fetchNotifications();
    } catch (err: any) {
      setActionMessage(err.response?.data?.error || 'Failed to trigger retry.');
    } finally {
      setRetryingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Parent Email Notifications</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Audit logs of automated absence notification dispatches with retry monitoring
          </p>
        </div>

        <button
          onClick={fetchNotifications}
          className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition"
        >
          <RotateCw className="h-3.5 w-3.5" />
          <span>Refresh Queue</span>
        </button>
      </div>

      {actionMessage && (
        <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-800 text-xs font-semibold flex items-center space-x-2">
          <Clock className="h-4 w-4 text-blue-600 shrink-0" />
          <span>{actionMessage}</span>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search email, recipient name..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
          />
        </div>

        <div className="flex items-center space-x-3 w-full sm:w-auto">
          <Filter className="h-4 w-4 text-slate-400 shrink-0" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full sm:w-auto px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Notification Statuses</option>
            <option value="SENT">Sent Successfully</option>
            <option value="FAILED">Failed</option>
            <option value="SKIPPED">Skipped (Missing Contact)</option>
            <option value="PENDING">Pending / Processing</option>
          </select>
        </div>
      </div>

      {/* Table Card */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-12 text-center">
            <Mail className="h-12 w-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-slate-700">No notifications in log</h3>
            <p className="text-sm text-slate-400 mt-1">
              Finalizing an attendance session with absent students will automatically generate notifications here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50/80 text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="py-4 px-6">Student</th>
                  <th className="py-4 px-6">Guardian Recipient</th>
                  <th className="py-4 px-6">Class & Session Date</th>
                  <th className="py-4 px-6">Status</th>
                  <th className="py-4 px-6">Details / Sent Time</th>
                  <th className="py-4 px-6 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {notifications.map((n) => {
                  const student = n.studentId;
                  const session = n.classSessionId;

                  return (
                    <tr key={n._id} className="hover:bg-slate-50/50 transition">
                      <td className="py-4 px-6 whitespace-nowrap">
                        <Link
                          to={`/students/${student?._id}`}
                          className="font-semibold text-slate-900 hover:text-blue-600 transition"
                        >
                          {student?.displayName || `${student?.firstName} ${student?.lastName}`}
                        </Link>
                        {student?.studentNumber && (
                          <span className="block text-xs font-mono text-slate-400">
                            {student.studentNumber}
                          </span>
                        )}
                      </td>

                      <td className="py-4 px-6 whitespace-nowrap">
                        <div className="font-medium text-slate-800">
                          {n.recipientName || 'Guardian'}
                        </div>
                        <div className="text-xs text-slate-500 font-mono">{n.recipientEmail}</div>
                      </td>

                      <td className="py-4 px-6 whitespace-nowrap">
                        <div className="font-semibold text-slate-800">
                          {session?.classId?.name || 'Class'}
                        </div>
                        <div className="text-xs text-slate-400">
                          {session?.sessionDate ? new Date(session.sessionDate).toLocaleDateString() : '—'}
                        </div>
                      </td>

                      <td className="py-4 px-6 whitespace-nowrap">
                        <StatusBadge status={n.status} />
                        {n.attemptCount > 0 && (
                          <span className="text-[11px] text-slate-400 block mt-0.5">
                            Attempts: {n.attemptCount}
                          </span>
                        )}
                      </td>

                      <td className="py-4 px-6 text-xs max-w-xs">
                        {n.status === 'SENT' && n.sentAt && (
                          <span className="text-emerald-700 font-medium">
                            Dispatched on {new Date(n.sentAt).toLocaleString()}
                          </span>
                        )}
                        {n.lastError && (
                          <span className="text-rose-600 font-medium block truncate" title={n.lastError}>
                            {n.lastError}
                          </span>
                        )}
                        {n.status === 'SKIPPED' && (
                          <span className="text-slate-500 italic">No valid guardian email</span>
                        )}
                      </td>

                      <td className="py-4 px-6 text-right whitespace-nowrap">
                        {(n.status === 'FAILED' || n.status === 'SKIPPED') && (
                          <button
                            onClick={() => handleManualRetry(n._id)}
                            disabled={retryingId === n._id}
                            className="inline-flex items-center space-x-1 px-3 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-bold rounded-lg transition disabled:opacity-50"
                          >
                            <RotateCw
                              className={`h-3 w-3 ${retryingId === n._id ? 'animate-spin' : ''}`}
                            />
                            <span>Retry Send</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
