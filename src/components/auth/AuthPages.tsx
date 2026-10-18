import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { useToast } from '../../context/ToastContext';
import { Lock, Mail, User, Clock, ArrowRight, ShieldCheck, CheckCircle2 } from 'lucide-react';

interface AuthPageProps {
  view: 'login' | 'register' | 'forgot-password' | 'reset-password';
  onNavigate: (path: string) => void;
  resetToken?: string;
}

export function AuthPages({ view, onNavigate, resetToken: initialResetToken }: AuthPageProps) {
  const { login, register } = useAuth();
  const { success, error: toastError } = useToast();

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Register form state
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirm, setRegConfirm] = useState('');
  const [regTimezone, setRegTimezone] = useState('UTC');

  // Forgot password state
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSent, setForgotSent] = useState(false);

  // Reset password state
  const [resetToken, setResetToken] = useState(initialResetToken || '');
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [resetDone, setResetDone] = useState(false);

  // Auto-detect timezone
  useEffect(() => {
    try {
      const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (detected) setRegTimezone(detected);
    } catch {
      setRegTimezone('UTC');
    }
  }, []);

  // Quick fill helper for review
  const handleQuickLogin = (email: string) => {
    setLoginEmail(email);
    setLoginPassword('Password123!');
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    if (!loginEmail || !loginPassword) {
      setErrors({ form: 'Email and password are required.' });
      return;
    }

    setLoading(true);
    try {
      await login({ email: loginEmail, password: loginPassword });
      success('Welcome back', 'Signed in successfully.');
      onNavigate('/dashboard');
    } catch (err: any) {
      setErrors({ form: err.message || 'Invalid email or password.' });
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    const errs: Record<string, string> = {};

    if (regName.trim().length < 2 || regName.trim().length > 80) {
      errs.name = 'Name must be between 2 and 80 characters.';
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(regEmail.trim())) {
      errs.email = 'Please provide a valid email address.';
    }
    if (regPassword.length < 10 || !/^(?=.*[A-Za-z])(?=.*\d)/.test(regPassword)) {
      errs.password = 'Password must be at least 10 characters and contain letters and numbers.';
    }
    if (regPassword !== regConfirm) {
      errs.confirm = 'Passwords do not match.';
    }

    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    setLoading(true);
    try {
      await register({
        name: regName.trim(),
        email: regEmail.trim(),
        password: regPassword,
        confirmPassword: regConfirm,
        timezone: regTimezone,
      });
      success('Account created', 'Welcome to Emperor CRM!');
      onNavigate('/dashboard');
    } catch (err: any) {
      setErrors({ form: err.message || 'Registration failed.' });
    } finally {
      setLoading(false);
    }
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail) return;

    setLoading(true);
    try {
      await api.forgotPassword(forgotEmail);
      setForgotSent(true);
    } catch (err: any) {
      toastError('Request failed', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    if (!resetToken.trim()) {
      setErrors({ token: 'Reset token is required.' });
      return;
    }
    if (resetNewPassword.length < 10 || !/^(?=.*[A-Za-z])(?=.*\d)/.test(resetNewPassword)) {
      setErrors({ password: 'Password must be at least 10 characters with letters and numbers.' });
      return;
    }

    setLoading(true);
    try {
      await api.resetPassword({ token: resetToken.trim(), newPassword: resetNewPassword });
      setResetDone(true);
      success('Password reset complete', 'You can now sign in with your new password.');
    } catch (err: any) {
      setErrors({ form: err.message || 'Password reset failed.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <img
          src="/src/assets/images/emperor_crm_hero_mark_1792326782934.jpg"
          alt="Emperor CRM"
          className="w-14 h-14 rounded-2xl mx-auto object-cover shadow-sm border border-slate-200"
          referrerPolicy="no-referrer"
        />
        <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-900">Emperor CRM</h1>
        <p className="mt-1 text-xs text-slate-500">The high-velocity relationship OS for top freelancers</p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4">
        <div className="bg-white py-8 px-6 shadow-sm rounded-2xl border border-slate-200 sm:px-10">
          {/* ======================================= */}
          {/* LOGIN VIEW */}
          {/* ======================================= */}
          {view === 'login' && (
            <div>
              <div className="mb-6">
                <h2 className="text-lg font-bold text-slate-900">Sign in to your account</h2>
                <p className="text-xs text-slate-500 mt-0.5">Enter your credentials to access your pipeline</p>
              </div>

              {errors.form && (
                <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700">
                  {errors.form}
                </div>
              )}

              <form onSubmit={handleLoginSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="email-input">
                    Email Address
                  </label>
                  <div className="relative">
                    <input
                      id="email-input"
                      type="email"
                      required
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      placeholder="you@domain.com"
                      className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                    />
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-slate-700" htmlFor="password-input">
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => onNavigate('/forgot-password')}
                      className="text-xs font-medium text-slate-600 hover:text-slate-900 hover:underline"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      id="password-input"
                      type="password"
                      required
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="••••••••••"
                      className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                    />
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full mt-2 py-2.5 px-4 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loading ? (
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      Sign In
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </form>

              {/* Quick Demo Logins for instant evaluation */}
              <div className="mt-6 pt-6 border-t border-slate-100">
                <p className="text-[11px] font-semibold text-slate-600 mb-2">Demo Quick Sign-In:</p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleQuickLogin('demo@emperorcrm.test')}
                    className="p-2 text-left border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors text-[11px]"
                  >
                    <span className="font-semibold text-slate-800 block">Freelancer</span>
                    <span className="text-slate-600 block text-[10px]">demo@emperorcrm.test</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickLogin('admin@emperorcrm.test')}
                    className="p-2 text-left border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors text-[11px]"
                  >
                    <span className="font-semibold text-amber-800 block">Admin</span>
                    <span className="text-slate-600 block text-[10px]">admin@emperorcrm.test</span>
                  </button>
                </div>
              </div>

              <div className="mt-6 text-center text-xs text-slate-500">
                Do not have an account?{' '}
                <button
                  onClick={() => onNavigate('/register')}
                  className="font-semibold text-slate-900 hover:underline"
                >
                  Create account
                </button>
              </div>
            </div>
          )}

          {/* ======================================= */}
          {/* REGISTER VIEW */}
          {/* ======================================= */}
          {view === 'register' && (
            <div>
              <div className="mb-6">
                <h2 className="text-lg font-bold text-slate-900">Create your account</h2>
                <p className="text-xs text-slate-500 mt-0.5">Start organizing high-value freelance clients</p>
              </div>

              {errors.form && (
                <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700">
                  {errors.form}
                </div>
              )}

              <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      value={regName}
                      onChange={(e) => setRegName(e.target.value)}
                      placeholder="e.g. Elena Rostova"
                      className={`w-full pl-9 pr-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 ${
                        errors.name ? 'border-rose-400 bg-rose-50/30' : 'border-slate-200'
                      }`}
                    />
                    <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  </div>
                  {errors.name && <p className="text-[11px] text-rose-600 mt-1">{errors.name}</p>}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
                  <div className="relative">
                    <input
                      type="email"
                      required
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      placeholder="you@domain.com"
                      className={`w-full pl-9 pr-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 ${
                        errors.email ? 'border-rose-400 bg-rose-50/30' : 'border-slate-200'
                      }`}
                    />
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  </div>
                  {errors.email && <p className="text-[11px] text-rose-600 mt-1">{errors.email}</p>}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Password</label>
                  <div className="relative">
                    <input
                      type="password"
                      required
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      placeholder="Min 10 characters (letters + numbers)"
                      className={`w-full pl-9 pr-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 ${
                        errors.password ? 'border-rose-400 bg-rose-50/30' : 'border-slate-200'
                      }`}
                    />
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  </div>
                  {errors.password && <p className="text-[11px] text-rose-600 mt-1">{errors.password}</p>}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Confirm Password</label>
                  <div className="relative">
                    <input
                      type="password"
                      required
                      value={regConfirm}
                      onChange={(e) => setRegConfirm(e.target.value)}
                      placeholder="Repeat password"
                      className={`w-full pl-9 pr-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 ${
                        errors.confirm ? 'border-rose-400 bg-rose-50/30' : 'border-slate-200'
                      }`}
                    />
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  </div>
                  {errors.confirm && <p className="text-[11px] text-rose-600 mt-1">{errors.confirm}</p>}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-slate-700">Timezone</label>
                    <span className="text-[10px] text-slate-600">Auto-detected</span>
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      value={regTimezone}
                      onChange={(e) => setRegTimezone(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                    />
                    <Clock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full mt-4 py-2.5 px-4 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loading ? (
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      Register & Go to Dashboard
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </form>

              <div className="mt-6 text-center text-xs text-slate-500">
                Already have an account?{' '}
                <button
                  onClick={() => onNavigate('/login')}
                  className="font-semibold text-slate-900 hover:underline"
                >
                  Sign in
                </button>
              </div>
            </div>
          )}

          {/* ======================================= */}
          {/* FORGOT PASSWORD VIEW */}
          {/* ======================================= */}
          {view === 'forgot-password' && (
            <div>
              <div className="mb-6">
                <h2 className="text-lg font-bold text-slate-900">Reset your password</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Enter your registered email address to receive reset instructions
                </p>
              </div>

              {forgotSent ? (
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-center space-y-3">
                  <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
                  <p className="text-xs font-medium text-emerald-900 leading-relaxed">
                    If an account exists with this email, you will receive password reset instructions.
                  </p>
                  <p className="text-[11px] text-slate-500">
                    In development mode, check your console log for the direct reset token URL.
                  </p>
                  <div className="pt-2">
                    <button
                      onClick={() => onNavigate('/reset-password')}
                      className="px-3 py-1.5 text-xs font-semibold text-slate-800 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
                    >
                      Enter Token Manually →
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleForgotSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
                    <div className="relative">
                      <input
                        type="email"
                        required
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        placeholder="you@domain.com"
                        className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                      />
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {loading ? (
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      'Send Reset Instructions'
                    )}
                  </button>
                </form>
              )}

              <div className="mt-6 text-center text-xs text-slate-500">
                Remembered your password?{' '}
                <button
                  onClick={() => onNavigate('/login')}
                  className="font-semibold text-slate-900 hover:underline"
                >
                  Return to sign in
                </button>
              </div>
            </div>
          )}

          {/* ======================================= */}
          {/* RESET PASSWORD VIEW */}
          {/* ======================================= */}
          {view === 'reset-password' && (
            <div>
              <div className="mb-6">
                <h2 className="text-lg font-bold text-slate-900">Set new password</h2>
                <p className="text-xs text-slate-500 mt-0.5">Provide the 32-byte reset token and your new password</p>
              </div>

              {resetDone ? (
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-center space-y-3">
                  <ShieldCheck className="w-8 h-8 text-emerald-600 mx-auto" />
                  <p className="text-xs font-medium text-emerald-900">
                    Your password has been reset successfully.
                  </p>
                  <button
                    onClick={() => onNavigate('/login')}
                    className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800"
                  >
                    Sign In With New Password
                  </button>
                </div>
              ) : (
                <form onSubmit={handleResetSubmit} className="space-y-3.5">
                  {errors.form && (
                    <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700">
                      {errors.form}
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Reset Token</label>
                    <input
                      type="text"
                      required
                      value={resetToken}
                      onChange={(e) => setResetToken(e.target.value)}
                      placeholder="Paste 64-char token or link parameter"
                      className="w-full px-3 py-2 text-xs font-mono border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                    />
                    {errors.token && <p className="text-[11px] text-rose-600 mt-1">{errors.token}</p>}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">New Password</label>
                    <input
                      type="password"
                      required
                      value={resetNewPassword}
                      onChange={(e) => setResetNewPassword(e.target.value)}
                      placeholder="Min 10 characters (letters + numbers)"
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                    />
                    {errors.password && <p className="text-[11px] text-rose-600 mt-1">{errors.password}</p>}
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full mt-4 py-2.5 px-4 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {loading ? (
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      'Confirm New Password'
                    )}
                  </button>
                </form>
              )}

              <div className="mt-6 text-center text-xs text-slate-500">
                Back to{' '}
                <button
                  onClick={() => onNavigate('/login')}
                  className="font-semibold text-slate-900 hover:underline"
                >
                  Sign in
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
