import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Search,
  Filter,
  Plus,
  MoreVertical,
  Archive,
  RefreshCw,
  ArrowUpDown,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Eye,
  Check,
  X,
  RotateCcw,
} from 'lucide-react';
import { api } from '../../lib/api';
import { Lead, LeadStage } from '../../types/crm';
import { LoadingSkeleton } from '../common/LoadingSkeleton';
import { EmptyState } from '../common/EmptyState';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { AddLeadModal } from '../common/AddLeadModal';
import { useToast } from '../../context/ToastContext';

interface LeadsViewProps {
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

const ALL_SOURCES = ['Referral', 'LinkedIn', 'Website', 'Cold Outreach', 'Twitter/X', 'Conference', 'Other'];

export function LeadsView({ onNavigate }: LeadsViewProps) {
  const { success, error } = useToast();

  // Search input & debouncing
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Filters
  const [selectedStages, setSelectedStages] = useState<LeadStage[]>([]);
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const [followUpFilter, setFollowUpFilter] = useState<string>('');
  const [showArchived, setShowArchived] = useState(false);

  // Sorting & Pagination
  const [sortBy, setSortBy] = useState('nextFollowUp');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Data & Modals
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);

  // Action dialogs
  const [archiveLeadTarget, setArchiveLeadTarget] = useState<Lead | null>(null);
  const [restoreLeadTarget, setRestoreLeadTarget] = useState<Lead | null>(null);

