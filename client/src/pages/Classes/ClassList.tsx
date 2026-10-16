import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { School, Plus, Search, Filter, Users, Calendar, ArrowRight, UserCheck, Trash2, Pencil } from 'lucide-react';
import api from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { ClassItem, User } from '../../types';
import { StatusBadge } from '../../components/StatusBadge';
import { Modal } from '../../components/Modal';

export const ClassList: React.FC = () => {
  const { isAdmin, isTeacher, isStudent, isParent } = useAuth();
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [teachers, setTeachers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [deletingClassId, setDeletingClassId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const [editingClass, setEditingClass] = useState<ClassItem | null>(null);

  // Create modal state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [classCode, setClassCode] = useState('');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [academicYear, setAcademicYear] = useState('2026-2027');
  const [selectedTeachers, setSelectedTeachers] = useState<string[]>([]);
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchClasses = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;

      const res = await api.get('/classes', { params });
      setClasses(res.data);
    } catch (err) {
      console.error('Failed to fetch classes:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchTeachers = async () => {
    if (!isAdmin) return;
    try {
      const res = await api.get('/users?role=TEACHER&status=ACTIVE');
      setTeachers(res.data);
    } catch (err) {
      console.error('Failed to load teachers:', err);
    }
  };

  useEffect(() => {
    fetchClasses();
  }, [search, statusFilter]);

  useEffect(() => {
    fetchTeachers();
  }, [isAdmin]);

  const handleSaveClass = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setIsSubmitting(true);

    try {
      const classData = {
        name,
        classCode,
        subject,
        description,
        academicYear,
        teachers: selectedTeachers,
      };
      if (editingClass) {
        await api.patch(`/classes/${editingClass._id}`, classData);
      } else {
        await api.post('/classes', classData);
      }

      setCreateModalOpen(false);
      setEditingClass(null);
      setName('');
      setClassCode('');
      setSubject('');
      setDescription('');
      setSelectedTeachers([]);
      await fetchClasses();
    } catch (err: any) {
      setFormError(err.response?.data?.error || `Failed to ${editingClass ? 'update' : 'create'} class.`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditClass = (classItem: ClassItem) => {
    setEditingClass(classItem);
    setName(classItem.name);
    setClassCode(classItem.classCode);
    setSubject(classItem.subject);
    setDescription(classItem.description || '');
    setAcademicYear(classItem.academicYear || '');
    setSelectedTeachers(classItem.teachers?.map((teacher) => teacher._id || teacher.id).filter((id): id is string => Boolean(id)) || []);
    setFormError('');
    setCreateModalOpen(true);
  };

  const handleToggleStatus = async (classId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await api.patch(`/classes/${classId}/status`);
      fetchClasses();
    } catch (err) {
      console.error('Failed to toggle status:', err);
    }
  };

  const handleDeleteClass = async (classItem: ClassItem) => {
    if (
      !window.confirm(
        `Permanently delete ${classItem.classCode} (${classItem.name})? This also removes its enrollments, lessons, assignments, exams, attendance, and related records.`
      )
    ) {
      return;
    }

    setDeleteError('');
    setDeletingClassId(classItem._id);
    try {
      await api.delete(`/classes/${classItem._id}`);
      setClasses((currentClasses) => currentClasses.filter((currentClass) => currentClass._id !== classItem._id));
    } catch (err: any) {
      setDeleteError(err.response?.data?.error || 'Failed to delete class.');
    } finally {
      setDeletingClassId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Classes & Courses</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {isAdmin
              ? 'Manage all academy classes, curriculum subjects, and teacher assignments'
              : isTeacher
              ? 'Classes assigned to you for curriculum delivery, lessons, assignments, and attendance'
              : isStudent
              ? 'Your enrolled classes, video lessons, homework assignments, and online examinations'
              : 'Classes and subjects your children are currently enrolled in'}
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={() => {
              setEditingClass(null);
              setName('');
              setClassCode('');
              setSubject('');
              setDescription('');
              setAcademicYear('2026-2027');
              setSelectedTeachers([]);
              setFormError('');
              setCreateModalOpen(true);
            }}
            className="inline-flex items-center space-x-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl shadow-md shadow-blue-500/20 transition"
          >
            <Plus className="h-4 w-4" />
            <span>Create Class</span>
          </button>
        )}
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
            placeholder="Search by name, code, subject..."
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

      {/* Class Cards Grid */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
        </div>
      ) : classes.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center">
          <School className="h-12 w-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-700">No classes found</h3>
          <p className="text-sm text-slate-400 mt-1">Try adjusting your search or create a new class.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {classes.map((cls) => (
            <div
              key={cls._id}
              className="bg-white rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md hover:border-blue-300 transition p-6 flex flex-col justify-between group"
            >
              <Link to={`/classes/${cls._id}`} className="block flex-1">
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <span className="inline-block px-2.5 py-1 bg-blue-50 text-blue-700 text-xs font-bold rounded-lg uppercase tracking-wider">
                      {cls.classCode}
                    </span>
                    <StatusBadge status={cls.status} />
                  </div>

                  <h3 className="text-lg font-bold text-slate-900 group-hover:text-blue-600 transition">
                    {cls.name}
                  </h3>
                  <p className="text-xs font-medium text-slate-500 mt-1">{cls.subject} {cls.academicYear && `• ${cls.academicYear}`}</p>

                  {cls.description && (
                    <p className="text-xs text-slate-600 mt-2 line-clamp-2">
                      {cls.description}
                    </p>
                  )}
                </div>

                <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                  <div
                    className="flex items-center space-x-1.5"
                    aria-label={`${cls.enrolledCount || 0} students enrolled`}
                    title="Active student enrollments"
                  >
                    <Users className="h-4 w-4 text-slate-400" />
                    <span className="font-semibold text-slate-700">{cls.enrolledCount || 0}</span>
                    <span>enrolled</span>
                  </div>

                  <div className="flex items-center space-x-1.5 font-medium text-slate-600 truncate max-w-[140px]">
                    <UserCheck className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">
                      {cls.teachers && cls.teachers.length > 0
                        ? cls.teachers.map((t) => t.fullName).join(', ')
                        : 'No teacher'}
                    </span>
                  </div>
                </div>
              </Link>
              {isAdmin && (
                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    onClick={() => openEditClass(cls)}
                    aria-label={`Edit class ${cls.classCode}`}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-blue-200 px-3 py-2 text-xs font-semibold text-blue-600 transition hover:bg-blue-50"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    <span>Edit Class</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteClass(cls)}
                    disabled={deletingClassId === cls._id}
                    aria-label={`Delete class ${cls.classCode}`}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>{deletingClassId === cls._id ? 'Deleting...' : 'Delete Class'}</span>
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create or Edit Class Modal */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => {
          setCreateModalOpen(false);
          setEditingClass(null);
          setFormError('');
        }}
        title={editingClass ? 'Edit Class' : 'Create New Class'}
      >
        <form onSubmit={handleSaveClass} className="space-y-4">
          {formError && (
            <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm border border-red-200">
              {formError}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Class Name *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Grade 10 Mathematics – Saturday"
              className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Class Code * (Unique)
              </label>
              <input
                type="text"
                required
                value={classCode}
                onChange={(e) => setClassCode(e.target.value.toUpperCase())}
                placeholder="G10-MATH-SAT"
                className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-sm uppercase font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Subject *
              </label>
              <input
                type="text"
                required
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Mathematics"
                className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Academic Year / Term
            </label>
            <input
              type="text"
              value={academicYear}
              onChange={(e) => setAcademicYear(e.target.value)}
              placeholder="2026-2027"
              className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Assign Teacher(s)
            </label>
            <select
              multiple
              value={selectedTeachers}
              onChange={(e) => {
                const selected = Array.from(e.target.selectedOptions, (option) => option.value);
                setSelectedTeachers(selected);
              }}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm h-28 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {teachers.map((t) => (
                <option key={t._id || t.id} value={t._id || t.id}>
                  {t.fullName} ({t.email})
                </option>
              ))}
            </select>
            <p className="text-[11px] text-slate-400 mt-1">Hold Ctrl (Cmd) to select multiple teachers.</p>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Description (Optional)
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief course summary..."
              className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => {
                setCreateModalOpen(false);
                setEditingClass(null);
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
              {isSubmitting ? (editingClass ? 'Saving...' : 'Creating...') : (editingClass ? 'Save Changes' : 'Create Class')}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
