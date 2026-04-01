// ResultCard.tsx — Ficha de resultados completa cuando status === 'done'
import React, { useState } from 'react';
import { Investigation, VERDICT_META, TYPE_META, ResearchResult, researchApi } from '../../lib/research';
import KpiGrid from './KpiGrid';
import CompetitionModule from './CompetitionModule';
import BrandLabSection from './BrandLabSection';
import DocumentsPanel from './DocumentsPanel';

interface AccordionProps {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
  accentColor?: string;
}

function Accordion({ title, defaultOpen = true, children }: AccordionProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-3.5 bg-gray-50 dark:bg-slate-800/60 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors text-left"
      >
        <span className="font-bold text-sm text-gray-900 dark:text-white">{title}</span>
        <span className="text-gray-400 dark:text-slate-400 text-sm">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="px-5 py-4 bg-white dark:bg-slate-800/20 border-t border-gray-100 dark:border-slate-700/50">
          {children}
        </div>
      )}
    </div>
  );
}

function SupplierCard({ supplier, index }: { supplier: ResearchResult['suppliers'] extends (infer U)[] | undefined ? NonNullable<U> : never; index: number }) {
  const s = supplier as Record<string, string>;
  const name = s.name || s.nombre || `Proveedor ${index + 1}`;
  const labels = [
    { k: 'Ubicación', v: s.location || s.ubicacion },
    { k: 'Envío a ES', v: s.shipping_es || s.envio_es },
    { k: 'Integración', v: s.integration || s.integracion },
    { k: 'Devoluciones', v: s.return_policy || s.devolucion },
  ];
  return (
    <div className="bg-white dark:bg-slate-800/60 border border-gray-200 dark:border-slate-700 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        {index === 0 && <span className="text-yellow-500 text-sm">⭐</span>}
        <h4 className="font-bold text-gray-900 dark:text-white text-sm">{index === 0 ? 'Proveedor Principal:' : index === 1 ? 'Backup:' : ''} {name}</h4>
        {index === 0 && <span className="px-2 py-0.5 rounded-full text-xs bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-700/40">Principal</span>}
        {index === 1 && <span className="px-2 py-0.5 rounded-full text-xs bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-700/40">Backup</span>}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {labels.map(({ k, v }) => v ? (
          <div key={k} className="text-xs">
            <span className="text-gray-500 dark:text-slate-400">{k}: </span>
            <span className="text-gray-700 dark:text-slate-200">{v}</span>
          </div>
        ) : null)}
      </div>
    </div>
  );
}

interface Props {
  investigation: Investigation;
  onArchive: () => void;
  onRetry: () => void;
  onDocumentsChange?: () => void;
}

