import React from 'react';

interface LoadingSkeletonProps {
  variant?: 'table' | 'cards' | 'board' | 'detail';
}

export function LoadingSkeleton({ variant = 'table' }: LoadingSkeletonProps) {
  if (variant === 'board') {
    return (
      <div className="flex gap-4 overflow-x-auto pb-4">
        {[1, 2, 3, 4, 5].map((col) => (
          <div key={col} className="w-72 shrink-0 bg-slate-100/70 rounded-xl p-3 flex flex-col gap-3 animate-pulse">
            <div className="h-5 bg-slate-200 rounded w-1/2"></div>
            <div className="h-28 bg-white rounded-lg border border-slate-200"></div>
            <div className="h-28 bg-white rounded-lg border border-slate-200"></div>
            <div className="h-28 bg-white rounded-lg border border-slate-200"></div>
          </div>
        ))}
      </div>
    );
  }

  if (variant === 'cards') {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="p-4 bg-white rounded-xl border border-slate-200">
            <div className="h-4 bg-slate-200 rounded w-1/3 mb-3"></div>
            <div className="h-7 bg-slate-200 rounded w-1/2 mb-2"></div>
            <div className="h-3 bg-slate-100 rounded w-2/3"></div>
          </div>
        ))}
      </div>
    );
  }

  if (variant === 'detail') {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-pulse">
        <div className="lg:col-span-2 space-y-4">
          <div className="h-40 bg-white rounded-xl border border-slate-200 p-6"></div>
          <div className="h-80 bg-white rounded-xl border border-slate-200 p-6"></div>
        </div>
        <div className="space-y-4">
          <div className="h-48 bg-white rounded-xl border border-slate-200 p-6"></div>
          <div className="h-64 bg-white rounded-xl border border-slate-200 p-6"></div>
        </div>
      </div>
    );
  }

  // Default table skeleton
  return (
    <div className="w-full bg-white rounded-xl border border-slate-200 overflow-hidden animate-pulse">
      <div className="h-12 bg-slate-50 border-b border-slate-200"></div>
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div key={i} className="h-14 border-b border-slate-100 px-4 flex items-center gap-4">
          <div className="h-4 bg-slate-200 rounded w-1/4"></div>
          <div className="h-4 bg-slate-200 rounded w-1/6"></div>
          <div className="h-4 bg-slate-200 rounded w-1/6"></div>
          <div className="h-4 bg-slate-200 rounded w-1/6"></div>
          <div className="h-4 bg-slate-200 rounded w-1/8 ml-auto"></div>
        </div>
      ))}
    </div>
  );
}
