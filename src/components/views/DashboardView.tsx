import React, { useState, useEffect, useCallback } from 'react';
import {
  Users,
  Calendar,
  AlertCircle,
  FileCheck2,
  DollarSign,
  Plus,
  CheckCircle2,
  Clock,
  ArrowRight,
  ExternalLink,
  Kanban,
} from 'lucide-react';
import { api } from '../../lib/api';
import { DashboardStats, PipelineSnapshotStage, Task, Activity } from '../../types/crm';
import { LoadingSkeleton } from '../common/LoadingSkeleton';
import { ErrorState } from '../common/ErrorState';
import { EmptyState } from '../common/EmptyState';
import { AddLeadModal } from '../common/AddLeadModal';
import { AddTaskModal } from '../common/AddTaskModal';
import { useToast } from '../../context/ToastContext';

interface DashboardViewProps {
  onNavigate: (path: string) => void;
}

export function DashboardView({ onNavigate }: DashboardViewProps) {
  const { success, error } = useToast();
  const [loading, setLoading] = useState(true);
  const [errorState, setErrorState] = useState<string | null>(null);

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [todayFollowUps, setTodayFollowUps] = useState<Task[]>([]);
  const [pipelineSnapshot, setPipelineSnapshot] = useState<PipelineSnapshotStage[]>([]);
  const [recentActivity, setRecentActivity] = useState<Activity[]>([]);

  const [isAddLeadOpen, setIsAddLeadOpen] = useState(false);
  const [isAddTaskOpen, setIsAddTaskOpen] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setErrorState(null);
    try {
      const data = await api.getDashboard();
      setStats(data.stats);
      setTodayFollowUps(data.todayFollowUps);
      setPipelineSnapshot(data.pipelineSnapshot);
      setRecentActivity(data.recentActivity);
    } catch (err: any) {
      setErrorState(err.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();

    const handleDataChanged = () => loadData();
    window.addEventListener('emperor:data-changed', handleDataChanged);
    return () => window.removeEventListener('emperor:data-changed', handleDataChanged);
  }, [loadData]);

  const handleToggleTask = async (task: Task) => {
    try {
      if (task.status === 'COMPLETED') {
        await api.reopenTask(task.id);
        success('Task reopened');
      } else {
        await api.completeTask(task.id);
        success('Task completed', `"${task.title}" marked completed.`);
      }
      loadData();
    } catch (err: any) {
      error('Failed to update task', err.message);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <LoadingSkeleton variant="cards" />
        <LoadingSkeleton variant="table" />
      </div>
    );
  }

  if (errorState || !stats) {
    return <ErrorState message={errorState || undefined} onRetry={loadData} />;
  }

  // Format currency
  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(
      amount
    );
  };

  // Check if completely new user
  const isNewUser = stats.activeLeads === 0 && stats.wonDealsCount === 0 && recentActivity.length === 0;

  return (
    <div className="space-y-6">
      {/* Onboarding block for brand-new users */}
      {isNewUser ? (
        <div className="p-8 bg-white rounded-2xl border border-slate-200 shadow-sm text-center max-w-2xl mx-auto my-6">
          <div className="w-12 h-12 rounded-xl bg-slate-900 text-white flex items-center justify-center mx-auto mb-4">
            <Plus className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-slate-900">Start by adding your first prospect</h2>
          <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-6 leading-relaxed">
            Emperor CRM helps you track client discovery, automate follow-ups, and convert high-ticket freelance engagements.
          </p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => setIsAddLeadOpen(true)}
              className="px-4 py-2.5 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors shadow-xs"
            >
              Add First Lead
            </button>
            <button
              onClick={() => onNavigate('/pipeline')}
              className="px-4 py-2.5 text-xs font-semibold text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
            >
              Explore Pipeline
            </button>
          </div>
        </div>
      ) : null}

      {/* 5 Stat Cards (Desktop 5-up, Mobile 2-up then 1-up) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        {/* Card 1: Active Leads */}
        <button
          onClick={() => onNavigate('/leads')}
          className="p-4 bg-white rounded-xl border border-slate-200 hover:border-slate-300 transition-all text-left shadow-xs flex flex-col justify-between group"
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-[11px] font-semibold text-slate-600">Active Leads</span>
            <Users className="w-4 h-4 text-slate-400 group-hover:text-slate-900 transition-colors" />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-900 tabular-nums">{stats.activeLeads}</p>
            <span className="text-[10px] text-slate-600 flex items-center gap-1 mt-1 font-medium">
              View all prospects <ArrowRight className="w-3 h-3" />
            </span>
          </div>
        </button>

        {/* Card 2: Due Today */}
        <button
          onClick={() => onNavigate('/tasks?filter=today')}
          className="p-4 bg-white rounded-xl border border-slate-200 hover:border-slate-300 transition-all text-left shadow-xs flex flex-col justify-between group"
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-[11px] font-semibold text-slate-600">Due Today</span>
            <Calendar className="w-4 h-4 text-slate-400 group-hover:text-slate-900 transition-colors" />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-900 tabular-nums">{stats.followUpsDueToday}</p>
            <span className="text-[10px] text-slate-600 flex items-center gap-1 mt-1 font-medium">
              Scheduled tasks <ArrowRight className="w-3 h-3" />
            </span>
          </div>
        </button>

        {/* Card 3: Overdue Follow-ups (Red styling when > 0) */}
        <button
          onClick={() => onNavigate('/tasks?filter=overdue')}
          className={`p-4 rounded-xl border transition-all text-left shadow-xs flex flex-col justify-between group ${
            stats.overdueFollowUps > 0
              ? 'bg-rose-50/40 border-rose-200 hover:border-rose-300'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span
              className={`text-[11px] font-semibold ${
                stats.overdueFollowUps > 0 ? 'text-rose-700' : 'text-slate-600'
              }`}
            >
              Overdue Follow-ups
            </span>
            <AlertCircle
              className={`w-4 h-4 ${stats.overdueFollowUps > 0 ? 'text-rose-500' : 'text-slate-400'}`}
            />
          </div>
          <div>
            <p
              className={`text-2xl font-bold tabular-nums ${
                stats.overdueFollowUps > 0 ? 'text-rose-600' : 'text-slate-900'
              }`}
            >
              {stats.overdueFollowUps}
            </p>
            <span
              className={`text-[10px] flex items-center gap-1 mt-1 font-medium ${
                stats.overdueFollowUps > 0 ? 'text-rose-700 font-semibold' : 'text-slate-600'
              }`}
            >
              Action required <ArrowRight className="w-3 h-3" />
            </span>
          </div>
        </button>

        {/* Card 4: Proposals Awaiting Response */}
        <button
          onClick={() => onNavigate('/pipeline')}
          className="p-4 bg-white rounded-xl border border-slate-200 hover:border-slate-300 transition-all text-left shadow-xs flex flex-col justify-between group"
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-[11px] font-semibold text-slate-600">Awaiting Response</span>
            <FileCheck2 className="w-4 h-4 text-slate-400 group-hover:text-slate-900 transition-colors" />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-900 tabular-nums">{stats.proposalsAwaitingResponse}</p>
            <span className="text-[10px] text-slate-600 flex items-center gap-1 mt-1 font-medium">
              In Proposal Sent <ArrowRight className="w-3 h-3" />
            </span>
          </div>
        </button>

        {/* Card 5: Won Deals + Recorded Revenue */}
        <button
          onClick={() => onNavigate('/reports')}
          className="p-4 bg-white rounded-xl border border-slate-200 hover:border-slate-300 transition-all text-left shadow-xs flex flex-col justify-between group col-span-2 sm:col-span-1"
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-[11px] font-semibold text-slate-600">Won Revenue</span>
            <DollarSign className="w-4 h-4 text-emerald-600 group-hover:text-emerald-700 transition-colors" />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-900 tabular-nums">{formatMoney(stats.recordedRevenue)}</p>
            <span className="text-[10px] text-slate-600 flex items-center gap-1 mt-1 font-medium">
              {stats.wonDealsCount} closed deal{stats.wonDealsCount === 1 ? '' : 's'} <ArrowRight className="w-3 h-3" />
            </span>
          </div>
        </button>
      </div>

      {/* Main Grid: Today's Follow-ups + Pipeline Snapshot */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 Cols): Today's Follow-ups */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Today's Follow-ups</h3>
                <p className="text-xs text-slate-500">Urgent commitments and scheduled client touchpoints</p>
              </div>
              <button
                onClick={() => setIsAddTaskOpen(true)}
                className="text-xs font-semibold text-slate-900 hover:underline inline-flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                Add task
              </button>
            </div>

            <div className="divide-y divide-slate-100 mt-2">
              {todayFollowUps.length === 0 ? (
                <div className="py-8 text-center">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                  <p className="text-xs font-semibold text-slate-800">You're all caught up.</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">No tasks are due today or overdue.</p>
                </div>
              ) : (
                todayFollowUps.map((task) => {
                  const isOverdue = new Date(task.dueAt).getTime() < Date.now();
                  return (
                    <div
                      key={task.id}
                      className="py-3 flex items-start gap-3 hover:bg-slate-50/70 rounded-lg px-2 transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={task.status === 'COMPLETED'}
                        onChange={() => handleToggleTask(task)}
                        className="mt-0.5 w-4 h-4 rounded text-slate-900 focus:ring-slate-900 cursor-pointer"
                        aria-label={`Mark task completed: ${task.title}`}
                      />
                      <div className="flex-1 min-w-0">
                        <p
                          className={`text-xs font-medium ${
                            task.status === 'COMPLETED' ? 'line-through text-slate-400' : 'text-slate-900'
                          }`}
                        >
                          {task.title}
                        </p>
                        <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500">
                          {task.lead ? (
                            <button
                              onClick={() => onNavigate(`/leads/${task.lead!.id}`)}
                              className="font-semibold text-slate-700 hover:text-slate-900 hover:underline truncate max-w-xs"
                            >
                              {task.lead.name}
                            </button>
                          ) : (
                            <span className="text-slate-600 font-medium">Standalone task</span>
                          )}
                          <span aria-hidden="true">·</span>
                          <span className={isOverdue ? 'text-rose-600 font-semibold' : 'text-slate-500'}>
                            {isOverdue ? 'Overdue' : 'Due today'}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Pipeline Snapshot */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Pipeline Snapshot</h3>
                <p className="text-xs text-slate-500">Active distribution across deal stages</p>
              </div>
              <button
                onClick={() => onNavigate('/pipeline')}
                className="text-xs font-semibold text-slate-900 hover:underline inline-flex items-center gap-1"
              >
                <Kanban className="w-3.5 h-3.5" />
                View Board
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {[
                { stage: 'IDENTIFIED', label: 'Identified' },
                { stage: 'CONTACTED', label: 'Contacted' },
                { stage: 'REPLIED', label: 'Replied' },
                { stage: 'MEETING', label: 'Meeting' },
                { stage: 'PROPOSAL_SENT', label: 'Proposal Sent' },
                { stage: 'WON', label: 'Won' },
                { stage: 'LOST', label: 'Lost' },
              ].map((item) => {
                const found = pipelineSnapshot.find((p) => p.stage === item.stage);
                const count = found?.count || 0;
                const value = found?.potentialValue || 0;
                return (
                  <div
                    key={item.stage}
                    onClick={() => onNavigate('/pipeline')}
                    className="p-3 bg-slate-50 rounded-lg border border-slate-100 hover:border-slate-200 cursor-pointer transition-colors"
                  >
                    <span className="text-[10px] font-semibold text-slate-600 block uppercase">
                      {item.label}
                    </span>
                    <span className="text-lg font-bold text-slate-900 block tabular-nums mt-0.5">{count}</span>
                    <span className="text-[10px] text-slate-600 font-mono block tabular-nums">
                      {value > 0 ? formatMoney(value) : '$0'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Recent Activity Log */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs h-full">
            <div className="pb-3 border-b border-slate-100 mb-3">
              <h3 className="text-sm font-bold text-slate-900">Recent Activity</h3>
              <p className="text-xs text-slate-500">Live timeline of CRM updates</p>
            </div>

            <div className="space-y-3.5">
              {recentActivity.length === 0 ? (
                <p className="text-xs text-slate-600 py-6 text-center">No recent activity recorded yet.</p>
              ) : (
                recentActivity.map((act) => {
                  const timeAgo = new Date(act.createdAt).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  });

                  return (
                    <div key={act.id} className="flex items-start gap-2.5 text-xs">
                      <div className="w-1.5 h-1.5 rounded-full bg-slate-400 mt-1.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-slate-800 font-medium leading-relaxed">
                          <span className="font-semibold text-slate-900">{act.action}</span>
                          {act.lead && (
                            <>
                              {' on '}
                              <span
                                onClick={() => onNavigate(`/leads/${act.lead!.id}`)}
                                className="font-semibold text-slate-900 hover:underline cursor-pointer"
                              >
                                {act.lead.name}
                              </span>
                            </>
                          )}
                        </p>
                        <span className="text-[10px] text-slate-600 block mt-0.5 tabular-nums">{timeAgo}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Add Lead Modal */}
      <AddLeadModal
        isOpen={isAddLeadOpen}
        onClose={() => setIsAddLeadOpen(false)}
        onSuccess={() => {
          loadData();
          window.dispatchEvent(new CustomEvent('emperor:data-changed'));
        }}
      />

      {/* Add Task Modal */}
      <AddTaskModal
        isOpen={isAddTaskOpen}
        onClose={() => setIsAddTaskOpen(false)}
        onSuccess={() => {
          loadData();
          window.dispatchEvent(new CustomEvent('emperor:data-changed'));
        }}
      />
    </div>
  );
}
