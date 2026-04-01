// CompetitionModule.tsx — Módulo de Competencia y Facilidad de Entrada (3B)
import React from 'react';
import { Competition, Competitor } from '../../lib/research';

interface Props {
  competition: Competition;
}

function LevelBadge({ level }: { level?: string }) {
  const map: Record<string, { label: string; color: string; bg: string; border: string }> = {
    low:    { label: '🟢 BAJA',  color: '#16A34A', bg: '#DCFCE7', border: '#166534' },
    medium: { label: '🟡 MEDIA', color: '#B45309', bg: '#FEF9C3', border: '#92400E' },
    high:   { label: '🔴 ALTA',  color: '#DC2626', bg: '#FEE2E2', border: '#991B1B' },
  };
  const m = map[level || ''] || { label: '—', color: '#64748B', bg: 'transparent', border: '#475569' };
  return (
    <div className="inline-flex items-center px-4 py-2 rounded-xl text-xl font-black" style={{ color: m.color, background: m.bg, border: `1.5px solid ${m.border}` }}>
      {m.label}
    </div>
  );
}

function ThreatBadge({ level }: { level?: string }) {
  if (level === 'high') return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400">🔴 Alto</span>;
  if (level === 'low')  return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400">🟢 Bajo</span>;
  return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-400">🟡 Medio</span>;
}

function BarrierBadge({ val }: { val?: string }) {
  if (val === 'bajo' || val === 'low') return <span className="px-2 py-0.5 rounded-full text-xs bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400">Bajo</span>;
  if (val === 'alto' || val === 'high') return <span className="px-2 py-0.5 rounded-full text-xs bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400">Alto</span>;
  if (val === 'medio' || val === 'medium') return <span className="px-2 py-0.5 rounded-full text-xs bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-400">Medio</span>;
  if (val === true || val === 'Sí') return <span className="px-2 py-0.5 rounded-full text-xs bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400">✓ Sí</span>;
  if (val === false || val === 'No') return <span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400">✗ No</span>;
  return <span className="text-gray-600 dark:text-slate-400 text-xs">{val || '—'}</span>;
}

