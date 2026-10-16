import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Users, Plus, Search, Mail, Phone, GraduationCap, Edit2, Trash2 } from 'lucide-react';
import api from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { Guardian } from '../../types';
import { StatusBadge } from '../../components/StatusBadge';
import { Modal } from '../../components/Modal';

export const GuardianList: React.FC = () => {
  const { isAdmin } = useAuth();
  const [guardians, setGuardians] = useState<Guardian[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Add / Edit Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingGuardianId, setDeletingGuardianId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState('');

  const fetchGuardians = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (search) params.search = search;
      const res = await api.get('/guardians', { params });
      setGuardians(res.data);
    } catch (err) {
      console.error('Failed to load guardians:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGuardians();
  }, [search]);

  const openAddModal = () => {
    setEditingId(null);
    setFullName('');
    setEmail('');
    setPhone('');
    setFormError('');
    setModalOpen(true);
  };

  const openEditModal = (g: Guardian) => {
    setEditingId(g._id);
    setFullName(g.fullName);
    setEmail(g.email);
    setPhone(g.phone || '');
    setFormError('');
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setIsSubmitting(true);

    try {
      if (editingId) {
        await api.patch(`/guardians/${editingId}`, { fullName, email, phone });
      } else {
        await api.post('/guardians', { fullName, email, phone });
      }

      setModalOpen(false);
      fetchGuardians();
    } catch (err: any) {
      setFormError(err.response?.data?.error || 'Failed to save guardian.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteGuardian = async (guardian: Guardian) => {
    if (
      !window.confirm(
        `Permanently delete ${guardian.fullName}? This will remove their student links and parent portal account.`
      )
    ) {
      return;
    }

    setDeleteError('');
    setDeletingGuardianId(guardian._id);
    try {
      await api.delete(`/guardians/${guardian._id}`);
      setGuardians((currentGuardians) =>
        currentGuardians.filter((currentGuardian) => currentGuardian._id !== guardian._id)
      );
    } catch (err: any) {
      setDeleteError(err.response?.data?.error || 'Failed to delete guardian.');
    } finally {
      setDeletingGuardianId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Parent & Guardian Contacts</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Manage guardian contact directory and verify notification delivery status
          </p>
        </div>

        <button
          onClick={openAddModal}
          className="inline-flex items-center space-x-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl shadow-md shadow-blue-500/20 transition"
        >
          <Plus className="h-4 w-4" />
          <span>Add Guardian</span>
        </button>
      </div>

      {deleteError && (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
          {deleteError}
        </div>
      )}

      {/* Search */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by guardian name, email, phone..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
          </div>
        ) : guardians.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="h-12 w-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-slate-700">No guardians registered</h3>
            <p className="text-sm text-slate-400 mt-1">Add a guardian or link them directly on the student profile.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50/80 text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="py-4 px-6">Guardian Name</th>
                  <th className="py-4 px-6">Email Address</th>
                  <th className="py-4 px-6">Phone Number</th>
                  <th className="py-4 px-6">Linked Students</th>
                  <th className="py-4 px-6">Status</th>
                  <th className="py-4 px-6 text-right">{isAdmin ? 'Actions' : 'Edit'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {guardians.map((g) => (
                  <tr key={g._id} className="hover:bg-slate-50/50 transition">
                    <td className="py-4 px-6 font-semibold text-slate-900 whitespace-nowrap">
                      {g.fullName}
                    </td>
                    <td className="py-4 px-6 font-medium text-slate-700 whitespace-nowrap">
                      {g.email}
                    </td>
                    <td className="py-4 px-6 text-slate-500 whitespace-nowrap">
                      {g.phone || '—'}
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex flex-wrap gap-1.5">
                        {g.linkedStudents && g.linkedStudents.length > 0 ? (
                          g.linkedStudents.map((ls, idx) => (
                            <Link
                              key={idx}
                              to={`/students/${ls.student?._id}`}
                              className="inline-flex items-center space-x-1 px-2.5 py-1 bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 text-xs font-medium rounded-lg transition"
                            >
                              <span>{ls.student?.displayName || ls.student?.firstName}</span>
                              <span className="text-[10px] text-slate-400">({ls.relationship})</span>
                            </Link>
                          ))
                        ) : (
                          <span className="text-xs text-slate-400 italic">No students linked</span>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-6 whitespace-nowrap">
                      <StatusBadge status={g.status} />
                    </td>
                    <td className="py-4 px-6 text-right whitespace-nowrap">
                      <div className="inline-flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => openEditModal(g)}
                          aria-label={`Edit ${g.fullName}`}
                          className="p-1.5 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-slate-100 transition"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() => handleDeleteGuardian(g)}
                            disabled={deletingGuardianId === g._id}
                            aria-label={`Delete ${g.fullName}`}
                            title="Delete guardian"
                            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span>{deletingGuardianId === g._id ? 'Deleting...' : 'Delete'}</span>
                          </button>
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

      {/* Add / Edit Guardian Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? 'Edit Guardian Details' : 'Add New Parent / Guardian'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && (
            <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm border border-red-200">
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
              placeholder="e.g. Carlos Rivera"
              className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Email Address *
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="carlos@parent.local"
              className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Phone Number (Optional)
            </label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="555-0101"
              className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition disabled:opacity-50"
            >
              {isSubmitting ? 'Saving...' : editingId ? 'Update Guardian' : 'Save Guardian'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
