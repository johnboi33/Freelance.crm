import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  TrendingUp,
  DollarSign,
  PieChart,
  Award,
  ArrowRight,
  ExternalLink,
} from 'lucide-react';
import { api } from '../../lib/api';
import { LoadingSkeleton } from '../common/LoadingSkeleton';
import { ErrorState } from '../common/ErrorState';

interface ReportsViewProps {
  onNavigate: (path: string) => void;
}

export function ReportsView({ onNavigate }: ReportsViewProps) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadReports = async () => {
    setLoading(true);
    try {
      const res = await api.getReports();
      setData(res);
    } catch (err: any) {
      setError(err.message || 'Failed to load report analytics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReports();
  }, []);

  if (loading) return <LoadingSkeleton variant="table" />;
  if (error || !data) return <ErrorState message={error || undefined} onRetry={loadReports} />;

  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(
      amount
    );
  };

  return (
    <div className="space-y-6">
      {/* 4 Summary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold text-slate-600">Total Won Revenue</span>
            <DollarSign className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-bold text-slate-900 tabular-nums">
            {formatMoney(data.summary.totalWonRevenue)}
          </p>
          <span className="text-[11px] text-slate-500 mt-1 block">From closed won opportunities</span>
        </div>

        <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold text-slate-600">Opportunity Win Rate</span>
            <Award className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-2xl font-bold text-slate-900 tabular-nums">{data.summary.winRate}%</p>
          <span className="text-[11px] text-slate-500 mt-1 block">
            {data.summary.wonDeals} won / {data.summary.wonDeals + data.summary.lostDeals} closed deals
          </span>
        </div>

        <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold text-slate-600">Average Deal Size</span>
            <TrendingUp className="w-4 h-4 text-sky-600" />
          </div>
          <p className="text-2xl font-bold text-slate-900 tabular-nums">
            {formatMoney(data.summary.avgDealSize)}
          </p>
          <span className="text-[11px] text-slate-500 mt-1 block">Per closed engagement</span>
        </div>

        <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold text-slate-600">Total Tracked Pipeline</span>
            <BarChart3 className="w-4 h-4 text-slate-500" />
          </div>
          <p className="text-2xl font-bold text-slate-900 tabular-nums">{data.summary.totalLeads}</p>
          <span className="text-[11px] text-slate-500 mt-1 block">Prospects across all stages</span>
        </div>
      </div>

      {/* Conversion by Channel / Source */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
        <div className="pb-3 border-b border-slate-100 mb-4">
          <h3 className="text-sm font-bold text-slate-900">Conversion by Acquisition Source</h3>
          <p className="text-xs text-slate-500">Track which lead channels deliver highest close rates and revenue</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                <th className="py-2.5 px-4">Channel / Source</th>
                <th className="py-2.5 px-4 text-right">Total Leads</th>
                <th className="py-2.5 px-4 text-right">Won Deals</th>
                <th className="py-2.5 px-4 text-right">Close Rate</th>
                <th className="py-2.5 px-4 text-right">Closed Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.bySource.map((s: any) => (
                <tr key={s.source} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3 px-4 font-semibold text-slate-900">{s.source}</td>
                  <td className="py-3 px-4 text-right tabular-nums">{s.total}</td>
                  <td className="py-3 px-4 text-right tabular-nums font-semibold text-emerald-700">{s.won}</td>
                  <td className="py-3 px-4 text-right tabular-nums font-bold text-slate-900">{s.conversionRate}%</td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 tabular-nums">
                    {formatMoney(s.revenue)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Won & Lost Opportunity Case Log */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Closed Won Deals */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <h3 className="text-sm font-bold text-emerald-900 flex items-center gap-2 mb-3 pb-2 border-b border-slate-100">
            <Award className="w-4 h-4 text-emerald-600" />
            Recent Won Engagements
          </h3>
          <div className="divide-y divide-slate-100">
            {data.recentWon.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">No won deals recorded yet.</p>
            ) : (
              data.recentWon.map((w: any) => (
                <div key={w.id} className="py-2.5 flex items-center justify-between text-xs">
                  <div>
                    <button
                      onClick={() => onNavigate(`/leads/${w.id}`)}
                      className="font-semibold text-slate-900 hover:underline"
                    >
                      {w.name}
                    </button>
                    <span className="text-[11px] text-slate-500 block">{w.source}</span>
                  </div>
                  <span className="font-mono font-bold text-emerald-700 tabular-nums">
                    {formatMoney(Number(w.wonValue))}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Closed Lost Analysis */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 mb-3 pb-2 border-b border-slate-100">
            <BarChart3 className="w-4 h-4 text-slate-500" />
            Recent Lost Reasons
          </h3>
          <div className="divide-y divide-slate-100">
            {data.recentLost.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">No lost deals recorded.</p>
            ) : (
              data.recentLost.map((l: any) => (
                <div key={l.id} className="py-2.5 text-xs">
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => onNavigate(`/leads/${l.id}`)}
                      className="font-semibold text-slate-900 hover:underline"
                    >
                      {l.name}
                    </button>
                    <span className="font-mono text-slate-500 tabular-nums">
                      {formatMoney(Number(l.potentialValue))}
                    </span>
                  </div>
                  {l.outcomeReason && (
                    <p className="text-[11px] text-rose-700 mt-1 italic">"{l.outcomeReason}"</p>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
