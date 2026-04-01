import { Bot, RefreshCw } from 'lucide-react';
import { useState, useEffect } from 'react';
import { dbGet, dbPatch } from '../lib/insforge';
import { Agent } from '../lib/types';
import StatusBadge from '../components/StatusBadge';
import Modal from '../components/Modal';
import { useNavigate } from 'react-router-dom';
import AreaBadge from '../components/AreaBadge';
import PageHeader from '../components/PageHeader';
import IconColorPicker from '../components/IconColorPicker';
import AgentConfigPanel from '../components/AgentConfigPanel';
import PageHelp from '../components/PageHelp';

function LevelBadge({ level }: { level: number }) {
  const colors: Record<number, string> = {
    0: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    1: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    2: 'bg-gray-700/50 text-gray-400 border-gray-200 dark:border-gray-700',
  };
  return (
    <span className={`text-xs font-mono px-1.5 py-0.5 rounded border ${colors[level] || colors[2]}`}>
      L{level}
    </span>
  );
}

function AgentCard({ agent, onSelect, onToggle, onChat }: {
  agent: Agent;
  onSelect: () => void;
  onToggle: () => void;
  onChat: () => void;
}) {
  const isActive = agent.status === 'active';

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 flex flex-col gap-3 hover:border-gray-200 dark:border-gray-700 transition-colors">
      {/* Top row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          <AreaBadge area={agent.area} size="md" icon={agent.icon} color={agent.color} />
          <div className="min-w-0">
            <button
              onClick={onSelect}
              className="text-sm font-semibold text-gray-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors truncate block text-left"
            >
              {agent.name}
            </button>
            <p className="text-xs text-gray-500 truncate capitalize">{agent.area}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-indigo-400' : 'bg-gray-600'}`} />
          <LevelBadge level={agent.level} />
        </div>
      </div>

      {/* Meta row */}
      <div className="flex items-center gap-2 flex-wrap">
        {agent.area && (
          <span className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full">{agent.area}</span>
        )}
        {agent.client_name && (
          <span className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-500 px-2 py-0.5 rounded-full">{agent.client_name}</span>
        )}
        <StatusBadge status={agent.status} />
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="bg-gray-100 dark:bg-white/[0.04] rounded-lg px-2.5 py-1.5">
          <div className="text-gray-500 mb-0.5">Modelo</div>
          <div className="text-gray-600 dark:text-gray-300 font-mono truncate">{agent.model?.split('/').pop() || '—'}</div>
        </div>
        <div className="bg-gray-100 dark:bg-white/[0.04] rounded-lg px-2.5 py-1.5">
          <div className="text-gray-500 mb-0.5">Coste hoy</div>
          <div className="text-indigo-400 font-mono">{agent.cost_used_today_eur?.toFixed(2)}€</div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <button
          onClick={onChat}
          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 rounded-lg text-xs font-medium transition-colors"
        >
          Chat
        </button>
        <button
          onClick={onToggle}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            isActive
              ? 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-400'
              : 'bg-gray-700/50 hover:bg-gray-700 text-gray-600 dark:text-gray-300'
          }`}
        >
          {isActive ? '⏸ Pausar' : '▶ Activar'}
        </button>
      </div>
    </div>
  );
}

const MODELS = [
  { value: 'anthropic/claude-sonnet-4-5',      label: 'Claude Sonnet 4.5',   tier: 'premium' },
  { value: 'anthropic/claude-haiku-4-5',        label: 'Claude Haiku 4.5',    tier: 'económico' },
  { value: 'anthropic/claude-opus-4-5',         label: 'Claude Opus 4.5',     tier: 'premium' },
  { value: 'openai/gpt-4o',                     label: 'GPT-4o',              tier: 'premium' },
  { value: 'openai/gpt-4o-mini',                label: 'GPT-4o Mini',         tier: 'económico' },
  { value: 'deepseek/deepseek-v3.2',            label: 'DeepSeek v3.2',       tier: 'económico' },
  { value: 'x-ai/grok-4.1-fast',               label: 'Grok 4.1 Fast',       tier: 'estándar' },
  { value: 'google/gemini-2.0-flash',           label: 'Gemini 2.0 Flash',    tier: 'estándar' },
  { value: 'minimax/minimax-m2.1',              label: 'MiniMax M2.1',        tier: 'económico' },
];

export default function Agents() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [managers, setManagers] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Agent | null>(null);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [view, setView] = useState<'grid' | 'table'>('grid');
  const [editModel, setEditModel] = useState('');
  const [savingModel, setSavingModel] = useState(false);
  const [editIcon, setEditIcon] = useState<string>('');
  const [editColor, setEditColor] = useState<string>('');
  const [savingAppearance, setSavingAppearance] = useState(false);
  const navigate = useNavigate();

  const load = async () => {
    setLoading(true);
    try {
      const all = await dbGet('agents', 'select=*&order=area.asc,name.asc');
      const data = all.filter((a: Agent) => a.level === 0);
      setAgents(data);
      setManagers(all.filter((a: Agent) => a.level === 1));
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const areas = [...new Set(agents.map(a => a.area).filter(Boolean))];

  const filtered = agents.filter(a => {
    const matchArea = filter === 'all' || a.area === filter;
    const matchSearch = !search || a.name.toLowerCase().includes(search.toLowerCase()) || a.role?.toLowerCase().includes(search.toLowerCase());
    return matchArea && matchSearch;
  });

  const openDetail = (agent: Agent) => {
    setSelected(agent);
    setEditModel(agent.model || '');
    setEditIcon(agent.icon || '');
    setEditColor(agent.color || '');
  };

  const saveAppearance = async () => {
    if (!selected) return;
    setSavingAppearance(true);
    try {
      await dbPatch('agents', `id=eq.${selected.id}`, { icon: editIcon || null, color: editColor || null });
      setAgents(prev => prev.map(a => a.id === selected.id ? { ...a, icon: editIcon || null, color: editColor || null } : a));
      setSelected(prev => prev ? { ...prev, icon: editIcon || null, color: editColor || null } : null);
    } catch (e) { console.error(e); }
    setSavingAppearance(false);
  };

  const saveModel = async () => {
    if (!selected || !editModel || editModel === selected.model) return;
    setSavingModel(true);
    try {
      await dbPatch('agents', `id=eq.${selected.id}`, { model: editModel });
      setAgents(prev => prev.map(a => a.id === selected.id ? { ...a, model: editModel } : a));
      setSelected(prev => prev ? { ...prev, model: editModel } : null);
    } catch (e) { console.error(e); }
    setSavingModel(false);
  };

  const toggleStatus = async (agent: Agent) => {
    const newStatus = agent.status === 'active' ? 'paused' : 'active';
    await dbPatch('agents', `id=eq.${agent.id}`, { status: newStatus });
    load();
  };

  const activeCount = agents.filter(a => a.status === 'active').length;

  return (
    <div className="p-4 sm:p-6 space-y-5">
            <PageHeader
        title="Dirección"
        icon={Bot}
        badge={String(agents.length)}
        subtitle={`${activeCount} activos`}
        actions={
          <button onClick={load} className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-gray-500 dark:text-slate-400 bg-white dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] hover:border-gray-300 dark:hover:border-white/[0.12] transition-all">
            <RefreshCw size={14} />
            Actualizar
          </button>
        }
      />

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
          </svg>
          <input
            type="text"
            placeholder="Buscar agente..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 placeholder-gray-600 rounded-lg pl-9 pr-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
          />
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filter === 'all' ? 'bg-indigo-500/15 text-indigo-400' : 'text-gray-500 hover:text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800'}`}
          >Todos</button>
          {areas.map(a => (
            <button
              key={a}
              onClick={() => setFilter(a)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filter === a ? 'bg-indigo-500/15 text-indigo-400' : 'text-gray-500 hover:text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800'}`}
            >
              <AreaBadge area={a} /> {a}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center gap-3 text-gray-500 py-8">
          <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>
          <span className="text-sm">Cargando dirección...</span>
        </div>
      ) : view === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(a => (
            <AgentCard
              key={a.id}
              agent={a}
              onSelect={() => openDetail(a)}
              onToggle={() => toggleStatus(a)}
              onChat={() => navigate(`/chat/${a.id}`)}
            />
          ))}
          {filtered.length === 0 && (
            <div className="col-span-full py-12 text-center text-gray-600 text-sm">
              No hay agentes que coincidan
            </div>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-200 dark:border-gray-800">
                <th className="pb-2 pr-4 font-medium">Nombre</th>
                <th className="pb-2 pr-4 font-medium">Área</th>
                <th className="pb-2 pr-4 font-medium">Nivel</th>
                <th className="pb-2 pr-4 font-medium">Estado</th>
                <th className="pb-2 pr-4 font-medium">Modelo</th>
                <th className="pb-2 pr-4 font-medium">Coste hoy</th>
                <th className="pb-2 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(a => (
                <tr key={a.id} className="border-b border-gray-200 dark:border-gray-800/50 hover:bg-gray-100 dark:bg-gray-800/30">
                  <td className="py-3 pr-4">
                    <button onClick={() => openDetail(a)} className="text-indigo-400 hover:underline font-medium">
                      {a.name}
                    </button>
                    {a.client_name && <span className="ml-2 text-xs text-gray-500">({a.client_name})</span>}
                  </td>
                  <td className="py-3 pr-4 text-gray-400">
                    <div className="flex items-center gap-2"><AreaBadge area={a.area} size="sm" /> <span className="capitalize">{a.area}</span></div>
                  </td>
                  <td className="py-3 pr-4"><LevelBadge level={a.level} /></td>
                  <td className="py-3 pr-4"><StatusBadge status={a.status} /></td>
                  <td className="py-3 pr-4 text-gray-500 text-xs font-mono">{a.model?.split('/').pop()}</td>
                  <td className="py-3 pr-4 text-indigo-400 font-mono text-xs">{a.cost_used_today_eur?.toFixed(2)}€</td>
                  <td className="py-3">
                    <div className="flex gap-2">
                      <button onClick={() => navigate(`/chat/${a.id}`)} className="px-2 py-1 bg-indigo-500/10 text-indigo-400 rounded text-xs hover:bg-indigo-500/20">Chat</button>
                      <button onClick={() => toggleStatus(a)} className={`px-2 py-1 rounded text-xs ${a.status === 'active' ? 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20' : 'bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-600'}`}>
                        {a.status === 'active' ? 'Pausar' : 'Activar'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Agent Detail Modal */}
      <Modal open={!!selected} onClose={() => setSelected(null)} title={selected?.name || ''} wide>
        {selected && (
          <div className="space-y-5 text-sm">
            {/* Header card */}
            <div className="flex items-center gap-4 bg-gray-100 dark:bg-white/[0.04] rounded-xl p-4">
              <AreaBadge area={selected.area} size="lg" icon={selected.icon} color={selected.color} />
              <div>
                <div className="font-semibold text-gray-900 dark:text-white text-base">{selected.name}</div>
                {selected.area && <div className="text-gray-500 dark:text-slate-400 text-sm capitalize">{selected.area}</div>}
                <div className="flex items-center gap-2 mt-1">
                  <StatusBadge status={selected.status} />
                  <LevelBadge level={selected.level} />
                </div>
              </div>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'ID', value: selected.id, mono: true, small: true },
                { label: 'Coste hoy', value: `${selected.cost_used_today_eur?.toFixed(2)}€`, mono: true },
                { label: 'Tokens hoy', value: selected.tokens_used_today?.toLocaleString(), mono: true },
              ].map(f => (
                <div key={f.label} className="bg-gray-100 dark:bg-white/[0.04] rounded-lg px-3 py-2.5">
                  <div className="text-xs text-gray-500 mb-1">{f.label}</div>
                  <div className={`text-gray-700 dark:text-gray-200 ${f.mono ? 'font-mono' : ''} ${f.small ? 'text-xs truncate' : 'text-sm'}`}>{f.value}</div>
                </div>
              ))}
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
                area={selected.area}
                onChangeIcon={setEditIcon}
                onChangeColor={setEditColor}
              />
            </div>

            {/* Model selector */}
            <div className="bg-gray-100 dark:bg-white/[0.04] rounded-lg px-3 py-2.5">
              <div className="text-xs text-gray-500 mb-2">Modelo LLM</div>
              <div className="flex gap-2 items-center">
                <select
                  value={editModel}
                  onChange={e => setEditModel(e.target.value)}
                  className="flex-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-indigo-500/50 font-mono"
                >
                  {MODELS.map(m => (
                    <option key={m.value} value={m.value}>{m.label} — {m.tier}</option>
                  ))}
                  {/* Si el modelo actual no está en la lista, mostrarlo igualmente */}
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

            {selected.client_name && (
              <div className="bg-gray-100 dark:bg-white/[0.04] rounded-lg px-3 py-2.5">
                <div className="text-xs text-gray-500 mb-1">Cliente</div>
                <div className="text-gray-700 dark:text-gray-200">{selected.client_name}</div>
              </div>
            )}

            {selected.parent_agent_id && (
              <div className="bg-gray-100 dark:bg-white/[0.04] rounded-lg px-3 py-2.5">
                <div className="text-xs text-gray-500 mb-1">Agente padre</div>
                <div className="text-gray-400 font-mono text-xs">{selected.parent_agent_id}</div>
              </div>
            )}

            {/* System prompt */}
            <div>
              <div className="text-xs text-gray-500 mb-2 font-medium uppercase tracking-wider">System Prompt</div>
              <pre className="bg-gray-100 dark:bg-gray-800 rounded-xl p-4 text-xs text-gray-600 dark:text-gray-300 whitespace-pre-wrap max-h-48 overflow-y-auto leading-relaxed">{selected.system_prompt || '—'}</pre>
            </div>

            {/* Tools */}
            {selected.tools_enabled?.length > 0 && (
              <div>
                <div className="text-xs text-gray-500 mb-2 font-medium uppercase tracking-wider">Tools habilitados</div>
                <div className="flex flex-wrap gap-1.5">
                  {selected.tools_enabled.map((t: string) => (
                    <span key={t} className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 px-2.5 py-1 rounded-lg text-xs font-mono">{t}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Agent Config Panel */}
            <div className="bg-gray-100 dark:bg-white/[0.04] rounded-lg px-3 py-3">
              {(() => {
                const childManagers = managers.filter(m => m.parent_agent_id === selected.id);
                return (
                  <AgentConfigPanel
                    agentId={selected.id}
                    agentName={selected.name}
                    childAgentIds={childManagers.map(m => m.id)}
                    childAgentNames={childManagers.map(m => m.name)}
                  />
                );
              })()}
            </div>

            {/* CTA */}
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => { navigate(`/chat/${selected.id}`); setSelected(null); }}
                className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Abrir Chat
              </button>
              <button
                onClick={() => { toggleStatus(selected); setSelected(null); }}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg text-sm font-medium transition-colors"
              >
                {selected.status === 'active' ? '⏸ Pausar' : '▶ Activar'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      <PageHelp
        summary="La Dirección es el nivel más alto de la jerarquía de agentes. Aquí se configuran los agentes directivos que coordinan el trabajo del equipo, definen objetivos y delegan tareas a Managers y Especialistas."
        items={[
          { icon: '⚙️', title: 'Configurar', description: 'Haz clic en un agente para editar su nombre, modelo de IA, instrucciones del sistema y herramientas disponibles.' },
          { icon: '▶️ / ⏸', title: 'Activar o pausar', description: 'Controla si un agente está operativo o en pausa sin perder su configuración.' },
          { icon: '💬', title: 'Chat', description: 'Abre una conversación directa con el agente para probarlo o darle instrucciones manuales.' },
          { icon: '🔑', title: 'Integraciones', description: 'Configura las claves API y herramientas externas (CRM, email, bases de datos) de cada agente.' },
        ]}
      />
    </div>
  );
}
