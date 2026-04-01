// BrandLabSection.tsx — Sección BrandLab con grid de nombres y checklist
import React, { useState } from 'react';
import { BrandProposals, BrandName } from '../../lib/research';

interface Props {
  brandProposals: BrandProposals;
  onDownload?: () => void;
}

function AvailBadge({ available, ext }: { available?: boolean; ext: string }) {
  if (available == null) return <span className="px-1.5 py-0.5 rounded text-xs bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400">{ext}</span>;
  return available
    ? <span className="px-1.5 py-0.5 rounded text-xs bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-700/40">{ext} ✓</span>
    : <span className="px-1.5 py-0.5 rounded text-xs bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-700/30">{ext} ✗</span>;
}

function ScoreDots({ score = 0 }: { score?: number }) {
  const pct = Math.round((score / 10) * 100);
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex-1 h-1 bg-gray-200 dark:bg-slate-700 rounded-full">
        <div className="h-1 rounded-full bg-orange-500 dark:bg-orange-400" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-gray-500 dark:text-slate-400 w-6 text-right">{score}</span>
    </div>
  );
}

const STYLE_LABELS: Record<string, string> = {
  profesional: '💼 Profesional / Premium',
  premium: '💼 Profesional / Premium',
  moderno: '⚡ Moderno / Tech',
  tech: '⚡ Moderno / Tech',
  cercano: '🤝 Cercano / Accesible',
  accesible: '🤝 Cercano / Accesible',
};

function getStyleLabel(style?: string) {
  if (!style) return '—';
  return STYLE_LABELS[style.toLowerCase()] || style;
}

