// KpiGrid.tsx — Grid de 10 KPIs con barras visuales (incluye Competencia)
import React from 'react';
import { ResearchResult, Competition } from '../../lib/research';

interface Props {
  result: ResearchResult;
}

function ScoreBar({ value, max = 10, color = '#F97316' }: { value: number; max?: number; color?: string }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <div className="flex items-center gap-2 mt-1">
      <div className="flex-1 h-1.5 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-xs font-bold text-gray-600 dark:text-slate-300 w-8 text-right">{value}/{max}</span>
    </div>
  );
}

function CompLevelBadge({ level }: { level?: string }) {
  const map: Record<string, { label: string; color: string; bg: string }> = {
    low:    { label: '🟢 Baja',    color: '#16A34A', bg: '#DCFCE7' },
    medium: { label: '🟡 Media',   color: '#B45309', bg: '#FEF9C3' },
    high:   { label: '🔴 Alta',    color: '#DC2626', bg: '#FEE2E2' },
  };
  const m = map[level || ''] || { label: '—', color: '#64748B', bg: 'transparent' };
  return (
    <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ color: m.color, background: m.bg }}>
      {m.label}
    </span>
  );
}

interface KpiItem {
  label: string;
  value: React.ReactNode;
  bar?: { value: number; max: number; color: string };
  sub?: string;
}

export default function KpiGrid({ result }: Props) {
  const comp: Competition | undefined = result.competition;

  const kpis: KpiItem[] = [
    {
      label: 'Demanda transaccional',
      value: result.demand_score != null ? `${result.demand_score}/10` : '—',
      bar: result.demand_score != null ? { value: result.demand_score, max: 10, color: '#3B82F6' } : undefined,
    },
    {
      label: 'Riesgo de devolución',
      value: result.return_risk_score != null ? `${result.return_risk_score}/10` : '—',
      bar: result.return_risk_score != null ? { value: result.return_risk_score, max: 10, color: result.return_risk_score < 4 ? '#16A34A' : result.return_risk_score > 6 ? '#DC2626' : '#F59E0B' } : undefined,
      sub: 'Menor = mejor',
    },
    {
      label: 'Margen neto estimado',
      value: result.net_margin_pct != null ? `${result.net_margin_pct}%` : '—',
      sub: result.net_margin_pct != null ? (result.net_margin_pct > 40 ? '✅ Excelente' : result.net_margin_pct > 25 ? '👍 Bueno' : '⚠️ Ajustado') : undefined,
    },
    {
      label: 'Proveedor directo',
      value: result.supplier_verified === true ? '✅ Verificado' : result.supplier_verified === false ? '❌ No encontrado' : '—',
    },
    {
      label: 'Durabilidad tendencia',
      value: result.trend_durability || '—',
    },
    {
      label: 'Automatización',
      value: result.automation_pct != null ? `${result.automation_pct}%` : '—',
      bar: result.automation_pct != null ? { value: result.automation_pct, max: 100, color: '#8B5CF6' } : undefined,
    },
    {
      label: 'Comunidad activa ES',
      value: result.community_es || '—',
    },
    {
      label: 'LTV 24 meses',
      value: result.ltv_24m != null ? `€${result.ltv_24m.toLocaleString('es-ES')}` : '—',
    },
    {
      label: 'Nivel de competencia',
      value: <CompLevelBadge level={comp?.level} />,
      sub: comp?.level_summary ? comp.level_summary.slice(0, 60) + (comp.level_summary.length > 60 ? '…' : '') : undefined,
    },
    {
      label: 'Facilidad de entrada',
      value: comp?.entry_ease?.score != null ? `${comp.entry_ease.score}/10` : '—',
      bar: comp?.entry_ease?.score != null ? { value: comp.entry_ease.score, max: 10, color: '#F97316' } : undefined,
      sub: 'Mayor = más fácil',
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {kpis.map((kpi, i) => (
        <div
          key={i}
          className="bg-white dark:bg-slate-800/60 border border-gray-200 dark:border-slate-700 rounded-xl p-3 flex flex-col justify-between"
        >
          <div className="text-xs text-gray-500 dark:text-slate-400 mb-1 font-medium">{kpi.label}</div>
          <div className="text-lg font-bold text-gray-900 dark:text-white">{kpi.value}</div>
          {kpi.bar && <ScoreBar value={kpi.bar.value} max={kpi.bar.max} color={kpi.bar.color} />}
          {kpi.sub && <div className="text-xs text-gray-400 dark:text-slate-500 mt-1">{kpi.sub}</div>}
        </div>
      ))}
    </div>
  );
}
