import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Lead, LeadStage } from '../../types/crm';
import { api } from '../../lib/api';
import { useToast } from '../../context/ToastContext';

interface AddLeadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (lead: Lead) => void;
  initialStage?: LeadStage;
  editLead?: Lead | null;
}

const SOURCES = ['Referral', 'LinkedIn', 'Website', 'Cold Outreach', 'Twitter/X', 'Conference', 'Other'];
const STAGES: LeadStage[] = ['IDENTIFIED', 'CONTACTED', 'REPLIED', 'MEETING', 'PROPOSAL_SENT', 'WON', 'LOST'];

export function AddLeadModal({
  isOpen,
  onClose,
  onSuccess,
  initialStage = 'IDENTIFIED',
  editLead = null,
}: AddLeadModalProps) {
  const { success, error } = useToast();
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [formData, setFormData] = useState({
    name: '',
    company: '',
    email: '',
    phone: '',
    website: '',
    source: 'Referral',
    service: 'Full-Stack Development',
    stage: initialStage,
    potentialValue: '',
    currency: 'USD',
    nextFollowUp: '',
    notes: '',
    createFollowUpTask: true,
  });

  useEffect(() => {
    if (editLead) {
      setFormData({
        name: editLead.name || '',
        company: editLead.company || '',
        email: editLead.email || '',
        phone: editLead.phone || '',
        website: editLead.website || '',
        source: editLead.source || 'Referral',
        service: editLead.service || 'Full-Stack Development',
        stage: editLead.stage || 'IDENTIFIED',
        potentialValue: editLead.potentialValue ? String(editLead.potentialValue) : '',
        currency: editLead.currency || 'USD',
        nextFollowUp: editLead.nextFollowUp ? editLead.nextFollowUp.split('T')[0] : '',
        notes: editLead.notes || '',
        createFollowUpTask: false,
      });
    } else {
      setFormData({
        name: '',
        company: '',
        email: '',
        phone: '',
        website: '',
        source: 'Referral',
        service: 'Full-Stack Development',
        stage: initialStage,
        potentialValue: '',
        currency: 'USD',
        nextFollowUp: '',
        notes: '',
        createFollowUpTask: true,
      });
    }
    setErrors({});
  }, [editLead, initialStage, isOpen]);

  if (!isOpen) return null;

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!formData.name.trim()) {
      errs.name = 'Lead name is required';
    }
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      errs.email = 'Please enter a valid email address';
    }
    if (formData.website && !/^https?:\/\/.+/.test(formData.website.trim())) {
      errs.website = 'Website must start with http:// or https://';
    }
    if (formData.potentialValue && isNaN(Number(formData.potentialValue))) {
      errs.potentialValue = 'Potential value must be a valid number';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate() || loading) return;

    setLoading(true);
    try {
      const payload: any = {
        name: formData.name.trim(),
        company: formData.company.trim() || null,
        email: formData.email.trim() || null,
        phone: formData.phone.trim() || null,
        website: formData.website.trim() || null,
        source: formData.source,
        service: formData.service.trim(),
        stage: formData.stage,
        potentialValue: formData.potentialValue ? Number(formData.potentialValue) : null,
        currency: formData.currency,
        nextFollowUp: formData.nextFollowUp ? formData.nextFollowUp : null,
        notes: formData.notes.trim() || null,
        createFollowUpTask: formData.createFollowUpTask,
      };

      let result: Lead;
      if (editLead) {
        result = await api.updateLead(editLead.id, payload);
        success('Lead updated', `${result.name} was successfully updated.`);
      } else {
        result = await api.createLead(payload);
        success('Lead created', `${result.name} added to pipeline.`);
      }

      onSuccess(result);
      onClose();
    } catch (err: any) {
      error('Failed to save lead', err.message || 'Please check the form inputs.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs overflow-y-auto">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="lead-modal-title"
        className="w-full max-w-xl bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden my-8"
      >
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <div>
            <h3 id="lead-modal-title" className="text-sm font-bold text-slate-900">
              {editLead ? 'Edit Lead' : 'Add New Prospect'}
            </h3>
            <p className="text-xs text-slate-500">Record a new freelance lead and schedule follow-ups</p>
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
          <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
            {/* Name & Company */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Prospect / Client Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Aether Robotics"
                  className={`w-full px-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 ${
                    errors.name ? 'border-rose-400 bg-rose-50/30' : 'border-slate-200'
                  }`}
                />
                {errors.name && <p className="text-xs text-rose-500 mt-1">{errors.name}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Company / Organization</label>
                <input
                  type="text"
                  value={formData.company}
                  onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                  placeholder="e.g. Aether Systems Inc."
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>
            </div>

            {/* Email & Phone */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="contact@company.com"
                  className={`w-full px-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 ${
                    errors.email ? 'border-rose-400 bg-rose-50/30' : 'border-slate-200'
                  }`}
                />
                {errors.email && <p className="text-xs text-rose-500 mt-1">{errors.email}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Phone Number</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+1 (555) 000-0000"
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>
            </div>

            {/* Website & Source */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Website URL</label>
                <input
                  type="url"
                  value={formData.website}
                  onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                  placeholder="https://example.com"
                  className={`w-full px-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 ${
                    errors.website ? 'border-rose-400 bg-rose-50/30' : 'border-slate-200'
                  }`}
                />
                {errors.website && <p className="text-xs text-rose-500 mt-1">{errors.website}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Acquisition Source</label>
                <select
                  value={formData.source}
                  onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                >
                  {SOURCES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Service & Stage */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Target Service / Project</label>
                <input
                  type="text"
                  required
                  value={formData.service}
                  onChange={(e) => setFormData({ ...formData, service: e.target.value })}
                  placeholder="e.g. Next.js SaaS Architecture"
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Pipeline Stage</label>
                <select
                  value={formData.stage}
                  onChange={(e) => setFormData({ ...formData, stage: e.target.value as LeadStage })}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                >
                  {STAGES.map((s) => (
                    <option key={s} value={s}>
                      {s.replace('_', ' ')}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Potential Value & Currency */}
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">Potential Deal Value</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.potentialValue}
                  onChange={(e) => setFormData({ ...formData, potentialValue: e.target.value })}
                  placeholder="25000.00"
                  className={`w-full px-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 ${
                    errors.potentialValue ? 'border-rose-400 bg-rose-50/30' : 'border-slate-200'
                  }`}
                />
                {errors.potentialValue && <p className="text-xs text-rose-500 mt-1">{errors.potentialValue}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Currency</label>
                <select
                  value={formData.currency}
                  onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                >
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                  <option value="CAD">CAD ($)</option>
                  <option value="AUD">AUD ($)</option>
                </select>
              </div>
            </div>

            {/* Next Follow-Up Date */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Next Follow-Up Date</label>
              <input
                type="date"
                value={formData.nextFollowUp}
                onChange={(e) => setFormData({ ...formData, nextFollowUp: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
              {!editLead && formData.nextFollowUp && (
                <label className="flex items-center gap-2 mt-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.createFollowUpTask}
                    onChange={(e) => setFormData({ ...formData, createFollowUpTask: e.target.checked })}
                    className="w-3.5 h-3.5 rounded text-slate-900 focus:ring-slate-900"
                  />
                  <span className="text-xs text-slate-600">Create linked follow-up task on this date</span>
                </label>
              )}
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Initial Notes & Context</label>
              <textarea
                rows={3}
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Key discovery details, client timeline, referral contact..."
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
              {editLead ? 'Save Changes' : 'Create Lead'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
