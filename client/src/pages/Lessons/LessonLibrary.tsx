import React, { useState, useEffect } from 'react';
import { Video, PlayCircle, Plus, Search, CheckCircle2, FileText, Download, ExternalLink, School, Pencil, Archive } from 'lucide-react';
import * as apiService from '../../api';
import { useAuth } from '../../context/AuthContext';
import { Lesson, ClassItem } from '../../types';
import { Modal } from '../../components/Modal';

const youtubeEmbedUrl = (value?: string): string | null => {
  if (!value) return null;
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    let videoId = '';
    if (host === 'youtu.be') {
      videoId = url.pathname.slice(1).split('/')[0];
    } else if (host === 'youtube.com' || host === 'www.youtube.com' || host === 'm.youtube.com') {
      videoId = url.searchParams.get('v') || url.pathname.match(/^\/(?:embed|shorts)\/([^/]+)/)?.[1] || '';
    }
    return /^[A-Za-z0-9_-]{6,20}$/.test(videoId)
      ? `https://www.youtube-nocookie.com/embed/${videoId}`
      : null;
  } catch {
    return null;
  }
};

export const LessonLibrary: React.FC = () => {
  const { isAdmin, isTeacher, isStudent } = useAuth();
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
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
  const [chapter, setChapter] = useState('');
  const [topic, setTopic] = useState('');
  const [order, setOrder] = useState('0');
  const [publicationStatus, setPublicationStatus] = useState<'DRAFT' | 'PUBLISHED'>('DRAFT');
  const [attachmentName, setAttachmentName] = useState('');
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [resourceFiles, setResourceFiles] = useState<File[]>([]);
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null);
  const [formError, setFormError] = useState('');
  const [actionError, setActionError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      setLoadError('');
      const classesRes = await apiService.getClasses({ status: 'ACTIVE' });
      if (!Array.isArray(classesRes.data)) {
        throw new Error('The class list response was invalid. Refresh the page or contact an administrator.');
      }
      setClasses(classesRes.data);

      const targetClass = classesRes.data.some((item: ClassItem) => item._id === selectedClassId)
        ? selectedClassId
        : classesRes.data[0]?._id || '';
      setSelectedClassId(targetClass);
      if (!targetClass) {
        setLessons([]);
        return;
      }
      const lessonsRes = await apiService.getClassLessons(targetClass);
      if (!Array.isArray(lessonsRes.data)) {
        throw new Error('The lesson list response was invalid. Refresh the page or contact an administrator.');
      }
      setLessons(lessonsRes.data);
    } catch (err: any) {
      console.error('Failed to load lessons:', err);
      setLoadError(err.response?.data?.error || err.message || 'Failed to load lessons. Please try again.');
      setLessons([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedClassId]);

  const handleToggleProgress = async (lessonId: string) => {
    try {
      await apiService.markLessonProgress(lessonId);
      // Update local state
      setLessons((prev) =>
        prev.map((l) => (l._id === lessonId ? { ...l, isCompleted: !l.isCompleted } : l))
      );
    } catch (err: any) {
      console.error('Failed to toggle progress:', err);
      setActionError(err.response?.data?.error || 'Failed to update lesson progress.');
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
      if (resourceFiles.length > 5) {
        setFormError('Upload no more than 5 resource files at a time.');
        return;
      }
      if (resourceFiles.some((file) => file.size > 10 * 1024 * 1024)) {
        setFormError('Each uploaded resource must be 10 MB or smaller.');
        return;
      }
      if ((editingLesson?.attachments.length || 0) + resourceFiles.length > 10) {
        setFormError('Lessons support up to 10 combined links and uploaded resources.');
        return;
      }
      setIsSubmitting(true);
      let attachments = editingLesson?.attachments || [];
      if (attachmentName.trim() && attachmentUrl.trim()) {
        const linkIndex = attachments.findIndex((attachment) => !attachment.fileUrl.startsWith('/api/'));
        const linkAttachment = {
          name: attachmentName.trim(),
          fileUrl: attachmentUrl.trim(),
          fileType: 'LINK',
        };
        attachments = linkIndex < 0
          ? [...attachments, linkAttachment]
          : attachments.map((attachment, index) => index === linkIndex ? linkAttachment : attachment);
      } else if (!editingLesson) {
        attachments = [];
      }
      const lessonData = {
        title,
        description,
        videoUrl,
        duration,
        chapter,
        topic,
        order: Number(order),
        publicationStatus,
        attachments,
      };
      const formData = new FormData();
      Object.entries(lessonData).forEach(([key, value]) => {
        formData.append(key, typeof value === 'object' ? JSON.stringify(value) : String(value));
      });
      resourceFiles.forEach((file) => formData.append('files', file));
      const targetClassId = editingLesson
        ? selectedClassId
        : classId || selectedClassId;
      if (editingLesson) {
        await apiService.updateLesson(editingLesson._id, formData);
      } else {
        formData.append('classId', targetClassId);
        await apiService.createLesson(formData);
      }

      setUploadModalOpen(false);
      setEditingLesson(null);
      setTitle('');
      setDescription('');
      setVideoUrl('');
      setDuration('45 mins');
      setChapter('');
      setTopic('');
      setOrder('0');
      setPublicationStatus('DRAFT');
      setAttachmentName('');
      setAttachmentUrl('');
      setResourceFiles([]);
      setActionError('');
      if (targetClassId) {
        setSelectedClassId(targetClassId);
        const res = await apiService.getClassLessons(targetClassId);
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
    setChapter(lesson.chapter || '');
    setTopic(lesson.topic || '');
    setOrder(String(lesson.order ?? 0));
    setPublicationStatus(lesson.publicationStatus === 'PUBLISHED' || (!lesson.publicationStatus && lesson.isPublished) ? 'PUBLISHED' : 'DRAFT');
    const linkAttachment = lesson.attachments?.find((attachment) => !attachment.fileUrl.startsWith('/api/'));
    setAttachmentName(linkAttachment?.name || '');
    setAttachmentUrl(linkAttachment?.fileUrl || '');
    setResourceFiles([]);
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
    setChapter('');
    setTopic('');
    setOrder('0');
    setPublicationStatus('DRAFT');
    setAttachmentName('');
    setAttachmentUrl('');
    setResourceFiles([]);
  };

  const handleArchiveLesson = async (lesson: Lesson) => {
    if (!window.confirm(`Archive "${lesson.title}"? Student progress and lesson history will be preserved.`)) return;
    try {
      setActionError('');
      await apiService.deleteLesson(lesson._id);
      setLessons((current) => current.filter((item) => item._id !== lesson._id));
    } catch (err: any) {
      console.error('Failed to archive lesson:', err);
      setActionError(err.response?.data?.error || 'Failed to archive lesson.');
    }
  };

  const handlePublishLesson = async (lesson: Lesson) => {
    try {
      setActionError('');
      await apiService.updateLesson(lesson._id, { publicationStatus: 'PUBLISHED' });
      const response = await apiService.getClassLessons(selectedClassId);
      setLessons(response.data);
    } catch (err: any) {
      console.error('Failed to publish lesson:', err);
      setActionError(err.response?.data?.error || 'Failed to publish lesson.');
    }
  };

  const downloadProtectedFile = async (fileUrl: string, fileName: string) => {
    try {
      const response = await apiService.downloadLessonFile(fileUrl.replace(/^\/api\//, ''));
      const objectUrl = URL.createObjectURL(response.data);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = fileName;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch (err: any) {
      console.error('Failed to download lesson material:', err);
      setActionError(err.response?.data?.error || 'Failed to download lesson material.');
    }
  };

  const filteredLessons = lessons.filter(
    (l) =>
      l.title.toLowerCase().includes(search.toLowerCase()) ||
      (l.description && l.description.toLowerCase().includes(search.toLowerCase())) ||
      (l.chapter && l.chapter.toLowerCase().includes(search.toLowerCase())) ||
      (l.topic && l.topic.toLowerCase().includes(search.toLowerCase()))
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

      {loadError && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {loadError}
          <button type="button" onClick={() => void fetchData()} className="ml-2 font-semibold underline">
            Retry
          </button>
        </div>
      )}

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

      {!loading && !loadError && classes.length === 0 && isStudent && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
          No active class enrollment is linked to this student account. Ask an administrator to check the student
          profile, login account link, and enrollment dates.
        </div>
      )}

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
                  onClick={() => {
                    if (lesson.videoUrl) setActiveVideo(lesson);
                  }}
                  className={`relative h-44 bg-slate-900 flex items-center justify-center group overflow-hidden ${lesson.videoUrl ? 'cursor-pointer' : 'cursor-not-allowed'}`}
                >
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-900/60 to-transparent" />
                  <PlayCircle className={`h-14 w-14 text-white transition transform relative z-10 drop-shadow-lg ${lesson.videoUrl ? 'group-hover:scale-110 group-hover:text-blue-400' : 'opacity-50'}`} />
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
                  {(isAdmin || isTeacher) && (
                    <span className={`mb-2 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      lesson.publicationStatus === 'DRAFT' || (!lesson.publicationStatus && !lesson.isPublished)
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-emerald-100 text-emerald-800'
                    }`}>
                      {lesson.publicationStatus || (lesson.isPublished ? 'PUBLISHED' : 'DRAFT')}
                    </span>
                  )}
                  <h3 className="text-base font-bold text-slate-900 line-clamp-1">{lesson.title}</h3>
                  {(lesson.chapter || lesson.topic || lesson.classId?.subject) && (
                    <p className="mt-1 text-xs font-semibold text-blue-700">
                      {[lesson.classId?.subject, lesson.chapter && `Chapter ${lesson.chapter}`, lesson.topic].filter(Boolean).join(' · ')}
                    </p>
                  )}
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
                          target={att.fileUrl.startsWith('/api/') ? undefined : '_blank'}
                          rel={att.fileUrl.startsWith('/api/') ? undefined : 'noreferrer'}
                          onClick={(event) => {
                            if (!att.fileUrl.startsWith('/api/')) return;
                            event.preventDefault();
                            void downloadProtectedFile(att.fileUrl, att.name);
                          }}
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
                    onClick={() => lesson.videoUrl && setActiveVideo(lesson)}
                    disabled={!lesson.videoUrl}
                    className="inline-flex items-center space-x-1.5 text-xs font-bold text-blue-600 hover:text-blue-700"
                  >
                    <PlayCircle className="h-4 w-4" />
                    <span>{lesson.videoUrl ? 'Watch Lesson' : 'Video not added'}</span>
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
                    {(lesson.publicationStatus === 'DRAFT' || (!lesson.publicationStatus && !lesson.isPublished)) && (
                      <button
                        type="button"
                        onClick={() => void handlePublishLesson(lesson)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition"
                      >
                        Publish
                      </button>
                    )}
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
                      onClick={() => void handleArchiveLesson(lesson)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
                    >
                      <Archive className="h-3.5 w-3.5" />
                      <span>Archive</span>
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
            {youtubeEmbedUrl(activeVideo?.videoUrl) ? (
              <iframe
                src={youtubeEmbedUrl(activeVideo?.videoUrl) || undefined}
                title={activeVideo?.title || 'Lesson video'}
                className="w-full h-full border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
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
              Description and Learning Objectives
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Explain what students will learn in this lesson."
              maxLength={10000}
              className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Video URL {publicationStatus === 'PUBLISHED' ? '*' : '(required before publishing)'} (HTTPS)
            </label>
            <input
              type="url"
              required={publicationStatus === 'PUBLISHED'}
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
                Chapter
              </label>
              <input
                type="text"
                value={chapter}
                onChange={(e) => setChapter(e.target.value)}
                placeholder="Chapter 1"
                className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Topic
              </label>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="Derivatives"
                className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Lesson Sequence
              </label>
              <input
                type="number"
                min="0"
                step="1"
                value={order}
                onChange={(e) => setOrder(e.target.value)}
                className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Publication
              </label>
              <select
                value={publicationStatus}
                onChange={(e) => setPublicationStatus(e.target.value as 'DRAFT' | 'PUBLISHED')}
                className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="DRAFT">Save as draft</option>
                <option value="PUBLISHED">Publish now</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Resource Link Name
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

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Upload Learning Resources (PDF, DOCX, JPG, PNG, WEBP; up to 5 files, 10 MB each)
            </label>
            <input
              type="file"
              multiple
              accept=".pdf,.docx,.jpg,.jpeg,.png,.webp"
              onChange={(e) => setResourceFiles(Array.from(e.target.files || []))}
              className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-sm"
            />
            {resourceFiles.length > 0 && (
              <p className="mt-1 text-xs text-slate-500">
                {resourceFiles.length} new file(s) selected. Existing uploaded resources are kept when editing.
              </p>
            )}
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
              {isSubmitting ? 'Saving...' : (editingLesson ? 'Save Changes' : publicationStatus === 'DRAFT' ? 'Save Draft' : 'Publish Lesson')}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
