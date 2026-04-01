import { Users, RefreshCw, Plus } from 'lucide-react';
import { useState, useEffect } from 'react';
import { fnCall, dbGet, dbPatch } from '../lib/insforge';
import AgentConfigPanel from '../components/AgentConfigPanel';
import { Agent } from '../lib/types';
import StatusBadge from '../components/StatusBadge';
import Modal from '../components/Modal';
import { useNavigate } from 'react-router-dom';
import AreaBadge from '../components/AreaBadge';
import PageHeader from '../components/PageHeader';
import IconColorPicker from '../components/IconColorPicker';
import PageHelp from '../components/PageHelp';

const MODELS = [
  { value: 'anthropic/claude-sonnet-4-5', label: 'Claude Sonnet 4.5',  tier: 'premium' },
  { value: 'anthropic/claude-haiku-4-5',  label: 'Claude Haiku 4.5',   tier: 'económico' },
  { value: 'anthropic/claude-opus-4-5',   label: 'Claude Opus 4.5',    tier: 'premium' },
  { value: 'openai/gpt-4o',               label: 'GPT-4o',             tier: 'premium' },
  { value: 'openai/gpt-4o-mini',          label: 'GPT-4o Mini',        tier: 'económico' },
  { value: 'deepseek/deepseek-v3.2',      label: 'DeepSeek v3.2',      tier: 'económico' },
  { value: 'x-ai/grok-4.1-fast',          label: 'Grok 4.1 Fast',      tier: 'estándar' },
  { value: 'google/gemini-2.0-flash',     label: 'Gemini 2.0 Flash',   tier: 'estándar' },
  { value: 'minimax/minimax-m2.1',        label: 'MiniMax M2.1',       tier: 'económico' },
];

