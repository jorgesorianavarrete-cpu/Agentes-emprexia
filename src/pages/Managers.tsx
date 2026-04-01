import { Briefcase, RefreshCw } from 'lucide-react';
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

export default function Managers() {
  const [managers, setManagers] = useState<Agent[]>([]);
  const [directors, setDirectors] = useState<Agent[]>([]);
  const [specialists, setSpecialists] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Agent | null>(null);
  const [areaFilter, setAreaFilter] = useState('');
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
      setDirectors(all.filter((a: Agent) => a.level === 0));
      setManagers(all.filter((a: Agent) => a.level === 1));
      setSpecialists(all.filter((a: Agent) => a.level === 2));
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const directorName = (id: string) => directors.find(d => d.id === id)?.name || '—';
  const areas = [...new Set(managers.map(m => m.area).filter(Boolean))];
  const filtered = areaFilter ? managers.filter(m => m.area === areaFilter) : managers;

  const openDetail = (m: Agent) => {
    setSelected(m);
    setEditIcon(m.icon || '');
    setEditColor(m.color || '');
    setEditModel(m.model || '');
  };

  const saveModel = async () => {
    if (!selected || !editModel || editModel === selected.model) return;
    setSavingModel(true);
    try {
      await dbPatch('agents', `id=eq.${selected.id}`, { model: editModel });
      setManagers(prev => prev.map(a => a.id === selected.id ? { ...a, model: editModel } : a));
      setSelected(prev => prev ? { ...prev, model: editModel } : null);
    } catch (e) { console.error(e); }
    setSavingModel(false);
  };

  const saveAppearance = async () => {
    if (!selected) return;
    setSavingAppearance(true);
    try {
      await dbPatch('agents', `id=eq.${selected.id}`, { icon: editIcon || null, color: editColor || null });
      setManagers(prev => prev.map(a => a.id === selected.id ? { ...a, icon: editIcon || null, color: editColor || null } : a));
      setSelected(prev => prev ? { ...prev, icon: editIcon || null, color: editColor || null } : null);
    } catch (e) { console.error(e); }
    setSavingAppearance(false);
  };

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <PageHeader
        title="Managers"
        icon={Briefcase}
        badge={managers.length}
        subtitle="managers de área"
        actions={
          <button onClick={load} className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-gray-500 dark:text-slate-400 bg-white dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] hover:border-gray-300 dark:hover:border-white/[0.12] transition-all">
            <RefreshCw size={14} />
            Actualizar
          </button>
        }
      />

      {/* Filter by area */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setAreaFilter('')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${!areaFilter ? 'bg-indigo-500/15 text-indigo-400' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 hover:text-gray-600 dark:text-gray-300'}`}
        >
          Todas las áreas
        </button>
        {areas.map(area => (
          <button
            key={area}
            onClick={() => setAreaFilter(area)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${areaFilter === area ? 'bg-indigo-500/15 text-indigo-400' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 hover:text-gray-600 dark:text-gray-300'}`}
          >
            <AreaBadge area={area} /> {area}
          </button>
        ))}
      </div>

      {/* Manager grid */}
      {loading ? (
        <div className="flex items-center gap-3 text-gray-500 py-8">
          <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>
          <span className="text-sm">Cargando managers...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(m => (
            <div key={m.id} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 hover:border-indigo-200 dark:hover:border-gray-700 rounded-xl p-4 flex flex-col gap-3 transition-colors">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <AreaBadge area={m.area} size="md" icon={m.icon} color={m.color} />
                  <div className="min-w-0">
                    <button
                      onClick={() => openDetail(m)}
                      className="text-sm font-semibold text-gray-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors truncate block text-left"
                    >
                      {m.name}
                    </button>
                    <p className="text-xs text-gray-500 truncate capitalize">{m.area}</p>
                  </div>
                </div>
                <div className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${m.status === 'active' ? 'bg-blue-400' : 'bg-gray-600'}`} />
              </div>

              {/* Director padre */}
              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                <span>Director:</span>
                <span className="text-gray-400 truncate">{directorName(m.parent_agent_id || '')}</span>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <StatusBadge status={m.status} />
                {m.model && (
                  <span className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-500 px-2 py-0.5 rounded-full font-mono truncate">
                    {m.model.split('/').pop()}
                  </span>
                )}
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-gray-100 dark:bg-white/[0.04] rounded-lg px-2.5 py-1.5">
                  <div className="text-gray-500 mb-0.5">Coste hoy</div>
                  <div className="text-blue-400 font-mono">{m.cost_used_today_eur?.toFixed(2)}€</div>
                </div>
                <div className="bg-gray-100 dark:bg-white/[0.04] rounded-lg px-2.5 py-1.5">
                  <div className="text-gray-500 mb-0.5">Tokens</div>
                  <div className="text-gray-600 dark:text-gray-300 font-mono">{m.tokens_used_today?.toLocaleString()}</div>
                </div>
              </div>

              <button
                onClick={() => navigate(`/chat/${m.id}`)}
                className="w-full flex items-center justify-center gap-1.5 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded-lg text-xs font-medium transition-colors"
              >
                Chat
              </button>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="col-span-full py-12 text-center text-gray-600 text-sm">No hay managers</div>
          )}
        </div>
      )}

      {/* Detail Modal */}
      <Modal open={!!selected} onClose={() => setSelected(null)} title={selected?.name || ''} wide>
        {selected && (
          <div className="space-y-4 text-sm">
            <div className="bg-gray-100 dark:bg-white/[0.04] rounded-xl p-4 flex items-center gap-4">
              <AreaBadge area={selected.area} size="lg" icon={selected.icon} color={selected.color} />
              <div>
                <div className="font-semibold text-gray-900 dark:text-white">{selected.name}</div>
                <div className="text-gray-400 text-xs mt-0.5 capitalize">{selected.area}</div>
                <div className="flex items-center gap-2 mt-1.5">
                  <StatusBadge status={selected.status} />
                  <span className="text-xs px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 font-mono">L1 · Manager</span>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Director', value: directorName(selected.parent_agent_id || '') },
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
                area={selected.area}
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
              {(() => {
                const childAgents = specialists.filter(s => s.parent_agent_id === selected.id);
                return (
                  <AgentConfigPanel
                    agentId={selected.id}
                    agentName={selected.name}
                    parentAgentId={selected.parent_agent_id}
                    parentAgentName={directors.find(d => d.id === selected.parent_agent_id)?.name}
                    childAgentIds={childAgents.map(s => s.id)}
                    childAgentNames={childAgents.map(s => s.name)}
                  />
                );
              })()}
            </div>

            <button
              onClick={() => { navigate(`/chat/${selected.id}`); setSelected(null); }}
              className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors"
            >
              Abrir Chat
            </button>
          </div>
        )}
      </Modal>

      <PageHelp
        summary="Los Managers son el nivel intermedio de la organización. Reciben objetivos de la Dirección, los dividen en tareas concretas y las asignan a los Especialistas. También pueden ejecutar tareas directamente."
        items={[
          { icon: '🎯', title: 'Rol', description: 'Cada Manager tiene un área de especialización (marketing, ventas, operaciones…) y gestiona un equipo de Especialistas.' },
          { icon: '⚙️', title: 'Configurar', description: 'Define las instrucciones del sistema, el modelo de IA y las herramientas disponibles para cada Manager.' },
          { icon: '💬', title: 'Chat directo', description: 'Abre una conversación directa con el Manager para darle instrucciones o consultar su estado.' },
        ]}
      />
    </div>
  );
}
