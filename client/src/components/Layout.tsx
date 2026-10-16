import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  School,
  GraduationCap,
  Users,
  HeartHandshake,
  CalendarCheck,
  Video,
  Award,
  BookOpen,
  BarChart3,
  Bell,
  ShieldCheck,
  Settings,
  Search,
  Sun,
  Moon,
  ChevronDown,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  KeyRound,
  LogOut,
  UserCheck,
  X,
  Menu,
  Check,
  Clock,
  Mail,
  AlertCircle,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Modal } from './Modal';
import api from '../api/client';

type Language = 'en' | 'si' | 'ta';

const navigationTranslations: Record<Language, Record<string, string>> = {
  en: {},
  si: {
    Dashboard: 'උපකරණ පුවරුව',
    Classes: 'පන්ති',
    Students: 'සිසුන්',
    Teachers: 'ගුරුවරුන්',
    Guardians: 'භාරකරුවන්',
    Attendance: 'පැමිණීම',
    'Video Lessons': 'වීඩියෝ පාඩම්',
    Exams: 'විභාග',
    Assignments: 'පැවරුම්',
    Reports: 'වාර්තා',
    Notifications: 'දැනුම්දීම්',
    'Audit Logs': 'විගණන වාර්තා',
    Settings: 'සැකසීම්',
    Announcements: 'නිවේදන',
    'Exams & Grades': 'විභාග සහ ලකුණු',
  },
  ta: {
    Dashboard: 'முகப்புப்பலகை',
    Classes: 'வகுப்புகள்',
    Students: 'மாணவர்கள்',
    Teachers: 'ஆசிரியர்கள்',
    Guardians: 'பாதுகாவலர்கள்',
    Attendance: 'வருகை',
    'Video Lessons': 'காணொளிப் பாடங்கள்',
    Exams: 'தேர்வுகள்',
    Assignments: 'பணிகள்',
    Reports: 'அறிக்கைகள்',
    Notifications: 'அறிவிப்புகள்',
    'Audit Logs': 'தணிக்கைப் பதிவுகள்',
    Settings: 'அமைப்புகள்',
    Announcements: 'அறிவிப்புகள்',
    'Exams & Grades': 'தேர்வுகள் மற்றும் மதிப்பெண்கள்',
  },
};

