import React, { useState, useEffect } from 'react';
import { Bell, Plus, Search, Filter, AlertTriangle, Trash2, Calendar, School, Users } from 'lucide-react';
import api from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { Announcement, ClassItem } from '../../types';
import { StatusBadge } from '../../components/StatusBadge';
import { Modal } from '../../components/Modal';

export const AnnouncementList: React.FC = () => {
  const { user, isAdmin, isTeacher } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Create Announcement Modal
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [priority, setPriority] = useState<'NORMAL' | 'HIGH' | 'URGENT'>('NORMAL');
  const [targetClassId, setTargetClassId] = useState('');
  const [targetRoles, setTargetRoles] = useState<string[]>(['STUDENT', 'PARENT', 'TEACHER']);
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchAnnouncements = async () => {
    try {
      setLoading(true);
      const res = await api.get('/announcements');
      setAnnouncements(res.data);
    } catch (err) {
      console.error('Failed to load announcements:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchClasses = async () => {
    if (isAdmin || isTeacher) {
      try {
        const res = await api.get('/classes?status=ACTIVE');
        setClasses(res.data);
      } catch (err) {
        console.error('Failed to load classes:', err);
      }
    }
  };

  useEffect(() => {
    fetchAnnouncements();
    fetchClasses();
  }, []);

  const handleCreateAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setIsSubmitting(true);

    try {
      await api.post('/announcements', {
        title,
        content,
        priority,
        classId: targetClassId || null,
        targetRoles,
      });

      setCreateModalOpen(false);
      setTitle('');
      setContent('');
      setPriority('NORMAL');
      setTargetClassId('');
      fetchAnnouncements();
    } catch (err: any) {
      setFormError(err.response?.data?.error || 'Failed to post announcement.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteAnnouncement = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this announcement?')) return;
    try {
      await api.delete(`/announcements/${id}`);
      fetchAnnouncements();
    } catch (err) {
      console.error('Failed to delete announcement:', err);
    }
  };

  const toggleTargetRole = (role: string) => {
    if (targetRoles.includes(role)) {
      setTargetRoles(targetRoles.filter((r) => r !== role));
    } else {
      setTargetRoles([...targetRoles, role]);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Announcements & Notices</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Important updates, term schedules, examination notices, and class broadcasts
          </p>
        </div>

        {(isAdmin || isTeacher) && (
          <button
            onClick={() => setCreateModalOpen(true)}
            className="inline-flex items-center space-x-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl shadow-md shadow-blue-500/20 transition"
          >
            <Plus className="h-4 w-4" />
            <span>Post Announcement</span>
          </button>
        )}
      </div>

      {/* Announcements Stream */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
        </div>
      ) : announcements.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200/80 p-12 text-center">
          <Bell className="h-12 w-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-700">No announcements yet</h3>
          <p className="text-sm text-slate-400 mt-1">Check back later for school and class broadcasts.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {announcements.map((item) => (
            <div
              key={item._id}
              className={`bg-white rounded-3xl border shadow-sm p-6 sm:p-7 transition ${
                item.priority === 'URGENT'
                  ? 'border-rose-300 ring-2 ring-rose-500/10'
                  : item.priority === 'HIGH'
                  ? 'border-amber-300'
                  : 'border-slate-200/80'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                <div className="flex items-center space-x-2">
                  <StatusBadge status={item.priority} />
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                    {item.classId ? `${item.classId.name} (${item.classId.classCode})` : 'Academy-Wide Broadcast'}
                  </span>
                </div>

                <div className="flex items-center space-x-3 text-xs text-slate-400">
                  <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                  {(isAdmin || isTeacher) && (
                    <button
                      onClick={() => handleDeleteAnnouncement(item._id)}
                      className="p-1 hover:text-rose-600 transition"
                      title="Delete Announcement"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>

              <h3 className="text-lg font-bold text-slate-900 tracking-tight">{item.title}</h3>
              <p className="text-sm text-slate-600 mt-2 whitespace-pre-line leading-relaxed">
                {item.content}
              </p>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
                <span>Posted by {item.createdBy?.fullName || 'Staff'}</span>
                <span className="capitalize">
                  Audience: {item.targetRoles && item.targetRoles.length > 0 ? item.targetRoles.join(', ') : 'Everyone'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Post Announcement Modal */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Post New Announcement"
      >
        <form onSubmit={handleCreateAnnouncement} className="space-y-4">
          {formError && (
            <div className="p-3 rounded-lg bg-red-50 text-red-700 text-xs border border-red-200">
              {formError}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Title *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Midterm Examination Schedule"
              className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Content *
            </label>
            <textarea
              required
              rows={4}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write the full announcement message..."
              className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="NORMAL">Normal</option>
                <option value="HIGH">High (Important)</option>
                <option value="URGENT">Urgent Alert</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Target Scope
              </label>
              <select
                value={targetClassId}
                onChange={(e) => setTargetClassId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Academy-Wide (All)</option>
                {classes.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name} ({c.classCode})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Audience Roles
            </label>
            <div className="flex items-center space-x-4">
              {['STUDENT', 'PARENT', 'TEACHER'].map((r) => (
                <label key={r} className="flex items-center space-x-2 text-xs font-semibold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={targetRoles.includes(r)}
                    onChange={() => toggleTargetRole(r)}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="capitalize">{r.toLowerCase()}s</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setCreateModalOpen(false)}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition disabled:opacity-50"
            >
              {isSubmitting ? 'Posting...' : 'Publish Announcement'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
