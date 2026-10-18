import React, { useState, useEffect } from 'react';
import { ToastProvider } from './context/ToastContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Shell } from './components/layout/Shell';
import { AuthPages } from './components/auth/AuthPages';
import { DashboardView } from './components/views/DashboardView';
import { LeadsView } from './components/views/LeadsView';
import { LeadDetailView } from './components/views/LeadDetailView';
import { PipelineView } from './components/views/PipelineView';
import { TasksView } from './components/views/TasksView';
import { ReportsView } from './components/views/ReportsView';
import { SettingsView } from './components/views/SettingsView';
import { AdminView } from './components/views/AdminView';
import { LoadingSkeleton } from './components/common/LoadingSkeleton';
import { AlertCircle } from 'lucide-react';

function AppContent() {
  const { user, loading, sessionExpired, dismissSessionExpired } = useAuth();
  const [currentPath, setCurrentPath] = useState(window.location.pathname || '/dashboard');

  const navigate = (path: string) => {
    window.history.pushState(null, '', path);
    setCurrentPath(path.split('?')[0]);
  };

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname || '/dashboard');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Protected routes check
  const isAuthRoute = ['/login', '/register', '/forgot-password', '/reset-password'].includes(currentPath);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full space-y-4">
          <LoadingSkeleton variant="table" />
        </div>
      </div>
    );
  }

  // If not logged in and not on auth page, redirect to /login
  if (!user && !isAuthRoute) {
    return <AuthPages view="login" onNavigate={navigate} />;
  }

  // If logged in and on auth page, redirect to dashboard
  if (user && isAuthRoute) {
    return (
      <Shell currentPath="/dashboard" onNavigate={navigate}>
        <DashboardView onNavigate={navigate} />
      </Shell>
    );
  }

  // Render Auth Pages
  if (!user) {
    if (currentPath === '/register') return <AuthPages view="register" onNavigate={navigate} />;
    if (currentPath === '/forgot-password') return <AuthPages view="forgot-password" onNavigate={navigate} />;
    if (currentPath === '/reset-password') {
      const urlParams = new URLSearchParams(window.location.search);
      const token = urlParams.get('token') || undefined;
      return <AuthPages view="reset-password" onNavigate={navigate} resetToken={token} />;
    }
    return <AuthPages view="login" onNavigate={navigate} />;
  }

  // Render Authenticated App Views
  let viewContent: React.ReactNode = null;

  if (currentPath.startsWith('/leads/')) {
    const id = currentPath.replace('/leads/', '').trim();
    viewContent = <LeadDetailView leadId={id} onNavigate={navigate} />;
  } else if (currentPath === '/leads') {
    viewContent = <LeadsView onNavigate={navigate} />;
  } else if (currentPath === '/pipeline') {
    viewContent = <PipelineView onNavigate={navigate} />;
  } else if (currentPath === '/tasks') {
    viewContent = <TasksView onNavigate={navigate} />;
  } else if (currentPath === '/reports') {
    viewContent = <ReportsView onNavigate={navigate} />;
  } else if (currentPath === '/settings') {
    viewContent = <SettingsView onNavigate={navigate} />;
  } else if (currentPath.startsWith('/admin')) {
    viewContent = <AdminView onNavigate={navigate} />;
  } else {
    // Default to /dashboard
    viewContent = <DashboardView onNavigate={navigate} />;
  }

  return (
    <>
      <Shell currentPath={currentPath} onNavigate={navigate}>
        {viewContent}
      </Shell>

      {/* Session Expired Prompt Modal */}
      {sessionExpired && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-xl max-w-sm w-full p-6 text-center space-y-4 shadow-2xl border border-slate-200">
            <div className="w-12 h-12 rounded-full bg-rose-100 flex items-center justify-center text-rose-600 mx-auto">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Session Expired</h3>
              <p className="text-xs text-slate-500 mt-1">
                Your session has expired or become invalid. Please sign in again to continue managing your pipeline.
              </p>
            </div>
            <button
              onClick={() => {
                dismissSessionExpired();
                navigate('/login');
              }}
              className="w-full py-2.5 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors"
            >
              Sign In Again
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ToastProvider>
  );
}
