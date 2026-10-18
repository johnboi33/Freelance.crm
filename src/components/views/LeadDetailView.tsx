import React, { useState, useEffect, useCallback } from 'react';
import {
  Mail,
  Phone,
  Globe,
  DollarSign,
  Calendar,
  Clock,
  ArrowLeft,
  Edit2,
  Plus,
  CheckCircle2,
  XCircle,
  Archive,
  Copy,
  ChevronDown,
  ChevronUp,
  FileText,
  Activity as ActivityIcon,
  Send,
  MessageSquare,
  AlertCircle,
  RotateCcw,
  ExternalLink,
} from 'lucide-react';
import { api } from '../../lib/api';
import { Lead, Interaction, Task, Activity, LeadStage, InteractionType, Direction } from '../../types/crm';
import { LoadingSkeleton } from '../common/LoadingSkeleton';
import { ErrorState } from '../common/ErrorState';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { AddLeadModal } from '../common/AddLeadModal';
import { AddTaskModal } from '../common/AddTaskModal';
import { useToast } from '../../context/ToastContext';

interface LeadDetailViewProps {
  leadId: string;
  onNavigate: (path: string) => void;
}

const ALL_STAGES: LeadStage[] = [
  'IDENTIFIED',
  'CONTACTED',
  'REPLIED',
  'MEETING',
  'PROPOSAL_SENT',
  'WON',
  'LOST',
];

