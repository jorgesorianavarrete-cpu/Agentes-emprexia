// ProgressCard.tsx — Vista de progreso en tiempo real
import React from 'react';
import { Investigation, MODULES_ALL, STATUS_META, TYPE_META } from '../../lib/research';

interface Props {
  investigation: Investigation;
}

export default function ProgressCard({ investigation }: Props) {
  const { status, progress, modules_done, type, name, created_at } = investigation;
  const statusMeta = STATUS_META[status] || STATUS_META.queued;
  const typeMeta = TYPE_META[type];
  const elapsed = Math.floor((Date.now() - new Date(created_at).getTime()) / 60000);

  return (
    <div className="bg-white dark:bg-slate-800/60 border border-gray-200 dark:border-slate-700 rounded-2xl p-6 md:p-8">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xl">{typeMeta.icon}</span>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">{name}</h2>
          </div>
          <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-slate-400">
            <span>{typeMeta.label}</span>
            <span>·</span>
            <span
              className="px-2 py-0.5 rounded-full text-xs font-semibold"
              style={{ color: statusMeta.color, background: statusMeta.bg }}
            >
              {status === 'queued' ? '⏳ En cola' : status === 'running' ? '⚙️ En proceso' : statusMeta.label}
            </span>
          </div>
        </div>
        <div className="text-right text-xs text-gray-400 dark:text-slate-500">
          Iniciada hace {elapsed < 1 ? 'unos segundos' : `${elapsed} min`}
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-600 dark:text-slate-300">Progreso</span>
          <span className="text-sm font-bold text-gray-900 dark:text-white">{progress}%</span>
        </div>
        <div className="h-3 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${progress}%`, background: typeMeta.color }}
          />
        </div>
      </div>

      {/* Modules grid */}
      <div>
        <p className="text-sm font-semibold text-gray-500 dark:text-slate-400 mb-3">Módulos</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {MODULES_ALL.map(mod => {
            const done = modules_done?.includes(mod.key);
            const current = !done && modules_done && MODULES_ALL.findIndex(m => !modules_done.includes(m.key)) === MODULES_ALL.indexOf(mod);
            return (
              <div
                key={mod.key}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                  done
                    ? 'bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700/40 text-green-700 dark:text-green-400'
                    : current
                    ? 'bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-600/50 text-blue-700 dark:text-blue-400'
                    : 'bg-gray-100 dark:bg-slate-700/40 border border-gray-200 dark:border-slate-700 text-gray-400 dark:text-slate-500'
                }`}
              >
                <span>
                  {done ? '✅' : current ? '⏳' : '○'}
                </span>
                {mod.label}
              </div>
            );
          })}
        </div>
      </div>

      {/* Animación de espera */}
      {(status === 'queued' || status === 'running') && (
        <div className="mt-6 flex items-center gap-3 text-gray-500 dark:text-slate-400 text-sm">
          <svg className="animate-spin w-4 h-4 flex-shrink-0" style={{ color: typeMeta.color }} fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span>
            {status === 'queued'
              ? 'Esperando que el agente comience la investigación...'
              : 'El agente está analizando datos en tiempo real...'}
          </span>
        </div>
      )}

      {/* Error */}
      {status === 'error' && investigation.error_message && (
        <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700/40 rounded-lg text-red-600 dark:text-red-400 text-sm">
          ⚠️ {investigation.error_message}
        </div>
      )}
    </div>
  );
}