export default function ResultCard({ investigation: inv, onArchive, onRetry, onDocumentsChange }: Props) {
  const verdictMeta = inv.verdict ? VERDICT_META[inv.verdict] : null;
  const typeMeta = TYPE_META[inv.type];
  const r: ResearchResult = inv.result || {};
  const brandProposals = inv.brand_proposals || r.brand_proposals || null;
  const docs = inv.documents || [];
  const date = new Date(inv.created_at).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div className="space-y-4">
      {/* ── Cabecera ── */}
      <div className="bg-white dark:bg-slate-800/60 border border-gray-200 dark:border-slate-700 rounded-2xl p-6">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-2xl">{typeMeta.icon}</span>
              <h1 className="text-2xl font-black text-gray-900 dark:text-white">{inv.name}</h1>
            </div>
            <p className="text-gray-500 dark:text-slate-400 text-sm">{typeMeta.label} · {date}</p>
          </div>
          {verdictMeta && (
            <div
              className="px-5 py-2.5 rounded-xl font-black text-lg"
              style={{ background: verdictMeta.bg, color: verdictMeta.color, border: `1.5px solid ${verdictMeta.color}40` }}
            >
              {verdictMeta.emoji} {verdictMeta.label}
            </div>
          )}
        </div>
        {inv.verdict_summary && (
          <p className="text-gray-700 dark:text-slate-300 text-sm leading-relaxed mb-4 max-w-3xl">{inv.verdict_summary}</p>
        )}
        {/* Acciones */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => window.open(researchApi.downloadAllUrl(inv.id), '_blank')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 dark:bg-orange-500/10 border border-orange-200 dark:border-orange-500/30 text-orange-600 dark:text-orange-400 hover:bg-orange-100 dark:hover:bg-orange-500/20 rounded-lg text-xs font-medium transition-colors"
          >
            📥 Descargar todo (.zip)
          </button>
          <button
            onClick={onRetry}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-slate-600 rounded-lg text-xs font-medium transition-colors"
          >
            🔁 Relanzar
          </button>
          <button
            onClick={onArchive}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-300 hover:text-red-500 hover:border-red-300 dark:hover:text-red-400 dark:hover:border-red-700/50 rounded-lg text-xs font-medium transition-colors"
          >
            🗑️ Archivar
          </button>
        </div>
      </div>

      {/* ── KPI Grid ── */}
      <div>
        <h3 className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-3">Métricas Clave</h3>
        <KpiGrid result={r} />
      </div>

      {/* ── Panel de documentos ── */}
      {docs.length > 0 && (
        <DocumentsPanel
          investigationId={inv.id}
          documents={docs}
          investigationName={inv.name}
          onRegenerate={onDocumentsChange}
        />
      )}

      {/* ── Módulos en acordeón ── */}
      <div className="space-y-3">
        {/* Proveedores */}
        {r.suppliers?.length ? (
          <Accordion title="🏭 Proveedores Directos Verificados">
            <div className="space-y-3">
              {r.suppliers.map((s, i) => (
                <SupplierCard key={i} supplier={s as never} index={i} />
              ))}
            </div>
          </Accordion>
        ) : null}

        {/* Competencia */}
        {r.competition && (
          <Accordion title="🏆 Competencia y Facilidad de Entrada" accentColor="#F97316">
            <CompetitionModule competition={r.competition} />
          </Accordion>
        )}

        {/* Margen y LTV */}
        {r.margin && (
          <Accordion title="💰 Margen y LTV">
            <div className="space-y-4">
              {r.margin.cost_breakdown?.length ? (
                <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-slate-700">
                  <table className="w-full text-xs">
                    <thead><tr className="bg-gray-100 dark:bg-slate-900/60"><th className="px-3 py-2.5 text-left text-gray-500 dark:text-slate-400">Concepto</th><th className="px-3 py-2.5 text-right text-gray-500 dark:text-slate-400">Importe</th></tr></thead>
                    <tbody>
                      {r.margin.cost_breakdown.map((row, i) => (
                        <tr key={i} className={i % 2 === 0 ? 'bg-gray-50 dark:bg-slate-800/40' : 'bg-white dark:bg-transparent'}>
                          <td className="px-3 py-2 text-gray-700 dark:text-slate-300">{row.label || row.concepto}</td>
                          <td className="px-3 py-2 text-right font-bold text-gray-900 dark:text-white">€{row.amount || row.importe}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
              {r.margin.net_margin != null && (
                <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700/30 rounded-xl text-sm">
                  <span className="text-gray-600 dark:text-slate-400">Margen neto estimado: </span>
                  <span className="font-black text-green-600 dark:text-green-400 text-lg">{r.margin.net_margin}%</span>
                </div>
              )}
            </div>
          </Accordion>
        )}

        {/* Automatización */}
        {r.automation && (
          <Accordion title="🤖 Stack de Automatización">
            <div className="space-y-3">
              {r.automation.tools?.length ? (
                <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-slate-700">
                  <table className="w-full text-xs">
                    <thead><tr className="bg-gray-100 dark:bg-slate-900/60"><th className="px-3 py-2.5 text-left text-gray-500 dark:text-slate-400">Herramienta</th><th className="px-3 py-2.5 text-left text-gray-500 dark:text-slate-400">Categoría</th><th className="px-3 py-2.5 text-right text-gray-500 dark:text-slate-400">Coste</th><th className="px-3 py-2.5 text-left text-gray-500 dark:text-slate-400">Función</th></tr></thead>
                    <tbody>
                      {r.automation.tools.map((t, i) => (
                        <tr key={i} className={i % 2 === 0 ? 'bg-gray-50 dark:bg-slate-800/40' : 'bg-white dark:bg-transparent'}>
                          <td className="px-3 py-2 font-semibold text-gray-900 dark:text-white">{t.name}</td>
                          <td className="px-3 py-2 text-gray-500 dark:text-slate-400">{t.category}</td>
                          <td className="px-3 py-2 text-right text-gray-700 dark:text-slate-300">€{t.cost_monthly}/mes</td>
                          <td className="px-3 py-2 text-gray-700 dark:text-slate-300">{t.purpose}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
              {r.automation.automation_pct != null && (
                <div className="p-3 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700/30 rounded-xl text-sm">
                  <span className="text-gray-600 dark:text-slate-400">Automatización total: </span>
                  <span className="font-black text-purple-600 dark:text-purple-400 text-lg">{r.automation.automation_pct}%</span>
                  {r.automation.hours_per_week != null && (
                    <span className="text-gray-500 dark:text-slate-400 ml-3">· {r.automation.hours_per_week}h/semana restantes</span>
                  )}
                </div>
              )}
            </div>
          </Accordion>
        )}

        {/* Marketplaces */}
        {r.marketplaces?.length ? (
          <Accordion title="🏪 Marketplaces y Canales">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {r.marketplaces.map((m, i) => (
                <div key={i} className={`p-3 rounded-xl border ${m.viable ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-700/30' : 'bg-gray-50 dark:bg-slate-800/40 border-gray-200 dark:border-slate-700'}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-sm text-gray-900 dark:text-white">{m.channel}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${m.viable ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400' : 'bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400'}`}>
                      {m.viable ? '✅ Viable' : '❌ No viable'}
                    </span>
                  </div>
                  {m.gap && <p className="text-xs text-blue-600 dark:text-blue-400">Gap: {m.gap}</p>}
                  {m.strategy && <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">{m.strategy}</p>}
                </div>
              ))}
            </div>
          </Accordion>
        ) : null}

        {/* Plan de acción */}
        {r.action_plan && (
          <Accordion title="📅 Plan de Acción 30 Días">
            <div className="space-y-4">
              {[
                { title: 'Semana 1 — Fundamentos técnicos', items: r.action_plan.week1 },
                { title: 'Semana 2 — Automatización', items: r.action_plan.week2 },
                { title: 'Semanas 3-4 — Primeras ventas', items: r.action_plan.week3_4 },
                { title: 'Meses 3-4 — Paid Media', items: r.action_plan.month3_4 },
              ].filter(w => w.items?.length).map((w, i) => (
                <div key={i}>
                  <h4 className="text-xs font-bold text-gray-500 dark:text-slate-400 uppercase mb-2">{w.title}</h4>
                  <ul className="space-y-1">
                    {w.items!.map((item, j) => (
                      <li key={j} className="flex items-start gap-2 text-sm text-gray-700 dark:text-slate-300">
                        <span className="text-orange-500 mt-0.5 flex-shrink-0">·</span>{item}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              {r.action_plan.break_even && (
                <div className="p-3 bg-gray-100 dark:bg-slate-700/40 border border-gray-200 dark:border-slate-600 rounded-xl text-sm">
                  <span className="text-gray-500 dark:text-slate-400">Break-even estimado: </span>
                  <span className="font-bold text-gray-900 dark:text-white">{r.action_plan.break_even}</span>
                </div>
              )}
            </div>
          </Accordion>
        )}

        {/* BrandLab */}
        {brandProposals && (brandProposals.names?.length || brandProposals.recommended) ? (
          <Accordion title="🏷️ BrandLab — Nombres y Dominios">
            <BrandLabSection brandProposals={brandProposals} />
          </Accordion>
        ) : null}

        {/* Proyección financiera */}
        {r.financial_projection?.monthly?.length ? (
          <Accordion title="📈 Proyección Financiera">
            <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-slate-700">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-100 dark:bg-slate-900/60">
                    <th className="px-3 py-2.5 text-left text-gray-500 dark:text-slate-400">Mes</th>
                    <th className="px-3 py-2.5 text-right text-gray-500 dark:text-slate-400">Ingresos</th>
                    <th className="px-3 py-2.5 text-right text-gray-500 dark:text-slate-400">Costes</th>
                    <th className="px-3 py-2.5 text-right text-gray-500 dark:text-slate-400">Beneficio</th>
                  </tr>
                </thead>
                <tbody>
                  {r.financial_projection.monthly.map((row, i) => {
                    const profit = row.profit || row.beneficio || 0;
                    return (
                      <tr key={i} className={i % 2 === 0 ? 'bg-gray-50 dark:bg-slate-800/40' : 'bg-white dark:bg-transparent'}>
                        <td className="px-3 py-2 text-gray-700 dark:text-slate-300">{row.month || row.mes}</td>
                        <td className="px-3 py-2 text-right text-gray-700 dark:text-slate-300">€{(row.revenue || row.ingresos || 0).toLocaleString('es-ES')}</td>
                        <td className="px-3 py-2 text-right text-gray-500 dark:text-slate-400">€{(row.costs || row.costes || 0).toLocaleString('es-ES')}</td>
                        <td className={`px-3 py-2 text-right font-bold ${profit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
                          €{(profit).toLocaleString('es-ES')}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Accordion>
        ) : null}

        {/* Riesgos */}
        {r.risks?.length ? (
          <Accordion title="⚠️ Riesgos y Mitigación" defaultOpen={false}>
            <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-slate-700">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-100 dark:bg-slate-900/60">
                    <th className="px-3 py-2.5 text-left text-gray-500 dark:text-slate-400">Riesgo</th>
                    <th className="px-3 py-2.5 text-left text-gray-500 dark:text-slate-400">Probabilidad</th>
                    <th className="px-3 py-2.5 text-left text-gray-500 dark:text-slate-400">Mitigación</th>
                  </tr>
                </thead>
                <tbody>
                  {r.risks.map((risk, i) => (
                    <tr key={i} className={i % 2 === 0 ? 'bg-gray-50 dark:bg-slate-800/40' : 'bg-white dark:bg-transparent'}>
                      <td className="px-3 py-2 text-gray-700 dark:text-slate-300">{risk.risk || risk.riesgo}</td>
                      <td className="px-3 py-2">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                          risk.probability === 'high' ? 'bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400'
                          : risk.probability === 'low' ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400'
                          : 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-400'
                        }`}>{risk.probability}</span>
                      </td>
                      <td className="px-3 py-2 text-gray-700 dark:text-slate-300">{risk.mitigation || risk.mitigacion}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Accordion>
        ) : null}
      </div>
    </div>
  );
}