export function LeadDetailView({ leadId, onNavigate }: LeadDetailViewProps) {
  const { success, error } = useToast();

  const [lead, setLead] = useState<(Lead & { interactions: Interaction[]; tasks: Task[]; activities: Activity[] }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Notes inline editing
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [notesDraft, setNotesDraft] = useState('');

  // Modals
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAddTaskModalOpen, setIsAddTaskModalOpen] = useState(false);
  const [isLogInteractionOpen, setIsLogInteractionOpen] = useState(false);
  const [activityCollapsed, setActivityCollapsed] = useState(true);

  // Terminal state modal handling
  const [targetStage, setTargetStage] = useState<LeadStage | null>(null);
  const [wonValueInput, setWonValueInput] = useState('');
  const [outcomeReasonInput, setOutcomeReasonInput] = useState('');
  const [isReopenConfirmOpen, setIsReopenConfirmOpen] = useState(false);
  const [isArchiveConfirmOpen, setIsArchiveConfirmOpen] = useState(false);

  // Log interaction form state
  const [interactionForm, setInteractionForm] = useState({
    type: 'EMAIL' as InteractionType,
    direction: 'OUTGOING' as Direction,
    outcome: 'Replied',
    notes: '',
    occurredAt: new Date().toISOString().slice(0, 16),
    scheduleFollowUp: false,
    followUpTitle: '',
    followUpDate: '',
  });

  const loadLead = useCallback(async () => {
    setLoading(true);
    setNotFound(false);
    try {
      const data = await api.getLead(leadId);
      setLead(data);
      setNotesDraft(data.notes || '');
      setWonValueInput(data.potentialValue ? String(data.potentialValue) : '');
    } catch (err: any) {
      if (err.status === 404 || err.code === 'NOT_FOUND') {
        setNotFound(true);
      } else {
        error('Failed to load lead profile', err.message);
      }
    } finally {
      setLoading(false);
    }
  }, [leadId, error]);

  useEffect(() => {
    loadLead();
  }, [loadLead]);

  if (loading) return <LoadingSkeleton variant="detail" />;

  if (notFound || !lead) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center bg-white rounded-xl border border-slate-200">
        <h2 className="text-xl font-bold text-slate-900 mb-2">404 — Lead Not Found</h2>
        <p className="text-xs text-slate-500 max-w-sm mb-6">
          The requested lead opportunity does not exist or you do not have permission to view it.
        </p>
        <button
          onClick={() => onNavigate('/leads')}
          className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800"
        >
          Return to Leads List
        </button>
      </div>
    );
  }

  // Handle stage change select
  const handleStageSelect = (newStage: LeadStage) => {
    if (newStage === lead.stage) return;

    if (newStage === 'WON') {
      setTargetStage('WON');
      setWonValueInput(lead.potentialValue ? String(lead.potentialValue) : '');
      return;
    }

    if (newStage === 'LOST') {
      setTargetStage('LOST');
      setOutcomeReasonInput('');
      return;
    }

    // Check if reopening from terminal
    const isTerminal = lead.stage === 'WON' || lead.stage === 'LOST';
    if (isTerminal) {
      setTargetStage(newStage);
      setIsReopenConfirmOpen(true);
      return;
    }

    // Direct stage update
    executeStageChange(newStage);
  };

  const executeStageChange = async (stage: LeadStage, wonVal?: number, reason?: string, reopen = false) => {
    try {
      await api.moveLeadStage(lead.id, {
        stage,
        wonValue: wonVal,
        outcomeReason: reason,
        reopenConfirmed: reopen,
      });
      success('Stage updated', `Moved to ${stage.replace('_', ' ')}.`);
      setTargetStage(null);
      setIsReopenConfirmOpen(false);
      loadLead();
      window.dispatchEvent(new CustomEvent('emperor:data-changed'));
    } catch (err: any) {
      error('Failed to update stage', err.message);
    }
  };

  const handleConfirmWon = () => {
    const val = Number(wonValueInput);
    if (isNaN(val) || val <= 0) {
      error('Invalid deal value', 'Please enter a valid positive number for the won contract value.');
      return;
    }
    executeStageChange('WON', val);
  };

  const handleConfirmLost = () => {
    if (!outcomeReasonInput.trim() || outcomeReasonInput.trim().length < 3) {
      error('Reason required', 'Please provide a reason with at least 3 characters.');
      return;
    }
    executeStageChange('LOST', undefined, outcomeReasonInput.trim());
  };

  const handleConfirmReopen = () => {
    if (targetStage) {
      executeStageChange(targetStage, undefined, undefined, true);
    }
  };

  // Handle task completion
  const handleToggleTask = async (task: Task) => {
    try {
      if (task.status === 'COMPLETED') {
        await api.reopenTask(task.id);
        success('Task reopened');
      } else {
        await api.completeTask(task.id);
        success('Task completed');
      }
      loadLead();
      window.dispatchEvent(new CustomEvent('emperor:data-changed'));
    } catch (err: any) {
      error('Task update failed', err.message);
    }
  };

  // Handle Save Notes
  const handleSaveNotes = async () => {
    try {
      await api.updateLeadNotes(lead.id, notesDraft);
      success('Notes saved');
      setIsEditingNotes(false);
      loadLead();
    } catch (err: any) {
      error('Failed to save notes', err.message);
    }
  };

  // Handle Log Interaction Submit
  const handleLogInteractionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload: any = {
        type: interactionForm.type,
        direction: interactionForm.direction,
        outcome: interactionForm.outcome,
        notes: interactionForm.notes.trim() || null,
        occurredAt: new Date(interactionForm.occurredAt).toISOString(),
      };

      if (interactionForm.scheduleFollowUp && interactionForm.followUpDate) {
        payload.followUpTask = {
          title: interactionForm.followUpTitle.trim() || `Follow up with ${lead.name}`,
          dueAt: new Date(interactionForm.followUpDate).toISOString(),
        };
      }

      await api.logInteraction(lead.id, payload);
      success('Interaction logged', 'Timeline updated.');
      setIsLogInteractionOpen(false);
      setInteractionForm({
        type: 'EMAIL',
        direction: 'OUTGOING',
        outcome: 'Replied',
        notes: '',
        occurredAt: new Date().toISOString().slice(0, 16),
        scheduleFollowUp: false,
        followUpTitle: '',
        followUpDate: '',
      });
      loadLead();
      window.dispatchEvent(new CustomEvent('emperor:data-changed'));
    } catch (err: any) {
      error('Failed to log interaction', err.message);
    }
  };

  // Copy email helper
  const handleCopyEmail = () => {
    if (lead.email) {
      navigator.clipboard.writeText(lead.email);
      success('Email copied', lead.email);
    }
  };

  // Format currency
  const formatMoney = (amount?: number | string | null) => {
    if (!amount) return '—';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(
      Number(amount)
    );
  };

  // Group interactions by month
  const groupedInteractions = lead.interactions.reduce((acc, curr) => {
    const monthKey = new Date(curr.occurredAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    if (!acc[monthKey]) acc[monthKey] = [];
    acc[monthKey].push(curr);
    return acc;
  }, {} as Record<string, Interaction[]>);

  const openTasks = lead.tasks.filter((t) => t.status === 'PENDING');

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <button
            onClick={() => onNavigate('/leads')}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Leads
          </button>
          <div className="flex items-center gap-3">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">{lead.name}</h1>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded text-slate-800 bg-slate-100 border border-slate-200 uppercase tracking-tight">
              {lead.stage.replace('_', ' ')}
            </span>
            {lead.archivedAt && (
              <span className="text-[10px] font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                Archived
              </span>
            )}
          </div>
          {lead.company && <p className="text-xs text-slate-500 mt-0.5">{lead.company}</p>}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setIsEditModalOpen(true)}
            className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors inline-flex items-center gap-1.5"
          >
            <Edit2 className="w-3.5 h-3.5 text-slate-400" />
            Edit
          </button>
          <button
            onClick={() => setIsLogInteractionOpen(true)}
            className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors inline-flex items-center gap-1.5"
          >
            <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
            Log Interaction
          </button>
          <button
            onClick={() => setIsAddTaskModalOpen(true)}
            className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors inline-flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5 text-slate-400" />
            Add Task
          </button>

          {lead.stage !== 'WON' && (
            <button
              onClick={() => handleStageSelect('WON')}
              className="px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors inline-flex items-center gap-1"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Mark Won
            </button>
          )}

          {lead.stage !== 'LOST' && (
            <button
              onClick={() => handleStageSelect('LOST')}
              className="px-3 py-1.5 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-rose-50 hover:text-rose-600 transition-colors inline-flex items-center gap-1"
            >
              <XCircle className="w-3.5 h-3.5" />
              Mark Lost
            </button>
          )}

          {lead.email && (
            <button
              onClick={handleCopyEmail}
              className="p-2 text-slate-400 hover:text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
              title="Copy Email"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            onClick={() => setIsArchiveConfirmOpen(true)}
            className="p-2 text-slate-400 hover:text-rose-600 border border-slate-200 rounded-lg hover:bg-rose-50 transition-colors"
            title="Archive Opportunity"
          >
            <Archive className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Two-Column Grid: Left Column (Main) + Right Rail */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ========================================================= */}
        {/* LEFT COLUMN (Contact card + Timeline) */}
        {/* ========================================================= */}
        <div className="lg:col-span-2 space-y-6">
          {/* 1. Contact Card */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Opportunity Specifications</h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-slate-600 block text-[11px]">Primary Service</span>
                <span className="font-semibold text-slate-900 block mt-0.5">{lead.service}</span>
              </div>

              <div>
                <span className="text-slate-600 block text-[11px]">Deal Value</span>
                <span className="font-mono font-bold text-slate-900 block mt-0.5 tabular-nums text-sm">
                  {lead.stage === 'WON' && lead.wonValue ? (
                    <span className="text-emerald-700">{formatMoney(lead.wonValue)} (Won Contract)</span>
                  ) : (
                    <span>{formatMoney(lead.potentialValue)} (Estimated)</span>
                  )}
                </span>
              </div>

              <div>
                <span className="text-slate-600 block text-[11px]">Acquisition Source</span>
                <span className="font-medium text-slate-800 block mt-0.5">{lead.source}</span>
              </div>

              <div>
                <span className="text-slate-600 block text-[11px]">Direct Email</span>
                {lead.email ? (
                  <a
                    href={`mailto:${lead.email}`}
                    className="font-semibold text-slate-900 hover:underline block mt-0.5"
                  >
                    {lead.email}
                  </a>
                ) : (
                  <span className="text-slate-400 mt-0.5 block">Not provided</span>
                )}
              </div>

              <div>
                <span className="text-slate-600 block text-[11px]">Phone</span>
                {lead.phone ? (
                  <a href={`tel:${lead.phone}`} className="font-semibold text-slate-900 hover:underline block mt-0.5">
                    {lead.phone}
                  </a>
                ) : (
                  <span className="text-slate-400 mt-0.5 block">Not provided</span>
                )}
              </div>

              <div>
                <span className="text-slate-600 block text-[11px]">Website</span>
                {lead.website ? (
                  <a
                    href={lead.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-slate-900 hover:underline inline-flex items-center gap-1 mt-0.5"
                  >
                    {lead.website} <ExternalLink className="w-3 h-3 text-slate-400" />
                  </a>
                ) : (
                  <span className="text-slate-400 mt-0.5 block">Not provided</span>
                )}
              </div>
            </div>

            {lead.outcomeReason && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-100 text-xs text-rose-800">
                <span className="font-bold block">Lost Opportunity Reason:</span>
                <p className="mt-0.5">{lead.outcomeReason}</p>
              </div>
            )}
          </div>

          {/* 2. Interaction Timeline */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-6">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Interaction Timeline</h3>
                <p className="text-xs text-slate-500">Chronological history of communications and touchpoints</p>
              </div>
              <button
                onClick={() => setIsLogInteractionOpen(true)}
                className="px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors inline-flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                Log Contact
              </button>
            </div>

            {lead.interactions.length === 0 ? (
              <div className="py-12 text-center">
                <MessageSquare className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <h4 className="text-sm font-semibold text-slate-800">No interactions logged yet.</h4>
                <p className="text-xs text-slate-500 max-w-xs mx-auto mt-1 mb-4">
                  Record your first contact (email, call, meeting or proposal) to start the client timeline.
                </p>
                <button
                  onClick={() => setIsLogInteractionOpen(true)}
                  className="px-3.5 py-1.5 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800"
                >
                  Log First Contact
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                {Object.entries(groupedInteractions).map(([month, items]) => (
                  <div key={month} className="space-y-3">
                    {/* Sticky subheader */}
                    <div className="sticky top-16 bg-white/95 backdrop-blur-xs py-1 z-10 border-b border-slate-100">
                      <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                        {month}
                      </span>
                    </div>

                    <div className="divide-y divide-slate-100">
                      {items.map((item) => {
                        const dateFormatted = new Date(item.occurredAt).toLocaleDateString('en-US', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                        });

                        return (
                          <div key={item.id} className="py-3 flex items-start gap-3 hover:bg-slate-50/50 rounded-lg p-2 transition-colors">
                            <div className="p-2 rounded-lg bg-slate-100 text-slate-700 shrink-0 mt-0.5">
                              {item.type === 'EMAIL' && <Mail className="w-4 h-4" />}
                              {item.type === 'CALL' && <Phone className="w-4 h-4" />}
                              {item.type === 'MEETING' && <Calendar className="w-4 h-4" />}
                              {item.type === 'MESSAGE' && <MessageSquare className="w-4 h-4" />}
                              {item.type === 'OTHER' && <FileText className="w-4 h-4" />}
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-bold text-slate-900">{item.type}</span>
                                <span
                                  className={`text-[10px] font-semibold px-1.5 py-0.2 rounded ${
                                    item.direction === 'OUTGOING'
                                      ? 'text-sky-700 bg-sky-50'
                                      : 'text-emerald-700 bg-emerald-50'
                                  }`}
                                >
                                  {item.direction}
                                </span>
                                {item.outcome && (
                                  <span className="text-[11px] font-medium text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                                    {item.outcome}
                                  </span>
                                )}
                                <span className="text-[10px] text-slate-600 ml-auto tabular-nums">
                                  {dateFormatted}
                                </span>
                              </div>

                              {item.notes && (
                                <p className="text-xs text-slate-600 mt-2 leading-relaxed bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                                  {item.notes}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ========================================================= */}
        {/* RIGHT RAIL (Stage card + Follow-ups + Notes + Activity) */}
        {/* ========================================================= */}
        <div className="space-y-6">
          {/* 1. Stage Card */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-3">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Pipeline Stage</h3>

            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">Current Status:</span>
              <span className="text-xs font-bold text-slate-900 px-2 py-0.5 rounded bg-slate-100 border border-slate-200">
                {lead.stage.replace('_', ' ')}
              </span>
            </div>

            <div className="pt-2">
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">Move to Stage:</label>
              <select
                value={lead.stage}
                onChange={(e) => handleStageSelect(e.target.value as LeadStage)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900"
              >
                {ALL_STAGES.map((s) => (
                  <option key={s} value={s}>
                    {s.replace('_', ' ')}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 2. Follow-Up Tasks Card */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Follow-ups ({openTasks.length})
              </h3>
              <button
                onClick={() => setIsAddTaskModalOpen(true)}
                className="text-xs font-semibold text-slate-900 hover:underline inline-flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                Add
              </button>
            </div>

            <div className="divide-y divide-slate-100">
              {openTasks.length === 0 ? (
                <p className="text-xs text-slate-600 py-3 text-center">No open tasks for this prospect.</p>
              ) : (
                openTasks.map((t) => {
                  const isOverdue = new Date(t.dueAt).getTime() < Date.now();
                  const dueFormatted = new Date(t.dueAt).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  });
                  return (
                    <div key={t.id} className="py-2.5 flex items-start gap-2.5">
                      <input
                        type="checkbox"
                        checked={t.status === 'COMPLETED'}
                        onChange={() => handleToggleTask(t)}
                        className="mt-0.5 w-4 h-4 rounded text-slate-900 focus:ring-slate-900 cursor-pointer"
                        aria-label={`Mark task completed: ${t.title}`}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-slate-900 line-clamp-1">{t.title}</p>
                        <span
                          className={`text-[10px] block mt-0.5 font-medium ${
                            isOverdue ? 'text-rose-600 font-bold' : 'text-slate-600'
                          }`}
                        >
                          Due: {dueFormatted} {isOverdue && '(Overdue)'}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* 3. Notes Card (Inline editable) */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Prospect Notes</h3>
              {!isEditingNotes && (
                <button
                  onClick={() => setIsEditingNotes(true)}
                  className="text-xs font-semibold text-slate-900 hover:underline"
                >
                  Edit
                </button>
              )}
            </div>

            {isEditingNotes ? (
              <div className="space-y-2">
                <textarea
                  rows={4}
                  value={notesDraft}
                  onChange={(e) => setNotesDraft(e.target.value)}
                  placeholder="Record discovery findings, contract terms, or special client requests..."
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => {
                      setNotesDraft(lead.notes || '');
                      setIsEditingNotes(false);
                    }}
                    className="px-2.5 py-1 text-xs text-slate-600 hover:text-slate-900"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveNotes}
                    className="px-3 py-1 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800"
                  >
                    Save Notes
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">
                {lead.notes || <span className="text-slate-400 italic">No notes added yet.</span>}
              </p>
            )}
          </div>

          {/* 4. Activity Log (Collapsible) */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
            <button
              onClick={() => setActivityCollapsed(!activityCollapsed)}
              className="w-full flex items-center justify-between text-xs font-bold text-slate-900 uppercase tracking-wider"
            >
              <span className="flex items-center gap-1.5">
                <ActivityIcon className="w-3.5 h-3.5 text-slate-500" />
                System Activity Log
              </span>
              {activityCollapsed ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronUp className="w-4 h-4 text-slate-400" />}
            </button>

            {!activityCollapsed && (
              <div className="mt-3 pt-3 border-t border-slate-100 space-y-2.5 max-h-60 overflow-y-auto">
                {lead.activities.length === 0 ? (
                  <p className="text-xs text-slate-600 py-2">No activity events.</p>
                ) : (
                  lead.activities.map((a) => (
                    <div key={a.id} className="text-[11px] leading-tight">
                      <p className="font-semibold text-slate-800">{a.action}</p>
                      <span className="text-slate-600 tabular-nums">
                        {new Date(a.createdAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* DIALOGS & MODALS */}
      {/* ========================================================= */}

      {/* Edit Lead Modal */}
      <AddLeadModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSuccess={() => loadLead()}
        editLead={lead}
      />

      {/* Add Task Modal */}
      <AddTaskModal
        isOpen={isAddTaskModalOpen}
        onClose={() => setIsAddTaskModalOpen(false)}
        onSuccess={() => loadLead()}
        defaultLeadId={lead.id}
      />

      {/* Log Interaction Modal */}
      {isLogInteractionOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">Log Interaction with {lead.name}</h3>
              <button
                onClick={() => setIsLogInteractionOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleLogInteractionSubmit} className="p-5 space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Interaction Type</label>
                  <select
                    value={interactionForm.type}
                    onChange={(e) => setInteractionForm({ ...interactionForm, type: e.target.value as InteractionType })}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                  >
                    <option value="EMAIL">Email</option>
                    <option value="CALL">Phone Call</option>
                    <option value="MESSAGE">Slack / LinkedIn Message</option>
                    <option value="MEETING">Video / In-Person Meeting</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Direction</label>
                  <select
                    value={interactionForm.direction}
                    onChange={(e) => setInteractionForm({ ...interactionForm, direction: e.target.value as Direction })}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                  >
                    <option value="OUTGOING">Outgoing (Sent by you)</option>
                    <option value="INCOMING">Incoming (Received from client)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Outcome</label>
                  <select
                    value={interactionForm.outcome}
                    onChange={(e) => setInteractionForm({ ...interactionForm, outcome: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                  >
                    <option value="No response">No response</option>
                    <option value="Replied">Replied</option>
                    <option value="Meeting booked">Meeting booked</option>
                    <option value="Proposal sent">Proposal sent</option>
                    <option value="Declined">Declined</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Occurred At</label>
                  <input
                    type="datetime-local"
                    required
                    value={interactionForm.occurredAt}
                    onChange={(e) => setInteractionForm({ ...interactionForm, occurredAt: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Notes & Discussion Summary</label>
                <textarea
                  rows={3}
                  value={interactionForm.notes}
                  onChange={(e) => setInteractionForm({ ...interactionForm, notes: e.target.value })}
                  placeholder="Key topics discussed, client objections, next steps agreed upon..."
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              {/* Optional follow-up task */}
              <div className="pt-2 border-t border-slate-100 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={interactionForm.scheduleFollowUp}
                    onChange={(e) => setInteractionForm({ ...interactionForm, scheduleFollowUp: e.target.checked })}
                    className="w-3.5 h-3.5 rounded text-slate-900 focus:ring-slate-900"
                  />
                  <span className="text-xs font-semibold text-slate-800">Schedule follow-up task from this contact</span>
                </label>

                {interactionForm.scheduleFollowUp && (
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <input
                      type="text"
                      value={interactionForm.followUpTitle}
                      onChange={(e) => setInteractionForm({ ...interactionForm, followUpTitle: e.target.value })}
                      placeholder="e.g. Send revised proposal"
                      className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                    />
                    <input
                      type="date"
                      value={interactionForm.followUpDate}
                      onChange={(e) => setInteractionForm({ ...interactionForm, followUpDate: e.target.value })}
                      className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                    />
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsLogInteractionOpen(false)}
                  className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800"
                >
                  Record Interaction
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Won Dialog (Requires wonValue) */}
      <ConfirmDialog
        isOpen={targetStage === 'WON'}
        onClose={() => setTargetStage(null)}
        onConfirm={handleConfirmWon}
        title="Congratulations! Mark Deal as Won"
        description="Record the final signed contract value for this client opportunity. This will be added to your recorded revenue reports."
        confirmLabel="Confirm Won Deal"
        variant="primary"
      >
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Confirmed Won Deal Value (USD) <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <input
              type="number"
              step="0.01"
              required
              value={wonValueInput}
              onChange={(e) => setWonValueInput(e.target.value)}
              placeholder="e.g. 35000.00"
              className="w-full pl-7 pr-3 py-2 text-xs font-mono border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
            <DollarSign className="w-4 h-4 text-slate-400 absolute left-2 top-2.5" />
          </div>
        </div>
      </ConfirmDialog>

      {/* Lost Dialog (Requires outcomeReason) */}
      <ConfirmDialog
        isOpen={targetStage === 'LOST'}
        onClose={() => setTargetStage(null)}
        onConfirm={handleConfirmLost}
        title="Mark Opportunity as Lost"
        description="Please provide context or feedback on why this deal did not close. Tracking lost reasons helps optimize future proposals."
        confirmLabel="Confirm Lost Deal"
        variant="warning"
      >
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Outcome Reason <span className="text-rose-500">*</span>
          </label>
          <textarea
            rows={3}
            required
            value={outcomeReasonInput}
            onChange={(e) => setOutcomeReasonInput(e.target.value)}
            placeholder="e.g. Budget frozen until next fiscal year, or chose internal resource..."
            className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
          />
        </div>
      </ConfirmDialog>

      {/* Reopening Confirmation Dialog */}
      <ConfirmDialog
        isOpen={isReopenConfirmOpen}
        onClose={() => setIsReopenConfirmOpen(false)}
        onConfirm={handleConfirmReopen}
        title="Reopen Opportunity?"
        description="This will reopen the opportunity into active pipeline tracking and clear previously recorded terminal values. Continue?"
        confirmLabel="Yes, Reopen Deal"
        variant="primary"
      />

      {/* Archive Dialog */}
      <ConfirmDialog
        isOpen={isArchiveConfirmOpen}
        onClose={() => setIsArchiveConfirmOpen(false)}
        onConfirm={async () => {
          await api.archiveLead(lead.id);
          success('Lead archived');
          setIsArchiveConfirmOpen(false);
          onNavigate('/leads');
        }}
        title="Archive Opportunity"
        description={`Archive "${lead.name}"? It will be removed from your active pipeline but can be restored anytime.`}
        confirmLabel="Archive"
        variant="warning"
      />
    </div>
  );
}
