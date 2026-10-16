import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  GraduationCap,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  School,
  Users,
  Eye,
  Trash2,
  Pencil,
} from 'lucide-react';
import * as apiService from '../../api';
import { useAuth } from '../../context/AuthContext';
import { ClassItem, Student } from '../../types';
import { StatusBadge } from '../../components/StatusBadge';
import { Modal } from '../../components/Modal';

export const StudentList: React.FC = () => {
  const { isAdmin } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [availableClasses, setAvailableClasses] = useState<ClassItem[]>([]);
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [deletingStudentId, setDeletingStudentId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);

  // Register student modal
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [studentNumber, setStudentNumber] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchStudents = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;

      const res = await apiService.getStudents(params);
      setStudents(res.data);
    } catch (err) {
      console.error('Failed to fetch students:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, [search, statusFilter]);

  useEffect(() => {
    if (!isAdmin) return;
    apiService.getClasses()
      .then((res) => setAvailableClasses(res.data))
      .catch((err) => console.error('Failed to load classes for student enrollment:', err));
  }, [isAdmin]);

  const handleSaveStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setIsSubmitting(true);

    try {
      const isEditing = Boolean(editingStudent);
      const studentData = {
        firstName,
        lastName,
        studentNumber: studentNumber.trim(),
        displayName: `${firstName.trim()} ${lastName.trim()}`,
        email: email.trim(),
        ...(password ? { password } : {}),
        phone: phone.trim(),
        notes: notes.trim(),
      };
      let studentId: string;
      let savedStudent: Student;
      if (editingStudent) {
        await apiService.updateStudent(editingStudent._id, studentData);
        studentId = editingStudent._id;
        savedStudent = editingStudent;
      } else {
        const response = await apiService.createStudent(studentData);
        savedStudent = response.data;
        studentId = response.data._id;
      }

      if (isAdmin && studentId) {
        const currentEnrollments = (editingStudent?.enrollments || []).filter(
          (enrollment: any) => enrollment.status === 'ACTIVE'
        );
        const currentByClassId = new Map<string, any>(
          currentEnrollments.map((enrollment: any) => [
            String(enrollment.classId?._id || enrollment.classId),
            enrollment,
          ])
        );
        const selectedIds = new Set(selectedClassIds);
        const enrollmentChanges: Promise<unknown>[] = [];

        currentByClassId.forEach((enrollment, classId) => {
          if (!selectedIds.has(classId)) {
            enrollmentChanges.push(apiService.deleteEnrollment(enrollment._id));
          }
        });
        selectedClassIds.forEach((classId) => {
          if (!currentByClassId.has(classId)) {
            enrollmentChanges.push(apiService.createEnrollment({ studentId, classId }));
          }
        });

        const results = await Promise.allSettled(enrollmentChanges);
        const failedChanges = results.filter((result) => result.status === 'rejected').length;
        if (failedChanges > 0) {
          const refreshedStudent = await apiService.getStudent(studentId);
          const activeEnrollments = (refreshedStudent.data.enrollments || []).filter(
            (enrollment: any) => enrollment.status === 'ACTIVE'
          );
          setEditingStudent({ ...savedStudent, enrollments: activeEnrollments });
          setSelectedClassIds(
            activeEnrollments.map((enrollment: any) => String(enrollment.classId?._id || enrollment.classId))
          );
          await fetchStudents();
          setFormError(
            `${isEditing ? 'Student details were saved' : 'Student was registered'}, but ${failedChanges} class enrollment change(s) failed. Review the selected classes and try again.`
          );
          return;
        }
      }

      setCreateModalOpen(false);
      setEditingStudent(null);
      setSelectedClassIds([]);
      setFirstName('');
      setLastName('');
      setStudentNumber('');
      setEmail('');
      setPassword('');
      setPhone('');
      setNotes('');
      await fetchStudents();
    } catch (err: any) {
      setFormError(err.response?.data?.error || `Failed to ${editingStudent ? 'update' : 'register'} student.`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditStudent = (student: Student) => {
    setEditingStudent(student);
    setFirstName(student.firstName);
    setLastName(student.lastName);
    setStudentNumber(student.studentNumber || '');
    setEmail(student.email || '');
    setPassword('');
    setPhone(student.phone || '');
    setNotes(student.notes || '');
    setSelectedClassIds(
      (student.enrollments || [])
        .filter((enrollment: any) => enrollment.status === 'ACTIVE')
        .map((enrollment: any) => String(enrollment.classId?._id || enrollment.classId))
    );
    setFormError('');
    setCreateModalOpen(true);
  };

  const handleDeleteStudent = async (student: Student) => {
    const studentName = student.displayName || `${student.firstName} ${student.lastName}`;
    if (
      !window.confirm(
        `Permanently delete ${studentName}? This also removes their enrollments, attendance, submissions, guardian links, and student portal account.`
      )
    ) {
      return;
    }

    setDeleteError('');
    setDeletingStudentId(student._id);
    try {
      await apiService.deleteStudent(student._id);
      setStudents((currentStudents) => currentStudents.filter((currentStudent) => currentStudent._id !== student._id));
    } catch (err: any) {
      setDeleteError(err.response?.data?.error || 'Failed to delete student.');
    } finally {
      setDeletingStudentId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Student Directory</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Manage student admission records, guardian contact links, and class enrollments
          </p>
        </div>

        <button
          onClick={() => {
            setEditingStudent(null);
            setFirstName('');
            setLastName('');
            setStudentNumber('');
            setEmail('');
            setPassword('');
            setPhone('');
            setNotes('');
            setSelectedClassIds([]);
            setFormError('');
            setCreateModalOpen(true);
          }}
          className="inline-flex items-center space-x-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl shadow-md shadow-blue-500/20 transition"
        >
          <Plus className="h-4 w-4" />
          <span>Register Student</span>
        </button>
      </div>

      {deleteError && (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
          {deleteError}
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
            placeholder="Search by name, student #, email..."
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
            <option value="">All Statuses</option>
            <option value="ACTIVE">Active Only</option>
            <option value="INACTIVE">Inactive Only</option>
          </select>
        </div>
      </div>

      {/* Student List Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
          </div>
        ) : students.length === 0 ? (
          <div className="p-12 text-center">
            <GraduationCap className="h-12 w-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-slate-700">No students found</h3>
            <p className="text-sm text-slate-400 mt-1">Register a new student to populate the directory.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50/80 text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="py-4 px-6">Adm #</th>
                  <th className="py-4 px-6">Student Name</th>
                  <th className="py-4 px-6">Parent Email Status</th>
                  <th className="py-4 px-6">Enrolled Classes</th>
                  <th className="py-4 px-6">Status</th>
                  <th className="py-4 px-6 text-right">{isAdmin ? 'Actions' : 'Profile'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {students.map((st) => (
                  <tr key={st._id} className="hover:bg-slate-50/50 transition">
                    <td className="py-4 px-6 font-mono text-xs text-slate-500 whitespace-nowrap">
                      {st.studentNumber || '—'}
                    </td>
                    <td className="py-4 px-6">
                      <div className="font-semibold text-slate-900">
                        {st.displayName || `${st.firstName} ${st.lastName}`}
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        {st.email || st.phone || 'No direct contact'}
                      </div>
                    </td>
                    <td className="py-4 px-6 whitespace-nowrap">
                      {st.hasActiveGuardianEmail ? (
                        <span className="inline-flex items-center space-x-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                          <span>Parent Notified</span>
                        </span>
                      ) : (
                        <span
                          className="inline-flex items-center space-x-1.5 text-xs font-semibold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200"
                          title="No active parent email linked to this student"
                        >
                          <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                          <span>Missing Parent Contact</span>
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex flex-wrap gap-1 max-w-xs">
                        {st.enrollments && st.enrollments.length > 0 ? (
                          st.enrollments.map((e: any) => (
                            <span
                              key={e._id}
                              className="px-2 py-0.5 bg-slate-100 text-slate-700 text-xs font-medium rounded"
                            >
                              {e.classId?.classCode || 'Class'}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-slate-400 italic">Not enrolled</span>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-6 whitespace-nowrap">
                      <StatusBadge status={st.status} />
                    </td>
                    <td className="py-4 px-6 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-2">
                        <Link
                          to={`/students/${st._id}`}
                          className="inline-flex items-center space-x-1 px-3 py-1.5 bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 font-semibold text-xs rounded-lg transition"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          <span>View</span>
                        </Link>
                        {isAdmin && (
                          <>
                            <button
                              type="button"
                              onClick={() => openEditStudent(st)}
                              aria-label={`Edit ${st.displayName || `${st.firstName} ${st.lastName}`}`}
                              title="Edit student"
                              className="inline-flex items-center space-x-1 px-3 py-1.5 text-blue-600 hover:bg-blue-50 font-semibold text-xs rounded-lg transition"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              <span>Edit</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteStudent(st)}
                              disabled={deletingStudentId === st._id}
                              aria-label={`Delete ${st.displayName || `${st.firstName} ${st.lastName}`}`}
                              title="Delete student"
                              className="inline-flex items-center space-x-1 px-3 py-1.5 text-rose-600 hover:bg-rose-50 font-semibold text-xs rounded-lg transition disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              <span>{deletingStudentId === st._id ? 'Deleting...' : 'Delete'}</span>
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Register or Edit Student Modal */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => {
          setCreateModalOpen(false);
          setEditingStudent(null);
          setPassword('');
          setFormError('');
        }}
        title={editingStudent ? 'Edit Student' : 'Register New Student'}
      >
        <form onSubmit={handleSaveStudent} className="space-y-4">
          {formError && (
            <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm border border-red-200">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                First Name *
              </label>
              <input
                type="text"
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Alex"
                className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Last Name *
              </label>
              <input
                type="text"
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Rivera"
                className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Admission / Student Number (Unique if used)
            </label>
            <input
              type="text"
              value={studentNumber}
              onChange={(e) => setStudentNumber(e.target.value)}
              placeholder="e.g. STU-1009"
              className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className={`grid grid-cols-1 gap-3 ${isAdmin ? 'sm:grid-cols-2' : ''}`}>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Student Email (Optional)
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="alex@student.local"
                className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            {isAdmin && (
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  {editingStudent ? 'New Login Password (Optional)' : 'Login Password (Optional)'}
                </label>
                <input
                  type="password"
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={editingStudent ? 'Leave blank to keep current password' : 'At least 6 characters'}
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Phone Number (Optional)
            </label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="555-0109"
              className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {isAdmin && (
            <p className="text-xs text-slate-500">
              To enable student sign-in, enter the student’s email and a password. They can then sign in with these credentials to view their student portal.
            </p>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Internal Notes (Optional)
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Medical alerts, special accommodations..."
              className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {isAdmin && (
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Enrolled Classes
              </label>
              {availableClasses.length > 0 ? (
                <select
                  multiple
                  value={selectedClassIds}
                  onChange={(event) =>
                    setSelectedClassIds(Array.from(event.target.selectedOptions, (option) => option.value))
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm h-32 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {availableClasses.map((classItem) => (
                    <option
                      key={classItem._id}
                      value={classItem._id}
                      disabled={classItem.status !== 'ACTIVE' && !selectedClassIds.includes(classItem._id)}
                    >
                      {classItem.classCode} — {classItem.name} ({classItem.subject})
                      {classItem.status !== 'ACTIVE' ? ' — Inactive' : ''}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
                  No active classes are available for enrollment.
                </p>
              )}
              {availableClasses.length > 0 && (
                <p className="text-[11px] text-slate-400 mt-1">Hold Ctrl (Cmd) to select multiple classes.</p>
              )}
            </div>
          )}

          <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => {
                setCreateModalOpen(false);
                setEditingStudent(null);
                setPassword('');
                setFormError('');
              }}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition disabled:opacity-50"
            >
              {isSubmitting ? (editingStudent ? 'Saving...' : 'Registering...') : (editingStudent ? 'Save Changes' : 'Register Student')}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