export const Layout: React.FC = () => {
  const { user, logout, isAdmin, isTeacher, isStudent, isParent } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('theme') === 'dark');
  const [language, setLanguage] = useState<Language>(() => {
    const savedLanguage = localStorage.getItem('language');
    return savedLanguage === 'si' || savedLanguage === 'ta' ? savedLanguage : 'en';
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    document.documentElement.style.colorScheme = darkMode ? 'dark' : 'light';
    localStorage.setItem('theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  useEffect(() => {
    const languageTags: Record<Language, string> = { en: 'en', si: 'si', ta: 'ta' };
    document.documentElement.lang = languageTags[language];
    localStorage.setItem('language', language);
  }, [language]);

  // Command Palette Quick Search
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);

  // Notifications Popover
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  // Change Password Modal
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [isSubmittingPassword, setIsSubmittingPassword] = useState(false);

  // Keyboard shortcut listener for Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setSearchModalOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters.');
      return;
    }

    try {
      setIsSubmittingPassword(true);
      await api.post('/auth/change-password', { currentPassword, newPassword });
      setPasswordSuccess('Password changed successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setTimeout(() => {
        setPasswordModalOpen(false);
        setPasswordSuccess('');
      }, 1500);
    } catch (err: any) {
      setPasswordError(err.response?.data?.error || 'Failed to change password.');
    } finally {
      setIsSubmittingPassword(false);
    }
  };

  // Build the 12 primary menu navigation links matching the design
  let navItems: Array<{
    to: string;
    label: string;
    icon: any;
    badge?: string | number;
  }> = [];

  if (isAdmin) {
    navItems = [
      { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { to: '/classes', label: 'Classes', icon: School },
      { to: '/students', label: 'Students', icon: GraduationCap },
      { to: '/teachers', label: 'Teachers', icon: UserCheck },
      { to: '/guardians', label: 'Guardians', icon: HeartHandshake },
      { to: '/attendance', label: 'Attendance', icon: CalendarCheck },
      { to: '/video-lessons', label: 'Video Lessons', icon: Video },
      { to: '/exams', label: 'Exams', icon: Award },
      { to: '/assignments', label: 'Assignments', icon: BookOpen },
      { to: '/reports', label: 'Reports', icon: BarChart3 },
      { to: '/notifications', label: 'Notifications', icon: Bell, badge: '3' },
      { to: '/audit-logs', label: 'Audit Logs', icon: ShieldCheck },
      { to: '/settings', label: 'Settings', icon: Settings },
    ];
  } else if (isTeacher) {
    navItems = [
      { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { to: '/classes', label: 'Classes', icon: School },
      { to: '/attendance', label: 'Attendance', icon: CalendarCheck },
      { to: '/video-lessons', label: 'Video Lessons', icon: Video },
      { to: '/exams', label: 'Exams', icon: Award },
      { to: '/assignments', label: 'Assignments', icon: BookOpen },
      { to: '/announcements', label: 'Announcements', icon: Bell },
      { to: '/reports', label: 'Reports', icon: BarChart3 },
      { to: '/settings', label: 'Settings', icon: Settings },
    ];
  } else if (isStudent) {
    navItems = [
      { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { to: '/classes', label: 'Classes', icon: School },
      { to: '/attendance', label: 'Attendance', icon: CalendarCheck },
      { to: '/video-lessons', label: 'Video Lessons', icon: Video },
      { to: '/exams', label: 'Exams', icon: Award },
      { to: '/assignments', label: 'Assignments', icon: BookOpen },
      { to: '/announcements', label: 'Announcements', icon: Bell },
      { to: '/settings', label: 'Settings', icon: Settings },
    ];
  } else if (isParent) {
    navItems = [
      { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { to: '/classes', label: 'Classes', icon: School },
      { to: '/exams', label: 'Exams & Grades', icon: Award },
      { to: '/assignments', label: 'Assignments', icon: BookOpen },
      { to: '/announcements', label: 'Announcements', icon: Bell },
      { to: '/settings', label: 'Settings', icon: Settings },
    ];
  }

  // Quick search filter
  const executeSearch = (q: string) => {
    setSearchQuery(q);
    if (!q.trim()) {
      setSearchResults([]);
      return;
    }
    const query = q.toLowerCase();
    const matches: any[] = [];

    // Search common destinations
    navItems.forEach((item) => {
      if (item.label.toLowerCase().includes(query)) {
        matches.push({ type: 'Navigation', title: item.label, path: item.to, icon: item.icon });
      }
    });

    setSearchResults(matches);
  };

  return (
    <div className="h-screen overflow-hidden bg-slate-50 flex flex-col md:flex-row">
      {/* Mobile Top Header */}
      <div className="md:hidden flex shrink-0 items-center justify-between bg-[#0b1329] text-white px-4 py-3 border-b border-slate-800">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 text-white bg-blue-600 shadow-md rounded-xl shadow-blue-500/20">
            <GraduationCap className="w-5 h-5" />
          </div>
          <div>
            <span className="block text-base font-extrabold leading-none tracking-tight text-white">Class LMS</span>
            <span className="text-[10px] text-slate-400 font-medium">Learn • Grow • Succeed</span>
          </div>
        </div>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
        >
          {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Modern Navy Sidebar (Desktop & Mobile Dropdown) */}
      <aside
        className={`${
          mobileMenuOpen ? 'block' : 'hidden'
        } md:flex flex-col ${
          sidebarCollapsed ? 'w-20' : 'w-64'
        } bg-[#0b1329] text-slate-300 h-[calc(100vh-64px)] min-h-0 md:h-screen select-none shrink-0 overflow-hidden border-r border-slate-800/80 transition-all duration-300 relative z-30`}
      >
        {/* Subtle Wave Watermark Decorator at Bottom */}
        <div className="absolute bottom-0 left-0 right-0 h-40 overflow-hidden pointer-events-none opacity-20">
          <svg viewBox="0 0 500 150" preserveAspectRatio="none" className="w-full h-full fill-blue-500">
            <path d="M0.00,49.98 C149.99,150.00 349.81,-49.98 500.00,49.98 L500.00,150.00 L0.00,150.00 Z" />
          </svg>
        </div>

        {/* Sidebar Brand Header */}
        <div className="flex items-center justify-between px-5 py-5 border-b border-slate-800/60">
          <div className="flex items-center space-x-3 overflow-hidden">
            <div className="bg-blue-600 p-2.5 rounded-2xl text-white shadow-lg shadow-blue-600/30 shrink-0">
              <GraduationCap className="w-6 h-6" />
            </div>
            {!sidebarCollapsed && (
              <div className="leading-tight">
                <h1 className="text-lg font-extrabold tracking-tight text-white">Class LMS</h1>
                <p className="text-[11px] text-slate-400 font-medium tracking-tight">Learn • Grow • Succeed</p>
              </div>
            )}
          </div>

          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="hidden md:flex p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/80 transition"
            title={sidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          >
            {sidebarCollapsed ? <ChevronsRight className="w-4 h-4" /> : <ChevronsLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Navigation Links Menu */}
        <nav className="flex-1 min-h-0 p-3 space-y-1 overflow-hidden layout-sidebar-nav">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname.startsWith(item.to);

            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setMobileMenuOpen(false)}
                title={sidebarCollapsed ? item.label : undefined}
                className={({ isActive }) =>
                  `flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all group ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                  }`
                }
              >
                <div className="flex items-center space-x-3.5">
                  <Icon
                    className={`h-4 w-4 shrink-0 transition-transform group-hover:scale-110 ${
                      isActive ? 'text-white' : 'text-slate-400 group-hover:text-white'
                    }`}
                  />
                  {!sidebarCollapsed && (
                    <span className="tracking-tight">{navigationTranslations[language][item.label] || item.label}</span>
                  )}
                </div>

                {!sidebarCollapsed && item.badge && (
                  <span className="h-5 min-w-5 px-1.5 flex items-center justify-center rounded-full bg-rose-500 text-white text-[10px] font-bold shadow-sm">
                    {item.badge}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* User Card at Bottom */}
        <div className="relative z-10 p-3 border-t border-slate-800/80">
          <div
            onClick={() => setProfileMenuOpen(!profileMenuOpen)}
            className="flex items-center justify-between p-2.5 rounded-2xl bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 transition cursor-pointer group"
          >
            <div className="flex items-center space-x-3 overflow-hidden">
              <div className="flex items-center justify-center text-sm font-bold text-white bg-blue-600 rounded-full shadow-md h-9 w-9 shrink-0 shadow-blue-600/30">
                {user?.fullName?.charAt(0) || 'U'}
              </div>
              {!sidebarCollapsed && (
                <div className="overflow-hidden">
                  <p className="text-xs font-bold leading-tight text-white truncate">{user?.fullName || 'User'}</p>
                  <p className="text-[10px] text-slate-400 capitalize truncate">{user?.role?.toLowerCase() || 'Member'}</p>
                  <div className="flex items-center space-x-1.5 mt-0.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-[10px] font-medium text-emerald-400">Online</span>
                  </div>
                </div>
              )}
            </div>

            {!sidebarCollapsed && <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-white group-hover:translate-x-0.5 transition" />}
          </div>
        </div>
      </aside>

      {/* Main Body Section */}
      <div className="flex flex-col flex-1 min-w-0 min-h-0">
        {/* Modern Top Navigation Bar */}
        <header className="relative z-20 shrink-0 bg-white/90 backdrop-blur-md border-b border-slate-200/80 px-4 sm:px-8 py-3.5 flex items-center justify-between gap-4">
          {/* Search Box with Ctrl + K */}
          <div
            onClick={() => setSearchModalOpen(true)}
            className="relative flex items-center w-full min-w-0 max-w-md px-4 py-2 transition border rounded-full cursor-pointer bg-slate-100 hover:bg-slate-200/70 border-slate-200 text-slate-400 hover:text-slate-600 group"
          >
            <Search className="h-4 w-4 text-slate-400 group-hover:text-blue-600 transition mr-2.5 shrink-0" />
            <span className="flex-1 text-xs font-medium truncate select-none text-slate-500">
              {language === 'si'
                ? 'සිසුන්, පන්ති හෝ වෙනත් දේ සොයන්න...'
                : language === 'ta'
                  ? 'மாணவர்கள், வகுப்புகள் அல்லது வேறு எதையும் தேடுங்கள்...'
                  : 'Search students, classes, or anything...'}
            </span>
            <kbd className="hidden sm:inline-flex items-center px-2 py-0.5 border border-slate-300 rounded text-[10px] font-mono text-slate-500 bg-white shadow-xs">
              Ctrl + K
            </kbd>
          </div>

          {/* Right Header Icons & Profile */}
          <div className="flex items-center space-x-3 shrink-0">
            <label className="sr-only" htmlFor="portal-language">Select language</label>
            <select
              id="portal-language"
              value={language}
              onChange={(event) => setLanguage(event.target.value as Language)}
              className="max-w-[6.5rem] rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="en">English</option>
              <option value="si">සිංහල</option>
              <option value="ta">தமிழ்</option>
            </select>

            {/* Notifications Bell */}
            <div className="relative">
              <button
                onClick={() => setNotificationsOpen(!notificationsOpen)}
                className="relative p-2 transition rounded-full text-slate-500 hover:text-slate-800 hover:bg-slate-100"
                title={navigationTranslations[language].Notifications || 'Notifications'}
              >
                <Bell className="w-5 h-5" />
                <span className="absolute top-1 right-1 h-4 w-4 rounded-full bg-rose-500 text-white font-bold text-[9px] flex items-center justify-center ring-2 ring-white">
                  2
                </span>
              </button>

              {/* Notification Quick Drawer */}
              {notificationsOpen && (
                <div className="absolute right-0 z-50 p-4 mt-2 bg-white border shadow-xl w-80 rounded-2xl border-slate-200/80 animate-in fade-in slide-in-from-top-2">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <span className="text-xs font-bold tracking-wider uppercase text-slate-900">Recent Alerts</span>
                    <button
                      onClick={() => setNotificationsOpen(false)}
                      className="text-[11px] font-semibold text-blue-600 hover:underline"
                    >
                      Dismiss
                    </button>
                  </div>
                  <div className="mt-3 space-y-3">
                    <div className="flex items-start p-2 space-x-3 rounded-xl bg-blue-50/60">
                      <div className="p-1.5 rounded-lg bg-blue-100 text-blue-600">
                        <CalendarCheck className="w-4 h-4" />
                      </div>
                      <div className="text-xs">
                        <p className="font-semibold text-slate-900">Mathematics Exam Scheduled</p>
                        <p className="text-slate-500 text-[11px]">Saturday, 10:00 AM • Room 102</p>
                      </div>
                    </div>
                    <div className="flex items-start p-2 space-x-3 rounded-xl bg-purple-50/60">
                      <div className="p-1.5 rounded-lg bg-purple-100 text-purple-600">
                        <Mail className="w-4 h-4" />
                      </div>
                      <div className="text-xs">
                        <p className="font-semibold text-slate-900">Absence Email Dispatched</p>
                        <p className="text-slate-500 text-[11px]">3 primary guardians alerted</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Dark Mode Toggle */}
            <button
              onClick={() => setDarkMode((current) => !current)}
              className="p-2 transition rounded-full text-slate-500 hover:text-slate-800 hover:bg-slate-100"
              title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {darkMode ? <Sun className="w-5 h-5 text-amber-500" /> : <Moon className="w-5 h-5" />}
            </button>

            {/* Profile Menu Pill */}
            <div className="relative">
              <button
                onClick={() => setProfileMenuOpen(!profileMenuOpen)}
                className="flex items-center space-x-2.5 p-1.5 pl-2 pr-3 rounded-full hover:bg-slate-100 transition border border-transparent hover:border-slate-200"
              >
                <div className="flex items-center justify-center w-8 h-8 text-xs font-bold text-white rounded-full shadow-sm bg-gradient-to-tr from-blue-600 to-indigo-600">
                  {user?.fullName?.charAt(0) || 'A'}
                </div>
                <div className="hidden text-left sm:block">
                  <p className="text-xs font-bold leading-none text-slate-900">
                    {user?.fullName ? user.fullName.split(' ')[0] : 'Admin'}
                  </p>
                  <p className="text-[10px] text-slate-400 capitalize">{user?.role?.toLowerCase() || 'Admin'}</p>
                </div>
                <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
              </button>

              {/* Profile Dropdown */}
              {profileMenuOpen && (
                <div className="absolute right-0 z-50 w-56 p-2 mt-2 bg-white border shadow-xl rounded-2xl border-slate-200/80">
                  <div className="px-3 py-2 border-b border-slate-100">
                    <p className="text-xs font-bold truncate text-slate-900">{user?.fullName}</p>
                    <p className="text-[11px] text-slate-400 truncate">{user?.email}</p>
                  </div>
                  <div className="py-1 space-y-0.5">
                    <button
                      onClick={() => {
                        setProfileMenuOpen(false);
                        navigate('/settings');
                      }}
                      className="flex items-center w-full px-3 py-2 space-x-2 text-xs font-semibold transition text-slate-700 hover:bg-slate-100 rounded-xl"
                    >
                      <Settings className="h-3.5 w-3.5 text-slate-400" />
                      <span>Settings & Preferences</span>
                    </button>
                    <button
                      onClick={() => {
                        setProfileMenuOpen(false);
                        setPasswordModalOpen(true);
                      }}
                      className="flex items-center w-full px-3 py-2 space-x-2 text-xs font-semibold transition text-slate-700 hover:bg-slate-100 rounded-xl"
                    >
                      <KeyRound className="h-3.5 w-3.5 text-slate-400" />
                      <span>Change Password</span>
                    </button>
                    <button
                      onClick={handleLogout}
                      className="flex items-center w-full px-3 py-2 space-x-2 text-xs font-semibold transition text-rose-600 hover:bg-rose-50 rounded-xl"
                    >
                      <LogOut className="h-3.5 w-3.5" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Content View Outlet */}
        <main className="flex-1 w-full min-h-0 p-4 mx-auto overflow-x-hidden overflow-y-auto layout-content-scrollbar sm:p-6 lg:p-8 max-w-8xl">
          <Outlet />
        </main>
      </div>

      {/* Command Palette Modal (Ctrl + K) */}
      <Modal isOpen={searchModalOpen} onClose={() => setSearchModalOpen(false)} title="Quick Jump & Search">
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              autoFocus
              value={searchQuery}
              onChange={(e) => executeSearch(e.target.value)}
              placeholder="Search classes, teachers, students, exams, or pages..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="space-y-2 overflow-y-auto max-h-64">
            {searchResults.length === 0 ? (
              <div className="py-6 text-xs text-center text-slate-400">
                Type something to search across all portal resources or jump to any module.
              </div>
            ) : (
              searchResults.map((res, idx) => {
                const Icon = res.icon || School;
                return (
                  <div
                    key={idx}
                    onClick={() => {
                      setSearchModalOpen(false);
                      navigate(res.path);
                    }}
                    className="flex items-center justify-between p-3 transition border border-transparent cursor-pointer rounded-xl hover:bg-slate-100 hover:border-slate-200"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="p-2 text-blue-600 rounded-lg bg-blue-50">
                        <Icon className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-900">{res.title}</p>
                        <p className="text-[10px] text-slate-400">{res.type}</p>
                      </div>
                    </div>
                    <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                  </div>
                );
              })
            )}
          </div>
        </div>
      </Modal>

      {/* Change Password Modal */}
      <Modal isOpen={passwordModalOpen} onClose={() => setPasswordModalOpen(false)} title="Change Your Password">
        <form onSubmit={handleChangePassword} className="space-y-4">
          {passwordError && (
            <div className="p-3 text-xs text-red-700 border border-red-200 rounded-lg bg-red-50">
              {passwordError}
            </div>
          )}
          {passwordSuccess && (
            <div className="p-3 text-xs text-green-700 border border-green-200 rounded-lg bg-green-50">
              {passwordSuccess}
            </div>
          )}

          <div>
            <label className="block mb-1 text-xs font-semibold tracking-wider uppercase text-slate-700">
              Current Password
            </label>
            <input
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="••••••••"
            />
          </div>

          <div>
            <label className="block mb-1 text-xs font-semibold tracking-wider uppercase text-slate-700">
              New Password (min 6 characters)
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="••••••••"
            />
          </div>

          <div className="flex justify-end pt-4 space-x-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setPasswordModalOpen(false)}
              className="px-4 py-2 text-xs font-bold transition rounded-lg text-slate-600 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmittingPassword}
              className="px-4 py-2 text-xs font-bold text-white transition bg-blue-600 shadow-sm hover:bg-blue-700 rounded-xl disabled:opacity-50"
            >
              {isSubmittingPassword ? 'Updating...' : 'Update Password'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
