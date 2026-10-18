import React, { useState, useEffect, useRef } from 'react';
import {
  LayoutDashboard,
  Users,
  Kanban,
  CheckSquare,
  BarChart3,
  Settings,
  Shield,
  Bell,
  Plus,
  LogOut,
  MoreHorizontal,
  X,
  ChevronDown,
  Calendar,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { AddLeadModal } from '../common/AddLeadModal';
import { AddTaskModal } from '../common/AddTaskModal';

interface ShellProps {
  currentPath: string;
  onNavigate: (path: string) => void;
  children: React.ReactNode;
}

export function Shell({ currentPath, onNavigate, children }: ShellProps) {
  const { user, logout } = useAuth();
  const [bellCount, setBellCount] = useState(0);
  const [bellOpen, setBellOpen] = useState(false);
  const [bellItems, setBellItems] = useState<any[]>([]);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [moreSheetOpen, setMoreSheetOpen] = useState(false);

  // Global modals
  const [isAddLeadOpen, setIsAddLeadOpen] = useState(false);
  const [isAddTaskOpen, setIsAddTaskOpen] = useState(false);

  const bellRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Load bell notification counts
  const fetchBellData = async () => {
    try {
      const res = await api.getDashboard();
      setBellCount(res.stats.bellCount);
      setBellItems(res.todayFollowUps);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchBellData();
    const interval = setInterval(fetchBellData, 30000);
    return () => clearInterval(interval);
  }, []);

  // Click outside to close dropdowns
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) {
        setBellOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isAdminOrOperator = user?.role === 'ADMIN' || user?.role === 'OPERATOR';

  const navItems = [
    { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { label: 'Leads', path: '/leads', icon: Users },
    { label: 'Pipeline', path: '/pipeline', icon: Kanban },
    { label: 'Tasks', path: '/tasks', icon: CheckSquare },
    { label: 'Reports', path: '/reports', icon: BarChart3 },
    { label: 'Settings', path: '/settings', icon: Settings },
  ];

  const adminNavItems = [
    { label: 'Admin Console', path: '/admin', icon: Shield },
  ];

  // Derive page title from path
  const getPageTitle = (path: string) => {
    if (path === '/dashboard') return 'Dashboard';
    if (path.startsWith('/leads/')) return 'Lead Overview';
    if (path === '/leads') return 'Leads & Prospects';
    if (path === '/pipeline') return 'Opportunity Pipeline';
    if (path === '/tasks') return 'Tasks & Follow-Ups';
    if (path === '/reports') return 'Performance Reports';
    if (path === '/settings') return 'Account & CRM Settings';
    if (path.startsWith('/admin')) return 'Admin & Operator Console';
    return 'Emperor CRM';
  };

  const showFAB = ['/dashboard', '/leads', '/pipeline'].includes(currentPath);

  // Avatar path or initials
  const userAvatar = user?.role === 'ADMIN'
    ? '/src/assets/images/avatar_admin_user_1792326771454.jpg'
    : '/src/assets/images/avatar_demo_freelancer_1792326758356.jpg';

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
      {/* Skip to main content for accessibility */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 z-50 bg-slate-900 text-white px-4 py-2 rounded-lg text-xs font-semibold shadow-lg"
      >
        Skip to main content
      </a>

      {/* ========================================================= */}
      {/* DESKTOP SIDEBAR (Fixed 240px) */}
      {/* ========================================================= */}
      <aside
        className="hidden md:flex flex-col w-60 shrink-0 bg-white border-r border-slate-200 h-screen sticky top-0 z-30"
        aria-label="Sidebar navigation"
      >
        {/* Logo & Brand */}
        <div className="h-16 flex items-center px-6 border-b border-slate-100 gap-3">
          <img
            src="/src/assets/images/emperor_crm_hero_mark_1792326782934.jpg"
            alt="Emperor CRM"
            className="w-8 h-8 rounded-lg object-cover shadow-xs"
            referrerPolicy="no-referrer"
          />
          <div>
            <span className="font-bold text-sm tracking-tight text-slate-900 block leading-tight">
              Emperor CRM
            </span>
            <span className="text-[10px] text-slate-600 block leading-tight font-medium">Freelance Ops v1</span>
          </div>
        </div>

        {/* Primary Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPath === item.path || (item.path !== '/dashboard' && currentPath.startsWith(item.path));
            return (
              <button
                key={item.path}
                onClick={() => onNavigate(item.path)}
                aria-current={isActive ? 'page' : undefined}
                className={`w-full flex items-center gap-3 px-3 py-2 text-xs font-medium rounded-lg transition-colors text-left ${
                  isActive
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}

          {/* Admin Navigation */}
          {isAdminOrOperator && (
            <div className="pt-4 mt-4 border-t border-slate-100">
              <span className="px-3 text-[10px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                Administration
              </span>
              {adminNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = currentPath.startsWith(item.path);
                return (
                  <button
                    key={item.path}
                    onClick={() => onNavigate(item.path)}
                    aria-current={isActive ? 'page' : undefined}
                    className={`w-full flex items-center gap-3 px-3 py-2 text-xs font-medium rounded-lg transition-colors text-left ${
                      isActive
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'text-amber-800 hover:text-amber-950 hover:bg-amber-50/70'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </nav>

        {/* Bottom User Area */}
        <div className="p-3 border-t border-slate-100 relative" ref={userMenuRef}>
          <button
            onClick={() => setUserDropdownOpen(!userDropdownOpen)}
            className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-slate-100/70 transition-colors text-left"
            aria-expanded={userDropdownOpen}
            aria-haspopup="menu"
          >
            <img
              src={userAvatar}
              alt={user?.name || 'User'}
              className="w-8 h-8 rounded-full object-cover shrink-0 border border-slate-200"
              referrerPolicy="no-referrer"
            />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-slate-900 truncate">{user?.name}</p>
              <p className="text-[10px] text-slate-600 truncate">{user?.email}</p>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          </button>

          {/* User Dropdown Menu */}
          {userDropdownOpen && (
            <div
              role="menu"
              className="absolute bottom-full left-3 right-3 mb-2 bg-white rounded-xl shadow-lg border border-slate-200 py-1.5 z-40"
            >
              <div className="px-3 py-2 border-b border-slate-100">
                <span className="text-[10px] font-semibold text-slate-600 block">Signed in as</span>
                <span className="text-xs font-bold text-slate-800 block truncate">{user?.name}</span>
                <span className="inline-block mt-1 text-[10px] font-medium text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
                  {user?.role}
                </span>
              </div>
              <button
                role="menuitem"
                onClick={() => {
                  setUserDropdownOpen(false);
                  onNavigate('/settings');
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 transition-colors text-left"
              >
                <Settings className="w-3.5 h-3.5 text-slate-400" />
                CRM Settings
              </button>
              <button
                role="menuitem"
                onClick={async () => {
                  setUserDropdownOpen(false);
                  await logout();
                  onNavigate('/login');
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-rose-600 hover:bg-rose-50 transition-colors text-left"
              >
                <LogOut className="w-3.5 h-3.5 text-rose-500" />
                Sign Out
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* ========================================================= */}
      {/* MAIN VIEWPORT CONTAINER */}
      {/* ========================================================= */}
      <div className="flex-1 flex flex-col min-w-0 pb-16 md:pb-0">
        {/* Top Header Bar */}
        <header className="h-16 bg-white border-b border-slate-200 sticky top-0 z-20 px-4 sm:px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <h2 className="text-sm sm:text-base font-bold text-slate-900 truncate">
              {getPageTitle(currentPath)}
            </h2>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {/* Bell Badge Notification */}
            <div className="relative" ref={bellRef}>
              <button
                onClick={() => setBellOpen(!bellOpen)}
                className="relative p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                aria-label={`Follow-ups reminder: ${bellCount} due`}
              >
                <Bell className="w-4 h-4" />
                {bellCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-rose-600 text-white rounded-full text-[9px] font-bold flex items-center justify-center tabular-nums">
                    {bellCount > 9 ? '9+' : bellCount}
                  </span>
                )}
              </button>

              {/* Bell dropdown */}
              {bellOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-slate-200 p-3 z-50">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <span className="text-xs font-bold text-slate-900">Follow-Ups Overview</span>
                    <span className="text-[10px] text-slate-500 tabular-nums">{bellCount} due/overdue</span>
                  </div>

                  <div className="py-2 space-y-2 max-h-60 overflow-y-auto">
                    {bellItems.length === 0 ? (
                      <p className="text-xs text-slate-500 py-3 text-center">You are all caught up!</p>
                    ) : (
                      bellItems.slice(0, 5).map((t) => (
                        <div
                          key={t.id}
                          onClick={() => {
                            setBellOpen(false);
                            onNavigate('/tasks?filter=overdue');
                          }}
                          className="p-2 rounded-lg hover:bg-slate-50 cursor-pointer border border-slate-100 transition-colors"
                        >
                          <p className="text-xs font-semibold text-slate-800 line-clamp-1">{t.title}</p>
                          <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-500">
                            {t.lead && <span>{t.lead.name}</span>}
                            <span>·</span>
                            <span className="text-rose-600 font-medium">Due soon</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  <button
                    onClick={() => {
                      setBellOpen(false);
                      onNavigate('/tasks');
                    }}
                    className="w-full mt-1 py-1.5 text-center text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    View All Tasks →
                  </button>
                </div>
              )}
            </div>

            {/* Quick Task Button */}
            <button
              onClick={() => setIsAddTaskOpen(true)}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap"
            >
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              Add Task
            </button>

            {/* Global "Add Lead" primary button */}
            <button
              onClick={() => setIsAddLeadOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Lead
            </button>
          </div>
        </header>

        {/* Content Viewport */}
        <main id="main-content" className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>

      {/* ========================================================= */}
      {/* MOBILE BOTTOM NAVIGATION BAR */}
      {/* ========================================================= */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 h-14 bg-white border-t border-slate-200 flex items-center justify-around z-30"
        aria-label="Mobile navigation"
      >
        <button
          onClick={() => onNavigate('/dashboard')}
          aria-current={currentPath === '/dashboard' ? 'page' : undefined}
          className={`flex flex-col items-center justify-center flex-1 h-full py-1 text-[10px] font-medium transition-colors ${
            currentPath === '/dashboard' ? 'text-slate-900 font-semibold' : 'text-slate-500'
          }`}
        >
          <LayoutDashboard className="w-4 h-4 mb-0.5" />
          <span>Dashboard</span>
        </button>

        <button
          onClick={() => onNavigate('/leads')}
          aria-current={currentPath.startsWith('/leads') ? 'page' : undefined}
          className={`flex flex-col items-center justify-center flex-1 h-full py-1 text-[10px] font-medium transition-colors ${
            currentPath.startsWith('/leads') ? 'text-slate-900 font-semibold' : 'text-slate-500'
          }`}
        >
          <Users className="w-4 h-4 mb-0.5" />
          <span>Leads</span>
        </button>

        <button
          onClick={() => onNavigate('/pipeline')}
          aria-current={currentPath === '/pipeline' ? 'page' : undefined}
          className={`flex flex-col items-center justify-center flex-1 h-full py-1 text-[10px] font-medium transition-colors ${
            currentPath === '/pipeline' ? 'text-slate-900 font-semibold' : 'text-slate-500'
          }`}
        >
          <Kanban className="w-4 h-4 mb-0.5" />
          <span>Pipeline</span>
        </button>

        <button
          onClick={() => onNavigate('/tasks')}
          aria-current={currentPath === '/tasks' ? 'page' : undefined}
          className={`flex flex-col items-center justify-center flex-1 h-full py-1 text-[10px] font-medium transition-colors ${
            currentPath === '/tasks' ? 'text-slate-900 font-semibold' : 'text-slate-500'
          }`}
        >
          <CheckSquare className="w-4 h-4 mb-0.5" />
          <span>Tasks</span>
        </button>

        <button
          onClick={() => setMoreSheetOpen(true)}
          className="flex flex-col items-center justify-center flex-1 h-full py-1 text-[10px] font-medium text-slate-500 transition-colors"
        >
          <MoreHorizontal className="w-4 h-4 mb-0.5" />
          <span>More</span>
        </button>
      </nav>

      {/* Floating Action Button (FAB) for Mobile on Dashboard, Leads, Pipeline */}
      {showFAB && (
        <button
          onClick={() => setIsAddLeadOpen(true)}
          className="md:hidden fixed bottom-18 right-4 w-12 h-12 bg-slate-900 text-white rounded-full shadow-lg flex items-center justify-center hover:bg-slate-800 transition-transform active:scale-95 z-30"
          aria-label="Add new lead"
        >
          <Plus className="w-5 h-5" />
        </button>
      )}

      {/* ========================================================= */}
      {/* MOBILE "MORE" SHEET DRAWER */}
      {/* ========================================================= */}
      {moreSheetOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-slate-900/50 backdrop-blur-xs md:hidden">
          <div className="bg-white rounded-t-2xl p-5 border-t border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <img
                  src={userAvatar}
                  alt={user?.name || ''}
                  className="w-10 h-10 rounded-full object-cover border border-slate-200"
                  referrerPolicy="no-referrer"
                />
                <div>
                  <h4 className="text-sm font-bold text-slate-900">{user?.name}</h4>
                  <p className="text-xs text-slate-500">{user?.email}</p>
                </div>
              </div>
              <button
                onClick={() => setMoreSheetOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600"
                aria-label="Close sheet"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-1">
              <button
                onClick={() => {
                  setMoreSheetOpen(false);
                  onNavigate('/reports');
                }}
                className="w-full flex items-center gap-3 p-3 text-xs font-semibold text-slate-800 hover:bg-slate-50 rounded-xl"
              >
                <BarChart3 className="w-4 h-4 text-slate-500" />
                Performance Reports
              </button>

              <button
                onClick={() => {
                  setMoreSheetOpen(false);
                  onNavigate('/settings');
                }}
                className="w-full flex items-center gap-3 p-3 text-xs font-semibold text-slate-800 hover:bg-slate-50 rounded-xl"
              >
                <Settings className="w-4 h-4 text-slate-500" />
                CRM Settings
              </button>

              {isAdminOrOperator && (
                <button
                  onClick={() => {
                    setMoreSheetOpen(false);
                    onNavigate('/admin');
                  }}
                  className="w-full flex items-center gap-3 p-3 text-xs font-semibold text-amber-900 bg-amber-50/50 rounded-xl"
                >
                  <Shield className="w-4 h-4 text-amber-700" />
                  Admin Console
                </button>
              )}
            </div>

            <div className="pt-2 border-t border-slate-100">
              <button
                onClick={async () => {
                  setMoreSheetOpen(false);
                  await logout();
                  onNavigate('/login');
                }}
                className="w-full flex items-center justify-center gap-2 p-3 text-xs font-semibold text-rose-600 bg-rose-50 rounded-xl hover:bg-rose-100"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global Add Lead Modal */}
      <AddLeadModal
        isOpen={isAddLeadOpen}
        onClose={() => setIsAddLeadOpen(false)}
        onSuccess={() => {
          fetchBellData();
          window.dispatchEvent(new CustomEvent('emperor:data-changed'));
        }}
      />

      {/* Global Add Task Modal */}
      <AddTaskModal
        isOpen={isAddTaskOpen}
        onClose={() => setIsAddTaskOpen(false)}
        onSuccess={() => {
          fetchBellData();
          window.dispatchEvent(new CustomEvent('emperor:data-changed'));
        }}
      />
    </div>
  );
}
