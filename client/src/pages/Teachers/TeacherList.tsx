import React, { useState, useEffect } from 'react';
import { Users, Search, Plus, Mail, Phone, School, BookOpen, UserCheck, ShieldCheck, Trash2, Pencil } from 'lucide-react';
import api from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { User, ClassItem } from '../../types';
import { StatusBadge } from '../../components/StatusBadge';
import { Modal } from '../../components/Modal';

export const TeacherList: React.FC = () => {
  const { isAdmin } = useAuth();
  const [teachers, setTeachers] = useState<User[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deletingTeacherId, setDeletingTeacherId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState('');

  // Add Teacher Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('Teacher@123456');
  const [phone, setPhone] = useState('');
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<User | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [teachersRes, classesRes] = await Promise.all([
        api.get('/users?role=TEACHER'),
        api.get('/classes?status=ACTIVE'),
      ]);
      setTeachers(teachersRes.data);
      setClasses(classesRes.data);
    } catch (err) {
      console.error('Failed to load teachers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setIsSubmitting(true);

    try {
      if (editingTeacher) {
        await api.patch(`/users/${editingTeacher._id || editingTeacher.id}`, {
          fullName,
          email,
          ...(password ? { password } : {}),
        });
      } else {
        await api.post('/users', {
          fullName,
          email,
          password,
          phone,
          role: 'TEACHER',
        });
      }
      setModalOpen(false);
      setEditingTeacher(null);
      setFullName('');
      setEmail('');
      setPhone('');
      setPassword('');
      await fetchData();
    } catch (err: any) {
      setFormError(err.response?.data?.error || `Failed to ${editingTeacher ? 'update' : 'create'} teacher account.`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditTeacher = (teacher: User) => {
    setEditingTeacher(teacher);
    setFullName(teacher.fullName);
    setEmail(teacher.email);
    setPassword('');
    setFormError('');
    setModalOpen(true);
  };

  const closeTeacherModal = () => {
    setModalOpen(false);
    setEditingTeacher(null);
    setPassword('');
    setFormError('');
  };

  const handleDeleteTeacher = async (teacher: User) => {
    if (
      !window.confirm(
        `Delete ${teacher.fullName}'s teacher account? They will lose portal access and be unassigned from all classes.`
      )
    ) {
      return;
    }

    const teacherId = teacher._id || teacher.id;
    if (!teacherId) {
      setDeleteError('Unable to delete this teacher because the account ID is missing.');
      return;
    }

    setDeleteError('');
    setDeletingTeacherId(teacherId);
    try {
      await api.delete(`/users/${teacherId}`);
      setTeachers((currentTeachers) =>
        currentTeachers.filter((currentTeacher) => (currentTeacher._id || currentTeacher.id) !== teacherId)
      );
    } catch (err: any) {
      setDeleteError(err.response?.data?.error || 'Failed to delete teacher account.');
    } finally {
      setDeletingTeacherId(null);
    }
  };

  const filteredTeachers = teachers.filter(
    (t) =>
      t.fullName.toLowerCase().includes(search.toLowerCase()) ||
      t.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Faculty & Teachers</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Manage teacher profiles, subject assignments, curriculum roles, and portal credentials
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={() => {
              setEditingTeacher(null);
              setFullName('');
              setEmail('');
              setPassword('Teacher@123456');
              setPhone('');
              setFormError('');
              setModalOpen(true);
            }}
            className="inline-flex items-center space-x-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl shadow-md shadow-blue-500/20 transition"
          >
            <Plus className="h-4 w-4" />
            <span>Add New Teacher</span>
          </button>
        )}
      </div>

      {deleteError && (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
          {deleteError}
        </div>
      )}

      {/* Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search teachers by name or email address..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
          />
        </div>
      </div>

      {/* Teachers Grid */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
        </div>
      ) : filteredTeachers.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center">
          <UserCheck className="h-12 w-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-700">No teachers found</h3>
          <p className="text-sm text-slate-400 mt-1">Try modifying your search query or add a new teacher.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredTeachers.map((teacher) => {
            const assignedClasses = classes.filter((c) =>
              c.teachers?.some((t) => (t._id || t.id) === (teacher._id || teacher.id))
            );

            return (
              <div
                key={teacher._id || teacher.id}
                className="bg-white rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition p-6 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="flex items-center space-x-3">
                      <div className="h-12 w-12 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center font-bold text-lg">
                        {teacher.fullName.charAt(0)}
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-slate-900 leading-tight">{teacher.fullName}</h3>
                        <span className="inline-flex items-center space-x-1 text-xs text-emerald-600 font-semibold mt-0.5">
                          <ShieldCheck className="h-3 w-3" />
                          <span>Faculty Staff</span>
                        </span>
                      </div>
                    </div>
                    <StatusBadge status={teacher.status} />
                  </div>

                  <div className="space-y-2 text-xs text-slate-600 pt-2 border-t border-slate-100">
                    <div className="flex items-center space-x-2">
                      <Mail className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{teacher.email}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <BookOpen className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      <span>{assignedClasses.length} Assigned Class{assignedClasses.length !== 1 ? 'es' : ''}</span>
                    </div>
                  </div>

                  {/* Assigned Classes Tags */}
                  <div className="mt-4 pt-3 border-t border-slate-100">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                      Assigned Curriculum
                    </p>
                    {assignedClasses.length === 0 ? (
                      <p className="text-xs text-slate-400 italic">No classes currently assigned</p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {assignedClasses.map((cls) => (
                          <span
                            key={cls._id}
                            className="inline-block px-2.5 py-1 bg-blue-50 text-blue-700 text-xs font-semibold rounded-lg"
                          >
                            {cls.classCode}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-6 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                  <span>Joined {new Date(teacher.createdAt || Date.now()).toLocaleDateString()}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-emerald-600 font-semibold">• Active Portal Access</span>
                    {isAdmin && (
                      <>
                        <button
                          type="button"
                          onClick={() => openEditTeacher(teacher)}
                          aria-label={`Edit ${teacher.fullName}`}
                          title="Edit teacher"
                          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-blue-600 transition hover:bg-blue-50"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          <span>Edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteTeacher(teacher)}
                          disabled={deletingTeacherId === (teacher._id || teacher.id)}
                          aria-label={`Delete ${teacher.fullName}`}
                          title="Delete teacher"
                          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span>{deletingTeacherId === (teacher._id || teacher.id) ? 'Deleting...' : 'Delete'}</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add or Edit Teacher Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={closeTeacherModal}
        title={editingTeacher ? 'Edit Teacher Account' : 'Register New Teacher Account'}
      >
        <form onSubmit={handleCreateTeacher} className="space-y-4">
          {formError && (
            <div className="p-3 rounded-lg bg-red-50 text-red-700 text-xs border border-red-200">
              {formError}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Full Name *
            </label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Dr. Arthur Pendelton"
              className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Email Address * (Login Username)
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="teacher@school.com"
              className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className={`grid grid-cols-1 gap-3 ${editingTeacher ? '' : 'sm:grid-cols-2'}`}>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                {editingTeacher ? 'Set New Password (Optional)' : 'Temporary Password *'}
              </label>
              <input
                type="password"
                required={!editingTeacher}
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={editingTeacher ? 'Leave blank to keep current password' : 'At least 6 characters'}
                className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            {!editingTeacher && (
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Contact Phone
                </label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="555-0199"
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}
          </div>
          <p className="text-xs text-slate-500">
            Teachers sign in using the email address and password set here.
          </p>

          <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={closeTeacherModal}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition disabled:opacity-50"
            >
              {isSubmitting ? (editingTeacher ? 'Saving...' : 'Creating...') : (editingTeacher ? 'Save Changes' : 'Register Teacher')}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
