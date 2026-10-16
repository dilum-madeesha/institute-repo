import React, { useState, useEffect } from 'react';
import { ShieldCheck, Search, Filter, RefreshCw } from 'lucide-react';
import api from '../../api/client';
import { AuditLog } from '../../types';

export const AuditLogList: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState('');
  const [entityFilter, setEntityFilter] = useState('');

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (actionFilter) params.action = actionFilter;
      if (entityFilter) params.entityType = entityFilter;

      const res = await api.get('/audit-logs', { params });
      setLogs(res.data);
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [actionFilter, entityFilter]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Security & Audit Logs</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Immutable log of sensitive actions, authentication events, attendance corrections, and system changes
          </p>
        </div>

        <button
          onClick={fetchLogs}
          className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          <span>Refresh Logs</span>
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col sm:flex-row items-center gap-3">
        <div className="w-full sm:w-64">
          <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
            Action Filter
          </label>
          <input
            type="text"
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            placeholder="e.g. ATTENDANCE_CORRECTED"
            className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="w-full sm:w-64">
          <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
            Entity Type
          </label>
          <select
            value={entityFilter}
            onChange={(e) => setEntityFilter(e.target.value)}
            className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Entity Types</option>
            <option value="AttendanceRecord">AttendanceRecord</option>
            <option value="ClassSession">ClassSession</option>
            <option value="User">User</option>
            <option value="Student">Student</option>
            <option value="Guardian">Guardian</option>
            <option value="EmailNotification">EmailNotification</option>
          </select>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
          </div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            No audit logs found matching the filter criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50/80 text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="py-4 px-6">Timestamp</th>
                  <th className="py-4 px-6">Action</th>
                  <th className="py-4 px-6">User</th>
                  <th className="py-4 px-6">Entity</th>
                  <th className="py-4 px-6">Details</th>
                  <th className="py-4 px-6 text-right">IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono text-xs">
                {logs.map((log) => (
                  <tr key={log._id} className="hover:bg-slate-50/50 transition">
                    <td className="py-3.5 px-6 whitespace-nowrap text-slate-500">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="py-3.5 px-6 whitespace-nowrap font-sans font-bold text-slate-900">
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800">
                        {log.action}
                      </span>
                    </td>
                    <td className="py-3.5 px-6 whitespace-nowrap font-sans text-slate-700">
                      {log.userId?.fullName || 'System / Unauth'}
                    </td>
                    <td className="py-3.5 px-6 whitespace-nowrap text-slate-600">
                      <span className="font-semibold">{log.entityType}</span>{' '}
                      {log.entityId && (
                        <span className="text-slate-400 text-[10px]">({log.entityId.slice(-6)})</span>
                      )}
                    </td>
                    <td className="py-3.5 px-6 max-w-xs truncate text-slate-500" title={JSON.stringify(log.details)}>
                      {JSON.stringify(log.details || {})}
                    </td>
                    <td className="py-3.5 px-6 text-right whitespace-nowrap text-slate-400">
                      {log.ipAddress || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
