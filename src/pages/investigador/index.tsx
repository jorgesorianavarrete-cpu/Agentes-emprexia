// pages/investigador/index.tsx — /investigador — Mis Investigaciones
import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { researchApi, Investigation, VERDICT_META, STATUS_META, TYPE_META, ResearchType, ResearchStatus, Verdict } from '../../lib/research';

function VerdictBadge({ verdict }: { verdict?: Verdict | null }) {
  if (!verdict) return <span className="text-gray-400 dark:text-slate-500 text-xs">—</span>;
  const m = VERDICT_META[verdict];
  return (
    <span className="px-2 py-0.5 rounded-full text-xs font-bold" style={{ color: m.color, background: m.bg }}>
      {m.emoji} {m.label}
    </span>
  );
}

function StatusBadge({ status }: { status: ResearchStatus }) {
  const m = STATUS_META[status];
  return (
    <span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{ color: m.color, background: m.bg }}>
      {status === 'running' ? '⚙️' : status === 'queued' ? '⏳' : status === 'done' ? '✅' : '❌'} {m.label}
    </span>
  );
}

export default function InvestigadorIndex() {
  const [investigations, setInvestigations] = useState<Investigation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterVerdict, setFilterVerdict] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error: err } = await researchApi.list({ type: filterType || undefined, verdict: filterVerdict || undefined, status: filterStatus || undefined });
    if (err) setError(err);
    else setInvestigations(data?.investigations || []);
    setLoading(false);
  }, [filterType, filterVerdict, filterStatus]);

  useEffect(() => { load(); }, [load]);

  const filtered = search
    ? investigations.filter(i => i.name.toLowerCase().includes(search.toLowerCase()))
    : investigations;

  const inputCls = "bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 text-sm focus:outline-none focus:border-orange-500";
  const selectCls = "bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2 text-gray-700 dark:text-slate-300 text-sm focus:outline-none focus:border-orange-500";

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white">🔍 Mis Investigaciones</h1>
          <p className="text-gray-500 dark:text-slate-400 text-sm mt-1">Análisis de viabilidad de negocio generados por el agente</p>
        </div>
        <Link
          to="/investigador/nuevo"
          className="flex items-center gap-2 px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl text-sm transition-colors shadow-lg shadow-orange-500/20"
        >
          + Nueva investigación
        </Link>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2 mb-4">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por nombre…"
          className={`flex-1 min-w-[180px] ${inputCls}`}
        />
        <select value={filterType} onChange={e => setFilterType(e.target.value)} className={selectCls}>
          <option value="">Todos los tipos</option>
          <option value="dropshipping">🛒 Dropshipping</option>
          <option value="productos-ia">🤖 Productos IA</option>
        </select>
        <select value={filterVerdict} onChange={e => setFilterVerdict(e.target.value)} className={selectCls}>
          <option value="">Todos los veredictos</option>
          <option value="go">🟢 GO</option>
          <option value="conditional">🟡 CONDICIONAL</option>
          <option value="no-go">🔴 NO GO</option>
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className={selectCls}>
          <option value="">Todos los estados</option>
          <option value="queued">En cola</option>
          <option value="running">En proceso</option>
          <option value="done">Completadas</option>
          <option value="error">Con error</option>
        </select>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-gray-500 dark:text-slate-400">
          <svg className="animate-spin w-6 h-6 mr-3 text-orange-500" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Cargando investigaciones…
        </div>
      ) : error ? (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700/40 rounded-xl text-red-600 dark:text-red-400 text-sm">{error}</div>
      ) : filtered.length === 0 ? (
        /* Empty state */
        <div className="text-center py-16">
          <div className="text-5xl mb-4">🔍</div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">No hay investigaciones aún</h3>
          <p className="text-gray-500 dark:text-slate-400 text-sm mb-6">Lanza tu primera investigación de negocio y recibe un informe completo en minutos</p>
          <div className="flex flex-wrap justify-center gap-3">
            {(['dropshipping', 'productos-ia'] as ResearchType[]).map(type => (
              <Link key={type} to={`/investigador/nuevo?type=${type}`}
                className="flex items-center gap-2 px-4 py-3 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 hover:border-orange-400 dark:hover:border-orange-500/50 rounded-xl text-sm text-gray-700 dark:text-slate-300 hover:text-gray-900 dark:hover:text-white transition-all">
                <span className="text-xl">{TYPE_META[type].icon}</span>
                <span>{TYPE_META[type].label}</span>
              </Link>
            ))}
          </div>
        </div>
      ) : (
        /* Table */
        <div className="rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
          {/* Desktop */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-100 dark:bg-slate-900/60 border-b border-gray-200 dark:border-slate-700">
                  <th className="px-4 py-3 text-left text-xs text-gray-500 dark:text-slate-400 font-semibold uppercase tracking-wider">Nombre</th>
                  <th className="px-4 py-3 text-left text-xs text-gray-500 dark:text-slate-400 font-semibold uppercase tracking-wider">Tipo</th>
                  <th className="px-4 py-3 text-left text-xs text-gray-500 dark:text-slate-400 font-semibold uppercase tracking-wider">Fecha</th>
                  <th className="px-4 py-3 text-left text-xs text-gray-500 dark:text-slate-400 font-semibold uppercase tracking-wider">Estado</th>
                  <th className="px-4 py-3 text-left text-xs text-gray-500 dark:text-slate-400 font-semibold uppercase tracking-wider">Veredicto</th>
                  <th className="px-4 py-3 text-left text-xs text-gray-500 dark:text-slate-400 font-semibold uppercase tracking-wider">Docs</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-700/50">
                {filtered.map(inv => (
                  <tr
                    key={inv.id}
                    className="bg-white dark:bg-slate-800/30 hover:bg-gray-50 dark:hover:bg-slate-800/60 cursor-pointer transition-colors group"
                    onClick={() => window.location.href = `/investigador/${inv.id}`}
                  >
                    <td className="px-4 py-3">
                      <span className="font-semibold text-gray-900 dark:text-white group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">{inv.name}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1.5 text-gray-600 dark:text-slate-300 text-xs">
                        <span>{TYPE_META[inv.type]?.icon}</span>
                        <span>{TYPE_META[inv.type]?.label || inv.type}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-slate-400 text-xs">
                      {new Date(inv.created_at).toLocaleDateString('es-ES')}
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={inv.status} /></td>
                    <td className="px-4 py-3"><VerdictBadge verdict={inv.verdict} /></td>
                    <td className="px-4 py-3 text-gray-500 dark:text-slate-400 text-xs">
                      {inv.documents_ready != null ? `${inv.documents_ready}/${inv.documents_total} listos` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Mobile cards */}
          <div className="md:hidden divide-y divide-gray-100 dark:divide-slate-700/50">
            {filtered.map(inv => (
              <Link key={inv.id} to={`/investigador/${inv.id}`} className="flex flex-col gap-2 px-4 py-3 bg-white dark:bg-slate-800/30 hover:bg-gray-50 dark:hover:bg-slate-800/60 transition-colors">
                <div className="flex items-start justify-between gap-2">
                  <span className="font-semibold text-gray-900 dark:text-white text-sm">{inv.name}</span>
                  <VerdictBadge verdict={inv.verdict} />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={inv.status} />
                  <span className="text-xs text-gray-500 dark:text-slate-400">{TYPE_META[inv.type]?.icon} {TYPE_META[inv.type]?.label || inv.type}</span>
                  <span className="text-xs text-gray-400 dark:text-slate-500">{new Date(inv.created_at).toLocaleDateString('es-ES')}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
