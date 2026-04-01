import { Users, RefreshCw, Plus} from 'lucide-react';
import { useState, useEffect } from 'react';
import { fnCall, dbGet } from '../lib/insforge';
import { Agent } from '../lib/types';
import StatusBadge from '../components/StatusBadge';
import Modal from '../components/Modal';
import { useNavigate } from 'react-router-dom';
import AreaBadge from '../components/AreaBadge';
import PageHeader from '../components/PageHeader';

export default function Subagents() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [parents, setParents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [selected, setSelected] = useState<Agent | null>(null);
  const [form, setForm] = useState({ parent_agent_id: '', client_name: '', system_prompt: '', model: '' });
  const [msg, setMsg] = useState('');
  const [saving, setSaving] = useState(false);
  const [parentFilter, setParentFilter] = useState('');
  const navigate = useNavigate();

  const load = async () => {
    setLoading(true);
    try {
      const all = await dbGet('agents', 'select=*&order=area.asc,name.asc');
      setParents(all.filter((a: Agent) => a.level === 1));
      setAgents(all.filter((a: Agent) => a.level === 2));
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!form.parent_agent_id || !form.client_name) return;
    setSaving(true);
    try {
      await fnCall('spawn-subagent', 'POST', form);
      setMsg('Subagente creado');
      setShowCreate(false);
      setForm({ parent_agent_id: '', client_name: '', system_prompt: '', model: '' });
      load();
    } catch (e: any) { setMsg(`Error:  ${e.message}`); }
    setSaving(false);
  };

  const parentName = (id: string) => parents.find(p => p.id === id)?.name || '—';
  const filtered = parentFilter ? agents.filter(a => a.parent_agent_id === parentFilter) : agents;

  return (
    <div className="p-4 sm:p-6 space-y-5">
            <PageHeader
        title="Subagentes"
        icon={Users}
        badge={agents.length}
        subtitle="subagentes"
        actions={
          <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-colors">
            <Plus size={15} />
            Nuevo
          </button>
        }
      />

      {/* Filter by parent */}
      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={() => setParentFilter('')} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${!parentFilter ? 'bg-indigo-500/15 text-indigo-400' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 hover:text-gray-600 dark:text-gray-300'}`}>
          Todos
        </button>
        {parents.map(p => (
          <button key={p.id} onClick={() => setParentFilter(p.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${parentFilter === p.id ? 'bg-indigo-500/15 text-indigo-400' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 hover:text-gray-600 dark:text-gray-300'}`}>
            <AreaBadge area={p.area} /> {p.name}
          </button>
        ))}
      </div>

      {/* Subagent grid */}
      {loading ? (
        <div className="flex items-center gap-3 text-gray-500 py-8">
          <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
          <span className="text-sm">Cargando subagentes...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(a => (
            <div key={a.id} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 hover:border-gray-200 dark:border-gray-700 rounded-xl p-4 flex flex-col gap-3 transition-colors">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-xl flex-shrink-0">
                    
                  </div>
                  <div className="min-w-0">
                    <button onClick={() => setSelected(a)} className="text-sm font-semibold text-gray-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors truncate block text-left">
                      {a.name}
                    </button>
                    <p className="text-xs text-gray-500 truncate">{a.client_name || a.area}</p>
                  </div>
                </div>
                <div className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${a.status === 'active' ? 'bg-indigo-400' : 'bg-gray-600'}`} />
              </div>

              {/* Parent */}
              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                <span>Padre:</span>
                <span className="text-gray-400 truncate">{parentName(a.parent_agent_id || '')}</span>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <StatusBadge status={a.status} />
                {a.model && <span className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-500 px-2 py-0.5 rounded-full font-mono truncate">{a.model.split('/').pop()}</span>}
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-gray-100 dark:bg-white/[0.04] rounded-lg px-2.5 py-1.5">
                  <div className="text-gray-500 mb-0.5">Coste hoy</div>
                  <div className="text-indigo-400 font-mono">{a.cost_used_today_eur?.toFixed(2)}€</div>
                </div>
                <div className="bg-gray-100 dark:bg-white/[0.04] rounded-lg px-2.5 py-1.5">
                  <div className="text-gray-500 mb-0.5">Tokens</div>
                  <div className="text-gray-600 dark:text-gray-300 font-mono">{a.tokens_used_today?.toLocaleString()}</div>
                </div>
              </div>

              <button onClick={() => navigate(`/chat/${a.id}`)}
                className="w-full flex items-center justify-center gap-1.5 py-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 rounded-lg text-xs font-medium transition-colors">
                Chat
              </button>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="col-span-full py-12 text-center text-gray-600 text-sm">No hay subagentes</div>
          )}
        </div>
      )}

      {/* Create Modal */}
      <Modal open={showCreate} onClose={() => { setShowCreate(false); setMsg(''); }} title="Crear subagente">
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1.5">Agente padre</label>
            <select value={form.parent_agent_id} onChange={e => setForm({ ...form, parent_agent_id: e.target.value })}
              className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500">
              <option value="">Seleccionar agente padre...</option>
              {parents.map(p => <option key={p.id} value={p.id}><AreaBadge area={p.area} /> {p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1.5">Nombre del cliente</label>
            <input value={form.client_name} onChange={e => setForm({ ...form, client_name: e.target.value })}
              placeholder="Ej: Cliente ABC"
              className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500 placeholder-gray-600" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1.5">System prompt (opcional)</label>
            <textarea value={form.system_prompt} onChange={e => setForm({ ...form, system_prompt: e.target.value })}
              rows={3} placeholder="Instrucciones específicas para este cliente..."
              className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500 placeholder-gray-600 resize-none" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1.5">Modelo (opcional)</label>
            <input value={form.model} onChange={e => setForm({ ...form, model: e.target.value })}
              placeholder="Hereda del agente padre por defecto"
              className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500 placeholder-gray-600" />
          </div>
          {msg && <div className="text-sm text-center py-1 text-gray-400">{msg}</div>}
          <button onClick={create} disabled={saving || !form.parent_agent_id || !form.client_name}
            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-lg text-sm font-medium transition-colors">
            {saving ? 'Creando...' : 'Crear subagente'}
          </button>
        </div>
      </Modal>

      {/* Detail Modal */}
      <Modal open={!!selected} onClose={() => setSelected(null)} title={selected?.name || ''} wide>
        {selected && (
          <div className="space-y-4 text-sm">
            <div className="bg-gray-100 dark:bg-white/[0.04] rounded-xl p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center"></div>
              <div>
                <div className="font-semibold text-gray-900 dark:text-white">{selected.name}</div>
                <div className="text-gray-400 text-xs mt-0.5">{selected.client_name}</div>
                <div className="flex items-center gap-2 mt-1.5"><StatusBadge status={selected.status} /></div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Padre', value: parentName(selected.parent_agent_id || '') },
                { label: 'Modelo', value: selected.model?.split('/').pop() || '—' },
                { label: 'Coste hoy', value: `${selected.cost_used_today_eur?.toFixed(2)}€` },
                { label: 'Tokens', value: selected.tokens_used_today?.toLocaleString() },
              ].map(f => (
                <div key={f.label} className="bg-gray-100 dark:bg-white/[0.04] rounded-lg px-3 py-2.5">
                  <div className="text-xs text-gray-500 mb-1">{f.label}</div>
                  <div className="text-gray-700 dark:text-gray-200 font-mono text-xs">{f.value}</div>
                </div>
              ))}
            </div>
            {selected.system_prompt && (
              <div>
                <div className="text-xs text-gray-500 mb-2 font-medium uppercase tracking-wider">System Prompt</div>
                <pre className="bg-gray-100 dark:bg-gray-800 rounded-xl p-4 text-xs text-gray-600 dark:text-gray-300 whitespace-pre-wrap max-h-40 overflow-y-auto">{selected.system_prompt}</pre>
              </div>
            )}
            <button onClick={() => { navigate(`/chat/${selected.id}`); setSelected(null); }}
              className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-colors">
              Abrir Chat
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
}
