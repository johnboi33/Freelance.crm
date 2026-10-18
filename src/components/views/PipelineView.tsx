import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
  useDroppable,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Kanban,
  List,
  Search,
  Plus,
  ArrowRight,
  MoreVertical,
  DollarSign,
  Calendar,
  AlertCircle,
  X,
  Filter,
} from 'lucide-react';
import { Lead, LeadStage } from '../../types/crm';
import { api } from '../../lib/api';
import { useToast } from '../../context/ToastContext';
import { AddLeadModal } from '../common/AddLeadModal';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { LoadingSkeleton } from '../common/LoadingSkeleton';

interface PipelineViewProps {
  onNavigate: (path: string) => void;
}

const STAGES: { key: LeadStage; label: string; isTerminal?: boolean }[] = [
  { key: 'IDENTIFIED', label: 'Identified' },
  { key: 'CONTACTED', label: 'Contacted' },
  { key: 'REPLIED', label: 'Replied' },
  { key: 'MEETING', label: 'Meeting / Discovery' },
  { key: 'PROPOSAL_SENT', label: 'Proposal Sent' },
  { key: 'WON', label: 'Won Deals', isTerminal: true },
  { key: 'LOST', label: 'Lost Deals', isTerminal: true },
];

const SOURCES = ['Referral', 'LinkedIn', 'Website', 'Cold Outreach', 'Twitter/X', 'Conference', 'Other'];

