// TypeSelector.tsx — Grid de tarjetas de tipo de investigación
import React from 'react';
import { TYPE_META, ResearchType } from '../../lib/research';

interface Props {
  onSelect: (type: ResearchType) => void;
}

export default function TypeSelector({ onSelect }: Props) {
  const types = Object.entries(TYPE_META) as [ResearchType, typeof TYPE_META[ResearchType]][];

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">¿Qué tipo de negocio quieres investigar?</h2>
      <p className="text-gray-500 dark:text-slate-400 mb-6 text-sm">Selecciona el modelo de negocio. El agente analizará viabilidad, proveedores, competencia, márgenes y te entregará un informe completo.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {types.map(([type, meta]) => (
          <button
            key={type}
            onClick={() => meta.active && onSelect(type)}
            disabled={!meta.active}
            className={`
              relative text-left rounded-xl border p-5 transition-all group
              ${meta.active
                ? 'border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800/60 hover:border-orange-500/60 hover:bg-gray-50 dark:hover:bg-slate-800 cursor-pointer'
                : 'border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/30 cursor-not-allowed opacity-60'
              }
            `}
          >
            {/* Icon + Status badge */}
            <div className="flex items-start justify-between mb-3">
              <span className="text-3xl">{meta.icon}</span>
              {meta.active ? (
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 dark:bg-green-900/60 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-700/50">
                  Activo
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400">
                  Próximamente
                </span>
              )}
            </div>
            {/* Title */}
            <h3 className={`font-bold text-sm mb-2 ${meta.active ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-slate-400'}`}>
              {meta.label}
            </h3>
            <p className="text-gray-500 dark:text-slate-400 text-xs leading-relaxed">{meta.description}</p>
            {/* Hover accent line */}
            {meta.active && (
              <div
                className="absolute bottom-0 left-0 right-0 h-0.5 rounded-b-xl opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ background: meta.color }}
              />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
