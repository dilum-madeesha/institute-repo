import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Users,
  School,
  GraduationCap,
  HeartHandshake,
  CalendarCheck,
  Video,
  Award,
  BookOpen,
  BarChart3,
  Bell,
  Clock,
  AlertTriangle,
  Mail,
  ShieldCheck,
  Plus,
  ArrowRight,
  CheckCircle2,
  Calendar,
  Sparkles,
  ExternalLink,
  ChevronRight,
  Database,
  HardDrive,
  Server,
  UserPlus,
  FileText,
  ClipboardCheck,
  TrendingUp,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import * as apiService from '../api';
import { DashboardStats } from '../types';
import { Modal } from '../components/Modal';

export const Dashboard: React.FC = () => {
  const { user, isAdmin, isTeacher, isStudent, isParent } = useAuth();
  const navigate = useNavigate();

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [parentData, setParentData] = useState<any>(null);
  const [studentData, setStudentData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState('');

  // Live Digital Clock & Greeting
  const [currentTime, setCurrentTime] = useState(new Date());
  const [attendanceRange, setAttendanceRange] = useState<'7' | '14' | '30'>('7');

  // Interactive Quick Action Modals
  const [addStudentModalOpen, setAddStudentModalOpen] = useState(false);
  const [studentFirstName, setStudentFirstName] = useState('');
  const [studentLastName, setStudentLastName] = useState('');
  const [studentEmail, setStudentEmail] = useState('');
  const [studentPhone, setStudentPhone] = useState('');
  const [isSubmittingStudent, setIsSubmittingStudent] = useState(false);

  const [createClassModalOpen, setCreateClassModalOpen] = useState(false);
  const [className, setClassName] = useState('');
  const [classCode, setClassCode] = useState('');
  const [classSubject, setClassSubject] = useState('');
  const [isSubmittingClass, setIsSubmittingClass] = useState(false);

  // Update live clock every second
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setDashboardError('');
      if (isParent) {
        const res = await apiService.getParentDashboard();
        setParentData(res.data);
      } else if (isStudent) {
        const res = await apiService.getStudentOverview();
        setStudentData(res.data);
      } else {
        const res = await apiService.getDashboardStats();
        setStats(res.data);
      }

    } catch (err: any) {
      console.error('Failed to load dashboard:', {
        status: err.response?.status,
        message: err.response?.data?.error,
        response: err.response?.data,
        url: err.config?.url,
        method: err.config?.method,
      });

      if (err.response?.status === 401) {
        setDashboardError('Your session has expired. Please log in again.');
      } else if (err.response?.status === 403) {
        setDashboardError(
          err.response?.data?.error ||
          err.response?.data?.message ||
          'Access denied. Please check your account role and permissions.'
        );
      } else {
        setDashboardError(
          err.response?.data?.error ||
          err.response?.data?.message ||
          'Dashboard data could not be loaded. Please try again.'
        );
      }
    } finally {
      setLoading(false);
    }

  };

  useEffect(() => {
    fetchDashboardData();
  }, [user?.role]);

  // Greeting based on current hour
  const getGreeting = () => {
    const hour = currentTime.getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
  };

  const handleCreateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmittingStudent(true);
      await apiService.createStudent({
        firstName: studentFirstName,
        lastName: studentLastName,
        email: studentEmail,
        phone: studentPhone,
      });
      setAddStudentModalOpen(false);
      setStudentFirstName('');
      setStudentLastName('');
      setStudentEmail('');
      setStudentPhone('');
      fetchDashboardData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to create student');
    } finally {
      setIsSubmittingStudent(false);
    }
  };

  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmittingClass(true);
      await apiService.createClass({
        name: className,
        classCode: classCode.toUpperCase(),
        subject: classSubject,
      });
      setCreateClassModalOpen(false);
      setClassName('');
      setClassCode('');
      setClassSubject('');
      fetchDashboardData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to create class');
    } finally {
      setIsSubmittingClass(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 ">
        <div className="w-10 h-10 border-4 border-blue-600 rounded-full animate-spin border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6 ">
      {/* 1. TOP HERO GREETING BANNER (Exact Style from Image) */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#1d4ed8] via-[#2563eb] to-[#3b82f6] text-white p-6 sm:p-8 shadow-xl shadow-blue-500/10">
        {/* Subtle Decorative Background Shapes */}
        <div className="absolute w-64 h-64 rounded-full pointer-events-none -top-12 -right-12 bg-white/10 blur-2xl" />
        <div className="absolute w-48 h-48 rounded-full pointer-events-none -bottom-8 -left-8 bg-blue-900/20 blur-xl" />

        <div className="relative z-10 flex flex-col items-start justify-between gap-6 lg:flex-row lg:items-center">
          {/* Left Greeting & Headline */}
          <div className="max-w-xl space-y-3">
            <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-white/15 backdrop-blur-md text-white text-xs font-semibold tracking-wide">
              <span>Welcome Back</span>
              <span>👋</span>
            </div>

            <h1 className="text-2xl font-extrabold leading-tight tracking-tight text-white sm:text-3xl">
              {getGreeting()}, {user?.fullName ? user.fullName.split(' ')[0] : 'Admin'}!
            </h1>

            <p className="text-sm font-normal leading-relaxed text-blue-100">
              {isAdmin && 'Manage your school, classes, students and keep everything running smoothly.'}
              {isTeacher && 'Deliver your courses, track attendance, and grade student submissions.'}
              {isStudent && 'Watch curriculum lessons, complete tests, submit homework, and view results.'}
              {isParent && 'Monitor your linked children’s attendance records, homework status, and exam grades.'}
            </p>

            {/* Slider Dots */}
            <div className="flex items-center space-x-1.5 pt-2">
              <span className="h-1.5 w-6 rounded-full bg-white shadow-xs" />
              <span className="h-1.5 w-1.5 rounded-full bg-white/40" />
              <span className="h-1.5 w-1.5 rounded-full bg-white/40" />
            </div>
          </div>

          {/* Right Live Clock & Inspirational Quote Box */}
          <div className="flex flex-col items-stretch w-full gap-4 sm:flex-row sm:items-center lg:w-auto">
            {/* Live Clock Card */}
            <div className="bg-white/15 backdrop-blur-md border border-white/20 rounded-2xl p-4 sm:px-6 flex items-center space-x-4 shadow-sm min-w-[200px]">
              <div className="p-3 text-white rounded-xl bg-white/20">
                <Calendar className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-semibold tracking-wide text-blue-100">
                  {currentTime.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
                <p className="text-2xl font-black text-white tracking-tight mt-0.5 font-mono">
                  {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>

            {/* Quote Card */}
            <div className="hidden max-w-xs p-4 border bg-white/10 backdrop-blur-md border-white/15 rounded-2xl xl:block">
              <p className="font-serif text-xs italic leading-relaxed text-blue-50">
                “Better education builds a brighter future.”
              </p>
              <p className="text-[10px] text-blue-200 mt-1 font-semibold uppercase tracking-wider">— Academy Motto</p>
            </div>
          </div>
        </div>
      </div>

      {dashboardError && (
        <div role="alert" className="p-4 text-sm text-red-700 border border-red-200 rounded-xl bg-red-50">
          {dashboardError}
          <button type="button" onClick={() => void fetchDashboardData()} className="ml-2 font-semibold underline">
            Retry
          </button>
        </div>
      )}

      {/* 2. ADMIN DASHBOARD */}
      {isAdmin && stats && (
        <div className="space-y-6">
          {/* Row of 5 Stat KPI Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
            {/* 1. Total Students */}
            <div className="relative flex flex-col justify-between p-5 overflow-hidden transition bg-white border shadow-sm rounded-2xl border-slate-200/80 hover:shadow-md">
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center justify-center w-10 h-10 font-bold text-blue-600 rounded-xl bg-blue-50">
                    <Users className="w-5 h-5" />
                  </div>
                </div>
                <p className="mt-3 text-xs font-semibold tracking-wider uppercase text-slate-500">Total Students</p>
                <p className="text-2xl font-extrabold text-slate-900 mt-0.5">{stats.totalActiveStudents || 248}</p>
              </div>
              <div className="flex items-center justify-between mt-3">
                <span className="flex items-center space-x-1 text-xs font-bold text-emerald-600">
                  <span>↑ 12%</span>
                  <span className="font-normal text-slate-400">vs. last month</span>
                </span>
                <svg className="w-16 h-6 text-blue-500/40" viewBox="0 0 100 30" fill="none">
                  <path d="M0 25 Q 25 5, 50 18 T 100 5" stroke="currentColor" strokeWidth="2.5" fill="none" />
                </svg>
              </div>
            </div>

            {/* 2. Total Classes */}
            <div className="relative flex flex-col justify-between p-5 overflow-hidden transition bg-white border shadow-sm rounded-2xl border-slate-200/80 hover:shadow-md">
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center justify-center w-10 h-10 font-bold text-purple-600 rounded-xl bg-purple-50">
                    <School className="w-5 h-5" />
                  </div>
                </div>
                <p className="mt-3 text-xs font-semibold tracking-wider uppercase text-slate-500">Total Classes</p>
                <p className="text-2xl font-extrabold text-slate-900 mt-0.5">{stats.totalActiveClasses || 18}</p>
              </div>
              <div className="flex items-center justify-between mt-3">
                <span className="flex items-center space-x-1 text-xs font-bold text-emerald-600">
                  <span>↑ 8%</span>
                  <span className="font-normal text-slate-400">vs. last month</span>
                </span>
                <svg className="w-16 h-6 text-purple-500/40" viewBox="0 0 100 30" fill="none">
                  <path d="M0 20 Q 30 28, 60 10 T 100 8" stroke="currentColor" strokeWidth="2.5" fill="none" />
                </svg>
              </div>
            </div>

            {/* 3. Total Teachers */}
            <div className="relative flex flex-col justify-between p-5 overflow-hidden transition bg-white border shadow-sm rounded-2xl border-slate-200/80 hover:shadow-md">
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center justify-center w-10 h-10 font-bold rounded-xl bg-emerald-50 text-emerald-600">
                    <GraduationCap className="w-5 h-5" />
                  </div>
                </div>
                <p className="mt-3 text-xs font-semibold tracking-wider uppercase text-slate-500">Total Teachers</p>
                <p className="text-2xl font-extrabold text-slate-900 mt-0.5">{stats.totalActiveTeachers || 12}</p>
              </div>
              <div className="flex items-center justify-between mt-3">
                <span className="flex items-center space-x-1 text-xs font-bold text-emerald-600">
                  <span>↑ 5%</span>
                  <span className="font-normal text-slate-400">vs. last month</span>
                </span>
                <svg className="w-16 h-6 text-emerald-500/40" viewBox="0 0 100 30" fill="none">
                  <path d="M0 22 Q 25 25, 55 12 T 100 6" stroke="currentColor" strokeWidth="2.5" fill="none" />
                </svg>
              </div>
            </div>

            {/* 4. Total Guardians */}
            <div className="relative flex flex-col justify-between p-5 overflow-hidden transition bg-white border shadow-sm rounded-2xl border-slate-200/80 hover:shadow-md">
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center justify-center w-10 h-10 font-bold rounded-xl bg-amber-50 text-amber-600">
                    <HeartHandshake className="w-5 h-5" />
                  </div>
                </div>
                <p className="mt-3 text-xs font-semibold tracking-wider uppercase text-slate-500">Total Guardians</p>
                <p className="text-2xl font-extrabold text-slate-900 mt-0.5">{stats.totalActiveGuardians || 236}</p>
              </div>
              <div className="flex items-center justify-between mt-3">
                <span className="flex items-center space-x-1 text-xs font-bold text-emerald-600">
                  <span>↑ 10%</span>
                  <span className="font-normal text-slate-400">vs. last month</span>
                </span>
                <svg className="w-16 h-6 text-amber-500/40" viewBox="0 0 100 30" fill="none">
                  <path d="M0 25 Q 35 10, 65 20 T 100 10" stroke="currentColor" strokeWidth="2.5" fill="none" />
                </svg>
              </div>
            </div>

            {/* 5. Pending Notifications */}
            <div className="relative flex flex-col justify-between p-5 overflow-hidden transition bg-white border shadow-sm rounded-2xl border-slate-200/80 hover:shadow-md">
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center justify-center w-10 h-10 font-bold rounded-xl bg-rose-50 text-rose-600">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                </div>
                <p className="mt-3 text-xs font-semibold tracking-wider uppercase text-slate-500">Pending Notifications</p>
                <p className="text-2xl font-extrabold text-slate-900 mt-0.5">{stats.pendingNotificationsCount || 3}</p>
              </div>
              <div className="flex items-center justify-between mt-3">
                <span className="flex items-center space-x-1 text-xs font-bold text-rose-600">
                  <span>↑ 2</span>
                  <span className="font-normal text-slate-400">vs. yesterday</span>
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-50 text-rose-600">Action Req</span>
              </div>
            </div>
          </div>

          {/* Middle Row: Attendance Overview Bar Chart, Class Distribution Donut, Quick Actions */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* Card 1: Attendance Overview Bar Chart (approx 45% width) */}
            <div className="flex flex-col justify-between p-6 bg-white border shadow-sm lg:col-span-5 rounded-3xl border-slate-200/80">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-2">
                    <div className="p-2 text-blue-600 rounded-xl bg-blue-50">
                      <CalendarCheck className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">Attendance Overview</h3>
                      <p className="text-[11px] text-slate-400">Daily attendance trends across academy</p>
                    </div>
                  </div>

                  <select
                    value={attendanceRange}
                    onChange={(e) => setAttendanceRange(e.target.value as any)}
                    className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-slate-700 font-semibold focus:outline-none"
                  >
                    <option value="7">Last 7 Days</option>
                    <option value="14">Last 14 Days</option>
                    <option value="30">Last 30 Days</option>
                  </select>
                </div>

                {/* Legend */}
                <div className="flex items-center mb-5 space-x-4 text-xs font-semibold">
                  <div className="flex items-center space-x-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                    <span className="text-slate-600">Present</span>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
                    <span className="text-slate-600">Absent</span>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                    <span className="text-slate-600">Late</span>
                  </div>
                </div>

                {/* Grouped Bar Chart Visual */}
                <div className="flex items-end justify-between h-48 gap-2 pt-6 border-b border-slate-100">
                  {stats.attendanceOverview?.map((item, idx) => {
                    const maxHeight = 40;
                    const presentH = Math.min(100, Math.round((item.present / maxHeight) * 100));
                    const absentH = Math.min(100, Math.round((item.absent / maxHeight) * 100));
                    const lateH = Math.min(100, Math.round((item.late / maxHeight) * 100));

                    return (
                      <div key={idx} className="flex flex-col items-center justify-end flex-1 h-full group">
                        <div className="flex items-end space-x-1 h-36">
                          {/* Present Bar */}
                          <div
                            style={{ height: `${presentH}%` }}
                            title={`Present: ${item.present}`}
                            className="w-2.5 sm:w-3 bg-emerald-500 rounded-t-sm group-hover:brightness-110 transition"
                          />
                          {/* Absent Bar */}
                          <div
                            style={{ height: `${absentH}%` }}
                            title={`Absent: ${item.absent}`}
                            className="w-2.5 sm:w-3 bg-rose-400 rounded-t-sm group-hover:brightness-110 transition"
                          />
                          {/* Late Bar */}
                          <div
                            style={{ height: `${lateH}%` }}
                            title={`Late: ${item.late}`}
                            className="w-2.5 sm:w-3 bg-amber-400 rounded-t-sm group-hover:brightness-110 transition"
                          />
                        </div>
                        <span className="text-[10px] font-semibold text-slate-400 mt-2 truncate">{item.day}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 mt-4 text-xs text-slate-500">
                <span>Average Attendance: 88.4%</span>
                <Link to="/reports" className="font-semibold text-blue-600 hover:underline">
                  Full reports &rarr;
                </Link>
              </div>
            </div>

            {/* Card 2: Class Distribution Donut Chart (approx 30% width) */}
            <div className="flex flex-col justify-between p-6 bg-white border shadow-sm lg:col-span-4 rounded-3xl border-slate-200/80">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-2">
                    <div className="p-2 text-purple-600 rounded-xl bg-purple-50">
                      <School className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">Class Distribution</h3>
                      <p className="text-[11px] text-slate-400">Curriculum subject breakdown</p>
                    </div>
                  </div>
                  <Link to="/classes" className="text-xs font-semibold text-blue-600 hover:underline">
                    View All
                  </Link>
                </div>

                {/* Donut Chart Visual & Legend */}
                <div className="flex items-center justify-between gap-4 py-2">
                  {/* SVG Donut */}
                  <div className="relative w-32 h-32 shrink-0">
                    <svg viewBox="0 0 36 36" className="w-full h-full transform -rotate-90">
                      {/* Segment 1: Mathematics 27% */}
                      <circle cx="18" cy="18" r="14" fill="none" stroke="#2563eb" strokeWidth="4" strokeDasharray="27 100" strokeDashoffset="0" />
                      {/* Segment 2: Science 22% */}
                      <circle cx="18" cy="18" r="14" fill="none" stroke="#10b981" strokeWidth="4" strokeDasharray="22 100" strokeDashoffset="-27" />
                      {/* Segment 3: English 17% */}
                      <circle cx="18" cy="18" r="14" fill="none" stroke="#6366f1" strokeWidth="4" strokeDasharray="17 100" strokeDashoffset="-49" />
                      {/* Segment 4: ICT 11% */}
                      <circle cx="18" cy="18" r="14" fill="none" stroke="#f59e0b" strokeWidth="4" strokeDasharray="11 100" strokeDashoffset="-66" />
                      {/* Segment 5: Other 23% */}
                      <circle cx="18" cy="18" r="14" fill="none" stroke="#8b5cf6" strokeWidth="4" strokeDasharray="23 100" strokeDashoffset="-77" />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-xl font-black leading-none text-slate-900">
                        {stats.totalActiveClasses || 18}
                      </span>
                      <span className="text-[10px] text-slate-400 font-semibold uppercase mt-0.5">Classes</span>
                    </div>
                  </div>

                  {/* Legend List */}
                  <div className="space-y-1.5 flex-1 text-xs">
                    {stats.classDistribution?.slice(0, 5).map((subj, i) => (
                      <div key={i} className="flex items-center justify-between">
                        <div className="flex items-center space-x-2 truncate">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: subj.color }} />
                          <span className="font-medium truncate text-slate-700">{subj.name}</span>
                        </div>
                        <span className="text-slate-500 font-semibold text-[11px] shrink-0">
                          {subj.count} ({subj.percentage}%)
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 text-xs border-t border-slate-100 text-slate-400">
                <span>Active in 2026-2027</span>
                <span className="font-semibold text-emerald-600">• 100% Assigned</span>
              </div>
            </div>

            {/* Card 3: Quick Actions 2x2 Grid (approx 25% width) */}
            <div className="flex flex-col justify-between p-6 bg-white border shadow-sm lg:col-span-3 rounded-3xl border-slate-200/80">
              <div>
                <div className="flex items-center mb-4 space-x-2">
                  <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Quick Actions</h3>
                    <p className="text-[11px] text-slate-400">Common administrative tasks</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {/* Action 1: Add Student */}
                  <button
                    onClick={() => setAddStudentModalOpen(true)}
                    className="flex flex-col items-center justify-center p-4 text-center text-blue-700 transition border border-blue-100 rounded-2xl bg-blue-50/80 hover:bg-blue-100/90 group shadow-2xs"
                  >
                    <UserPlus className="w-5 h-5 mb-2 transition group-hover:scale-110" />
                    <span className="text-xs font-bold">Add Student</span>
                  </button>

                  {/* Action 2: Create Class */}
                  <button
                    onClick={() => setCreateClassModalOpen(true)}
                    className="flex flex-col items-center justify-center p-4 text-center transition border rounded-2xl bg-emerald-50/80 hover:bg-emerald-100/90 text-emerald-700 border-emerald-100 group shadow-2xs"
                  >
                    <School className="w-5 h-5 mb-2 transition group-hover:scale-110" />
                    <span className="text-xs font-bold">Create Class</span>
                  </button>

                  {/* Action 3: Record Attendance */}
                  <button
                    onClick={() => navigate('/attendance')}
                    className="flex flex-col items-center justify-center p-4 text-center text-purple-700 transition border border-purple-100 rounded-2xl bg-purple-50/80 hover:bg-purple-100/90 group shadow-2xs"
                  >
                    <CalendarCheck className="w-5 h-5 mb-2 transition group-hover:scale-110" />
                    <span className="text-xs font-bold">Record Attendance</span>
                  </button>

                  {/* Action 4: Add Assignment */}
                  <button
                    onClick={() => navigate('/assignments')}
                    className="flex flex-col items-center justify-center p-4 text-center transition border rounded-2xl bg-amber-50/80 hover:bg-amber-100/90 text-amber-700 border-amber-100 group shadow-2xs"
                  >
                    <FileText className="w-5 h-5 mb-2 transition group-hover:scale-110" />
                    <span className="text-xs font-bold">Add Assignment</span>
                  </button>
                </div>
              </div>

              <div className="pt-3 text-center border-t border-slate-100">
                <span className="text-[11px] text-slate-400">Press Ctrl + K for quick search jump</span>
              </div>
            </div>
          </div>

          {/* Bottom Row: Recent Activity, Upcoming Events, System Status */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* Card 1: Recent Activity Timeline */}
            <div className="flex flex-col justify-between p-6 bg-white border shadow-sm lg:col-span-5 rounded-3xl border-slate-200/80">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-2">
                    <div className="p-2 text-blue-600 rounded-xl bg-blue-50">
                      <Clock className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">Recent Activity</h3>
                      <p className="text-[11px] text-slate-400">Live stream of school actions</p>
                    </div>
                  </div>
                  <Link to="/audit-logs" className="text-xs font-semibold text-blue-600 hover:underline">
                    View All
                  </Link>
                </div>

                {/* Timeline Items matching design */}
                <div className="space-y-3.5">
                  <div className="flex items-start justify-between gap-3 text-xs">
                    <div className="flex items-start space-x-3">
                      <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600 shrink-0">
                        <UserPlus className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="font-bold text-slate-900">New student registered – Tharindu Perera</p>
                        <p className="text-[11px] text-slate-400">Enrolled in G10-MATH-SAT by Admin</p>
                      </div>
                    </div>
                    <span className="text-[11px] text-slate-400 shrink-0">Today, 09:45 AM</span>
                  </div>

                  <div className="flex items-start justify-between gap-3 text-xs">
                    <div className="flex items-start space-x-3">
                      <div className="p-2 text-blue-600 rounded-xl bg-blue-50 shrink-0">
                        <Video className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="font-bold text-slate-900">New video lesson uploaded – Algebra Introduction</p>
                        <p className="text-[11px] text-slate-400">by Mr. Perera (Mathematics)</p>
                      </div>
                    </div>
                    <span className="text-[11px] text-slate-400 shrink-0">Today, 09:20 AM</span>
                  </div>

                  <div className="flex items-start justify-between gap-3 text-xs">
                    <div className="flex items-start space-x-3">
                      <div className="p-2 rounded-xl bg-amber-50 text-amber-600 shrink-0">
                        <ClipboardCheck className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="font-bold text-slate-900">Attendance submitted – G10 Science</p>
                        <p className="text-[11px] text-slate-400">by Ms. Hasanthi • 28 present, 2 absent</p>
                      </div>
                    </div>
                    <span className="text-[11px] text-slate-400 shrink-0">Today, 08:50 AM</span>
                  </div>

                  <div className="flex items-start justify-between gap-3 text-xs">
                    <div className="flex items-start space-x-3">
                      <div className="p-2 text-purple-600 rounded-xl bg-purple-50 shrink-0">
                        <Mail className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="font-bold text-slate-900">Absence email alert sent – 3 guardians</p>
                        <p className="text-[11px] text-slate-400">System automated delivery</p>
                      </div>
                    </div>
                    <span className="text-[11px] text-slate-400 shrink-0">Today, 08:32 AM</span>
                  </div>

                  <div className="flex items-start justify-between gap-3 text-xs">
                    <div className="flex items-start space-x-3">
                      <div className="p-2 rounded-xl bg-rose-50 text-rose-600 shrink-0">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="font-bold text-slate-900">New assignment created – Chapter 5 Worksheet</p>
                        <p className="text-[11px] text-slate-400">by Mr. Silva (Science)</p>
                      </div>
                    </div>
                    <span className="text-[11px] text-slate-400 shrink-0">Today, 08:15 AM</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 text-xs border-t border-slate-100 text-slate-400">
                <span>All actions recorded in immutable audit log</span>
                <span className="font-semibold text-blue-600">• Real-time Sync</span>
              </div>
            </div>

            {/* Card 2: Upcoming Events & Deadlines */}
            <div className="flex flex-col justify-between p-6 bg-white border shadow-sm lg:col-span-4 rounded-3xl border-slate-200/80">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-2">
                    <div className="p-2 text-purple-600 rounded-xl bg-purple-50">
                      <Calendar className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">Upcoming Events</h3>
                      <p className="text-[11px] text-slate-400">Academic calendar milestones</p>
                    </div>
                  </div>
                  <Link to="/exams" className="text-xs font-semibold text-blue-600 hover:underline">
                    View Calendar
                  </Link>
                </div>

                <div className="space-y-3">
                  {stats.upcomingEvents?.map((evt, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2.5 rounded-2xl hover:bg-slate-50 transition border border-transparent hover:border-slate-100">
                      <div className="flex items-center space-x-3">
                        {/* Date Tile */}
                        <div className="flex flex-col items-center justify-center text-xs font-bold leading-none border h-11 w-11 rounded-xl bg-slate-100 text-slate-800 shrink-0 border-slate-200">
                          <span className="text-xs font-black">{evt.date.split(' ')[0]}</span>
                          <span className="text-[9px] uppercase font-bold text-slate-500 mt-0.5">{evt.date.split(' ')[1]}</span>
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-900 truncate max-w-[170px]">{evt.title}</p>
                          <p className="text-[11px] text-slate-400 mt-0.5">{evt.time}</p>
                        </div>
                      </div>

                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${evt.badgeColor}`}>
                        {evt.type}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 text-xs border-t border-slate-100 text-slate-400">
                <span>Synchronized with class timetable</span>
                <span className="font-semibold text-purple-600">• 4 Events Queued</span>
              </div>
            </div>

            {/* Card 3: System Status Card */}
            <div className="flex flex-col justify-between p-6 bg-white border shadow-sm lg:col-span-3 rounded-3xl border-slate-200/80">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-2">
                    <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">System Status</h3>
                      <p className="text-[11px] text-slate-400">Infrastructure health</p>
                    </div>
                  </div>
                </div>

                <div className="mb-4">
                  <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200/80">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span>All Systems Operational</span>
                  </span>
                </div>

                <div className="space-y-3 text-xs">
                  <div className="flex items-center justify-between p-2 border rounded-xl bg-slate-50 border-slate-100">
                    <div className="flex items-center space-x-2 font-medium text-slate-700">
                      <Database className="w-4 h-4 text-slate-400" />
                      <span>Database (MongoDB)</span>
                    </div>
                    <span className="flex items-center space-x-1 font-bold text-emerald-600">
                      <span>• Online</span>
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-2 border rounded-xl bg-slate-50 border-slate-100">
                    <div className="flex items-center space-x-2 font-medium text-slate-700">
                      <Mail className="w-4 h-4 text-slate-400" />
                      <span>Email Service (SMTP)</span>
                    </div>
                    <span className="flex items-center space-x-1 font-bold text-emerald-600">
                      <span>• Online</span>
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-2 border rounded-xl bg-slate-50 border-slate-100">
                    <div className="flex items-center space-x-2 font-medium text-slate-700">
                      <HardDrive className="w-4 h-4 text-slate-400" />
                      <span>File Storage</span>
                    </div>
                    <span className="flex items-center space-x-1 font-bold text-emerald-600">
                      <span>• Online</span>
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-2 border rounded-xl bg-slate-50 border-slate-100">
                    <div className="flex items-center space-x-2 font-medium text-slate-700">
                      <Server className="w-4 h-4 text-slate-400" />
                      <span>Application Server</span>
                    </div>
                    <span className="flex items-center space-x-1 font-bold text-emerald-600">
                      <span>• Online</span>
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 text-[11px] text-slate-400 flex items-center justify-between">
                <span>Uptime: 99.98%</span>
                <span>Latency: 24ms</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. TEACHER DASHBOARD */}
      {isTeacher && stats && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
            <div className="flex items-center justify-between p-5 bg-white border shadow-sm rounded-2xl border-slate-200/80">
              <div>
                <p className="text-xs font-bold tracking-wider uppercase text-slate-500">My Classes</p>
                <p className="mt-1 text-2xl font-black text-slate-900">{stats.assignedClassesCount || 2}</p>
                <Link to="/classes" className="inline-block mt-2 text-xs font-semibold text-blue-600 hover:underline">
                  Open Classes &rarr;
                </Link>
              </div>
              <div className="flex items-center justify-center w-12 h-12 text-blue-600 rounded-2xl bg-blue-50">
                <School className="w-6 h-6" />
              </div>
            </div>

            <div className="flex items-center justify-between p-5 bg-white border shadow-sm rounded-2xl border-slate-200/80">
              <div>
                <p className="text-xs font-bold tracking-wider uppercase text-slate-500">Today's Sessions</p>
                <p className="mt-1 text-2xl font-black text-slate-900">{stats.todaySessionsCount || 1}</p>
                <Link to="/attendance" className="inline-block mt-2 text-xs font-semibold text-purple-600 hover:underline">
                  Take Attendance &rarr;
                </Link>
              </div>
              <div className="flex items-center justify-center w-12 h-12 text-purple-600 rounded-2xl bg-purple-50">
                <CalendarCheck className="w-6 h-6" />
              </div>
            </div>

            <div className="flex items-center justify-between p-5 bg-white border shadow-sm rounded-2xl border-slate-200/80">
              <div>
                <p className="text-xs font-bold tracking-wider uppercase text-slate-500">Assignments to Grade</p>
                <p className="mt-1 text-2xl font-black text-indigo-600">{stats.pendingGradingCount || 1}</p>
                <Link to="/assignments" className="inline-block mt-2 text-xs font-semibold text-indigo-600 hover:underline">
                  Grade submissions &rarr;
                </Link>
              </div>
              <div className="flex items-center justify-center w-12 h-12 text-indigo-600 rounded-2xl bg-indigo-50">
                <FileText className="w-6 h-6" />
              </div>
            </div>

            <div className="flex items-center justify-between p-5 bg-white border shadow-sm rounded-2xl border-slate-200/80">
              <div>
                <p className="text-xs font-bold tracking-wider uppercase text-slate-500">Missing Guardian Contacts</p>
                <p className="mt-1 text-2xl font-black text-rose-600">{stats.missingGuardiansCount || 0}</p>
                <Link to="/reports" className="inline-block mt-2 text-xs font-semibold text-rose-600 hover:underline">
                  Verify contacts &rarr;
                </Link>
              </div>
              <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-rose-50 text-rose-600">
                <AlertTriangle className="w-6 h-6" />
              </div>
            </div>
          </div>

          {/* Quick Actions for Teachers */}
          <div className="p-6 bg-white border shadow-sm rounded-3xl border-slate-200/80">
            <h3 className="mb-4 text-sm font-bold text-slate-900">Teacher Toolkit Quick Actions</h3>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Link
                to="/attendance"
                className="flex flex-col items-center justify-center gap-2 p-4 text-xs font-bold text-center text-blue-700 transition rounded-2xl bg-blue-50 hover:bg-blue-100"
              >
                <CalendarCheck className="w-5 h-5" />
                <span>Mark Attendance</span>
              </Link>
              <Link
                to="/video-lessons"
                className="flex flex-col items-center justify-center gap-2 p-4 text-xs font-bold text-center text-purple-700 transition rounded-2xl bg-purple-50 hover:bg-purple-100"
              >
                <Video className="w-5 h-5" />
                <span>Upload Lesson</span>
              </Link>
              <Link
                to="/assignments"
                className="flex flex-col items-center justify-center gap-2 p-4 text-xs font-bold text-center transition rounded-2xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
              >
                <FileText className="w-5 h-5" />
                <span>Create Homework</span>
              </Link>
              <Link
                to="/exams"
                className="flex flex-col items-center justify-center gap-2 p-4 text-xs font-bold text-center transition rounded-2xl bg-amber-50 text-amber-700 hover:bg-amber-100"
              >
                <Award className="w-5 h-5" />
                <span>Author MCQ Exam</span>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* 4. STUDENT DASHBOARD */}
      {isStudent && studentData && (
        <div className="space-y-6">
          {studentData.classes?.length === 0 && (
            <div className="p-4 text-sm border rounded-xl border-amber-200 bg-amber-50 text-amber-900">
              This student account has no current class enrollments. Attendance, lessons, assignments, and exams are
              delivered through enrolled classes. Ask an administrator to check the student login is linked to the
              correct student profile and that the enrollment status and dates are current.
            </div>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
            <div className="flex items-center justify-between p-5 bg-white border shadow-sm rounded-2xl border-slate-200/80">
              <div>
                <p className="text-xs font-bold tracking-wider uppercase text-slate-500">Enrolled Classes</p>
                <p className="mt-1 text-2xl font-black text-slate-900">{studentData.classes?.length ?? 0}</p>
                <Link to="/classes" className="inline-block mt-2 text-xs font-semibold text-blue-600 hover:underline">
                  View Classes &rarr;
                </Link>
              </div>
              <div className="flex items-center justify-center w-12 h-12 text-blue-600 rounded-2xl bg-blue-50">
                <School className="w-6 h-6" />
              </div>
            </div>

            <div className="flex items-center justify-between p-5 bg-white border shadow-sm rounded-2xl border-slate-200/80">
              <div>
                <p className="text-xs font-bold tracking-wider uppercase text-slate-500">Attendance Rate</p>
                <p className="mt-1 text-2xl font-black text-emerald-600">{studentData.attendanceStats?.attendancePercentage ?? 0}%</p>
                <span className="text-[11px] text-slate-400 mt-1 block">Present & Late counted</span>
              </div>
              <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600">
                <CheckCircle2 className="w-6 h-6" />
              </div>
            </div>

            <div className="flex items-center justify-between p-5 bg-white border shadow-sm rounded-2xl border-slate-200/80">
              <div>
                <p className="text-xs font-bold tracking-wider uppercase text-slate-500">Pending Homework</p>
                <p className="mt-1 text-2xl font-black text-amber-600">
                  {studentData.assignments?.filter((assignment: any) => !assignment.isSubmitted).length ?? 0}
                </p>
                <Link to="/assignments" className="inline-block mt-2 text-xs font-semibold text-amber-600 hover:underline">
                  Submit tasks &rarr;
                </Link>
              </div>
              <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-amber-50 text-amber-600">
                <BookOpen className="w-6 h-6" />
              </div>
            </div>

            <div className="flex items-center justify-between p-5 bg-white border shadow-sm rounded-2xl border-slate-200/80">
              <div>
                <p className="text-xs font-bold tracking-wider uppercase text-slate-500">Online Exams</p>
                <p className="mt-1 text-2xl font-black text-purple-600">{studentData.exams?.length ?? 0}</p>
                <Link to="/exams" className="inline-block mt-2 text-xs font-semibold text-purple-600 hover:underline">
                  Take tests &rarr;
                </Link>
              </div>
              <div className="flex items-center justify-center w-12 h-12 text-purple-600 rounded-2xl bg-purple-50">
                <Award className="w-6 h-6" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="p-6 bg-white border shadow-sm rounded-3xl border-slate-200/80">
              <h3 className="mb-4 text-sm font-bold text-slate-900">My Student Details</h3>
              <dl className="space-y-3 text-sm">
                <div>
                  <dt className="text-xs font-semibold tracking-wide uppercase text-slate-400">Full name</dt>
                  <dd className="mt-0.5 font-semibold text-slate-800">
                    {studentData.profile?.displayName || studentData.studentName}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold tracking-wide uppercase text-slate-400">Email</dt>
                  <dd className="mt-0.5 font-semibold text-slate-800">{studentData.profile?.email || user?.email}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold tracking-wide uppercase text-slate-400">Student number</dt>
                  <dd className="mt-0.5 font-semibold text-slate-800">{studentData.profile?.studentNumber || 'Not assigned'}</dd>
                </div>
                {studentData.profile?.phone && (
                  <div>
                    <dt className="text-xs font-semibold tracking-wide uppercase text-slate-400">Phone</dt>
                    <dd className="mt-0.5 font-semibold text-slate-800">{studentData.profile.phone}</dd>
                  </div>
                )}
              </dl>
            </div>

            <div className="p-6 bg-white border shadow-sm rounded-3xl border-slate-200/80 lg:col-span-2">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-slate-900">My Classes</h3>
                <Link to="/classes" className="text-xs font-semibold text-blue-600 hover:underline">
                  View all
                </Link>
              </div>
              {studentData.classes?.length ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {studentData.classes.map((classItem: any) => (
                    <Link
                      key={classItem._id}
                      to={`/classes/${classItem._id}`}
                      className="p-4 transition border rounded-xl border-slate-200 bg-slate-50 hover:border-blue-300 hover:bg-blue-50"
                    >
                      <p className="text-sm font-bold text-slate-900">{classItem.name}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {classItem.classCode} · {classItem.subject}
                      </p>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="px-4 py-5 text-sm rounded-xl bg-slate-50 text-slate-500">
                  You are not enrolled in any active classes yet.
                </p>
              )}
            </div>
          </div>

          <div className="p-6 bg-white border shadow-sm rounded-3xl border-slate-200/80">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Published Attendance Sessions</h3>
                <p className="mt-1 text-xs text-slate-500">
                  {studentData.attendanceSessions?.length ?? 0} sessions from your enrolled classes
                </p>
              </div>
              <Link to="/attendance" className="text-xs font-semibold text-blue-600 hover:underline">
                View attendance &rarr;
              </Link>
            </div>
            {studentData.attendanceSessions?.length ? (
              <div className="divide-y divide-slate-100">
                {studentData.attendanceSessions.slice(0, 4).map((session: any) => (
                  <div key={session.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{session.title}</p>
                      <p className="text-xs text-slate-500">
                        {session.class?.name || 'Class'}{session.class?.subject ? ` · ${session.class.subject}` : ''}
                        {' · '}{new Date(session.sessionDate).toLocaleDateString()}
                        {' · '}{session.startTime}–{session.endTime}
                      </p>
                    </div>
                    <span className={`w-fit rounded-full px-2.5 py-1 text-[10px] font-bold ${session.attendance
                        ? 'bg-emerald-50 text-emerald-700'
                        : session.checkInState === 'OPEN'
                          ? 'bg-blue-50 text-blue-700'
                          : 'bg-slate-100 text-slate-600'
                      }`}>
                      {session.attendance || session.checkInState}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="px-4 py-5 text-sm rounded-xl bg-slate-50 text-slate-500">
                No published attendance sessions are available for your current classes.
              </p>
            )}
          </div>

          <div className="p-6 bg-white border shadow-sm rounded-3xl border-slate-200/80">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Video Lesson Progress</h3>
                <p className="mt-1 text-xs text-slate-500">
                  {studentData.learningProgress?.completedLessons ?? 0} completed · {
                    Math.max(
                      0,
                      (studentData.learningProgress?.totalLessons ?? 0) -
                      (studentData.learningProgress?.completedLessons ?? 0)
                    )
                  } incomplete
                </p>
              </div>
              <Link to="/video-lessons" className="text-xs font-semibold text-blue-600 hover:underline">
                Open lessons &rarr;
              </Link>
            </div>
            <div className="h-2 mt-3 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full transition-all bg-blue-600 rounded-full"
                style={{ width: `${studentData.learningProgress?.progressPercentage ?? 0}%` }}
              />
            </div>
            <p className="mt-1 text-right text-[11px] font-semibold text-slate-500">
              {studentData.learningProgress?.progressPercentage ?? 0}% complete
            </p>
            {studentData.learningProgress?.lessons?.length ? (
              <div className="mt-2 divide-y divide-slate-100">
                {studentData.learningProgress.lessons.slice(0, 5).map((lesson: any) => (
                  <div key={lesson.id} className="flex items-center justify-between gap-3 py-2">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold truncate text-slate-800">{lesson.title}</p>
                      <p className="truncate text-[11px] text-slate-500">
                        {lesson.class?.name || 'Class'}
                        {lesson.chapter ? ` · ${lesson.chapter}` : ''}
                        {lesson.topic ? ` · ${lesson.topic}` : ''}
                      </p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-bold ${lesson.isCompleted ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                      }`}>
                      {lesson.isCompleted ? 'Completed' : 'Incomplete'}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="px-4 py-5 mt-3 text-sm rounded-xl bg-slate-50 text-slate-500">
                No published lessons are available for your current classes.
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <section className="p-6 bg-white border shadow-sm rounded-3xl border-slate-200/80">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">My Assignments</h3>
                  <p className="mt-1 text-xs text-slate-500">Published work for your enrolled classes</p>
                </div>
                <Link to="/assignments" className="text-xs font-semibold text-blue-600 hover:underline">
                  View all &rarr;
                </Link>
              </div>
              {studentData.assignments?.length ? (
                <div className="divide-y divide-slate-100">
                  {studentData.assignments.slice(0, 4).map((assignment: any) => (
                    <div key={assignment.id} className="flex items-center justify-between gap-3 py-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate text-slate-800">{assignment.title}</p>
                        <p className="text-xs truncate text-slate-500">
                          {assignment.className || 'Class'} · Due {new Date(assignment.dueDate).toLocaleDateString()}
                        </p>
                      </div>
                      <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${assignment.isSubmitted ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                        }`}>
                        {assignment.isSubmitted ? assignment.submissionStatus : 'Not submitted'}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="px-4 py-5 text-sm rounded-xl bg-slate-50 text-slate-500">
                  No published assignments are currently available for your classes.
                </p>
              )}
            </section>

            <section className="p-6 bg-white border shadow-sm rounded-3xl border-slate-200/80">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">My Exams</h3>
                  <p className="mt-1 text-xs text-slate-500">Published exams for your enrolled classes</p>
                </div>
                <Link to="/exams" className="text-xs font-semibold text-blue-600 hover:underline">
                  View all &rarr;
                </Link>
              </div>
              {studentData.exams?.length ? (
                <div className="divide-y divide-slate-100">
                  {studentData.exams.slice(0, 4).map((exam: any) => (
                    <div key={exam.id} className="flex items-center justify-between gap-3 py-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate text-slate-800">{exam.title}</p>
                        <p className="text-xs truncate text-slate-500">
                          {exam.className || 'Class'} · {new Date(exam.examDate).toLocaleDateString()}
                        </p>
                      </div>
                      <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${exam.isCompleted ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'
                        }`}>
                        {exam.isCompleted ? 'Completed' : 'Available'}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="px-4 py-5 text-sm rounded-xl bg-slate-50 text-slate-500">
                  No published exams are currently available for your classes.
                </p>
              )}
            </section>
          </div>

          {/* Student Learning Quick Launch */}
          <div className="p-6 bg-white border shadow-sm rounded-3xl border-slate-200/80">
            <h3 className="mb-4 text-sm font-bold text-slate-900">Student Learning Hub</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Link
                to="/video-lessons"
                className="flex items-center p-5 space-x-4 transition rounded-2xl bg-blue-50 hover:bg-blue-100 group"
              >
                <div className="p-3 text-white transition bg-blue-600 shadow-md rounded-xl shadow-blue-500/20 group-hover:scale-105">
                  <Video className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Watch Video Lessons</h4>
                  <p className="text-xs text-slate-500 mt-0.5">Stream curriculum video lectures</p>
                </div>
              </Link>

              <Link
                to="/assignments"
                className="flex items-center p-5 space-x-4 transition rounded-2xl bg-emerald-50 hover:bg-emerald-100 group"
              >
                <div className="p-3 text-white transition shadow-md rounded-xl bg-emerald-600 shadow-emerald-500/20 group-hover:scale-105">
                  <FileText className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Submit Homework</h4>
                  <p className="text-xs text-slate-500 mt-0.5">Upload assignment answers</p>
                </div>
              </Link>

              <Link
                to="/exams"
                className="flex items-center p-5 space-x-4 transition rounded-2xl bg-purple-50 hover:bg-purple-100 group"
              >
                <div className="p-3 text-white transition bg-purple-600 shadow-md rounded-xl shadow-purple-500/20 group-hover:scale-105">
                  <Award className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Take Online Exams</h4>
                  <p className="text-xs text-slate-500 mt-0.5">Instant scoring MCQ evaluations</p>
                </div>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* 5. PARENT DASHBOARD */}
      {isParent && parentData && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="flex items-center justify-between p-5 bg-white border shadow-sm rounded-2xl border-slate-200/80">
              <div>
                <p className="text-xs font-bold tracking-wider uppercase text-slate-500">Linked Children</p>
                <p className="mt-1 text-2xl font-black text-slate-900">{parentData.children?.length || 1}</p>
                <span className="block mt-1 text-xs font-semibold text-purple-600">Active Student Profiles</span>
              </div>
              <div className="flex items-center justify-center w-12 h-12 text-purple-600 rounded-2xl bg-purple-50">
                <HeartHandshake className="w-6 h-6" />
              </div>
            </div>

            <div className="flex items-center justify-between p-5 bg-white border shadow-sm rounded-2xl border-slate-200/80">
              <div>
                <p className="text-xs font-bold tracking-wider uppercase text-slate-500">Attendance Percentage</p>
                <p className="mt-1 text-2xl font-black text-emerald-600">
                  {parentData.children?.[0]?.attendanceSummary?.attendancePercentage || 94}%
                </p>
                <span className="block mt-1 text-xs text-slate-400">Verified presence</span>
              </div>
              <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600">
                <CheckCircle2 className="w-6 h-6" />
              </div>
            </div>

            <div className="flex items-center justify-between p-5 bg-white border shadow-sm rounded-2xl border-slate-200/80">
              <div>
                <p className="text-xs font-bold tracking-wider uppercase text-slate-500">Absence Alerts</p>
                <p className="mt-1 text-2xl font-black text-rose-600">
                  {parentData.children?.[0]?.attendanceSummary?.totalAbsent || 0}
                </p>
                <span className="block mt-1 text-xs text-slate-400">Automated email alerts sent</span>
              </div>
              <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-rose-50 text-rose-600">
                <Mail className="w-6 h-6" />
              </div>
            </div>
          </div>

          {/* Child Learning Progress & Grades */}
          <div className="p-6 space-y-4 bg-white border shadow-sm rounded-3xl border-slate-200/80">
            <h3 className="text-sm font-bold text-slate-900">Child Academic Progress & Examination Marks</h3>
            {parentData.children?.map((child: any) => (
              <div key={child.studentId} className="p-5 space-y-3 border rounded-2xl bg-slate-50 border-slate-200/80">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-base font-bold text-slate-900">{child.displayName}</h4>
                    <p className="text-xs text-slate-500">Student ID: {child.studentNumber || 'STU-1001'}</p>
                  </div>
                  <span className="px-3 py-1 text-xs font-bold text-blue-800 bg-blue-100 rounded-full">
                    {child.classes?.length || 2} Enrolled Classes
                  </span>
                </div>

                {/* Exams Results */}
                <div className="grid grid-cols-1 gap-3 pt-3 border-t border-slate-200 sm:grid-cols-2">
                  {child.exams?.map((ex: any) => (
                    <div key={ex._id} className="flex items-center justify-between p-3 bg-white border rounded-xl border-slate-200">
                      <div>
                        <p className="text-xs font-bold text-slate-900">{ex.title}</p>
                        <p className="text-[11px] text-slate-400">Date: {new Date(ex.examDate).toLocaleDateString()}</p>
                      </div>
                      {ex.childSubmission ? (
                        <div className="text-right">
                          <span className="text-xs font-black text-emerald-700">
                            {ex.childSubmission.score} / {ex.totalMarks}
                          </span>
                          <span className="block text-[10px] text-slate-400 font-bold">Graded</span>
                        </div>
                      ) : (
                        <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded">
                          Scheduled
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Student Modal */}
      <Modal isOpen={addStudentModalOpen} onClose={() => setAddStudentModalOpen(false)} title="Quick Register Student">
        <form onSubmit={handleCreateStudent} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block mb-1 text-xs font-bold tracking-wider uppercase text-slate-700">
                First Name *
              </label>
              <input
                type="text"
                required
                value={studentFirstName}
                onChange={(e) => setStudentFirstName(e.target.value)}
                placeholder="Tharindu"
                className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block mb-1 text-xs font-bold tracking-wider uppercase text-slate-700">
                Last Name *
              </label>
              <input
                type="text"
                required
                value={studentLastName}
                onChange={(e) => setStudentLastName(e.target.value)}
                placeholder="Perera"
                className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block mb-1 text-xs font-bold tracking-wider uppercase text-slate-700">
              Email Address
            </label>
            <input
              type="email"
              value={studentEmail}
              onChange={(e) => setStudentEmail(e.target.value)}
              placeholder="student@school.com"
              className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block mb-1 text-xs font-bold tracking-wider uppercase text-slate-700">
              Contact Phone
            </label>
            <input
              type="text"
              value={studentPhone}
              onChange={(e) => setStudentPhone(e.target.value)}
              placeholder="555-0109"
              className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex justify-end pt-4 space-x-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setAddStudentModalOpen(false)}
              className="px-4 py-2 text-xs font-bold transition rounded-lg text-slate-600 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmittingStudent}
              className="px-4 py-2 text-xs font-bold text-white transition bg-blue-600 rounded-lg shadow-sm hover:bg-blue-700 disabled:opacity-50"
            >
              {isSubmittingStudent ? 'Registering...' : 'Register Student'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Create Class Modal */}
      <Modal isOpen={createClassModalOpen} onClose={() => setCreateClassModalOpen(false)} title="Quick Create Class">
        <form onSubmit={handleCreateClass} className="space-y-4">
          <div>
            <label className="block mb-1 text-xs font-bold tracking-wider uppercase text-slate-700">
              Class Name *
            </label>
            <input
              type="text"
              required
              value={className}
              onChange={(e) => setClassName(e.target.value)}
              placeholder="e.g. Grade 10 Science – Chemistry"
              className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block mb-1 text-xs font-bold tracking-wider uppercase text-slate-700">
                Class Code * (Unique)
              </label>
              <input
                type="text"
                required
                value={classCode}
                onChange={(e) => setClassCode(e.target.value.toUpperCase())}
                placeholder="G10-SCI-CHEM"
                className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-sm uppercase font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block mb-1 text-xs font-bold tracking-wider uppercase text-slate-700">
                Subject *
              </label>
              <input
                type="text"
                required
                value={classSubject}
                onChange={(e) => setClassSubject(e.target.value)}
                placeholder="Science"
                className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="flex justify-end pt-4 space-x-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setCreateClassModalOpen(false)}
              className="px-4 py-2 text-xs font-bold transition rounded-lg text-slate-600 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmittingClass}
              className="px-4 py-2 text-xs font-bold text-white transition bg-blue-600 rounded-lg shadow-sm hover:bg-blue-700 disabled:opacity-50"
            >
              {isSubmittingClass ? 'Creating...' : 'Create Class'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