// ==========================================
// PIPELINE CARD COMPONENT (Sortable)
// ==========================================
function PipelineCard({
  lead,
  onNavigate,
  onMoveToStage,
}: {
  lead: Lead;
  onNavigate: (path: string) => void;
  onMoveToStage: (lead: Lead, stage: LeadStage) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: lead.id,
    data: { lead },
  });

  const [menuOpen, setMenuOpen] = useState(false);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  };

  const isOverdue = lead.nextFollowUp && new Date(lead.nextFollowUp).getTime() < Date.now();
  const followUpFormatted = lead.nextFollowUp
    ? new Date(lead.nextFollowUp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : null;

  const formatMoney = (amount?: number | string | null) => {
    if (!amount) return '—';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(
      Number(amount)
    );
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => onNavigate(`/leads/${lead.id}`)}
      className="bg-white rounded-lg border border-slate-200 p-3 shadow-xs hover:border-slate-300 transition-all cursor-grab active:cursor-grabbing space-y-2 relative group"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <h4 className="font-bold text-xs text-slate-900 group-hover:underline line-clamp-1">{lead.name}</h4>
          {lead.company && <p className="text-[11px] text-slate-500 line-clamp-1">{lead.company}</p>}
        </div>

        {/* Move To Dropdown Menu (Accessible Non-drag alternative) */}
        <div className="relative" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="p-1 text-slate-400 hover:text-slate-600 rounded hover:bg-slate-100 transition-colors"
            title="Move stage..."
            aria-label={`Move stage for ${lead.name}`}
          >
            <MoreVertical className="w-3.5 h-3.5" />
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-full mt-1 w-44 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-30">
              <span className="block px-2.5 py-1 text-[10px] font-bold text-slate-400 uppercase">Move to...</span>
              {STAGES.filter((s) => s.key !== lead.stage).map((s) => (
                <button
                  key={s.key}
                  onClick={() => {
                    setMenuOpen(false);
                    onMoveToStage(lead, s.key);
                  }}
                  className="w-full text-left px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  {s.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <p className="text-[11px] text-slate-600 line-clamp-1">{lead.service}</p>

      <div className="flex items-center justify-between pt-1.5 border-t border-slate-100 text-[11px]">
        <span className="font-mono font-bold text-slate-900 tabular-nums">
          {lead.stage === 'WON' && lead.wonValue ? (
            <span className="text-emerald-700">{formatMoney(lead.wonValue)}</span>
          ) : (
            formatMoney(lead.potentialValue)
          )}
        </span>

        {followUpFormatted && (
          <span
            className={`font-medium flex items-center gap-1 ${
              isOverdue ? 'text-rose-600 font-bold' : 'text-slate-500'
            }`}
          >
            {isOverdue && <AlertCircle className="w-3 h-3 text-rose-500" />}
            {followUpFormatted}
          </span>
        )}
      </div>
    </div>
  );
}

// ==========================================
// COLUMN CONTAINER (Droppable)
// ==========================================
function PipelineColumn({
  stageKey,
  label,
  leads,
  onNavigate,
  onAddLeadToStage,
  onMoveToStage,
}: {
  stageKey: LeadStage;
  label: string;
  leads: Lead[];
  onNavigate: (path: string) => void;
  onAddLeadToStage: (stage: LeadStage) => void;
  onMoveToStage: (lead: Lead, stage: LeadStage) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: stageKey,
  });

  const totalValue = leads.reduce((sum, l) => {
    const val = l.stage === 'WON' && l.wonValue ? Number(l.wonValue) : Number(l.potentialValue || 0);
    return sum + val;
  }, 0);

  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(
      amount
    );
  };

  return (
    <div
      ref={setNodeRef}
      className={`w-72 shrink-0 flex flex-col rounded-xl border transition-colors ${
        isOver ? 'bg-amber-50/50 border-amber-300 ring-2 ring-amber-400/20' : 'bg-slate-100/70 border-slate-200'
      }`}
    >
      {/* Column Sticky Header */}
      <div className="p-3 border-b border-slate-200/80 bg-slate-100/90 rounded-t-xl sticky top-0 z-10 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-bold text-slate-900">{label}</h3>
            <span className="text-[10px] font-bold text-slate-500 bg-white px-1.5 py-0.2 rounded border border-slate-200 tabular-nums">
              {leads.length}
            </span>
          </div>
          <span className="text-[10px] text-slate-500 font-mono block tabular-nums mt-0.5">
            {formatMoney(totalValue)}
          </span>
        </div>

        <button
          onClick={() => onAddLeadToStage(stageKey)}
          className="p-1 text-slate-500 hover:text-slate-900 rounded hover:bg-white transition-colors"
          title={`Add lead in ${label}`}
          aria-label={`Add lead in ${label}`}
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Column Cards List */}
      <SortableContext items={leads.map((l) => l.id)} strategy={verticalListSortingStrategy}>
        <div className="p-2 flex-1 space-y-2 overflow-y-auto max-h-[calc(100vh-280px)] min-h-[140px]">
          {leads.length === 0 ? (
            <div className="h-24 border border-dashed border-slate-200 rounded-lg flex items-center justify-center text-[11px] text-slate-400">
              Drop prospects here
            </div>
          ) : (
            leads.map((lead) => (
              <PipelineCard
                key={lead.id}
                lead={lead}
                onNavigate={onNavigate}
                onMoveToStage={onMoveToStage}
              />
            ))
          )}
        </div>
      </SortableContext>
    </div>
  );
}

