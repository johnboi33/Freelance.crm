import React, { useState, useEffect } from 'react';
import {
  User,
  Shield,
  Sliders,
  Database,
  Info,
  Check,
  AlertTriangle,
  Download,
  Trash2,
  Lock,
  Globe,
  Clock,
  LogOut,
} from 'lucide-react';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { LoadingSkeleton } from '../common/LoadingSkeleton';

interface SettingsViewProps {
  onNavigate: (path: string) => void;
}

const COMMON_TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Toronto',
  'America/Sao_Paulo',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Amsterdam',
  'Asia/Dubai',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Australia/Sydney',
  'Africa/Lagos',
  'Africa/Johannesburg',
  'UTC',
];

export function SettingsView({ onNavigate }: SettingsViewProps) {
  const { user, refreshSession, logout } = useAuth();
  const { success, error } = useToast();

  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'pipeline' | 'data' | 'about'>('profile');
  const [loading, setLoading] = useState(true);

  // Profile Form State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [timezone, setTimezone] = useState('UTC');
  const [currency, setCurrency] = useState('USD');
  const [dateFormat, setDateFormat] = useState('MM/DD/YYYY');

  // Security Form State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);

  // Pipeline Preferences State
  const [hideTerminalStages, setHideTerminalStages] = useState(false);
  const [defaultStage, setDefaultStage] = useState('IDENTIFIED');

  // Danger Zone Delete Account Modal
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteConfirmationInput, setDeleteConfirmationInput] = useState('');
  const [deletePasswordInput, setDeletePasswordInput] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    const loadSettings = async () => {
      setLoading(true);
      try {
        const data = await api.getSettings();
        setName(data.name || '');
        setEmail(data.email || '');
        setTimezone(data.timezone || 'UTC');
        const prefs = data.preferences || {};
        setCurrency(prefs.currency || 'USD');
        setDateFormat(prefs.dateFormat || 'MM/DD/YYYY');
        setHideTerminalStages(Boolean(prefs.hideTerminalStages));
        setDefaultStage(prefs.defaultStage || 'IDENTIFIED');
      } catch (err: any) {
        error('Failed to load settings', err.message);
      } finally {
        setLoading(false);
      }
    };
    loadSettings();
  }, [error]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.updateProfile({ name, timezone, currency, dateFormat });
      await refreshSession();
      success('Profile updated', 'Your profile preferences were saved.');
    } catch (err: any) {
      error('Failed to update profile', err.message);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      error('Password mismatch', 'New passwords do not match.');
      return;
    }
    if (newPassword.length < 10) {
      error('Weak password', 'Password must be at least 10 characters.');
      return;
    }

    setPasswordLoading(true);
    try {
      await api.changePassword({ currentPassword, newPassword });
      success('Password changed', 'Your password has been updated securely.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      error('Failed to change password', err.message);
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleSavePipelinePreferences = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.updatePreferences({ hideTerminalStages, defaultStage });
      await refreshSession();
      success('Pipeline preferences saved', 'Board view preferences updated.');
    } catch (err: any) {
      error('Failed to update pipeline settings', err.message);
    }
  };

  const handleExportData = async (format: 'json' | 'csv') => {
    try {
      const res = await api.exportData(format);
      let blob: Blob;
      let filename: string;

      if (format === 'csv') {
        blob = new Blob([res], { type: 'text/csv' });
        filename = `emperor-crm-leads-${new Date().toISOString().slice(0, 10)}.csv`;
      } else {
        blob = new Blob([JSON.stringify(res, null, 2)], { type: 'application/json' });
        filename = `emperor-crm-export-${new Date().toISOString().slice(0, 10)}.json`;
      }

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      success('Export ready', `Downloaded ${filename}`);
    } catch (err: any) {
      error('Export failed', err.message);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmationInput !== 'DELETE') {
      error('Type DELETE to confirm', 'You must type DELETE exactly.');
      return;
    }
    if (!deletePasswordInput) {
      error('Password required', 'Please enter your password.');
      return;
    }

    setDeleteLoading(true);
    try {
      await api.deleteAccount({ confirmation: deleteConfirmationInput, password: deletePasswordInput });
      success('Account deleted', 'All data permanently removed.');
      await logout();
      onNavigate('/login');
    } catch (err: any) {
      error('Failed to delete account', err.message);
    } finally {
      setDeleteLoading(false);
    }
  };

  if (loading) return <LoadingSkeleton variant="table" />;

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Settings Navigation Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 border-b border-slate-200">
        {[
          { key: 'profile', label: 'Profile', icon: User },
          { key: 'security', label: 'Security', icon: Shield },
          { key: 'pipeline', label: 'Pipeline Preferences', icon: Sliders },
          { key: 'data', label: 'Data & Export', icon: Database },
          { key: 'about', label: 'About Emperor CRM', icon: Info },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                isActive
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ========================================================= */}
      {/* 1. PROFILE TAB */}
      {/* ========================================================= */}
      {activeTab === 'profile' && (
        <form onSubmit={handleSaveProfile} className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-5">
          <div>
            <h3 className="text-sm font-bold text-slate-900">User Profile & Regional Formatting</h3>
            <p className="text-xs text-slate-500 mt-0.5">Manage your identity, preferred timezone and currency formats</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
              <input
                type="email"
                disabled
                value={email}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-slate-50 text-slate-500 cursor-not-allowed"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">
                Email change requires re-verification flow (disabled in v1).
              </span>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-700">Timezone</label>
                <button
                  type="button"
                  onClick={() => {
                    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
                    if (detected) setTimezone(detected);
                  }}
                  className="text-[10px] text-slate-900 hover:underline font-semibold"
                >
                  Use Detected
                </button>
              </div>
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
              >
                {COMMON_TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Default Deal Currency</label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
              >
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option>
                <option value="CAD">CAD ($)</option>
                <option value="AUD">AUD ($)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Date Format Preference</label>
              <select
                value={dateFormat}
                onChange={(e) => setDateFormat(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
              >
                <option value="MM/DD/YYYY">MM/DD/YYYY (US Standard)</option>
                <option value="DD/MM/YYYY">DD/MM/YYYY (International)</option>
                <option value="YYYY-MM-DD">YYYY-MM-DD (ISO Format)</option>
              </select>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex justify-end">
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors shadow-xs"
            >
              Save Profile Preferences
            </button>
          </div>
        </form>
      )}

      {/* ========================================================= */}
      {/* 2. SECURITY TAB */}
      {/* ========================================================= */}
      {activeTab === 'security' && (
        <div className="space-y-6">
          <form
            onSubmit={handleChangePassword}
            className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4"
          >
            <div>
              <h3 className="text-sm font-bold text-slate-900">Change Password</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Passwords are authenticated using the Argon2id cryptographic hashing scheme
              </p>
            </div>

            <div className="space-y-3 max-w-md">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Current Password</label>
                <input
                  type="password"
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="••••••••••"
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">New Password</label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min 10 characters (letters + numbers)"
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Confirm New Password</label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat new password"
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={passwordLoading}
                className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors shadow-xs inline-flex items-center gap-1.5 disabled:opacity-50"
              >
                {passwordLoading && <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                Update Password
              </button>
            </div>
          </form>

          {/* Session Management */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs flex items-center justify-between">
            <div>
              <h4 className="text-sm font-bold text-slate-900">Sign Out Everywhere</h4>
              <p className="text-xs text-slate-500 mt-0.5">Invalidate all existing session cookies across your devices</p>
            </div>
            <button
              onClick={async () => {
                await logout();
                onNavigate('/login');
              }}
              className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors inline-flex items-center gap-1.5"
            >
              <LogOut className="w-3.5 h-3.5 text-slate-500" />
              Sign Out All Devices
            </button>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 3. PIPELINE PREFERENCES TAB */}
      {/* ========================================================= */}
      {activeTab === 'pipeline' && (
        <form
          onSubmit={handleSavePipelinePreferences}
          className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-5"
        >
          <div>
            <h3 className="text-sm font-bold text-slate-900">Pipeline Stages & Board Display</h3>
            <p className="text-xs text-slate-500 mt-0.5">Customize default stage behaviors and terminal column visibility</p>
          </div>

          <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-lg text-xs text-amber-800 flex items-start gap-2">
            <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <span>
              <strong>Note:</strong> Custom pipeline stages are coming in a future release. The seven core stages (Identified, Contacted, Replied, Meeting, Proposal Sent, Won, Lost) reflect the battle-tested high-ticket sales cadence.
            </span>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Default Stage for New Leads</label>
              <select
                value={defaultStage}
                onChange={(e) => setDefaultStage(e.target.value)}
                className="w-full max-w-xs px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
              >
                <option value="IDENTIFIED">Identified</option>
                <option value="CONTACTED">Contacted</option>
                <option value="REPLIED">Replied</option>
                <option value="MEETING">Meeting / Discovery</option>
              </select>
            </div>

            <label className="flex items-center gap-2 cursor-pointer pt-2">
              <input
                type="checkbox"
                checked={hideTerminalStages}
                onChange={(e) => setHideTerminalStages(e.target.checked)}
                className="w-4 h-4 rounded text-slate-900 focus:ring-slate-900"
              />
              <span className="text-xs font-semibold text-slate-800">
                Hide Won and Lost columns on board view (Display preference only)
              </span>
            </label>
          </div>

          <div className="pt-3 border-t border-slate-100 flex justify-end">
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors shadow-xs"
            >
              Save Pipeline Preferences
            </button>
          </div>
        </form>
      )}

      {/* ========================================================= */}
      {/* 4. DATA TAB */}
      {/* ========================================================= */}
      {activeTab === 'data' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Export Your CRM Data</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Download all your leads, scheduled follow-ups, interaction logs, and activity records.
              </p>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600">
              <p className="font-semibold text-slate-900 mb-0.5">Data Privacy Notice</p>
              Exported archives contain client email addresses, notes, and deal financial values. Ensure you store exported files securely.
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => handleExportData('csv')}
                className="px-4 py-2 text-xs font-semibold text-slate-800 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors inline-flex items-center gap-2"
              >
                <Download className="w-3.5 h-3.5" />
                Export Leads (CSV)
              </button>

              <button
                type="button"
                onClick={() => handleExportData('json')}
                className="px-4 py-2 text-xs font-semibold text-slate-800 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors inline-flex items-center gap-2"
              >
                <Download className="w-3.5 h-3.5" />
                Export Full Database (JSON)
              </button>
            </div>
          </div>

          {/* Danger Zone: Delete Account */}
          <div className="bg-rose-50/50 rounded-xl border border-rose-200 p-6 shadow-xs space-y-3">
            <div>
              <h4 className="text-sm font-bold text-rose-900 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600" />
                Danger Zone: Delete Account
              </h4>
              <p className="text-xs text-rose-700 mt-0.5">
                Permanently deletes your account and all associated records (leads, interactions, follow-ups, and logs). This action cannot be undone.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setIsDeleteModalOpen(true)}
              className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 rounded-lg hover:bg-rose-700 transition-colors inline-flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete My Account
            </button>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 5. ABOUT TAB */}
      {/* ========================================================= */}
      {activeTab === 'about' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4 text-xs">
          <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
            <img
              src="/src/assets/images/emperor_crm_hero_mark_1792326782934.jpg"
              alt="Emperor CRM"
              className="w-10 h-10 rounded-xl object-cover border border-slate-200"
              referrerPolicy="no-referrer"
            />
            <div>
              <h3 className="text-sm font-bold text-slate-900">Emperor CRM v1.0.0</h3>
              <p className="text-slate-500">Built for high-velocity software freelancers, consultants, and operators</p>
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="font-semibold text-slate-900">What is included in v1:</h4>
            <ul className="list-disc list-inside space-y-1 text-slate-600">
              <li>High-performance PostgreSQL schema with GIN trigram indexing for instant lead search</li>
              <li>Argon2id password hashing and secure JWT session management</li>
              <li>Visual dnd-kit drag-and-drop pipeline board with optimistic UI and rollback protection</li>
              <li>Fully accessible non-drag alternative and tabular list view</li>
              <li>Timeline logging for email, phone calls, meetings, and messages grouped by month</li>
              <li>Automated next-follow-up synchronization linked to actionable tasks</li>
              <li>Aggregated financial reports tracking deal win-rates and revenue by channel</li>
              <li>Admin/Operator consent access grant model with audit logging</li>
            </ul>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-slate-500">
            <span>© 2026 Emperor CRM. All rights reserved.</span>
            <a
              href="mailto:support@emperorcrm.test"
              className="font-semibold text-slate-900 hover:underline"
            >
              Contact Support
            </a>
          </div>
        </div>
      )}

      {/* Delete Account Modal Dialog */}
      <ConfirmDialog
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDeleteAccount}
        title="Permanently Delete Your Account"
        description="This will permanently delete your account, your pipeline leads, all interaction history, and scheduled tasks. To proceed, please type DELETE below and re-enter your password."
        confirmLabel="Permanently Delete Account"
        variant="danger"
        loading={deleteLoading}
      >
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Type <span className="font-mono text-rose-600 font-bold">DELETE</span> to confirm
            </label>
            <input
              type="text"
              value={deleteConfirmationInput}
              onChange={(e) => setDeleteConfirmationInput(e.target.value)}
              placeholder="DELETE"
              className="w-full px-3 py-2 text-xs font-mono border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Confirm Your Password</label>
            <input
              type="password"
              value={deletePasswordInput}
              onChange={(e) => setDeletePasswordInput(e.target.value)}
              placeholder="••••••••••"
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
          </div>
        </div>
      </ConfirmDialog>
    </div>
  );
}
