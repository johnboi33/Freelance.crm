import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Task, Lead } from '../../types/crm';
import { api } from '../../lib/api';
import { useToast } from '../../context/ToastContext';

interface AddTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (task: Task) => void;
  defaultLeadId?: string | null;
  editTask?: Task | null;
}

export function AddTaskModal({
  isOpen,
  onClose,
  onSuccess,
  defaultLeadId = null,
  editTask = null,
}: AddTaskModalProps) {
  const { success, error } = useToast();
  const [loading, setLoading] = useState(false);
  const [leads, setLeads] = useState<Lead[]>([]);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [dueTime, setDueTime] = useState('09:00');
  const [leadId, setLeadId] = useState<string>(defaultLeadId || '');

  useEffect(() => {
    if (isOpen) {
      api.getLeads({ limit: 100 }).then((res) => setLeads(res.leads)).catch(() => {});
    }
  }, [isOpen]);

  useEffect(() => {
    if (editTask) {
      setTitle(editTask.title);
      setDescription(editTask.description || '');
      setLeadId(editTask.leadId || '');
      if (editTask.dueAt) {
        const d = new Date(editTask.dueAt);
        setDueDate(d.toISOString().split('T')[0]);
        const hh = String(d.getHours()).padStart(2, '0');
        const mm = String(d.getMinutes()).padStart(2, '0');
        setDueTime(`${hh}:${mm}`);
      }
    } else {
      setTitle('');
      setDescription('');
      setLeadId(defaultLeadId || '');
      const today = new Date();
      setDueDate(today.toISOString().split('T')[0]);
      setDueTime('09:00');
    }
  }, [editTask, defaultLeadId, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !dueDate || loading) return;

    setLoading(true);
    try {
      const [year, month, day] = dueDate.split('-').map(Number);
      const [hours, minutes] = (dueTime || '09:00').split(':').map(Number);
      const combinedDate = new Date(year, month - 1, day, hours, minutes);

      const payload = {
        title: title.trim(),
        description: description.trim() || null,
        dueAt: combinedDate.toISOString(),
        leadId: leadId || null,
      };

      const res = await api.createTask(payload);
      success('Task scheduled', `"${res.title}" has been added.`);
      onSuccess(res);
      onClose();
    } catch (err: any) {
      error('Failed to schedule task', err.message || 'Please check your inputs.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-modal-title"
        className="w-full max-w-lg bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden"
      >
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <div>
            <h3 id="task-modal-title" className="text-sm font-bold text-slate-900">
              {editTask ? 'Edit Task' : 'Schedule Follow-Up Task'}
            </h3>
            <p className="text-xs text-slate-500">Track deadlines, calls, proposals and commitments</p>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition-colors"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="p-5 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Task Title <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Follow up with VP of Engineering"
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Linked Opportunity / Lead</label>
              <select
                value={leadId}
                onChange={(e) => setLeadId(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
              >
                <option value="">No linked lead (Standalone task)</option>
                {leads.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name} {l.company ? `(${l.company})` : ''} — {l.stage}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Due Date <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Due Time (Local)</label>
                <input
                  type="time"
                  value={dueTime}
                  onChange={(e) => setDueTime(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Notes & Description</label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Specific agenda items, questions, or deliverables..."
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 p-4 bg-slate-50 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors inline-flex items-center gap-1.5 disabled:opacity-50"
            >
              {loading && <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              {editTask ? 'Save Task' : 'Schedule Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
