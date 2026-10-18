import React, { useState, useEffect } from 'react';
import { Shield, Users, KeyRound, History, ArrowLeft, AlertCircle } from 'lucide-react';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { LoadingSkeleton } from '../common/LoadingSkeleton';
import { ErrorState } from '../common/ErrorState';

interface AdminViewProps {
  onNavigate: (path: string) => void;
}

export function AdminView({ onNavigate }: AdminViewProps) {
  const { user } = useAuth();
  const [tab, setTab] = useState<'users' | 'access' | 'audit'>('users');
  const [loading, setLoading] = useState(true);
  const [forbidden404, setForbidden404] = useState(false);

  const [users, setUsers] = useState<any[]>([]);
  const [grants, setGrants] = useState<any[]>([]);
  const [audit, setAudit] = useState<any[]>([]);

  // If user is FREELANCER, prompt explicitly specifies: "Visiting /admin as a FREELANCER returns 404"
  useEffect(() => {
    if (user && user.role !== 'ADMIN' && user.role !== 'OPERATOR') {
      setForbidden404(true);
      setLoading(false);
      return;
    }

    const loadAdminData = async () => {
      setLoading(true);
      try {
        const [u, g, a] = await Promise.all([
          api.getAdminUsers(),
          api.getAdminAccess(),
          api.getAdminAudit(),
        ]);
        setUsers(u);
        setGrants(g);
        setAudit(a);
      } catch (err: any) {
        if (err.status === 404 || err.code === 'NOT_FOUND') {
          setForbidden404(true);
        }
      } finally {
        setLoading(false);
      }
    };

    loadAdminData();
  }, [user]);

  if (forbidden404) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center bg-white rounded-xl border border-slate-200">
        <h2 className="text-xl font-bold text-slate-900 mb-2">404 — Page Not Found</h2>
        <p className="text-xs text-slate-500 max-w-sm mb-6">
          The requested URL could not be found on this server.
        </p>
        <button
          onClick={() => onNavigate('/dashboard')}
          className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800"
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  if (loading) return <LoadingSkeleton variant="table" />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="pb-4 border-b border-slate-200 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Shield className="w-5 h-5 text-amber-600" />
            Admin & Operator Console
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            System tenant overview, user authorization roles, and support access consent records
          </p>
        </div>
        <span className="text-xs font-semibold text-amber-900 bg-amber-50 px-2.5 py-1 rounded border border-amber-200">
          Role: {user?.role}
        </span>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setTab('users')}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
            tab === 'users' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          Registered Users ({users.length})
        </button>

        <button
          onClick={() => setTab('access')}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
            tab === 'access' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <KeyRound className="w-3.5 h-3.5" />
          Support Access Grants ({grants.length})
        </button>

        <button
          onClick={() => setTab('audit')}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
            tab === 'audit' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          System Audit Trail ({audit.length})
        </button>
      </div>

      {/* ========================================================= */}
      {/* 1. USERS TABLE */}
      {/* ========================================================= */}
      {tab === 'users' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-4">User</th>
                <th className="py-3 px-4">Email</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Timezone</th>
                <th className="py-3 px-4 text-center">Leads</th>
                <th className="py-3 px-4 text-center">Tasks</th>
                <th className="py-3 px-4">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50/70">
                  <td className="py-3 px-4 font-semibold text-slate-900">{u.name}</td>
                  <td className="py-3 px-4 text-slate-600 font-mono text-[11px]">{u.email}</td>
                  <td className="py-3 px-4">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                        u.role === 'ADMIN'
                          ? 'bg-amber-100 text-amber-800'
                          : u.role === 'OPERATOR'
                          ? 'bg-purple-100 text-purple-800'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {u.role}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-600">{u.timezone}</td>
                  <td className="py-3 px-4 text-center font-bold text-slate-900 tabular-nums">
                    {u._count?.leads || 0}
                  </td>
                  <td className="py-3 px-4 text-center font-bold text-slate-900 tabular-nums">
                    {u._count?.tasks || 0}
                  </td>
                  <td className="py-3 px-4 text-slate-500 tabular-nums">
                    {new Date(u.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ========================================================= */}
      {/* 2. SUPPORT ACCESS GRANTS */}
      {/* ========================================================= */}
      {tab === 'access' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-4">Subject User (Data Owner)</th>
                <th className="py-3 px-4">Granted To</th>
                <th className="py-3 px-4">Reason & Justification</th>
                <th className="py-3 px-4">Scope</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Expires At</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {grants.map((g) => (
                <tr key={g.id} className="hover:bg-slate-50/70">
                  <td className="py-3 px-4">
                    <span className="font-semibold text-slate-900 block">{g.subjectUser?.name}</span>
                    <span className="text-[10px] text-slate-500 block">{g.subjectUser?.email}</span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="font-semibold text-slate-900 block">{g.grantedToUser?.name}</span>
                    <span className="text-[10px] text-slate-500 block">{g.grantedToUser?.email}</span>
                  </td>
                  <td className="py-3 px-4 text-slate-700 max-w-xs">{g.reason}</td>
                  <td className="py-3 px-4 font-mono text-[11px] font-semibold text-slate-700">{g.scope}</td>
                  <td className="py-3 px-4">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                        g.status === 'ACTIVE'
                          ? 'bg-emerald-100 text-emerald-800'
                          : g.status === 'PENDING'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {g.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-500 tabular-nums">
                    {new Date(g.expiresAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ========================================================= */}
      {/* 3. AUDIT TRAIL */}
      {/* ========================================================= */}
      {tab === 'audit' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-4">Actor</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Lead Opportunity</th>
                <th className="py-3 px-4">Details</th>
                <th className="py-3 px-4">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {audit.map((a) => (
                <tr key={a.id} className="hover:bg-slate-50/70">
                  <td className="py-3 px-4">
                    <span className="font-semibold text-slate-900 block">{a.user?.name}</span>
                    <span className="text-[10px] text-slate-500 font-mono block">{a.actorRole}</span>
                  </td>
                  <td className="py-3 px-4 font-mono font-bold text-slate-800 text-[11px]">{a.action}</td>
                  <td className="py-3 px-4 text-slate-700">{a.lead ? a.lead.name : '—'}</td>
                  <td className="py-3 px-4 text-slate-600 font-mono text-[10px] max-w-xs truncate">
                    {a.details ? JSON.stringify(a.details) : '—'}
                  </td>
                  <td className="py-3 px-4 text-slate-500 tabular-nums">
                    {new Date(a.createdAt).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
