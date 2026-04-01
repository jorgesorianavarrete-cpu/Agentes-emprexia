import { RotateCw, RefreshCw } from 'lucide-react';
import { useState, useEffect } from 'react';
import { dbGet } from '../lib/insforge';
import { Handoff, Agent } from '../lib/types';
import StatusBadge from '../components/StatusBadge';
import Modal from '../components/Modal';
import AreaBadge from '../components/AreaBadge';
import PageHeader from '../components/PageHeader';
import PageHelp from '../components/PageHelp';

function fmt(d: string) {
  return new Date(d).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

const ESTADO_MAP: Record<string, string> = {
  all:       'Todas',
  pending:   'Pendiente',
  accepted:  'Aceptada',
  completed: 'Completada',
  rejected:  'Rechazada',
  escalated: 'Escalada',
};

export default function Delegaciones() {
  const [delegaciones, setDelegaciones] = useState<Handoff[]>([]);
  const [agents, setAgents]             = useState<Record<string, Agent>>({});
  const [loading, setLoading]           = useState(true);
  const [selected, setSelected]         = useState<Handoff | null>(null);
  const [filter, setFilter]             = useState('all');
  const [search, setSearch]             = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [h, a] = await Promise.all([
        dbGet('handoffs', 'select=*&order=created_at.desc&limit=100'),
        dbGet('agents', 'select=id,name,area'),
      ]);
      setDelegaciones(h);
      const map: Record<string, Agent> = {};
      a.forEach((ag: Agent) => { map[ag.id] = ag; });
      setAgents(map);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const agentName = (id: string) => agents[id]?.name || id?.slice(0, 8) + '…';
  const agentArea = (id: string) => agents[id]?.area || '';

  const conteoEstados = delegaciones.reduce((acc: Record<string, number>, h) => {
    acc[h.state] = (acc[h.state] || 0) + 1;
    return acc;
  }, {});

  const filtradas = delegaciones.filter(h => {
    const coincideEstado = filter === 'all' || h.state === filter;
    const coincideBusqueda = !search ||
      h.payload?.reason?.toLowerCase().includes(search.toLowerCase()) ||
      agentName(h.from_agent_id).toLowerCase().includes(search.toLowerCase()) ||
      agentName(h.to_agent_id).toLowerCase().includes(search.toLowerCase());
    return coincideEstado && coincideBusqueda;
  });

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <PageHeader
        title="Delegaciones"
        icon={RotateCw}
        badge={delegaciones.length}
        subtitle="delegaciones registradas"
        actions={
          <button onClick={load} className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-gray-500 dark:text-slate-400 bg-white dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] hover:border-gray-300 dark:hover:border-white/[0.12] transition-all">
            <RefreshCw size={14} />
            Actualizar
          </button>
        }
      />

      {/* Filtros */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
          <input type="text" placeholder="Buscar delegación..." value={search} onChange={e => setSearch(e.target.value)}
            className="bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 placeholder-gray-600 rounded-lg pl-9 pr-3 py-2 text-sm focus:border-indigo-500 outline-none w-52" />
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {['all', 'pending', 'accepted', 'completed', 'rejected', 'escalated'].map(s => (
            <button key={s} onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filter === s ? 'bg-indigo-500/15 text-indigo-400' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 hover:text-gray-600 dark:text-gray-300'}`}>
              {ESTADO_MAP[s] || s}
              {s !== 'all' && conteoEstados[s] ? <span className="ml-1.5 opacity-60">{conteoEstados[s]}</span> : null}
            </button>
          ))}
        </div>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="flex items-center gap-3 text-gray-500 py-8">
          <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
          <span className="text-sm">Cargando delegaciones...</span>
        </div>
      ) : (
        <div className="space-y-2">
          {filtradas.map(h => (
            <button key={h.id} onClick={() => setSelected(h)}
              className="w-full text-left bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 rounded-xl p-4 transition-colors">
              <div className="flex items-center justify-between gap-3">
                {/* Flujo agente → agente */}
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-sm">
                    <AreaBadge area={agentArea(h.from_agent_id)} size="sm" />
                    <span className="text-gray-600 dark:text-gray-300 font-medium truncate">{agentName(h.from_agent_id)}</span>
                  </div>
                  <svg className="text-gray-400 flex-shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                  <div className="flex items-center gap-2 text-sm">
                    <AreaBadge area={agentArea(h.to_agent_id)} size="sm" />
                    <span className="text-gray-600 dark:text-gray-300 font-medium truncate">{agentName(h.to_agent_id)}</span>
                  </div>
                </div>
                {/* Metadatos */}
                <div className="text-right flex-shrink-0 space-y-0.5">
                  <StatusBadge status={h.state} />
                  <div className="text-xs text-gray-500">{fmt(h.created_at)}</div>
                </div>
              </div>
              {h.payload?.reason && (
                <div className="mt-2 text-xs text-gray-500 truncate">{h.payload.reason}</div>
              )}
            </button>
          ))}
          {filtradas.length === 0 && (
            <div className="py-12 text-center text-gray-500 text-sm">No hay delegaciones que coincidan</div>
          )}
        </div>
      )}

      {/* Modal de detalle */}
      <Modal open={!!selected} onClose={() => setSelected(null)} title="Detalle de la delegación" wide>
        {selected && (
          <div className="space-y-4 text-sm">
            {/* Flujo */}
            <div className="bg-gray-100 dark:bg-white/[0.04] rounded-xl p-4 flex items-center justify-around">
              <div className="text-center">
                <div className="mb-1"><AreaBadge area={agentArea(selected.from_agent_id)} size="lg" /></div>
                <div className="text-xs text-gray-500 mb-0.5">Origen</div>
                <div className="text-sm font-medium text-gray-900 dark:text-white">{agentName(selected.from_agent_id)}</div>
              </div>
              <svg className="text-indigo-500" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
              <div className="text-center">
                <div className="mb-1"><AreaBadge area={agentArea(selected.to_agent_id)} size="lg" /></div>
                <div className="text-xs text-gray-500 mb-0.5">Destino</div>
                <div className="text-sm font-medium text-gray-900 dark:text-white">{agentName(selected.to_agent_id)}</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-100 dark:bg-white/[0.04] rounded-lg px-3 py-2.5">
                <div className="text-xs text-gray-500 mb-1">Estado</div>
                <StatusBadge status={selected.state} />
              </div>
              <div className="bg-gray-100 dark:bg-white/[0.04] rounded-lg px-3 py-2.5">
                <div className="text-xs text-gray-500 mb-1">Creada</div>
                <div className="text-gray-700 dark:text-gray-200">{fmt(selected.created_at)}</div>
              </div>
            </div>

            {selected.payload?.reason && (
              <div className="bg-gray-100 dark:bg-white/[0.04] rounded-lg px-3 py-2.5">
                <div className="text-xs text-gray-500 mb-1">Motivo</div>
                <div className="text-gray-600 dark:text-gray-300 whitespace-pre-wrap">{selected.payload.reason}</div>
              </div>
            )}

            {selected.payload && (
              <div>
                <div className="text-xs text-gray-500 mb-2 font-medium uppercase tracking-wider">Contexto</div>
                <pre className="bg-gray-100 dark:bg-gray-800 rounded-xl p-4 text-xs text-gray-600 dark:text-gray-300 whitespace-pre-wrap max-h-48 overflow-y-auto">
                  {JSON.stringify(selected.payload, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </Modal>

      <PageHelp
        summary="Las delegaciones son transferencias de trabajo entre agentes: cuando un agente necesita ayuda de otro, crea una delegación. El receptor acepta, ejecuta la tarea y devuelve el resultado al emisor."
        items={[
          { icon: '📤', title: 'Origen', description: 'El agente que solicita la delegación y espera el resultado para continuar su trabajo.' },
          { icon: '📥', title: 'Destino', description: 'El agente que recibe la delegación, la ejecuta y notifica al origen cuando termina.' },
          { icon: '⏳', title: 'Pendiente', description: 'La delegación fue creada pero el agente destino aún no la ha aceptado.' },
          { icon: '✅', title: 'Completada', description: 'El agente destino terminó la tarea y el resultado fue enviado al agente origen.' },
        ]}
      />
    </div>
  );
}
