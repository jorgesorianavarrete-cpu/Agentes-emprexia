import { Activity, RefreshCw } from 'lucide-react';
import { useState, useEffect } from 'react';
import { dbGet } from '../lib/insforge';
import { ActivityLogEntry, Agent } from '../lib/types';
import PageHeader from '../components/PageHeader';
import PageHelp from '../components/PageHelp';

const EVENT_LABELS: Record<string, string> = {
  backup_created: 'copia de seguridad creada',
  cost_reset: 'coste reiniciado',
  handoff_created: 'delegación creada',
  task_completed: 'tarea completada',
  task_failed: 'tarea fallida',
  agent_activated: 'agente activado',
  agent_paused: 'agente pausado',
  approval_requested: 'aprobación solicitada',
  approval_granted: 'aprobación concedida',
  approval_rejected: 'aprobación rechazada',
};

function fmt(d: string) {
  return new Date(d).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

const EVENT_COLORS: Record<string, string> = {
  backup_created: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  cost_reset: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
  handoff_created: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
  task_completed: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
  task_failed: 'text-red-400 bg-red-500/10 border-red-500/20',
  agent_activated: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
  agent_paused: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  approval_requested: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
  approval_granted: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
  approval_rejected: 'text-red-400 bg-red-500/10 border-red-500/20',
  default: 'text-gray-400 bg-gray-700/30 border-gray-200 dark:border-gray-700',
};

const EVENT_ICONS: Record<string, string> = {
  backup_created: '', cost_reset: '', handoff_created: '',
  task_completed: '', task_failed: '', agent_activated: '',
  agent_paused: '', approval_requested: '', approval_granted: '',
  approval_rejected: '', default: '',
};

export default function ActivityLog() {
  const [entries, setEntries] = useState<ActivityLogEntry[]>([]);
  const [agents, setAgents] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('');
  const [search, setSearch] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      let params = 'select=*&order=timestamp.desc&limit=200';
      if (typeFilter) params += `&event_type=eq.${typeFilter}`;
      const [e, a] = await Promise.all([
        dbGet('activity_log', params),
        dbGet('agents', 'select=id,name'),
      ]);
      setEntries(e);
      const map: Record<string, string> = {};
      a.forEach((ag: Agent) => { map[ag.id] = ag.name; });
      setAgents(map);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { load(); }, [typeFilter]);

  const types = [...new Set(entries.map(e => e.event_type))].sort();
  const agentName = (id: string) => id ? (agents[id] || id.slice(0, 8) + '') : '';

  const filtered = entries.filter(e => {
    if (!search) return true;
    return e.event_type?.toLowerCase().includes(search.toLowerCase()) ||
      e.summary?.toLowerCase().includes(search.toLowerCase()) ||
      agentName(e.agent_id || '').toLowerCase().includes(search.toLowerCase()) ||
      JSON.stringify(e.details || {}).toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div className="p-4 sm:p-6 space-y-5">
            <PageHeader
        title="Registro de Actividad"
        icon={Activity}
        badge={entries.length}
        subtitle="eventos registrados"
        actions={
          <button onClick={load} className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-gray-500 dark:text-slate-400 bg-white dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] hover:border-gray-300 dark:hover:border-white/[0.12] transition-all">
            <RefreshCw size={14} />
            Actualizar
          </button>
        }
      />

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
          <input type="text" placeholder="Buscar evento..." value={search} onChange={e => setSearch(e.target.value)}
            className="bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 placeholder-gray-600 rounded-lg pl-9 pr-3 py-2 text-sm focus:border-indigo-500 outline-none w-48" />
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <button onClick={() => setTypeFilter('')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${!typeFilter ? 'bg-indigo-500/15 text-indigo-400' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 hover:text-gray-600 dark:text-gray-300'}`}>
            Todos
          </button>
          {types.map(t => (
            <button key={t} onClick={() => setTypeFilter(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${typeFilter === t ? 'bg-indigo-500/15 text-indigo-400' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 hover:text-gray-600 dark:text-gray-300'}`}>
              {t.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Timeline */}
      {loading ? (
        <div className="flex items-center gap-3 text-gray-500 py-8">
          <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
          <span className="text-sm">Cargando registro de actividad...</span>
        </div>
      ) : (
        <div className="space-y-1.5">
          {filtered.map((e, i) => {
            const color = EVENT_COLORS[e.event_type] || EVENT_COLORS.default;
            const icon = EVENT_ICONS[e.event_type] || EVENT_ICONS.default;
            return (
              <div key={e.id || i} className="flex items-start gap-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl px-4 py-3">
                <div className={`flex-shrink-0 px-2 py-0.5 rounded-md border text-xs font-medium whitespace-nowrap ${color}`}>
                  {icon} {EVENT_LABELS[e.event_type] ?? e.event_type?.replace(/_/g, ' ')}
                </div>
                <div className="flex-1 min-w-0">
                  {e.summary && (
                    <p className="text-sm text-gray-700 dark:text-gray-200 truncate">{e.summary}</p>
                  )}
                  {e.agent_id && (
                    <p className="text-xs text-gray-500 mt-0.5"> {agentName(e.agent_id)}</p>
                  )}
                  {e.details && Object.keys(e.details).length > 0 && (
                    <p className="text-xs text-gray-600 mt-0.5 truncate">{JSON.stringify(e.details)}</p>
                  )}
                </div>
                <div className="flex-shrink-0 text-xs text-gray-500 whitespace-nowrap">{fmt(e.timestamp)}</div>
              </div>
            );
          })}
          {filtered.length === 0 && <div className="py-12 text-center text-gray-600 text-sm">No hay eventos</div>}
        </div>
      )}

      <PageHelp
        summary="El registro de actividad muestra un historial cronológico de todos los eventos del sistema: tareas completadas o fallidas, agentes activados o pausados, delegaciones creadas, aprobaciones y copias de seguridad."
        items={[
          { icon: '🔍', title: 'Búsqueda', description: 'Filtra por texto libre para encontrar eventos relacionados con un agente o acción concreta.' },
          { icon: '🏷️', title: 'Tipo de evento', description: 'Haz clic en un tipo de evento para ver sólo esas entradas del registro.' },
          { icon: '🕐', title: 'Orden', description: 'Los eventos más recientes aparecen primero. El sistema guarda hasta 200 entradas por consulta.' },
        ]}
      />
    </div>
  );
}
