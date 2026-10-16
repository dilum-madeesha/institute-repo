import React, { useState, useEffect } from 'react';
import { Video, PlayCircle, Plus, Search, CheckCircle2, Clock, FileText, Download, ExternalLink, School, Pencil, Trash2 } from 'lucide-react';
import api from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { Lesson, ClassItem } from '../../types';
import { Modal } from '../../components/Modal';

export const LessonLibrary: React.FC = () => {
  const { user, isAdmin, isTeacher, isStudent } = useAuth();
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Video Player Modal
  const [activeVideo, setActiveVideo] = useState<Lesson | null>(null);

  // Upload Lesson Modal
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [classId, setClassId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [duration, setDuration] = useState('45 mins');
  const [attachmentName, setAttachmentName] = useState('');
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null);
  const [formError, setFormError] = useState('');
  const [actionError, setActionError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const classesRes = await api.get('/classes?status=ACTIVE');
      setClasses(classesRes.data);

      const targetClass = selectedClassId || (classesRes.data.length > 0 ? classesRes.data[0]._id : '');
      if (targetClass) {
        setSelectedClassId(targetClass);
        const lessonsRes = await api.get(`/lessons/class/${targetClass}`);
        setLessons(lessonsRes.data);
      }
    } catch (err) {
      console.error('Failed to load lessons:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedClassId]);

  const handleToggleProgress = async (lessonId: string) => {
    try {
      await api.post(`/lessons/${lessonId}/progress`);
      // Update local state
      setLessons((prev) =>
        prev.map((l) => (l._id === lessonId ? { ...l, isCompleted: !l.isCompleted } : l))
      );
    } catch (err) {
      console.error('Failed to toggle progress:', err);
    }
  };

  const handleUploadLesson = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setFormError('');
      if (Boolean(attachmentName.trim()) !== Boolean(attachmentUrl.trim())) {
        setFormError('Enter both the study material name and download URL.');
        return;
      }
      setIsSubmitting(true);
      const attachments = attachmentName.trim() && attachmentUrl.trim()
        ? editingLesson
          ? [
              { name: attachmentName.trim(), fileUrl: attachmentUrl.trim(), fileType: 'PDF' },
              ...(editingLesson.attachments || []).slice(1),
            ]
          : [{ name: attachmentName.trim(), fileUrl: attachmentUrl.trim(), fileType: 'PDF' }]
        : editingLesson?.attachments || [];
      const lessonData = {
        title,
        description,
        videoUrl,
        duration,
        attachments,
      };
      if (editingLesson) {
        await api.patch(`/lessons/${editingLesson._id}`, lessonData);
      } else {
        await api.post('/lessons', { classId: classId || selectedClassId, ...lessonData });
      }

      setUploadModalOpen(false);
      setEditingLesson(null);
      setTitle('');
      setDescription('');
      setVideoUrl('');
      setDuration('45 mins');
      setAttachmentName('');
      setAttachmentUrl('');
      setActionError('');
      if (selectedClassId) {
        const res = await api.get(`/lessons/class/${selectedClassId}`);
        setLessons(res.data);
      }
    } catch (err: any) {
      console.error('Failed to save lesson:', err);
      setFormError(err.response?.data?.error || `Failed to ${editingLesson ? 'update' : 'publish'} lesson.`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditLesson = (lesson: Lesson) => {
    setEditingLesson(lesson);
    setClassId(typeof lesson.classId === 'string' ? lesson.classId : lesson.classId._id);
    setTitle(lesson.title);
    setDescription(lesson.description || '');
    setVideoUrl(lesson.videoUrl || '');
    setDuration(lesson.duration || '');
    setAttachmentName(lesson.attachments?.[0]?.name || '');
    setAttachmentUrl(lesson.attachments?.[0]?.fileUrl || '');
    setFormError('');
    setUploadModalOpen(true);
  };

  const closeLessonModal = () => {
    setUploadModalOpen(false);
    setEditingLesson(null);
    setFormError('');
    setTitle('');
    setDescription('');
    setVideoUrl('');
    setDuration('45 mins');
    setAttachmentName('');
    setAttachmentUrl('');
  };

  const handleDeleteLesson = async (lesson: Lesson) => {
    if (!window.confirm(`Delete the video lesson "${lesson.title}"? This cannot be undone.`)) return;
    try {
      setActionError('');
      await api.delete(`/lessons/${lesson._id}`);
      setLessons((current) => current.filter((item) => item._id !== lesson._id));
    } catch (err: any) {
      console.error('Failed to delete lesson:', err);
      setActionError(err.response?.data?.error || 'Failed to delete lesson.');
    }
  };

  const filteredLessons = lessons.filter(
    (l) =>
      l.title.toLowerCase().includes(search.toLowerCase()) ||
      (l.description && l.description.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Video Lessons & Study Hub</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Stream high-definition curriculum lectures, download lecture notes and study guides, and track progress
          </p>
        </div>

        {(isAdmin || isTeacher) && (
          <button
            onClick={() => {
              setClassId(selectedClassId);
              setUploadModalOpen(true);
            }}
            className="inline-flex items-center space-x-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl shadow-md shadow-blue-500/20 transition"
          >
            <Plus className="h-4 w-4" />
            <span>Upload New Lesson</span>
          </button>
        )}
      </div>

      {/* Class Pills */}
      <div className="flex items-center space-x-2 overflow-x-auto pb-2 scrollbar-none">
        {classes.map((cls) => {
          const isSelected = cls._id === selectedClassId;
          return (
            <button
              key={cls._id}
              onClick={() => setSelectedClassId(cls._id)}
              className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition flex items-center space-x-2 ${
                isSelected
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                  : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200/80'
              }`}
            >
              <School className={`h-3.5 w-3.5 ${isSelected ? 'text-white' : 'text-slate-400'}`} />
              <span>{cls.name}</span>
            </button>
          );
        })}
      </div>

      {/* Search */}
      {actionError && (
        <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm border border-red-200">{actionError}</div>
      )}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search lessons by topic or concept..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
          />
        </div>
      </div>

      {/* Lessons Grid */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
        </div>
      ) : filteredLessons.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200/80 p-12 text-center">
          <Video className="h-12 w-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-700">No video lessons published yet</h3>
          <p className="text-sm text-slate-400 mt-1">Check back later or upload the first video lesson.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredLessons.map((lesson) => (
            <div
              key={lesson._id}
              className="bg-white rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition overflow-hidden flex flex-col justify-between"
            >
              <div>
                {/* Video Thumbnail Header */}
                <div
                  onClick={() => setActiveVideo(lesson)}
                  className="relative h-44 bg-slate-900 flex items-center justify-center cursor-pointer group overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-900/60 to-transparent" />
                  <PlayCircle className="h-14 w-14 text-white group-hover:scale-110 group-hover:text-blue-400 transition transform relative z-10 drop-shadow-lg" />
                  <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-xs text-white/90 z-10">
                    <span className="font-semibold bg-black/40 backdrop-blur-sm px-2 py-0.5 rounded">
                      {lesson.duration || '40 mins'}
                    </span>
                    {lesson.isCompleted && (
                      <span className="bg-emerald-500/90 text-white font-bold px-2 py-0.5 rounded-full text-[10px] flex items-center space-x-1">
                        <CheckCircle2 className="h-3 w-3" />
                        <span>Completed</span>
                      </span>
                    )}
                  </div>
                </div>

                <div className="p-5">
                  <h3 className="text-base font-bold text-slate-900 line-clamp-1">{lesson.title}</h3>
                  <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                    {lesson.description || 'Watch to master core concepts.'}
                  </p>

                  {/* Attachments */}
                  {lesson.attachments && lesson.attachments.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-slate-100 space-y-1.5">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Study Materials</p>
                      {lesson.attachments.map((att, i) => (
                        <a
                          key={i}
                          href={att.fileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center justify-between p-2 rounded-lg bg-slate-50 hover:bg-slate-100 text-xs font-medium text-slate-700 transition"
                        >
                          <div className="flex items-center space-x-2 truncate">
                            <FileText className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                            <span className="truncate">{att.name}</span>
                          </div>
                          <Download className="h-3.5 w-3.5 text-slate-400" />
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="p-5 pt-0">
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                  <button
                    onClick={() => setActiveVideo(lesson)}
                    className="inline-flex items-center space-x-1.5 text-xs font-bold text-blue-600 hover:text-blue-700"
                  >
                    <PlayCircle className="h-4 w-4" />
                    <span>Watch Lesson</span>
                  </button>

                  {isStudent && (
                    <button
                      onClick={() => handleToggleProgress(lesson._id)}
                      className={`text-xs font-bold px-3 py-1.5 rounded-lg transition flex items-center space-x-1 ${
                        lesson.isCompleted
                          ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>{lesson.isCompleted ? 'Marked Complete' : 'Mark Done'}</span>
                    </button>
                  )}
                </div>
                {(isAdmin || isTeacher) && (
                  <div className="mt-3 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => openEditLesson(lesson)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      <span>Edit</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteLesson(lesson)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-red-700 bg-red-50 hover:bg-red-100 rounded-lg transition"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Delete</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Video Player Modal */}
      <Modal isOpen={!!activeVideo} onClose={() => setActiveVideo(null)} title={activeVideo?.title || 'Lesson Player'}>
        <div className="space-y-4">
          <div className="relative aspect-video rounded-xl overflow-hidden bg-black flex items-center justify-center">
            {activeVideo?.videoUrl?.includes('youtube.com') || activeVideo?.videoUrl?.includes('youtu.be') ? (
              <iframe
                src={activeVideo.videoUrl.replace('watch?v=', 'embed/')}
                title={activeVideo.title}
                className="w-full h-full border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            ) : (
              <div className="text-center p-6 text-white space-y-3">
                <PlayCircle className="h-16 w-16 text-blue-500 mx-auto" />
                <p className="text-sm font-semibold">Video Stream Ready</p>
                <a
                  href={activeVideo?.videoUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition"
                >
                  <span>Open Video in New Tab</span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            )}
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">{activeVideo?.description}</p>
        </div>
      </Modal>

      {/* Upload Modal */}
      <Modal
        isOpen={uploadModalOpen}
        onClose={closeLessonModal}
        title={editingLesson ? 'Edit Video Lesson' : 'Upload Video Lesson'}
      >
        <form onSubmit={handleUploadLesson} className="space-y-4">
          {formError && (
            <div className="p-3 rounded-lg bg-red-50 text-red-700 text-xs border border-red-200">{formError}</div>
          )}
          {!editingLesson && <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Select Class *
            </label>
            <select
              value={classId || selectedClassId}
              onChange={(e) => setClassId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {classes.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name} ({c.classCode})
                </option>
              ))}
            </select>
          </div>}

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Lesson Title *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Introduction to Calculus & Derivatives"
              className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Video URL * (YouTube, Vimeo, MP4)
            </label>
            <input
              type="url"
              required
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
              className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Estimated Duration
              </label>
              <input
                type="text"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                placeholder="45 mins"
                className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Study Material PDF Name
              </label>
              <input
                type="text"
                value={attachmentName}
                onChange={(e) => setAttachmentName(e.target.value)}
                placeholder="Lecture-Notes-Ch1.pdf"
                className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Study Material Download URL
            </label>
            <input
              type="url"
              value={attachmentUrl}
              onChange={(e) => setAttachmentUrl(e.target.value)}
              placeholder="https://storage.googleapis.com/... or Google Drive link"
              className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={closeLessonModal}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition disabled:opacity-50"
            >
              {isSubmitting ? (editingLesson ? 'Saving...' : 'Publishing...') : (editingLesson ? 'Save Changes' : 'Publish Lesson')}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
