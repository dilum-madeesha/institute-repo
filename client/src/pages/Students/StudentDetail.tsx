import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  GraduationCap,
  Users,
  School,
  Mail,
  Phone,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Plus,
  Trash2,
  Clock,
  PieChart,
} from 'lucide-react';
import api from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { Student, Guardian } from '../../types';
import { StatusBadge } from '../../components/StatusBadge';
import { Modal } from '../../components/Modal';

export const StudentDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { isAdmin } = useAuth();

  const [student, setStudent] = useState<any>(null);
  const [attendanceRecords, setAttendanceRecords] = useState<any[]>([]);
  const [availableGuardians, setAvailableGuardians] = useState<Guardian[]>([]);
  const [loading, setLoading] = useState(true);

  // Link guardian modal state
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [guardianMode, setGuardianMode] = useState<'existing' | 'new'>('existing');
  const [selectedGuardianId, setSelectedGuardianId] = useState('');
  const [newGuardianName, setNewGuardianName] = useState('');
  const [newGuardianEmail, setNewGuardianEmail] = useState('');
  const [newGuardianPhone, setNewGuardianPhone] = useState('');
  const [relationship, setRelationship] = useState('Mother');
  const [receivesEmails, setReceivesEmails] = useState(true);
  const [isPrimary, setIsPrimary] = useState(false);
  const [linkError, setLinkError] = useState('');

  const fetchStudentData = async () => {
    try {
      setLoading(true);
      const [studentRes, attendanceRes] = await Promise.all([
        api.get(`/students/${id}`),
        api.get(`/students/${id}/attendance`),
      ]);
      setStudent(studentRes.data);
      setAttendanceRecords(attendanceRes.data);
    } catch (err) {
      console.error('Failed to load student:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchGuardians = async () => {
    try {
      const res = await api.get('/guardians');
      setAvailableGuardians(res.data);
    } catch (err) {
      console.error('Failed to load guardians:', err);
    }
  };

  useEffect(() => {
    fetchStudentData();
  }, [id]);

  useEffect(() => {
    if (linkModalOpen) {
      fetchGuardians();
    }
  }, [linkModalOpen]);

  const handleLinkGuardian = async (e: React.FormEvent) => {
    e.preventDefault();
    setLinkError('');

    try {
      let gId = selectedGuardianId;

      if (guardianMode === 'new') {
        const createRes = await api.post('/guardians', {
          fullName: newGuardianName,
          email: newGuardianEmail,
          phone: newGuardianPhone,
        });
        gId = createRes.data._id;
      }

      if (!gId) {
        setLinkError('Please select or create a guardian.');
        return;
      }

      await api.post(`/students/${id}/guardians`, {
        guardianId: gId,
        relationship,
        receivesAttendanceEmails: receivesEmails,
        isPrimaryContact: isPrimary,
      });

      setLinkModalOpen(false);
      setSelectedGuardianId('');
      setNewGuardianName('');
      setNewGuardianEmail('');
      setNewGuardianPhone('');
      fetchStudentData();
    } catch (err: any) {
      setLinkError(err.response?.data?.error || 'Failed to link guardian.');
    }
  };

  const handleToggleEmailPreference = async (guardianId: string, current: boolean) => {
    try {
      await api.patch(`/students/${id}/guardians/${guardianId}`, {
        receivesAttendanceEmails: !current,
      });
      fetchStudentData();
    } catch (err) {
      console.error('Failed to update email setting:', err);
    }
  };

  const handleUnlinkGuardian = async (guardianId: string) => {
    if (!window.confirm('Are you sure you want to unlink this guardian?')) return;

    try {
      await api.delete(`/students/${id}/guardians/${guardianId}`);
      fetchStudentData();
    } catch (err) {
      console.error('Failed to unlink guardian:', err);
    }
  };

  const handleToggleStudentStatus = async () => {
    try {
      await api.patch(`/students/${id}/status`);
      fetchStudentData();
    } catch (err) {
      console.error('Failed to toggle status:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  if (!student) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-500">Student not found.</p>
        <Link to="/students" className="text-blue-600 hover:underline mt-2 inline-block">
          &larr; Back to Students
        </Link>
      </div>
    );
  }

  const stats = student.attendanceStats || {
    totalRecords: 0,
    presentCount: 0,
    lateCount: 0,
    absentCount: 0,
    excusedCount: 0,
    attendancePercentage: 100,
  };

  return (
    <div className="space-y-6">
      {/* Back button */}
      <div>
        <Link
          to="/students"
          className="inline-flex items-center space-x-1 text-sm font-semibold text-slate-500 hover:text-slate-800 transition"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Students</span>
        </Link>
      </div>

      {/* Profile Header Card */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-6 sm:p-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-4">
            <div className="h-16 w-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold text-2xl shadow-lg shadow-blue-500/20">
              {student.firstName.charAt(0)}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                  {student.displayName || `${student.firstName} ${student.lastName}`}
                </h1>
                <StatusBadge status={student.status} />
              </div>
              <p className="font-mono text-xs font-semibold text-slate-500 mt-1">
                Admission No: {student.studentNumber || 'Not assigned'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleToggleStudentStatus}
              className={`px-4 py-2 text-xs font-semibold rounded-xl border transition ${
                student.status === 'ACTIVE'
                  ? 'border-slate-200 hover:bg-slate-50 text-slate-600'
                  : 'border-emerald-200 bg-emerald-50 text-emerald-700'
              }`}
            >
              {student.status === 'ACTIVE' ? 'Deactivate Account' : 'Reactivate Account'}
            </button>
          </div>
        </div>

        {/* Contact info grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-6 mt-6 border-t border-slate-100 text-sm">
          <div className="flex items-center space-x-2 text-slate-600">
            <Mail className="h-4 w-4 text-slate-400" />
            <span>{student.email || 'No email provided'}</span>
          </div>
          <div className="flex items-center space-x-2 text-slate-600">
            <Phone className="h-4 w-4 text-slate-400" />
            <span>{student.phone || 'No phone provided'}</span>
          </div>
          <div className="flex items-center space-x-2 text-slate-600">
            <Calendar className="h-4 w-4 text-slate-400" />
            <span>
              DOB:{' '}
              {student.dateOfBirth
                ? new Date(student.dateOfBirth).toLocaleDateString()
                : 'Not specified'}
            </span>
          </div>
        </div>
      </div>

      {/* Attendance Metrics Card */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-6 sm:p-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">Attendance Performance</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Calculated using: (Present + Late) / (Present + Late + Absent) × 100
            </p>
          </div>
          <div className="text-right">
            <span className="text-2xl sm:text-3xl font-extrabold text-blue-600">
              {stats.attendancePercentage}%
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
              Overall Rate
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-slate-100 text-center">
          <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100">
            <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-600">Present</p>
            <p className="text-xl font-bold text-emerald-800 mt-0.5">{stats.presentCount}</p>
          </div>
          <div className="p-3 bg-amber-50 rounded-xl border border-amber-100">
            <p className="text-[11px] font-bold uppercase tracking-wider text-amber-600">Late</p>
            <p className="text-xl font-bold text-amber-800 mt-0.5">{stats.lateCount}</p>
          </div>
          <div className="p-3 bg-rose-50 rounded-xl border border-rose-100">
            <p className="text-[11px] font-bold uppercase tracking-wider text-rose-600">Absent</p>
            <p className="text-xl font-bold text-rose-800 mt-0.5">{stats.absentCount}</p>
          </div>
          <div className="p-3 bg-purple-50 rounded-xl border border-purple-100">
            <p className="text-[11px] font-bold uppercase tracking-wider text-purple-600">Excused</p>
            <p className="text-xl font-bold text-purple-800 mt-0.5">{stats.excusedCount}</p>
          </div>
        </div>
      </div>

      {/* Linked Guardians Card */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-6 sm:p-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">Linked Parents & Guardians</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Receives automated absence emails when attendance is finalized.
            </p>
          </div>
          <button
            onClick={() => setLinkModalOpen(true)}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold rounded-lg transition"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Link Guardian</span>
          </button>
        </div>

        {student.guardians?.length === 0 ? (
          <div className="p-6 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
              <span>
                <strong>Warning:</strong> No parent/guardian is linked. Automated absence emails will be skipped.
              </span>
            </div>
            <button
              onClick={() => setLinkModalOpen(true)}
              className="px-3 py-1 bg-amber-600 text-white font-bold rounded-lg hover:bg-amber-700 transition"
            >
              Add Contact Now
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {student.guardians?.map((link: any) => {
              const guardian = link.guardianId;
              if (!guardian) return null;

              return (
                <div key={link._id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-semibold text-slate-900 text-sm">{guardian.fullName}</span>
                      <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">
                        {link.relationship}
                      </span>
                      {link.isPrimaryContact && (
                        <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                          Primary
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 mt-1 flex items-center space-x-4">
                      <span>{guardian.email}</span>
                      {guardian.phone && <span>• {guardian.phone}</span>}
                    </div>
                  </div>

                  <div className="flex items-center space-x-3">
                    <button
                      onClick={() =>
                        handleToggleEmailPreference(guardian._id, link.receivesAttendanceEmails)
                      }
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition ${
                        link.receivesAttendanceEmails
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                          : 'border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100'
                      }`}
                    >
                      {link.receivesAttendanceEmails
                        ? '✓ Absence Emails Active'
                        : '✕ Emails Disabled'}
                    </button>

                    <button
                      onClick={() => handleUnlinkGuardian(guardian._id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg transition"
                      title="Unlink Guardian"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Class Enrollments Card */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-6 sm:p-8">
        <h2 className="text-base font-bold text-slate-900 mb-3">Enrolled Classes</h2>
        {student.enrollments?.length === 0 ? (
          <p className="text-xs text-slate-400 py-2">Student is not currently enrolled in any classes.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {student.enrollments?.map((en: any) => (
              <div
                key={en._id}
                className="p-4 rounded-2xl border border-slate-100 bg-slate-50/50 flex items-center justify-between"
              >
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-mono text-xs font-bold text-blue-700">{en.classId?.classCode}</span>
                    <span className="text-sm font-semibold text-slate-800">{en.classId?.name}</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    Enrolled on {new Date(en.startDate).toLocaleDateString()}
                  </p>
                </div>
                <StatusBadge status={en.status} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Attendance History Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100">
          <h2 className="text-base font-bold text-slate-900">Attendance History Logs</h2>
        </div>

        {attendanceRecords.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">
            No attendance history recorded yet for this student.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50/80 text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="py-3 px-6">Date</th>
                  <th className="py-3 px-6">Class</th>
                  <th className="py-3 px-6">Status</th>
                  <th className="py-3 px-6">Arrival / Notes</th>
                  <th className="py-3 px-6">Marked By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {attendanceRecords.map((rec) => (
                  <tr key={rec._id} className="hover:bg-slate-50/50 transition">
                    <td className="py-3.5 px-6 font-semibold text-slate-900 whitespace-nowrap">
                      {new Date(rec.classSessionId?.sessionDate).toLocaleDateString()}
                    </td>
                    <td className="py-3.5 px-6 font-medium text-slate-800">
                      {rec.classSessionId?.classId?.name} ({rec.classSessionId?.classId?.classCode})
                    </td>
                    <td className="py-3.5 px-6">
                      <StatusBadge status={rec.status} />
                    </td>
                    <td className="py-3.5 px-6 text-xs text-slate-500">
                      {rec.arrivalTime && <span className="font-bold text-amber-700 mr-2">Time: {rec.arrivalTime}</span>}
                      {rec.note || '—'}
                    </td>
                    <td className="py-3.5 px-6 text-xs text-slate-400">
                      {rec.markedBy?.fullName || 'Teacher'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Link Guardian Modal */}
      <Modal isOpen={linkModalOpen} onClose={() => setLinkModalOpen(false)} title="Link Parent / Guardian">
        <form onSubmit={handleLinkGuardian} className="space-y-4">
          {linkError && (
            <div className="p-3 rounded-lg bg-red-50 text-red-700 text-xs border border-red-200">
              {linkError}
            </div>
          )}

          {/* Mode Switch */}
          <div className="flex rounded-xl bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setGuardianMode('existing')}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition ${
                guardianMode === 'existing' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
              }`}
            >
              Choose Existing Guardian
            </button>
            <button
              type="button"
              onClick={() => setGuardianMode('new')}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition ${
                guardianMode === 'new' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
              }`}
            >
              Add New Guardian
            </button>
          </div>

          {guardianMode === 'existing' ? (
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Select Guardian *
              </label>
              <select
                required={guardianMode === 'existing'}
                value={selectedGuardianId}
                onChange={(e) => setSelectedGuardianId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- Choose guardian --</option>
                {availableGuardians.map((g) => (
                  <option key={g._id} value={g._id}>
                    {g.fullName} ({g.email})
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required={guardianMode === 'new'}
                  value={newGuardianName}
                  onChange={(e) => setNewGuardianName(e.target.value)}
                  placeholder="e.g. Martha Wayne"
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    required={guardianMode === 'new'}
                    value={newGuardianEmail}
                    onChange={(e) => setNewGuardianEmail(e.target.value)}
                    placeholder="martha@parent.local"
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Phone (Optional)
                  </label>
                  <input
                    type="text"
                    value={newGuardianPhone}
                    onChange={(e) => setNewGuardianPhone(e.target.value)}
                    placeholder="555-0199"
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Relationship
              </label>
              <select
                value={relationship}
                onChange={(e) => setRelationship(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="Mother">Mother</option>
                <option value="Father">Father</option>
                <option value="Guardian">Legal Guardian</option>
                <option value="Grandparent">Grandparent</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div className="flex flex-col justify-center space-y-2 pt-4">
              <label className="flex items-center space-x-2 text-xs font-semibold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={receivesEmails}
                  onChange={(e) => setReceivesEmails(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span>Send Absence Emails</span>
              </label>

              <label className="flex items-center space-x-2 text-xs font-semibold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isPrimary}
                  onChange={(e) => setIsPrimary(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span>Primary Contact</span>
              </label>
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setLinkModalOpen(false)}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition"
            >
              Link Guardian to Student
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
