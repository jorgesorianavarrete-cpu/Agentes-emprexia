import { Play, RefreshCw } from 'lucide-react';
import { useState, useEffect } from 'react';
import { dbGet } from '../lib/insforge';
import { AgentRun, Agent } from '../lib/types';
import StatusBadge from '../components/StatusBadge';
import Modal from '../components/Modal';
import AreaBadge from '../components/AreaBadge';
import PageHeader from '../components/PageHeader';
import PageHelp from '../components/PageHelp';

const STATUS_FILTER_LABELS: Record<string, string> = {
  all: 'Todos',
  completed: 'Completadas',
  running: 'En progreso',
  failed: 'Fallidas',
};

function fmt(d: string) {
  return new Date(d).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export default function Runs() {
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [agentMap, setAgentMap] = useState<Record<string, Agent>>({});
  const [loading, setLoading] = useState(true);
  const [agentFilter, setAgentFilter] = useState('');
  const [selected, setSelected] = useState<AgentRun | null>(null);
  const [statusFilter, setStatusFilter] = useState('all');

  const load = async () => {
    setLoading(true);
    try {
      const params = agentFilter
        ? `select=*&agent_id=eq.${agentFilter}&order=created_at.desc&limit=100`
        : 'select=*&order=created_at.desc&limit=100';
      const [r, a] = await Promise.all([dbGet('agent_runs', params), dbGet('agents', 'select=id,name,area')]);
      setRuns(r);
      setAgents(a);
      const map: Record<string, Agent> = {};
      a.forEach((ag: Agent) => { map[ag.id] = ag; });
      setAgentMap(map);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { load(); }, [agentFilter]);

  const agentName = (id: string) => agentMap[id]?.name || id?.slice(0, 8) + '…';
  const agentArea = (id: string) => agentMap[id]?.area || '';

  const statusCounts = runs.reduce((acc: Record<string, number>, r) => {
    acc[r.trigger] = (acc[r.trigger] || 0) + 1;
    return acc;
  }, {});

  const filtered = runs.filter(r => statusFilter === 'all' || r.trigger === statusFilter);

  const totalCost = runs.reduce((s, r) => s + (r.cost_eur || 0), 0);
  const avgLatency = runs.length ? Math.round(runs.reduce((s, r) => s + (r.latency_ms || 0), 0) / runs.length) : 0;

  return (
    <div className="p-4 sm:p-6 space-y-5">
            <PageHeader
        title="Ejecuciones"
        icon={Play}
        badge={runs.length}
        subtitle="ejecuciones totales"
        actions={
          <button onClick={load} className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-gray-500 dark:text-slate-400 bg-white dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] hover:border-gray-300 dark:hover:border-white/[0.12] transition-all">
            <RefreshCw size={14} />
            Actualizar
          </button>
        }
      />

      {/* Summary stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { label: 'Total ejecuciones', value: runs.length, color: 'text-gray-900 dark:text-white' },
          { label: 'Coste total', value: `${totalCost.toFixed(2)}€`, color: 'text-indigo-400' },
          { label: 'Latencia media', value: `${avgLatency}ms`, color: 'text-cyan-400' },
        ].map(s => (
          <div key={s.label} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl px-4 py-3">
            <div className="text-xs text-gray-500 mb-1">{s.label}</div>
            <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <select value={agentFilter} onChange={e => setAgentFilter(e.target.value)}
          className="bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500">
          <option value="">Todos los agentes</option>
          {agents.map(a => <option key={a.id} value={a.id}><AreaBadge area={a.area} /> {a.name}</option>)}
        </select>
        <div className="flex items-center gap-1.5">
          {['all', 'completed', 'running', 'failed'].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${statusFilter === s ? 'bg-indigo-500/15 text-indigo-400' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 hover:text-gray-600 dark:text-gray-300'}`}>
              {STATUS_FILTER_LABELS[s] ?? s}
              {s !== 'all' && statusCounts[s] ? <span className="ml-1.5 opacity-60">{statusCounts[s]}</span> : null}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center gap-3 text-gray-500 py-8">
          <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
          <span className="text-sm">Cargando ejecuciones...</span>
        </div>
      ) : (
        <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-200 dark:border-gray-800">
                <th className="pb-2 pr-4 font-medium">Agente</th>
                <th className="pb-2 pr-4 font-medium">Estado</th>
                <th className="pb-2 pr-4 font-medium">Prompt</th>
                <th className="pb-2 pr-4 font-medium text-right">Tokens</th>
                <th className="pb-2 pr-4 font-medium text-right">Coste</th>
                <th className="pb-2 pr-4 font-medium text-right">Latencia</th>
                <th className="pb-2 font-medium">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.id} onClick={() => setSelected(r)} className="border-b border-gray-200 dark:border-gray-800/50 hover:bg-gray-100 dark:bg-gray-800/30 cursor-pointer">
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-2">
                      <span><AreaBadge area={agentArea(r.agent_id)} size="sm" /></span>
                      <span className="text-gray-600 dark:text-gray-300 text-xs">{agentName(r.agent_id)}</span>
                    </div>
                  </td>
                  <td className="py-3 pr-4"><StatusBadge status={r.trigger} /></td>
                  <td className="py-3 pr-4 max-w-[200px]">
                    <p className="text-gray-400 text-xs truncate">{r.input_summary?.slice(0, 60) || '—'}</p>
                  </td>
                  <td className="py-3 pr-4 text-right font-mono text-xs text-gray-400">{r.tokens_used?.toLocaleString() || '—'}</td>
                  <td className="py-3 pr-4 text-right font-mono text-xs text-indigo-400">{r.cost_eur != null ? `${r.cost_eur.toFixed(2)}€` : '—'}</td>
                  <td className="py-3 pr-4 text-right font-mono text-xs text-cyan-400">{r.latency_ms ? `${r.latency_ms}ms` : '—'}</td>
                  <td className="py-3 text-xs text-gray-600">{fmt(r.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <div className="py-12 text-center text-gray-600 text-sm">No hay ejecuciones</div>}
        </div>
      )}

      {/* Detail Modal */}
      <Modal open={!!selected} onClose={() => setSelected(null)} title="Detalle de ejecución" wide>
        {selected && (
          <div className="space-y-4 text-sm">
            <div className="flex items-center gap-2 mb-1">
              <span><AreaBadge area={agentArea(selected.agent_id)} size="sm" /></span>
              <span className="text-gray-600 dark:text-gray-300">{agentName(selected.agent_id)}</span>
              <StatusBadge status={selected.trigger} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { label: 'Tokens totales', value: selected.tokens_used?.toLocaleString() || '—' },
                { label: 'Coste', value: `${selected.cost_eur?.toFixed(2)}€` },
                { label: 'Latencia', value: `${selected.latency_ms}ms` },
              ].map(f => (
                <div key={f.label} className="bg-gray-100 dark:bg-white/[0.04] rounded-lg px-3 py-2.5">
                  <div className="text-xs text-gray-500 mb-1">{f.label}</div>
                  <div className="text-gray-700 dark:text-gray-200 font-mono">{f.value}</div>
                </div>
              ))}
            </div>
            {selected.input_summary && (
              <div>
                <div className="text-xs text-gray-500 mb-2 font-medium uppercase tracking-wider">Entrada</div>
                <pre className="bg-gray-100 dark:bg-gray-800 rounded-xl p-4 text-xs text-gray-600 dark:text-gray-300 whitespace-pre-wrap max-h-36 overflow-y-auto">{selected.input_summary}</pre>
              </div>
            )}
            {selected.output_summary && (
              <div>
                <div className="text-xs text-gray-500 mb-2 font-medium uppercase tracking-wider">Salida</div>
                <pre className="bg-gray-100 dark:bg-gray-800 rounded-xl p-4 text-xs text-gray-600 dark:text-gray-300 whitespace-pre-wrap max-h-48 overflow-y-auto">{selected.output_summary}</pre>
              </div>
            )}
            {selected.result && (
              <div className="bg-gray-100 dark:bg-white/[0.04] rounded-xl p-3 text-xs text-gray-400">Resultado: {selected.result}</div>
            )}
          </div>
        )}
      </Modal>

      <PageHelp
        summary="Las ejecuciones registran cada vez que un agente procesa una tarea: el prompt enviado, la respuesta generada, los tokens consumidos, el coste en euros y la latencia."
        items={[
          { icon: '📊', title: 'Métricas', description: 'Coste total y latencia media te ayudan a monitorizar el rendimiento del sistema.' },
          { icon: '🔍', title: 'Filtros', description: 'Filtra por agente o estado (completada, en progreso, fallida) para localizar ejecuciones concretas.' },
          { icon: '📋', title: 'Detalle', description: 'Haz clic en cualquier fila para ver el prompt de entrada, la salida del agente y las métricas completas.' },
        ]}
      />
    </div>
  );
}
