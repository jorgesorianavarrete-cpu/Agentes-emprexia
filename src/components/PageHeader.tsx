import React from 'react';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  icon?: React.ElementType;
  actions?: React.ReactNode;
  badge?: string | number;
}

export default function PageHeader({ title, subtitle, icon: Icon, actions, badge }: PageHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-5 border-b border-gray-200 dark:border-white/[0.06] mb-5">
      <div className="flex items-center gap-3.5 min-w-0">
        {Icon && (
          <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center flex-shrink-0">
            <Icon size={20} className="text-indigo-600 dark:text-indigo-400" />
          </div>
        )}
        <div className="min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-[22px] font-bold text-gray-900 dark:text-white tracking-tight leading-tight">
              {title}
            </h1>
            {badge !== undefined && (
              <span className="px-2 py-0.5 rounded-md bg-gray-100 dark:bg-white/[0.07] text-gray-500 dark:text-slate-400 text-xs font-medium tabular-nums">
                {badge}
              </span>
            )}
          </div>
          {subtitle && (
            <p className="text-sm text-gray-500 dark:text-slate-500 mt-0.5 truncate">{subtitle}</p>
          )}
        </div>
      </div>
      {actions && (
        <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
          {actions}
        </div>
      )}
    </div>
  );
}
