import React, { useState, useEffect, useCallback } from 'react';
import {
  CheckSquare,
  Clock,
  Calendar,
  AlertCircle,
  Plus,
  MoreVertical,
  Edit2,
  Trash2,
  XCircle,
  RotateCcw,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Task } from '../../types/crm';
import { api } from '../../lib/api';
import { useToast } from '../../context/ToastContext';
import { AddTaskModal } from '../common/AddTaskModal';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { EmptyState } from '../common/EmptyState';
import { LoadingSkeleton } from '../common/LoadingSkeleton';

interface TasksViewProps {
  onNavigate: (path: string) => void;
}

export function TasksView({ onNavigate }: TasksViewProps) {
  const { success, error } = useToast();

  const [activeTab, setActiveTab] = useState<'all' | 'overdue' | 'today' | 'upcoming' | 'completed'>('all');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [counts, setCounts] = useState({ overdue: 0, today: 0, upcoming: 0, completed: 0, totalOpen: 0 });
  const [loading, setLoading] = useState(true);

  // Modals
  const [isAddTaskOpen, setIsAddTaskOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Task | null>(null);
  const [showCompletedCollapsed, setShowCompletedCollapsed] = useState(true);

  // Read URL query parameter for filter (e.g. ?filter=overdue)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const filterParam = params.get('filter');
    if (filterParam && ['all', 'overdue', 'today', 'upcoming', 'completed'].includes(filterParam)) {
      setActiveTab(filterParam as any);
    }
  }, []);

  const loadTasks = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getTasks(activeTab);
      setTasks(res.tasks);
      setCounts(res.counts);
    } catch (err: any) {
      error('Failed to load tasks', err.message);
    } finally {
      setLoading(false);
    }
  }, [activeTab, error]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  // Tab switch
  const handleTabChange = (tab: 'all' | 'overdue' | 'today' | 'upcoming' | 'completed') => {
    setActiveTab(tab);
    const params = new URLSearchParams(window.location.search);
    if (tab === 'all') params.delete('filter');
    else params.set('filter', tab);

    const newQuery = params.toString();
    const newPath = window.location.pathname + (newQuery ? `?${newQuery}` : '');
    window.history.replaceState(null, '', newPath);
  };

  const handleToggleTask = async (task: Task) => {
    try {
      if (task.status === 'COMPLETED') {
        await api.reopenTask(task.id);
        success('Task reopened', `"${task.title}" is active again.`);
      } else {
        await api.completeTask(task.id);
        success('Task completed', `"${task.title}" marked as finished.`);
      }
      loadTasks();
      window.dispatchEvent(new CustomEvent('emperor:data-changed'));
    } catch (err: any) {
      error('Task update failed', err.message);
    }
  };

  const handleCancelTask = async (task: Task) => {
    try {
      await api.cancelTask(task.id);
      success('Task cancelled', `"${task.title}" cancelled.`);
      loadTasks();
      window.dispatchEvent(new CustomEvent('emperor:data-changed'));
    } catch (err: any) {
      error('Failed to cancel task', err.message);
    }
  };

  const handleDeleteTask = async () => {
    if (!deleteTarget) return;
    try {
      await api.deleteTask(deleteTarget.id);
      success('Task deleted', 'Removed from schedule.');
      setDeleteTarget(null);
      loadTasks();
      window.dispatchEvent(new CustomEvent('emperor:data-changed'));
    } catch (err: any) {
      error('Failed to delete task', err.message);
    }
  };

  // Format relative label
  const getRelativeLabel = (dueAtStr: string, status: string) => {
    if (status === 'COMPLETED') return 'Completed';
    if (status === 'CANCELLED') return 'Cancelled';

    const target = new Date(dueAtStr);
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

    if (target < startOfToday) {
      const diffDays = Math.ceil((startOfToday.getTime() - target.getTime()) / (1000 * 60 * 60 * 24));
      return { text: `${diffDays} day${diffDays === 1 ? '' : 's'} overdue`, isOverdue: true };
    }
    if (target >= startOfToday && target <= endOfToday) {
      return { text: 'Due today', isToday: true };
    }
    const diffDays = Math.ceil((target.getTime() - endOfToday.getTime()) / (1000 * 60 * 60 * 24));
    return { text: `In ${diffDays} day${diffDays === 1 ? '' : 's'}`, isUpcoming: true };
  };

  // Group tasks into sections when 'all' tab is selected
  const nowTime = Date.now();
  const overdueTasks = tasks.filter((t) => t.status === 'PENDING' && new Date(t.dueAt).getTime() < nowTime);
  const dueTodayTasks = tasks.filter((t) => {
    if (t.status !== 'PENDING') return false;
    const d = new Date(t.dueAt);
    const n = new Date();
    return d.toDateString() === n.toDateString();
  });
  const upcomingTasks = tasks.filter((t) => {
    if (t.status !== 'PENDING') return false;
    const d = new Date(t.dueAt);
    const n = new Date();
    n.setHours(23, 59, 59, 999);
    return d.getTime() > n.getTime();
  });
  const completedTasks = tasks.filter((t) => t.status === 'COMPLETED' || t.status === 'CANCELLED');

  return (
    <div className="space-y-6">
      {/* Top Filter Tabs & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
        {/* Quick Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          <button
            onClick={() => handleTabChange('all')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
              activeTab === 'all'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            All Open ({counts.totalOpen})
          </button>

          <button
            onClick={() => handleTabChange('overdue')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
              activeTab === 'overdue'
                ? 'bg-rose-600 text-white shadow-xs'
                : counts.overdue > 0
                ? 'text-rose-600 font-bold hover:bg-rose-50'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            Overdue ({counts.overdue})
          </button>

          <button
            onClick={() => handleTabChange('today')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
              activeTab === 'today'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            Due Today ({counts.today})
          </button>

          <button
            onClick={() => handleTabChange('upcoming')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
              activeTab === 'upcoming'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            Upcoming ({counts.upcoming})
          </button>

          <button
            onClick={() => handleTabChange('completed')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
              activeTab === 'completed'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            Completed ({counts.completed})
          </button>
        </div>

        <button
          onClick={() => {
            setEditingTask(null);
            setIsAddTaskOpen(true);
          }}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors shadow-xs ml-auto"
        >
          <Plus className="w-3.5 h-3.5" />
          Schedule Task
        </button>
      </div>

      {loading ? (
        <LoadingSkeleton variant="table" />
      ) : tasks.length === 0 ? (
        <EmptyState
          icon={CheckSquare}
          title={
            activeTab === 'overdue'
              ? 'No overdue follow-ups!'
              : activeTab === 'today'
              ? 'No tasks due today.'
              : 'No follow-ups scheduled.'
          }
          description="Add a task so you do not lose track of critical client commitments and discovery calls."
          action={{
            label: 'Schedule First Task',
            onClick: () => {
              setEditingTask(null);
              setIsAddTaskOpen(true);
            },
          }}
        />
      ) : (
        <div className="space-y-6">
          {/* Render Task List */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs divide-y divide-slate-100">
            {tasks.map((task) => {
              const rel = getRelativeLabel(task.dueAt, task.status);
              const dueFormatted = new Date(task.dueAt).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
              });

              return (
                <div
                  key={task.id}
                  className="p-4 flex items-start sm:items-center justify-between gap-3 hover:bg-slate-50/80 transition-colors group"
                >
                  <div className="flex items-start sm:items-center gap-3 flex-1 min-w-0">
                    <input
                      type="checkbox"
                      checked={task.status === 'COMPLETED'}
                      onChange={() => handleToggleTask(task)}
                      className="mt-1 sm:mt-0 w-4 h-4 rounded text-slate-900 focus:ring-slate-900 cursor-pointer"
                      aria-label={`Mark task completed: ${task.title}`}
                    />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`text-xs font-semibold ${
                            task.status === 'COMPLETED'
                              ? 'line-through text-slate-400'
                              : task.status === 'CANCELLED'
                              ? 'line-through text-slate-400 italic'
                              : 'text-slate-900'
                          }`}
                        >
                          {task.title}
                        </span>

                        {typeof rel === 'object' && rel.isOverdue && (
                          <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-1.5 py-0.2 rounded border border-rose-200">
                            {rel.text}
                          </span>
                        )}

                        {typeof rel === 'object' && rel.isToday && (
                          <span className="text-[10px] font-semibold text-amber-800 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
                            Today
                          </span>
                        )}

                        {task.status === 'CANCELLED' && (
                          <span className="text-[10px] font-medium text-slate-600 bg-slate-100 px-1.5 py-0.2 rounded">
                            Cancelled
                          </span>
                        )}
                      </div>

                      {task.description && (
                        <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">{task.description}</p>
                      )}

                      <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-600 font-medium">
                        {task.lead ? (
                          <button
                            onClick={() => onNavigate(`/leads/${task.lead!.id}`)}
                            className="font-semibold text-slate-700 hover:text-slate-900 hover:underline truncate max-w-xs"
                          >
                            {task.lead.name} {task.lead.company ? `· ${task.lead.company}` : ''}
                          </button>
                        ) : (
                          <span className="text-slate-600 font-medium">No lead linked</span>
                        )}
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">{dueFormatted}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    {task.status === 'PENDING' && (
                      <button
                        onClick={() => handleCancelTask(task)}
                        className="p-1.5 text-slate-400 hover:text-amber-600 rounded hover:bg-amber-50 transition-colors"
                        title="Cancel Task"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                      </button>
                    )}

                    <button
                      onClick={() => setDeleteTarget(task)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50 transition-colors"
                      title="Delete Task"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Add Task Modal */}
      <AddTaskModal
        isOpen={isAddTaskOpen}
        onClose={() => {
          setIsAddTaskOpen(false);
          setEditingTask(null);
        }}
        onSuccess={() => {
          loadTasks();
          window.dispatchEvent(new CustomEvent('emperor:data-changed'));
        }}
        editTask={editingTask}
      />

      {/* Delete Task Confirmation */}
      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteTask}
        title="Delete Task"
        description={`Are you sure you want to permanently delete "${deleteTarget?.title}"?`}
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  );
}