// ==========================================
// MAIN PIPELINE VIEW
// ==========================================
export function PipelineView({ onNavigate }: PipelineViewProps) {
  const { success, error } = useToast();

  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'board' | 'list'>('board');

  // Filters
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [followUpFilter, setFollowUpFilter] = useState('');

  // Modals
  const [isAddLeadOpen, setIsAddLeadOpen] = useState(false);
  const [defaultStage, setDefaultStage] = useState<LeadStage>('IDENTIFIED');
  const [activeDragLead, setActiveDragLead] = useState<Lead | null>(null);

  // Terminal dialogs
  const [pendingMove, setPendingMove] = useState<{ lead: Lead; targetStage: LeadStage } | null>(null);
  const [wonValueInput, setWonValueInput] = useState('');
  const [outcomeReasonInput, setOutcomeReasonInput] = useState('');
  const [isReopenConfirmOpen, setIsReopenConfirmOpen] = useState(false);

  // Setup dnd-kit sensors (with keyboard accessible sensor)
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Read URL query params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const qSearch = params.get('search');
    const qSource = params.get('source');
    const qFollowUp = params.get('followUp');
    const qView = params.get('view');

    if (qSearch) setSearch(qSearch);
    if (qSource) setSourceFilter(qSource);
    if (qFollowUp) setFollowUpFilter(qFollowUp);
    if (qView === 'list') setViewMode('list');
  }, []);

  // Sync filters with URL
  useEffect(() => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (sourceFilter) params.set('source', sourceFilter);
    if (followUpFilter) params.set('followUp', followUpFilter);
    if (viewMode === 'list') params.set('view', 'list');

    const newQuery = params.toString();
    const newPath = window.location.pathname + (newQuery ? `?${newQuery}` : '');
    window.history.replaceState(null, '', newPath);
  }, [search, sourceFilter, followUpFilter, viewMode]);

  const loadPipeline = useCallback(async () => {
    setLoading(true);
    try {
      // Exclude archived leads by default
      const res = await api.getLeads({
        limit: 500, // Loads full active board in under ~1.5s as requested
        search,
        source: sourceFilter,
        followUpStatus: followUpFilter,
        showArchived: false,
      });
      setLeads(res.leads);
    } catch (err: any) {
      error('Failed to load pipeline', err.message);
    } finally {
      setLoading(false);
    }
  }, [search, sourceFilter, followUpFilter, error]);

  useEffect(() => {
    loadPipeline();
  }, [loadPipeline]);

  // Group leads by stage
  const stageMap = useMemo(() => {
    const map: Record<LeadStage, Lead[]> = {
      IDENTIFIED: [],
      CONTACTED: [],
      REPLIED: [],
      MEETING: [],
      PROPOSAL_SENT: [],
      WON: [],
      LOST: [],
    };
    for (const lead of leads) {
      if (map[lead.stage]) {
        map[lead.stage].push(lead);
      }
    }
    return map;
  }, [leads]);

  // Move stage logic with optimistic update and rollback
  const executeStageMove = async (
    lead: Lead,
    targetStage: LeadStage,
    wonVal?: number,
    reason?: string,
    reopen = false
  ) => {
    const previousStage = lead.stage;

    // Optimistic update
    setLeads((prev) =>
      prev.map((l) =>
        l.id === lead.id
          ? {
              ...l,
              stage: targetStage,
              wonValue: targetStage === 'WON' ? wonVal || l.potentialValue : null,
              outcomeReason: targetStage === 'LOST' ? reason || null : null,
            }
          : l
      )
    );

    try {
      await api.moveLeadStage(lead.id, {
        stage: targetStage,
        wonValue: wonVal,
        outcomeReason: reason,
        reopenConfirmed: reopen,
      });
      success('Opportunity moved', `"${lead.name}" is now in ${targetStage.replace('_', ' ')}.`);
      setPendingMove(null);
      setIsReopenConfirmOpen(false);
      window.dispatchEvent(new CustomEvent('emperor:data-changed'));
    } catch (err: any) {
      // Rollback on failure
      setLeads((prev) => prev.map((l) => (l.id === lead.id ? { ...l, stage: previousStage } : l)));
      error('Move failed — Restoring position', err.message);
    }
  };

  const handleInitiateStageMove = (lead: Lead, newStage: LeadStage) => {
    if (lead.stage === newStage) return;

    if (newStage === 'WON') {
      setPendingMove({ lead, targetStage: 'WON' });
      setWonValueInput(lead.potentialValue ? String(lead.potentialValue) : '');
      return;
    }

    if (newStage === 'LOST') {
      setPendingMove({ lead, targetStage: 'LOST' });
      setOutcomeReasonInput('');
      return;
    }

    const isTerminal = lead.stage === 'WON' || lead.stage === 'LOST';
    if (isTerminal) {
      setPendingMove({ lead, targetStage: newStage });
      setIsReopenConfirmOpen(true);
      return;
    }

    executeStageMove(lead, newStage);
  };

  // Drag and Drop handlers
  const handleDragStart = (event: DragStartEvent) => {
    const leadId = event.active.id as string;
    const found = leads.find((l) => l.id === leadId);
    if (found) setActiveDragLead(found);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragLead(null);
    if (!over) return;

    const leadId = active.id as string;
    const lead = leads.find((l) => l.id === leadId);
    if (!lead) return;

    // Target stage can be a column ID or another card's ID
    let targetStage: LeadStage | null = null;
    const overId = over.id as string;

    if (STAGES.some((s) => s.key === overId)) {
      targetStage = overId as LeadStage;
    } else {
      const overLead = leads.find((l) => l.id === overId);
      if (overLead) targetStage = overLead.stage;
    }

    if (targetStage && targetStage !== lead.stage) {
      handleInitiateStageMove(lead, targetStage);
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Filter and View Mode Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative flex-1">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter board by name, company..."
              className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
          </div>

          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900"
          >
            <option value="">All Sources</option>
            {SOURCES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          {/* Segmented Board / List tab switch */}
          <div className="flex items-center p-1 bg-slate-100 rounded-lg border border-slate-200">
            <button
              onClick={() => setViewMode('board')}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                viewMode === 'board' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Kanban className="w-3.5 h-3.5" />
              Board
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                viewMode === 'list' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              List View
            </button>
          </div>

          <button
            onClick={() => {
              setDefaultStage('IDENTIFIED');
              setIsAddLeadOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Lead
          </button>
        </div>
      </div>

      {loading ? (
        <LoadingSkeleton variant="board" />
      ) : viewMode === 'board' ? (
        /* ========================================================= */
        /* HORIZONTAL SCROLLING DND BOARD */
        /* ========================================================= */
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-4 overflow-x-auto pb-6 pt-1">
            {STAGES.map((st) => (
              <PipelineColumn
                key={st.key}
                stageKey={st.key}
                label={st.label}
                leads={stageMap[st.key] || []}
                onNavigate={onNavigate}
                onAddLeadToStage={(stage) => {
                  setDefaultStage(stage);
                  setIsAddLeadOpen(true);
                }}
                onMoveToStage={handleInitiateStageMove}
              />
            ))}
          </div>

          <DragOverlay>
            {activeDragLead && (
              <div className="w-72 bg-white rounded-lg border-2 border-slate-900 p-3 shadow-xl rotate-1">
                <h4 className="font-bold text-xs text-slate-900">{activeDragLead.name}</h4>
                <p className="text-[11px] text-slate-500">{activeDragLead.service}</p>
              </div>
            )}
          </DragOverlay>
        </DndContext>
      ) : (
        /* ========================================================= */
        /* ACCESSIBLE LIST VIEW TAB (NON-DRAG ALTERNATIVE) */
        /* ========================================================= */
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-4">Prospect</th>
                <th className="py-3 px-4">Current Stage (Select to move)</th>
                <th className="py-3 px-4">Service</th>
                <th className="py-3 px-4 text-right">Potential Value</th>
                <th className="py-3 px-4">Next Follow-Up</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {leads.map((lead) => (
                <tr key={lead.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3 px-4">
                    <button
                      onClick={() => onNavigate(`/leads/${lead.id}`)}
                      className="font-semibold text-slate-900 hover:underline text-left block"
                    >
                      {lead.name}
                    </button>
                    {lead.company && <span className="text-[11px] text-slate-500 block">{lead.company}</span>}
                  </td>
                  <td className="py-3 px-4">
                    <select
                      value={lead.stage}
                      onChange={(e) => handleInitiateStageMove(lead, e.target.value as LeadStage)}
                      className="px-2.5 py-1 text-xs border border-slate-200 rounded-md bg-white font-medium text-slate-800"
                    >
                      {STAGES.map((s) => (
                        <option key={s.key} value={s.key}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-3 px-4 text-slate-600">{lead.service}</td>
                  <td className="py-3 px-4 text-right font-mono font-medium text-slate-900 tabular-nums">
                    {lead.stage === 'WON' && lead.wonValue
                      ? `$${Number(lead.wonValue).toLocaleString()}`
                      : lead.potentialValue
                      ? `$${Number(lead.potentialValue).toLocaleString()}`
                      : '—'}
                  </td>
                  <td className="py-3 px-4 text-slate-600">
                    {lead.nextFollowUp
                      ? new Date(lead.nextFollowUp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                      : 'None'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Lead Pre-selecting clicked Stage */}
      <AddLeadModal
        isOpen={isAddLeadOpen}
        initialStage={defaultStage}
        onClose={() => setIsAddLeadOpen(false)}
        onSuccess={() => {
          loadPipeline();
          window.dispatchEvent(new CustomEvent('emperor:data-changed'));
        }}
      />

      {/* Move to Won Confirmation Dialog */}
      <ConfirmDialog
        isOpen={Boolean(pendingMove && pendingMove.targetStage === 'WON')}
        onClose={() => setPendingMove(null)}
        onConfirm={() => {
          const val = Number(wonValueInput);
          if (isNaN(val) || val <= 0) {
            error('Invalid deal value', 'Please enter a valid positive number for the won contract.');
            return;
          }
          if (pendingMove) executeStageMove(pendingMove.lead, 'WON', val);
        }}
        title="Congratulations! Mark Deal as Won"
        description={`Record the final signed contract amount for "${pendingMove?.lead.name}". This will be added to your recorded revenue reports.`}
        confirmLabel="Confirm Won"
        variant="primary"
      >
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Confirmed Contract Value (USD) <span className="text-rose-500">*</span>
          </label>
          <input
            type="number"
            step="0.01"
            value={wonValueInput}
            onChange={(e) => setWonValueInput(e.target.value)}
            placeholder="35000.00"
            className="w-full px-3 py-2 text-xs font-mono border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
          />
        </div>
      </ConfirmDialog>

      {/* Move to Lost Confirmation Dialog */}
      <ConfirmDialog
        isOpen={Boolean(pendingMove && pendingMove.targetStage === 'LOST')}
        onClose={() => setPendingMove(null)}
        onConfirm={() => {
          if (!outcomeReasonInput.trim() || outcomeReasonInput.trim().length < 3) {
            error('Reason required', 'Please provide a reason with at least 3 characters.');
            return;
          }
          if (pendingMove) executeStageMove(pendingMove.lead, 'LOST', undefined, outcomeReasonInput.trim());
        }}
        title="Mark Opportunity as Lost"
        description={`Please provide context on why "${pendingMove?.lead.name}" did not close.`}
        confirmLabel="Confirm Lost"
        variant="warning"
      >
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Outcome Reason <span className="text-rose-500">*</span>
          </label>
          <textarea
            rows={3}
            value={outcomeReasonInput}
            onChange={(e) => setOutcomeReasonInput(e.target.value)}
            placeholder="e.g. Timing mismatch, budget cut, chose internal build..."
            className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
          />
        </div>
      </ConfirmDialog>

      {/* Reopen Opportunity Dialog */}
      <ConfirmDialog
        isOpen={isReopenConfirmOpen}
        onClose={() => {
          setIsReopenConfirmOpen(false);
          setPendingMove(null);
        }}
        onConfirm={() => {
          if (pendingMove) {
            executeStageMove(pendingMove.lead, pendingMove.targetStage, undefined, undefined, true);
          }
        }}
        title="Reopen Opportunity?"
        description="This will reopen the opportunity into active pipeline tracking and clear previously recorded terminal values. Continue?"
        confirmLabel="Yes, Reopen Deal"
        variant="primary"
      />
    </div>
  );
}