export default function CompetitionModule({ competition: comp }: Props) {
  const ee = comp.entry_ease || {};
  const competitors = comp.competitors || [];
  const gaps = comp.gaps || [];

  const entryFactors = [
    { label: 'Barreras de capital',     val: ee.capital_barrier },
    { label: 'Barreras de proveedor',   val: ee.supplier_barrier },
    { label: 'Barreras regulatorias',   val: ee.regulatory_barrier },
    { label: 'Barreras de marca',       val: ee.brand_barrier },
    { label: 'Ventana de precio',       val: ee.price_window != null ? (ee.price_window ? 'Sí' : 'No') : undefined },
    { label: 'Ventana de canal',        val: ee.channel_window != null ? (ee.channel_window ? 'Sí' : 'No') : undefined },
    { label: 'Ventana de formato',      val: ee.format_window != null ? (ee.format_window ? 'Sí' : 'No') : undefined },
    { label: 'Tiempo a primera venta',  val: ee.time_to_first_sale_weeks != null ? `${ee.time_to_first_sale_weeks} sem.` : undefined },
    { label: 'Tiempo a superar mediano',val: ee.time_to_beat_median_months != null ? `${ee.time_to_beat_median_months} meses` : undefined },
  ].filter(f => f.val != null);

  return (
    <div className="space-y-6">
      {/* Mapa competitivo */}
      <div className="flex flex-wrap items-start gap-6">
        <div>
          <p className="text-xs text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-2">Nivel de competencia</p>
          <LevelBadge level={comp.level} />
          {comp.level_summary && (
            <p className="text-gray-600 dark:text-slate-400 text-xs mt-2 max-w-sm">{comp.level_summary}</p>
          )}
        </div>
        {ee.score != null && (
          <div className="min-w-[160px]">
            <p className="text-xs text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-2">Facilidad de entrada</p>
            <div className="text-4xl font-black text-orange-500 dark:text-orange-400">{ee.score}<span className="text-xl text-gray-400 dark:text-slate-500">/10</span></div>
            <div className="flex items-center gap-2 mt-1">
              <div className="flex-1 h-2 bg-gray-200 dark:bg-slate-700 rounded-full">
                <div className="h-full rounded-full bg-orange-500 dark:bg-orange-400" style={{ width: `${(ee.score / 10) * 100}%` }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Tabla de competidores */}
      {competitors.length > 0 && (
        <div>
          <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-3">Ranking de Competidores</h4>
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto rounded-xl border border-gray-200 dark:border-slate-700">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-100 dark:bg-slate-900/60">
                  <th className="px-3 py-2.5 text-left text-gray-500 dark:text-slate-400 font-semibold w-6">#</th>
                  <th className="px-3 py-2.5 text-left text-gray-500 dark:text-slate-400 font-semibold">Nombre / URL</th>
                  <th className="px-3 py-2.5 text-left text-gray-500 dark:text-slate-400 font-semibold">Canal</th>
                  <th className="px-3 py-2.5 text-left text-gray-500 dark:text-slate-400 font-semibold">Tráfico</th>
                  <th className="px-3 py-2.5 text-left text-gray-500 dark:text-slate-400 font-semibold">Fortalezas</th>
                  <th className="px-3 py-2.5 text-left text-gray-500 dark:text-slate-400 font-semibold">Debilidades</th>
                  <th className="px-3 py-2.5 text-left text-gray-500 dark:text-slate-400 font-semibold">Amenaza</th>
                  <th className="px-3 py-2.5 text-left text-gray-500 dark:text-slate-400 font-semibold">Gap explotable</th>
                </tr>
              </thead>
              <tbody>
                {competitors.map((c: Competitor, i: number) => (
                  <tr key={i} className={i % 2 === 0 ? 'bg-gray-50 dark:bg-slate-800/40' : 'bg-white dark:bg-slate-800/20'}>
                    <td className="px-3 py-2 text-gray-500 dark:text-slate-400 font-bold">#{c.rank || i + 1}</td>
                    <td className="px-3 py-2">
                      <span className="font-semibold text-gray-900 dark:text-white">{c.name}</span>
                      {c.url && <a href={c.url} target="_blank" rel="noreferrer" className="block text-blue-500 dark:text-blue-400 hover:underline truncate max-w-[120px]">{c.url}</a>}
                    </td>
                    <td className="px-3 py-2 text-gray-600 dark:text-slate-300">{c.main_channel || '—'}</td>
                    <td className="px-3 py-2 text-gray-600 dark:text-slate-300">{c.traffic_estimate || '—'}</td>
                    <td className="px-3 py-2">
                      <ul className="space-y-0.5 text-green-600 dark:text-green-400">{(c.strengths || []).map((s, j) => <li key={j}>· {s}</li>)}</ul>
                    </td>
                    <td className="px-3 py-2">
                      <ul className="space-y-0.5 text-red-500 dark:text-red-400">{(c.weaknesses || []).map((w, j) => <li key={j}>· {w}</li>)}</ul>
                    </td>
                    <td className="px-3 py-2"><ThreatBadge level={c.threat_level} /></td>
                    <td className="px-3 py-2 text-gray-600 dark:text-slate-300 text-xs max-w-[160px]">{c.exploitable_gap || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {competitors.map((c: Competitor, i: number) => (
              <div key={i} className="bg-white dark:bg-slate-800/60 border border-gray-200 dark:border-slate-700 rounded-xl p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <span className="font-bold text-gray-900 dark:text-white">#{c.rank || i+1} {c.name}</span>
                    {c.url && <a href={c.url} target="_blank" rel="noreferrer" className="block text-blue-500 dark:text-blue-400 text-xs">{c.url}</a>}
                  </div>
                  <ThreatBadge level={c.threat_level} />
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {c.main_channel && <div><span className="text-gray-500 dark:text-slate-400">Canal: </span><span className="text-gray-700 dark:text-slate-300">{c.main_channel}</span></div>}
                  {c.traffic_estimate && <div><span className="text-gray-500 dark:text-slate-400">Tráfico: </span><span className="text-gray-700 dark:text-slate-300">{c.traffic_estimate}</span></div>}
                </div>
                {c.exploitable_gap && <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700/30 rounded text-xs text-blue-600 dark:text-blue-300"><span className="font-semibold">Gap: </span>{c.exploitable_gap}</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Factores de entrada */}
      {entryFactors.length > 0 && (
        <div>
          <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-3">Factores de Facilidad de Entrada</h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {entryFactors.map((f, i) => (
              <div key={i} className="bg-gray-50 dark:bg-slate-800/40 border border-gray-200 dark:border-slate-700 rounded-lg p-2.5">
                <div className="text-xs text-gray-500 dark:text-slate-400 mb-1">{f.label}</div>
                <BarrierBadge val={f.val} />
              </div>
            ))}
          </div>
          {ee.narrative && (
            <div className="mt-3 p-3 border-l-4 border-orange-500/60 bg-orange-50 dark:bg-orange-500/5 rounded-r-xl text-sm text-gray-700 dark:text-slate-300">
              {ee.narrative}
            </div>
          )}
        </div>
      )}

      {/* Gaps de mercado */}
      {gaps.length > 0 && (
        <div>
          <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-3">Gaps de Mercado Detectados</h4>
          <div className="space-y-2">
            {gaps.map((g, i) => (
              <div key={i} className="flex gap-3 p-3 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-700/20 rounded-xl">
                <span className="flex-shrink-0 w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center text-white text-xs font-bold">{i + 1}</span>
                <p className="text-sm text-gray-700 dark:text-slate-300">{g}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Conclusión */}
      {comp.conclusion && (
        <div>
          <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-2">¿Merece la pena entrar?</h4>
          <div className="p-4 border-l-4 border-gray-400 dark:border-slate-500 bg-gray-50 dark:bg-slate-700/30 rounded-r-xl text-sm text-gray-700 dark:text-slate-300 leading-relaxed">
            {comp.conclusion}
          </div>
        </div>
      )}
    </div>
  );
}
