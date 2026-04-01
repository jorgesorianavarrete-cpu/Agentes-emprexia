import { Brain, RefreshCw, Plus} from 'lucide-react';
import { useState, useEffect } from 'react';
import { dbGet, dbPost, dbDelete } from '../lib/insforge';
import { AgentMemory, Agent } from '../lib/types';
import Modal from '../components/Modal';
import PageHeader from '../components/PageHeader';
import PageHelp from '../components/PageHelp';

const MEMORY_TYPE_LABELS: Record<string, string> = {
  fact: 'Hecho',
  preference: 'Preferencia',
  instruction: 'Instrucción',
  context: 'Contexto',
  relationship: 'Relación',
};

const MEMORY_COLORS: Record<string, string> = {
  fact: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  preference: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
  instruction: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
  context: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
  relationship: 'text-pink-400 bg-pink-500/10 border-pink-500/20',
  default: 'text-gray-400 bg-gray-700/30 border-gray-200 dark:border-gray-700',
};


function fmt(d: string) {
  return new Date(d).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function ImportanceDots({ value }: { value: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className={`w-1.5 h-1.5 rounded-full ${i < value ? 'bg-indigo-400' : 'bg-gray-700'}`} />
      ))}
    </div>
  );
}

export default function Memory() {
  const [memories, setMemories] = useState<AgentMemory[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [agentFilter, setAgentFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ agent_id: '', content: '', memory_type: 'fact', importance: 5 });
  const [msg, setMsg] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      let params = 'select=*&order=importance.desc,created_at.desc&limit=200';
      if (agentFilter) params += `&agent_id=eq.${agentFilter}`;
      const [m, a] = await Promise.all([
        dbGet('agent_memory', params),
        dbGet('agents', 'select=id,name,level,area'),
      ]);
      setMemories(m);
      setAgents(a);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { load(); }, [agentFilter]);

  const create = async () => {
    if (!form.agent_id || !form.content) return;
    setSaving(true);
    try {
      await dbPost('agent_memory', [{ ...form, created_at: new Date().toISOString() }]);
      setMsg('Memoria creada');
      setShowCreate(false);
      setForm({ agent_id: '', content: '', memory_type: 'fact', importance: 5 });
      load();
    } catch (e: any) { setMsg(`Error:  ${e.message}`); }
    setSaving(false);
  };

  const del = async (id: string) => {
    if (!confirm('¿Eliminar esta memoria?')) return;
    try {
      await dbDelete('agent_memory', `id=eq.${id}`);
      load();
    } catch (e) { console.error(e); }
  };

  const agentName = (id: string) => {
    const a = agents.find(a => a.id === id);
    return a ? a.name : id?.slice(0, 8) + '…';
  };

  const types = [...new Set(memories.map(m => m.memory_type).filter(Boolean))];
  const filtered = memories.filter(m => !typeFilter || m.memory_type === typeFilter);

  return (
    <div className="p-4 sm:p-6 space-y-5">
            <PageHeader
        title="Memoria"
        icon={Brain}
        badge={memories.length}
        subtitle="fragmentos de memoria"
        actions={
          <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-colors">
            <Plus size={15} />
            Nueva memoria
          </button>
        }
      />

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <select value={agentFilter} onChange={e => setAgentFilter(e.target.value)}
          className="bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500">
          <option value="">Todos los agentes</option>
          {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <div className="flex items-center gap-1.5 flex-wrap">
          <button onClick={() => setTypeFilter('')} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${!typeFilter ? 'bg-indigo-500/15 text-indigo-400' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 hover:text-gray-600 dark:text-gray-300'}`}>
            Todos
          </button>
          {types.map(t => (
            <button key={t} onClick={() => setTypeFilter(t)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${typeFilter === t ? 'bg-indigo-500/15 text-indigo-400' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 hover:text-gray-600 dark:text-gray-300'}`}>
              {MEMORY_TYPE_LABELS[t] ?? t}
            </button>
          ))}
        </div>
      </div>

      {/* Memory cards */}
      {loading ? (
        <div className="flex items-center gap-3 text-gray-500 py-8">
          <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
          <span className="text-sm">Cargando memorias...</span>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(m => (
            <div key={m.id} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${MEMORY_COLORS[m.memory_type] || MEMORY_COLORS.default}`}>
                    {MEMORY_TYPE_LABELS[m.memory_type] ?? m.memory_type}
                  </span>
                  <span className="text-xs text-gray-500">{agentName(m.agent_id)}</span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <ImportanceDots value={m.importance || 5} />
                  <button onClick={() => del(m.id)} className="text-gray-700 hover:text-red-400 transition-colors text-xs">✕</button>
                </div>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-300">{m.content}</p>
              <div className="text-xs text-gray-600">{fmt(m.created_at)}</div>
            </div>
          ))}
          {filtered.length === 0 && <div className="py-12 text-center text-gray-600 text-sm">No hay memorias</div>}
        </div>
      )}

      {/* Create Modal */}
      <Modal open={showCreate} onClose={() => { setShowCreate(false); setMsg(''); }} title="Añadir memoria">
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1.5">Agente</label>
            <select value={form.agent_id} onChange={e => setForm({ ...form, agent_id: e.target.value })}
              className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500">
              <option value="">Seleccionar agente...</option>
              {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1.5">Contenido</label>
            <textarea value={form.content} onChange={e => setForm({ ...form, content: e.target.value })}
              rows={3} placeholder="Escribe el contenido de la memoria..."
              className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500 placeholder-gray-600 resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1.5">Tipo</label>
              <select value={form.memory_type} onChange={e => setForm({ ...form, memory_type: e.target.value })}
                className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500">
                {['fact', 'preference', 'instruction', 'context', 'relationship'].map(t => (
                  <option key={t} value={t}>{MEMORY_TYPE_LABELS[t] ?? t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1.5">Importancia: {form.importance}/10</label>
              <input type="range" min={1} max={10} value={form.importance} onChange={e => setForm({ ...form, importance: Number(e.target.value) })}
                className="w-full accent-emerald-500 mt-2" />
            </div>
          </div>
          {msg && <div className="text-sm text-center py-1 text-gray-400">{msg}</div>}
          <button onClick={create} disabled={saving || !form.agent_id || !form.content}
            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-lg text-sm font-medium transition-colors">
            {saving ? 'Guardando...' : 'Guardar memoria'}
          </button>
        </div>
      </Modal>

      <PageHelp
        summary="La memoria permite que los agentes recuerden información entre sesiones: hechos sobre el negocio, preferencias del usuario, instrucciones permanentes, contexto de proyectos y relaciones entre entidades."
        items={[
          { icon: '💡', title: 'Hecho', description: 'Información objetiva que el agente debe recordar (ej: "el cliente X prefiere entregas por la mañana").' },
          { icon: '❤️', title: 'Preferencia', description: 'Gustos o hábitos del usuario o del negocio que condicionan las respuestas del agente.' },
          { icon: '📌', title: 'Instrucción', description: 'Reglas permanentes que el agente siempre debe seguir.' },
          { icon: '🌐', title: 'Contexto', description: 'Información situacional relevante para un periodo o proyecto concreto.' },
          { icon: '🔗', title: 'Relación', description: 'Vínculos entre personas, empresas u otras entidades que el agente debe tener en cuenta.' },
        ]}
      />
    </div>
  );
}