  // Filter Popover state
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);

  // Debounce search input by 300ms as requested
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Read URL query params on initial load
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const qSearch = params.get('search');
    const qStage = params.get('stage');
    const qSource = params.get('source');
    const qFollowUp = params.get('followUp');
    const qArchived = params.get('archived');
    const qSort = params.get('sort');

    if (qSearch) {
      setSearchInput(qSearch);
      setDebouncedSearch(qSearch);
    }
    if (qStage) setSelectedStages(qStage.split(',') as LeadStage[]);
    if (qSource) setSelectedSources(qSource.split(','));
    if (qFollowUp) setFollowUpFilter(qFollowUp);
    if (qArchived === 'true') setShowArchived(true);
    if (qSort) setSortBy(qSort);
  }, []);

  // Update URL query params on filter change so state survives refresh
  useEffect(() => {
    const params = new URLSearchParams();
    if (debouncedSearch) params.set('search', debouncedSearch);
    if (selectedStages.length > 0) params.set('stage', selectedStages.join(','));
    if (selectedSources.length > 0) params.set('source', selectedSources.join(','));
    if (followUpFilter) params.set('followUp', followUpFilter);
    if (showArchived) params.set('archived', 'true');
    if (sortBy !== 'nextFollowUp') params.set('sort', sortBy);

    const newQuery = params.toString();
    const newRelativePathQuery = window.location.pathname + (newQuery ? `?${newQuery}` : '');
    window.history.replaceState(null, '', newRelativePathQuery);
  }, [debouncedSearch, selectedStages, selectedSources, followUpFilter, showArchived, sortBy]);

  // Load leads from API
  const loadLeads = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getLeads({
        search: debouncedSearch,
        stage: selectedStages.join(','),
        source: selectedSources.join(','),
        followUpStatus: followUpFilter,
        sortBy,
        sortOrder,
        page: currentPage,
        limit: 15,
        showArchived,
      });
      setLeads(res.leads);
      setTotalCount(res.pagination.total);
      setTotalPages(res.pagination.totalPages);
    } catch (err: any) {
      error('Failed to load leads', err.message);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, selectedStages, selectedSources, followUpFilter, sortBy, sortOrder, currentPage, showArchived, error]);

  useEffect(() => {
    loadLeads();
  }, [loadLeads]);

  // Handle Archive
  const handleConfirmArchive = async () => {
    if (!archiveLeadTarget) return;
    try {
      await api.archiveLead(archiveLeadTarget.id);
      success('Lead archived', `${archiveLeadTarget.name} has been archived.`);
      setArchiveLeadTarget(null);
      loadLeads();
    } catch (err: any) {
      error('Archive failed', err.message);
    }
  };

  // Handle Restore
  const handleConfirmRestore = async () => {
    if (!restoreLeadTarget) return;
    try {
      await api.restoreLead(restoreLeadTarget.id);
      success('Lead restored', `${restoreLeadTarget.name} has been restored to active leads.`);
      setRestoreLeadTarget(null);
      loadLeads();
    } catch (err: any) {
      error('Restore failed', err.message);
    }
  };

  const clearAllFilters = () => {
    setSearchInput('');
    setDebouncedSearch('');
    setSelectedStages([]);
    setSelectedSources([]);
    setFollowUpFilter('');
    setShowArchived(false);
    setCurrentPage(1);
  };

  const isFiltered = Boolean(debouncedSearch || selectedStages.length || selectedSources.length || followUpFilter || showArchived);

  // Format currency
  const formatMoney = (amount?: number | string | null) => {
    if (!amount) return '—';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(
      Number(amount)
    );
  };

  // Format follow-up date
  const formatFollowUp = (dateStr?: string | null) => {
    if (!dateStr) return { text: 'None scheduled', isOverdue: false, isToday: false };

    const target = new Date(dateStr);
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

    const isOverdue = target < startOfToday;
    const isToday = target >= startOfToday && target <= endOfToday;

    const formattedDate = target.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    let label = formattedDate;

    if (isToday) {
      label = `Today (${formattedDate})`;
    } else if (isOverdue) {
      const diffDays = Math.ceil((startOfToday.getTime() - target.getTime()) / (1000 * 60 * 60 * 24));
      label = `${diffDays}d overdue (${formattedDate})`;
    } else {
      const diffDays = Math.ceil((target.getTime() - endOfToday.getTime()) / (1000 * 60 * 60 * 24));
      label = `In ${diffDays}d (${formattedDate})`;
    }

    return { text: label, isOverdue, isToday };
  };

  return (
    <div className="space-y-4">
      {/* Search, Filter Bar, and Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
        {/* Search Box */}
        <div className="relative flex-1 max-w-md">
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search name, company, email (debounced)..."
            className="w-full pl-9 pr-8 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          {searchInput && (
            <button
              onClick={() => setSearchInput('')}
              className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filter Controls & Toggle */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Follow-up status filter */}
          <select
            value={followUpFilter}
            onChange={(e) => {
              setFollowUpFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="px-2.5 py-2 text-xs border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900"
          >
            <option value="">All Follow-up Statuses</option>
            <option value="Overdue">Overdue</option>
            <option value="Due today">Due today</option>
            <option value="Upcoming">Upcoming</option>
            <option value="None">None</option>
          </select>

          {/* Sort selector */}
          <select
            value={sortBy}
            onChange={(e) => {
              setSortBy(e.target.value);
              setCurrentPage(1);
            }}
            className="px-2.5 py-2 text-xs border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900"
          >
            <option value="nextFollowUp">Sort: Next Follow-Up</option>
            <option value="createdAt">Sort: Created Date</option>
            <option value="name">Sort: Prospect Name</option>
            <option value="potentialValue">Sort: Potential Value</option>
          </select>

          <button
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            className="p-2 text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
            title={`Direction: ${sortOrder.toUpperCase()}`}
          >
            <ArrowUpDown className="w-3.5 h-3.5" />
          </button>

          {/* Show Archived Toggle */}
          <button
            onClick={() => {
              setShowArchived(!showArchived);
              setCurrentPage(1);
            }}
            className={`px-3 py-2 text-xs font-medium rounded-lg border transition-colors ${
              showArchived
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            {showArchived ? 'Showing Archived' : 'Show Archived'}
          </button>

          {/* Clear filters shortcut */}
          {isFiltered && (
            <button
              onClick={clearAllFilters}
              className="text-xs text-rose-600 hover:text-rose-800 font-semibold px-2 py-1"
            >
              Clear
            </button>
          )}

          <button
            onClick={() => {
              setEditingLead(null);
              setIsAddModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors shadow-xs ml-auto"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Lead
          </button>
        </div>
      </div>

      {/* Stage Chips for quick multi-select */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
        <span className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide mr-1">Stages:</span>
        {ALL_STAGES.map((st) => {
          const isSelected = selectedStages.includes(st);
          return (
            <button
              key={st}
              onClick={() => {
                if (isSelected) {
                  setSelectedStages(selectedStages.filter((s) => s !== st));
                } else {
                  setSelectedStages([...selectedStages, st]);
                }
                setCurrentPage(1);
              }}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors shrink-0 ${
                isSelected
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {st.replace('_', ' ')}
            </button>
          );
        })}
      </div>

      {/* Leads Content */}
      {loading ? (
        <LoadingSkeleton variant="table" />
      ) : leads.length === 0 ? (
        isFiltered ? (
          <EmptyState
            icon={Filter}
            title="No leads match these filters."
            description="Try modifying or resetting your search query, stages, or follow-up filters."
            action={{ label: 'Clear all filters', onClick: clearAllFilters }}
          />
        ) : (
          <EmptyState
            icon={Search}
            title="No leads yet."
            description="Add your first prospect to start tracking outreach and building your pipeline."
            action={{
              label: 'Add First Lead',
              onClick: () => {
                setEditingLead(null);
                setIsAddModalOpen(true);
              },
            }}
          />
        )
      ) : (
        <div className="space-y-4">
          {/* ========================================================= */}
          {/* DESKTOP TABLE LAYOUT (hidden on mobile) */}
          {/* ========================================================= */}
          <div className="hidden md:block bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Prospect & Company</th>
                  <th className="py-3 px-4">Stage</th>
                  <th className="py-3 px-4">Source</th>
                  <th className="py-3 px-4">Service</th>
                  <th className="py-3 px-4 text-right">Potential Value</th>
                  <th className="py-3 px-4">Next Follow-Up</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {leads.map((lead) => {
                  const followUp = formatFollowUp(lead.nextFollowUp);
                  return (
                    <tr
                      key={lead.id}
                      onClick={() => onNavigate(`/leads/${lead.id}`)}
                      className="hover:bg-slate-50/80 cursor-pointer transition-colors group"
                    >
                      {/* Name & Company */}
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900 group-hover:underline">{lead.name}</div>
                        {lead.company && <div className="text-[11px] text-slate-500">{lead.company}</div>}
                      </td>

                      {/* Stage Badge */}
                      <td className="py-3 px-4">
                        <span className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded text-slate-800 bg-slate-100 border border-slate-200 uppercase tracking-tight">
                          {lead.stage.replace('_', ' ')}
                        </span>
                        {lead.archivedAt && (
                          <span className="ml-1.5 inline-block text-[10px] font-medium text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
                            Archived
                          </span>
                        )}
                      </td>

                      {/* Source */}
                      <td className="py-3 px-4 text-slate-600 font-medium">{lead.source}</td>

                      {/* Service */}
                      <td className="py-3 px-4 text-slate-600 max-w-xs truncate">{lead.service}</td>

                      {/* Value */}
                      <td className="py-3 px-4 text-right font-mono font-medium text-slate-900 tabular-nums">
                        {lead.stage === 'WON' && lead.wonValue ? (
                          <span className="text-emerald-700 font-bold">{formatMoney(lead.wonValue)}</span>
                        ) : (
                          formatMoney(lead.potentialValue)
                        )}
                      </td>

                      {/* Next Follow-Up */}
                      <td className="py-3 px-4">
                        <span
                          className={`font-medium ${
                            followUp.isOverdue
                              ? 'text-rose-600 font-bold'
                              : followUp.isToday
                              ? 'text-amber-600 font-semibold'
                              : 'text-slate-600'
                          }`}
                        >
                          {followUp.text}
                        </span>
                      </td>

                      {/* Row actions */}
                      <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          {lead.archivedAt ? (
                            <button
                              onClick={() => setRestoreLeadTarget(lead)}
                              className="px-2.5 py-1 text-xs font-semibold text-slate-700 bg-slate-100 rounded hover:bg-slate-200 transition-colors inline-flex items-center gap-1"
                              title="Restore lead"
                            >
                              <RotateCcw className="w-3 h-3" />
                              Restore
                            </button>
                          ) : (
                            <>
                              <button
                                onClick={() => {
                                  setEditingLead(lead);
                                  setIsAddModalOpen(true);
                                }}
                                className="px-2 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => setArchiveLeadTarget(lead)}
                                className="px-2 py-1 text-xs font-medium text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                                title="Archive opportunity"
                              >
                                <Archive className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* ========================================================= */}
          {/* MOBILE STACKED CARDS LAYOUT (md:hidden) */}
          {/* ========================================================= */}
          <div className="md:hidden space-y-3">
            {leads.map((lead) => {
              const followUp = formatFollowUp(lead.nextFollowUp);
              return (
                <div
                  key={lead.id}
                  onClick={() => onNavigate(`/leads/${lead.id}`)}
                  className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-2.5 active:bg-slate-50 transition-colors cursor-pointer"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="font-bold text-sm text-slate-900">{lead.name}</h4>
                      {lead.company && <p className="text-xs text-slate-500">{lead.company}</p>}
                    </div>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded text-slate-800 bg-slate-100 border border-slate-200 uppercase tracking-tight">
                      {lead.stage.replace('_', ' ')}
                    </span>
                  </div>

                  <p className="text-xs text-slate-600">{lead.service}</p>

                  <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
                    <span className="font-mono font-bold text-slate-900 tabular-nums">
                      {lead.stage === 'WON' && lead.wonValue ? formatMoney(lead.wonValue) : formatMoney(lead.potentialValue)}
                    </span>
                    <span
                      className={`text-[11px] font-medium ${
                        followUp.isOverdue
                          ? 'text-rose-600 font-bold'
                          : followUp.isToday
                          ? 'text-amber-600 font-semibold'
                          : 'text-slate-500'
                      }`}
                    >
                      {followUp.text}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination Controls & Total Results */}
          <div className="flex items-center justify-between px-2 pt-2 text-xs text-slate-500">
            <div>
              Showing <span className="font-semibold text-slate-900">{leads.length}</span> of{' '}
              <span className="font-semibold text-slate-900">{totalCount}</span> prospects
            </div>

            <div className="flex items-center gap-2">
              <button
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="p-1.5 border border-slate-200 rounded-lg hover:bg-white disabled:opacity-30 disabled:pointer-events-none transition-colors"
                aria-label="Previous page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs font-semibold text-slate-700">
                Page {currentPage} of {totalPages}
              </span>
              <button
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="p-1.5 border border-slate-200 rounded-lg hover:bg-white disabled:opacity-30 disabled:pointer-events-none transition-colors"
                aria-label="Next page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Lead Modal */}
      <AddLeadModal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setEditingLead(null);
        }}
        onSuccess={() => {
          loadLeads();
          window.dispatchEvent(new CustomEvent('emperor:data-changed'));
        }}
        editLead={editingLead}
      />

      {/* Archive Confirm Dialog */}
      <ConfirmDialog
        isOpen={Boolean(archiveLeadTarget)}
        onClose={() => setArchiveLeadTarget(null)}
        onConfirm={handleConfirmArchive}
        title="Archive Opportunity"
        description={`Are you sure you want to archive "${archiveLeadTarget?.name}"? Archived leads are excluded from your active pipeline and won't trigger follow-up alerts, but can be restored anytime.`}
        confirmLabel="Archive Lead"
        variant="warning"
      />

      {/* Restore Confirm Dialog */}
      <ConfirmDialog
        isOpen={Boolean(restoreLeadTarget)}
        onClose={() => setRestoreLeadTarget(null)}
        onConfirm={handleConfirmRestore}
        title="Restore Opportunity"
        description={`Restore "${restoreLeadTarget?.name}" back to your active pipeline?`}
        confirmLabel="Restore"
        variant="primary"
      />
    </div>
  );
}
