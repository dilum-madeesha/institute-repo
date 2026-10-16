import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart3,
  Download,
  Filter,
  Calendar,
  AlertTriangle,
  School,
  Users,
  CheckCircle2,
  FileSpreadsheet,
} from 'lucide-react';
import api from '../../api/client';
import { ClassItem } from '../../types';
import { StatusBadge } from '../../components/StatusBadge';

export const ReportsView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'summary' | 'absences' | 'missing'>('summary');
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [summaryData, setSummaryData] = useState<any[]>([]);
  const [absenceData, setAbsenceData] = useState<any[]>([]);
  const [missingData, setMissingData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchClasses = async () => {
      try {
        const res = await api.get('/classes?status=ACTIVE');
        setClasses(res.data);
      } catch (err) {
        console.error('Failed to load classes:', err);
      }
    };
    fetchClasses();
  }, []);

  const fetchReport = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (selectedClass) params.classId = selectedClass;
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;

      if (activeTab === 'summary') {
        const res = await api.get('/reports/summary', { params });
        setSummaryData(res.data);
      } else if (activeTab === 'absences') {
        const res = await api.get('/reports/absences', { params });
        setAbsenceData(res.data);
      } else if (activeTab === 'missing') {
        const res = await api.get('/reports/missing-guardians');
        setMissingData(res.data);
      }
    } catch (err) {
      console.error('Failed to load report:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [activeTab, selectedClass, startDate, endDate]);

  const handleExportCsv = () => {
    const params = new URLSearchParams();
    if (activeTab === 'absences') params.append('type', 'absences');
    if (selectedClass) params.append('classId', selectedClass);
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);

    window.open(`/api/reports/export-csv?${params.toString()}`, '_blank');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Attendance Reports</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Statistical calculations, attendance rates, absence auditing, and contact verification
          </p>
        </div>

        {activeTab !== 'missing' && (
          <button
            onClick={handleExportCsv}
            className="inline-flex items-center space-x-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl shadow-md shadow-emerald-500/20 transition"
          >
            <Download className="h-4 w-4" />
            <span>Export to CSV</span>
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex space-x-2 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('summary')}
          className={`pb-3 px-4 text-sm font-bold border-b-2 transition ${
            activeTab === 'summary'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Attendance Performance Summary
        </button>
        <button
          onClick={() => setActiveTab('absences')}
          className={`pb-3 px-4 text-sm font-bold border-b-2 transition ${
            activeTab === 'absences'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Absence Incidents List
        </button>
        <button
          onClick={() => setActiveTab('missing')}
          className={`pb-3 px-4 text-sm font-bold border-b-2 transition ${
            activeTab === 'missing'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Missing Guardian Contacts
        </button>
      </div>

      {/* Filters Bar (Only for summary and absences) */}
      {activeTab !== 'missing' && (
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
              Class
            </label>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Classes</option>
              {classes.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name} ({c.classCode})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
              Start Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
              End Date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      )}

      {/* Content */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
          </div>
        ) : activeTab === 'summary' ? (
          summaryData.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              No finalized attendance sessions found for the chosen filters.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50/80 text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="py-4 px-6">Adm #</th>
                    <th className="py-4 px-6">Student Name</th>
                    <th className="py-4 px-6 text-center">Present</th>
                    <th className="py-4 px-6 text-center">Late</th>
                    <th className="py-4 px-6 text-center">Absent</th>
                    <th className="py-4 px-6 text-center">Excused</th>
                    <th className="py-4 px-6 text-right">Attendance Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {summaryData.map((item) => (
                    <tr key={item.studentId} className="hover:bg-slate-50/50 transition">
                      <td className="py-4 px-6 font-mono text-xs text-slate-500 whitespace-nowrap">
                        {item.studentNumber}
                      </td>
                      <td className="py-4 px-6 font-semibold text-slate-900 whitespace-nowrap">
                        <Link
                          to={`/students/${item.studentId}`}
                          className="hover:text-blue-600 transition"
                        >
                          {item.studentName}
                        </Link>
                      </td>
                      <td className="py-4 px-6 text-center font-semibold text-emerald-700">
                        {item.present}
                      </td>
                      <td className="py-4 px-6 text-center font-semibold text-amber-700">
                        {item.late}
                      </td>
                      <td className="py-4 px-6 text-center font-semibold text-rose-700">
                        {item.absent}
                      </td>
                      <td className="py-4 px-6 text-center font-semibold text-purple-700">
                        {item.excused}
                      </td>
                      <td className="py-4 px-6 text-right font-extrabold whitespace-nowrap">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-lg text-xs ${
                            item.attendancePercentage >= 90
                              ? 'bg-emerald-100 text-emerald-800'
                              : item.attendancePercentage >= 75
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {item.attendancePercentage}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : activeTab === 'absences' ? (
          absenceData.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              No absences recorded in the selected period.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50/80 text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="py-4 px-6">Session Date</th>
                    <th className="py-4 px-6">Student Name</th>
                    <th className="py-4 px-6">Admission #</th>
                    <th className="py-4 px-6">Absence Note</th>
                    <th className="py-4 px-6 text-right">Parent Email Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {absenceData.map((item) => (
                    <tr key={item.recordId} className="hover:bg-slate-50/50 transition">
                      <td className="py-4 px-6 font-semibold text-slate-900 whitespace-nowrap">
                        {new Date(item.sessionDate).toLocaleDateString()}
                      </td>
                      <td className="py-4 px-6 font-semibold text-slate-900 whitespace-nowrap">
                        <Link
                          to={`/students/${item.studentId}`}
                          className="hover:text-blue-600 transition"
                        >
                          {item.studentName}
                        </Link>
                      </td>
                      <td className="py-4 px-6 font-mono text-xs text-slate-500 whitespace-nowrap">
                        {item.studentNumber}
                      </td>
                      <td className="py-4 px-6 text-xs text-slate-500">
                        {item.note || '—'}
                      </td>
                      <td className="py-4 px-6 text-right whitespace-nowrap">
                        <StatusBadge status={item.notificationStatus} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : (
          /* Missing Guardian Contacts */
          missingData.length === 0 ? (
            <div className="p-12 text-center">
              <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-800">All Set!</p>
              <p className="text-xs text-slate-400 mt-1">
                Every actively enrolled student has an active guardian email configured.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <div className="p-4 bg-amber-50 border-b border-amber-200 text-xs text-amber-800 flex items-center space-x-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                <span>
                  The following {missingData.length} students cannot receive absence notification emails because they lack an active guardian email.
                </span>
              </div>
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50/80 text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="py-4 px-6">Adm #</th>
                    <th className="py-4 px-6">Student Name</th>
                    <th className="py-4 px-6">Contact Status</th>
                    <th className="py-4 px-6 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {missingData.map((st) => (
                    <tr key={st.studentId} className="hover:bg-slate-50/50 transition">
                      <td className="py-4 px-6 font-mono text-xs text-slate-500 whitespace-nowrap">
                        {st.studentNumber}
                      </td>
                      <td className="py-4 px-6 font-semibold text-slate-900 whitespace-nowrap">
                        {st.studentName}
                      </td>
                      <td className="py-4 px-6 text-xs text-amber-700 font-medium">
                        {st.reason}
                      </td>
                      <td className="py-4 px-6 text-right whitespace-nowrap">
                        <Link
                          to={`/students/${st.studentId}`}
                          className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold text-xs rounded-lg transition"
                        >
                          Link Guardian &rarr;
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>
    </div>
  );
};