export default function BrandLabSection({ brandProposals: bp, onDownload }: Props) {
  const [checkedItems, setCheckedItems] = useState<Set<number>>(new Set());
  const rec = bp.recommended || bp.names?.[0];
  const names = bp.names || [];

  const defaultChecklist = [
    'Registrar dominio .com y .es',
    'Crear cuenta de Google Business',
    'Crear perfil Instagram y TikTok',
    'Crear página Facebook',
    'Registrar marca en OEPM (España)',
    'Crear ficha en Google Maps',
    'Crear cuenta Trustpilot',
    'Configurar DNS y SSL del dominio',
  ];
  const checklist = bp.digital_checklist || defaultChecklist;

  const toggleCheck = (i: number) => {
    setCheckedItems(prev => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  };

  // Agrupar por estilo
  const byStyle: Record<string, BrandName[]> = {};
  for (const n of names) {
    const s = n.style || n.estilo || 'otros';
    if (!byStyle[s]) byStyle[s] = [];
    byStyle[s].push(n);
  }

  return (
    <div className="space-y-6">
      {/* Nombre recomendado */}
      {rec && (
        <div className="p-4 bg-orange-50 dark:bg-gradient-to-r dark:from-orange-500/10 dark:to-amber-500/5 border border-orange-200 dark:border-orange-500/30 rounded-xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs text-orange-600 dark:text-orange-400 font-semibold uppercase tracking-wider mb-1">⭐ Nombre Recomendado</p>
              <p className="text-2xl font-black text-gray-900 dark:text-white">{rec.name || rec.nombre}</p>
              {rec.handle && <p className="text-gray-500 dark:text-slate-400 text-sm mt-1">Handle: <span className="text-gray-700 dark:text-slate-200">@{rec.handle}</span></p>}
            </div>
            <div className="flex flex-col gap-1.5 flex-shrink-0">
              <AvailBadge available={rec.com_available} ext=".com" />
              <AvailBadge available={rec.es_available} ext=".es" />
            </div>
          </div>
          {rec.reason || rec.razon ? (
            <p className="text-gray-700 dark:text-slate-300 text-sm mt-2 leading-relaxed">{rec.reason || rec.razon}</p>
          ) : null}
        </div>
      )}

      {/* Grid de nombres por estilo */}
      {Object.keys(byStyle).length > 0 ? (
        <div className="space-y-4">
          {Object.entries(byStyle).map(([style, styleNames]) => (
            <div key={style}>
              <h4 className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                {getStyleLabel(style)}
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {styleNames.map((n, i) => (
                  <div key={i} className="bg-white dark:bg-slate-800/60 border border-gray-200 dark:border-slate-700 rounded-xl p-3 hover:border-orange-400/40 dark:hover:border-orange-500/40 transition-colors">
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <span className="font-bold text-gray-900 dark:text-white text-sm">{n.name || n.nombre}</span>
                      <div className="flex gap-1 flex-shrink-0">
                        <AvailBadge available={n.com_available} ext=".com" />
                        <AvailBadge available={n.es_available} ext=".es" />
                      </div>
                    </div>
                    {n.score != null && <ScoreDots score={n.score} />}
                    {(n.reason || n.razon) && (
                      <p className="text-gray-400 dark:text-slate-500 text-xs mt-1.5 leading-relaxed">{n.reason || n.razon}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : names.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {names.map((n, i) => (
            <div key={i} className="bg-white dark:bg-slate-800/60 border border-gray-200 dark:border-slate-700 rounded-xl p-3">
              <div className="flex items-start justify-between gap-2 mb-1">
                <span className="font-bold text-gray-900 dark:text-white text-sm">{n.name || n.nombre}</span>
                <div className="flex gap-1"><AvailBadge available={n.com_available} ext=".com" /><AvailBadge available={n.es_available} ext=".es" /></div>
              </div>
              {n.score != null && <ScoreDots score={n.score} />}
            </div>
          ))}
        </div>
      ) : null}

      {/* Checklist presencia digital */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-bold text-gray-900 dark:text-white">📋 Checklist Presencia Digital</h4>
          <span className="text-xs text-gray-500 dark:text-slate-400">{checkedItems.size}/{checklist.length} completados</span>
        </div>
        <div className="space-y-1.5">
          {checklist.map((item, i) => (
            <button
              key={i}
              type="button"
              onClick={() => toggleCheck(i)}
              className={`w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm ${
                checkedItems.has(i)
                  ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700/30 text-green-700 dark:text-green-400'
                  : 'bg-gray-50 dark:bg-slate-800/40 border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-300 hover:border-gray-300 dark:hover:border-slate-600'
              }`}
            >
              <span className={`w-4 h-4 rounded flex-shrink-0 border flex items-center justify-center text-xs ${
                checkedItems.has(i) ? 'bg-green-600 border-green-600 text-white' : 'border-gray-400 dark:border-slate-500'
              }`}>
                {checkedItems.has(i) ? '✓' : ''}
              </span>
              {item}
            </button>
          ))}
        </div>
      </div>

      {/* Registradores recomendados */}
      <div className="p-4 bg-gray-50 dark:bg-slate-800/40 border border-gray-200 dark:border-slate-700 rounded-xl">
        <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-2">🔗 Registradores Recomendados (España)</h4>
        <ul className="space-y-1 text-sm text-gray-700 dark:text-slate-300">
          <li>· <strong>Dondominio.com</strong> — Mejor precio para .es (~5€/año)</li>
          <li>· <strong>Namecheap.com</strong> — Mejor relación calidad/precio .com (~9€/año)</li>
          <li>· <strong>GoDaddy.es</strong> — Soporte en español</li>
          <li>· <strong>Dinahosting.com</strong> — Registrador español con soporte local</li>
        </ul>
      </div>

      {/* Download button */}
      {onDownload && (
        <button
          onClick={onDownload}
          className="flex items-center gap-2 px-4 py-2 bg-orange-50 dark:bg-orange-500/10 border border-orange-200 dark:border-orange-500/30 text-orange-600 dark:text-orange-400 rounded-lg hover:bg-orange-100 dark:hover:bg-orange-500/20 transition-colors text-sm font-medium"
        >
          ⬇️ Descargar informe BrandLab
        </button>
      )}
    </div>
  );
}