export default function Specialists() {
  const [specialists, setSpecialists] = useState<Agent[]>([]);
  const [managers, setManagers] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [selected, setSelected] = useState<Agent | null>(null);
  const [form, setForm] = useState({ parent_agent_id: '', client_name: '', system_prompt: '', model: '' });
  const [msg, setMsg] = useState('');
  const [saving, setSaving] = useState(false);
  const [managerFilter, setManagerFilter] = useState('');
  const [editIcon, setEditIcon] = useState('');
  const [editColor, setEditColor] = useState('');
  const [savingAppearance, setSavingAppearance] = useState(false);
  const [editModel, setEditModel] = useState('');
  const [savingModel, setSavingModel] = useState(false);
  const navigate = useNavigate();

  const load = async () => {
    setLoading(true);
    try {
      const all = await dbGet('agents', 'select=*&order=area.asc,name.asc');
      setManagers(all.filter((a: Agent) => a.level === 1));
      setSpecialists(all.filter((a: Agent) => a.level === 2));
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!form.parent_agent_id || !form.client_name) return;
    setSaving(true);
    try {
      await fnCall('spawn-subagent', 'POST', form);
      setMsg('Especialista creado');
      setShowCreate(false);
      setForm({ parent_agent_id: '', client_name: '', system_prompt: '', model: '' });
      load();
    } catch (e: any) { setMsg(`Error: ${e.message}`); }
    setSaving(false);
  };

  const managerName = (id: string) => managers.find(m => m.id === id)?.name || '—';
  const filtered = managerFilter
    ? specialists.filter(s => s.parent_agent_id === managerFilter)
    : specialists;

  const openDetail = (s: Agent) => {
    setSelected(s);
    setEditIcon(s.icon || '');
    setEditColor(s.color || '');
    setEditModel(s.model || '');
  };

  const saveModel = async () => {
    if (!selected || !editModel || editModel === selected.model) return;
    setSavingModel(true);
    try {
      await dbPatch('agents', `id=eq.${selected.id}`, { model: editModel });
      setSpecialists(prev => prev.map(a => a.id === selected.id ? { ...a, model: editModel } : a));
      setSelected(prev => prev ? { ...prev, model: editModel } : null);
    } catch (e) { console.error(e); }
    setSavingModel(false);
  };

  const saveAppearance = async () => {
    if (!selected) return;
    setSavingAppearance(true);
    try {
      await dbPatch('agents', `id=eq.${selected.id}`, { icon: editIcon || null, color: editColor || null });
      setSpecialists(prev => prev.map(a => a.id === selected.id ? { ...a, icon: editIcon || null, color: editColor || null } : a));
      setSelected(prev => prev ? { ...prev, icon: editIcon || null, color: editColor || null } : null);
    } catch (e) { console.error(e); }
    setSavingAppearance(false);
  };

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <PageHeader
        title="Especialistas"
        icon={Users}
        badge={specialists.length}
        subtitle="especialistas por cliente"
        actions={
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <Plus size={15} />
            Nuevo
          </button>
        }
      />

      {/* Filter by manager */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setManagerFilter('')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${!managerFilter ? 'bg-indigo-500/15 text-indigo-400' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 hover:text-gray-600 dark:text-gray-300'}`}
        >
          Todos
        </button>
        {managers.map(m => (
          <button
            key={m.id}
            onClick={() => setManagerFilter(m.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${managerFilter === m.id ? 'bg-indigo-500/15 text-indigo-400' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 hover:text-gray-600 dark:text-gray-300'}`}
          >
            <AreaBadge area={m.area} /> {m.name}
          </button>
        ))}
      </div>

      {/* Specialist grid */}
      {loading ? (
        <div className="flex items-center gap-3 text-gray-500 py-8">
          <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>
          <span className="text-sm">Cargando especialistas...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(s => (
            <div key={s.id} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 hover:border-gray-200 dark:hover:border-gray-700 rounded-xl p-4 flex flex-col gap-3 transition-colors">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <AreaBadge area={s.area || 'operaciones'} size="md" icon={s.icon} color={s.color} />
                  <div className="min-w-0">
                    <button
                      onClick={() => openDetail(s)}
                      className="text-sm font-semibold text-gray-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors truncate block text-left"
                    >
                      {s.name}
                    </button>
                    <p className="text-xs text-gray-500 truncate">{s.client_name || s.area}</p>
                  </div>
                </div>
                <div className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${s.status === 'active' ? 'bg-indigo-400' : 'bg-gray-600'}`} />
              </div>

              {/* Manager responsable */}
              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                <span>Manager:</span>
                <span className="text-gray-400 truncate">{managerName(s.parent_agent_id || '')}</span>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <StatusBadge status={s.status} />
                {s.model && (
                  <span className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-500 px-2 py-0.5 rounded-full font-mono truncate">
                    {s.model.split('/').pop()}
                  </span>
                )}
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-gray-100 dark:bg-white/[0.04] rounded-lg px-2.5 py-1.5">
                  <div className="text-gray-500 mb-0.5">Coste hoy</div>
                  <div className="text-indigo-400 font-mono">{s.cost_used_today_eur?.toFixed(2)}€</div>
                </div>
                <div className="bg-gray-100 dark:bg-white/[0.04] rounded-lg px-2.5 py-1.5">
                  <div className="text-gray-500 mb-0.5">Tokens</div>
                  <div className="text-gray-600 dark:text-gray-300 font-mono">{s.tokens_used_today?.toLocaleString()}</div>
                </div>
              </div>

              <button
                onClick={() => navigate(`/chat/${s.id}`)}
                className="w-full flex items-center justify-center gap-1.5 py-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 rounded-lg text-xs font-medium transition-colors"
              >
                Chat
              </button>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="col-span-full py-12 text-center text-gray-600 text-sm">No hay especialistas</div>
          )}
        </div>
      )}

      {/* Create Modal */}
      <Modal open={showCreate} onClose={() => { setShowCreate(false); setMsg(''); }} title="Crear especialista">
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1.5">Manager responsable</label>
            <select
              value={form.parent_agent_id}
              onChange={e => setForm({ ...form, parent_agent_id: e.target.value })}
              className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500"
            >
              <option value="">Seleccionar manager...</option>
              {managers.map(m => (
                <option key={m.id} value={m.id}>{m.name} — {m.area}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1.5">Nombre del cliente</label>
            <input
              value={form.client_name}
              onChange={e => setForm({ ...form, client_name: e.target.value })}
              placeholder="Ej: Cliente ABC"
              className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500 placeholder-gray-600"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1.5">System prompt (opcional)</label>
            <textarea
              value={form.system_prompt}
              onChange={e => setForm({ ...form, system_prompt: e.target.value })}
              rows={3}
              placeholder="Instrucciones específicas para este especialista..."
              className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500 placeholder-gray-600 resize-none"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1.5">Modelo (opcional)</label>
            <input
              value={form.model}
              onChange={e => setForm({ ...form, model: e.target.value })}
              placeholder="Hereda del manager por defecto"
              className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500 placeholder-gray-600"
            />
          </div>
          {msg && <div className="text-sm text-center py-1 text-gray-400">{msg}</div>}
          <button
            onClick={create}
            disabled={saving || !form.parent_agent_id || !form.client_name}
            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-lg text-sm font-medium transition-colors"
          >
            {saving ? 'Creando...' : 'Crear especialista'}
          </button>
        </div>
      </Modal>

      {/* Detail Modal */}
      <Modal open={!!selected} onClose={() => setSelected(null)} title={selected?.name || ''} wide>
        {selected && (
          <div className="space-y-4 text-sm">
            <div className="bg-gray-100 dark:bg-white/[0.04] rounded-xl p-4 flex items-center gap-4">
              <AreaBadge area={selected.area || 'ops'} size="lg" icon={selected.icon} color={selected.color} />
              <div>
                <div className="font-semibold text-gray-900 dark:text-white">{selected.name}</div>
                <div className="text-gray-400 text-xs mt-0.5">{selected.client_name}</div>
                <div className="flex items-center gap-2 mt-1.5">
                  <StatusBadge status={selected.status} />
                  <span className="text-xs px-1.5 py-0.5 rounded bg-gray-500/10 text-gray-400 border border-gray-500/20 font-mono">L2 · Especialista</span>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Manager', value: managerName(selected.parent_agent_id || '') },
                { label: 'Coste hoy', value: `${selected.cost_used_today_eur?.toFixed(2)}€` },
                { label: 'Tokens', value: selected.tokens_used_today?.toLocaleString() },
              ].map(f => (
                <div key={f.label} className="bg-gray-100 dark:bg-white/[0.04] rounded-lg px-3 py-2.5">
                  <div className="text-xs text-gray-500 mb-1">{f.label}</div>
                  <div className="text-gray-700 dark:text-gray-200 font-mono text-xs">{f.value}</div>
                </div>
              ))}
            </div>

            {/* Model selector */}
            <div className="bg-gray-100 dark:bg-white/[0.04] rounded-lg px-3 py-2.5">
              <div className="text-xs text-gray-500 mb-2">Modelo LLM</div>
              <div className="flex gap-2 items-center">
                <select
                  value={editModel}
                  onChange={e => setEditModel(e.target.value)}
                  className="flex-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 text-xs text-gray-900 dark:text-white focus:outline-none focus:border-indigo-500/50 font-mono"
                >
                  {MODELS.map(m => <option key={m.value} value={m.value}>{m.label} — {m.tier}</option>)}
                  {selected.model && !MODELS.find(m => m.value === selected.model) && (
                    <option value={selected.model}>{selected.model}</option>
                  )}
                </select>
                <button
                  onClick={saveModel}
                  disabled={savingModel || editModel === selected.model}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs rounded-lg font-medium transition-colors whitespace-nowrap"
                >
                  {savingModel ? 'Guardando…' : 'Guardar'}
                </button>
              </div>
            </div>

            {/* Appearance picker */}
            <div className="bg-gray-100 dark:bg-white/[0.04] rounded-lg px-3 py-3">
              <div className="flex items-center justify-between mb-3">
                <div className="text-xs text-gray-500 font-medium">Apariencia</div>
                <button
                  onClick={saveAppearance}
                  disabled={savingAppearance || (editIcon === (selected.icon || '') && editColor === (selected.color || ''))}
                  className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs rounded-lg font-medium transition-colors"
                >
                  {savingAppearance ? 'Guardando…' : 'Guardar'}
                </button>
              </div>
              <IconColorPicker
                icon={editIcon}
                color={editColor}
                area={selected.area || 'ops'}
                onChangeIcon={setEditIcon}
                onChangeColor={setEditColor}
              />
            </div>

            {selected.system_prompt && (
              <div>
                <div className="text-xs text-gray-500 mb-2 font-medium uppercase tracking-wider">System Prompt</div>
                <pre className="bg-gray-100 dark:bg-gray-800 rounded-xl p-4 text-xs text-gray-600 dark:text-gray-300 whitespace-pre-wrap max-h-40 overflow-y-auto">{selected.system_prompt}</pre>
              </div>
            )}

            {/* Agent Config Panel */}
            <div className="bg-gray-100 dark:bg-white/[0.04] rounded-lg px-3 py-3">
              <AgentConfigPanel
                agentId={selected.id}
                agentName={selected.name}
                parentAgentId={selected.parent_agent_id}
                parentAgentName={managers.find(m => m.id === selected.parent_agent_id)?.name}
              />
            </div>

            <button
              onClick={() => { navigate(`/chat/${selected.id}`); setSelected(null); }}
              className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-colors"
            >
              Abrir Chat
            </button>
          </div>
        )}
      </Modal>

      <PageHelp
        summary="Los Especialistas son los agentes de base que ejecutan las tareas concretas: redactar contenidos, analizar datos, responder emails, llamar APIs externas, etc. Cada uno tiene un área de expertise definida."
        items={[
          { icon: '🛠️', title: 'Especialización', description: 'Cada Especialista tiene instrucciones específicas y acceso sólo a las herramientas que necesita para su función.' },
          { icon: '👆', title: 'Manager asignado', description: 'Cada Especialista responde a un Manager que le asigna tareas y supervisa su trabajo.' },
          { icon: '➕', title: 'Crear nuevo', description: 'Puedes crear Especialistas nuevos con el botón "Nuevo especialista" y asignarles un Manager responsable.' },
          { icon: '💬', title: 'Chat directo', description: 'Prueba al Especialista abriendo un chat directo para verificar que su configuración es correcta.' },
        ]}
      />
    </div>
  );
}
