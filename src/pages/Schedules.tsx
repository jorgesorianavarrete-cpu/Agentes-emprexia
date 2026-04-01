import { Clock, RefreshCw, Plus, Play, Pause, Trash2, ChevronDown, ChevronUp, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { useState, useEffect } from 'react';
import { dbGet, dbPost, dbPatch, dbDelete } from '../lib/insforge';
import { Agent, Schedule } from '../lib/types';
import Modal from '../components/Modal';
import PageHeader from '../components/PageHeader';
import AreaBadge from '../components/AreaBadge';
import PageHelp from '../components/PageHelp';

// Helper: human-readable cron
function cronLabel(expr: string): string {
  const presets: Record<string, string> = {
    '0 0 * * *':   'Cada día a las 00:00',
    '0 2 * * *':   'Cada día a las 02:00',
    '0 6 * * *':   'Cada día a las 06:00',
    '0 8 * * *':   'Cada día a las 08:00',
    '0 9 * * *':   'Cada día a las 09:00',
    '0 12 * * *':  'Cada día a las 12:00',
    '0 18 * * *':  'Cada día a las 18:00',
    '0 0 * * 1':   'Cada lunes a las 00:00',
    '0 9 * * 1':   'Cada lunes a las 09:00',
    '0 9 1 * *':   'El 1º de cada mes a las 09:00',
    '*/30 * * * *': 'Cada 30 minutos',
    '*/15 * * * *': 'Cada 15 minutos',
    '0 */6 * * *':  'Cada 6 horas',
    '0 */12 * * *': 'Cada 12 horas',
  };
  return presets[expr] || expr;
}

const CRON_PRESETS = [
  { label: 'Cada 15 minutos', value: '*/15 * * * *' },
  { label: 'Cada 30 minutos', value: '*/30 * * * *' },
  { label: 'Cada hora',        value: '0 * * * *' },
  { label: 'Cada 6 horas',     value: '0 */6 * * *' },
  { label: 'Cada 12 horas',    value: '0 */12 * * *' },
  { label: 'Cada día 00:00',   value: '0 0 * * *' },
  { label: 'Cada día 02:00',   value: '0 2 * * *' },
  { label: 'Cada día 06:00',   value: '0 6 * * *' },
  { label: 'Cada día 09:00',   value: '0 9 * * *' },
  { label: 'Cada día 12:00',   value: '0 12 * * *' },
  { label: 'Cada lunes 09:00', value: '0 9 * * 1' },
  { label: '1º de cada mes',   value: '0 9 1 * *' },
  { label: 'Personalizado',    value: '__custom__' },
];

const STATUS_COLOR: Record<string, string> = {
  active:   'bg-green-500/10 text-green-400 border-green-500/20',
  paused:   'bg-amber-500/10 text-amber-400 border-amber-500/20',
  disabled: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
};
const STATUS_LABEL: Record<string, string> = {
  active: 'Activa', paused: 'Pausada', disabled: 'Desactivada',
};

const emptyForm = {
  name: '',
  description: '',
  agent_id: '',
  cron_expression: '0 9 * * *',
  cron_preset: '0 9 * * *',
  task_prompt: '',
};

export default function Schedules() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [selected, setSelected] = useState<Schedule | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('');

  const load = async () => {
    setLoading(true);
    try {
      const [sched, agts] = await Promise.all([
        dbGet('schedules', 'select=*&order=created_at.asc'),
        dbGet('agents', 'select=id,name,area,level,icon,color&order=level.asc,name.asc'),
      ]);
      setSchedules(sched || []);
      setAgents(agts || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const agentById = (id: string | null) => agents.find(a => a.id === id);

  const filtered = filterStatus ? schedules.filter(s => s.status === filterStatus) : schedules;

  const create = async () => {
    if (!form.name.trim() || !form.cron_expression.trim() || !form.task_prompt.trim()) return;
    setSaving(true);
    try {
      await dbPost('schedules', [{
        name: form.name.trim(),
        description: form.description.trim() || null,
        agent_id: form.agent_id || null,
        cron_expression: form.cron_expression.trim(),
        task_prompt: form.task_prompt.trim(),
        status: 'active',
      }]);
      setShowCreate(false);
      setForm(emptyForm);
      await load();
    } catch (e: any) { console.error(e); }
    setSaving(false);
  };

  const toggleStatus = async (s: Schedule) => {
    const next = s.status === 'active' ? 'paused' : 'active';
    try {
      await dbPatch('schedules', `id=eq.${s.id}`, { status: next });
      setSchedules(prev => prev.map(x => x.id === s.id ? { ...x, status: next as any } : x));
      if (selected?.id === s.id) setSelected(prev => prev ? { ...prev, status: next as any } : null);
    } catch (e) { console.error(e); }
  };

  const deleteSchedule = async (id: string) => {
    if (!confirm('¿Eliminar esta programación?')) return;
    try {
      await dbDelete('schedules', `id=eq.${id}`);
      setSchedules(prev => prev.filter(x => x.id !== id));
      if (selected?.id === id) setSelected(null);
    } catch (e) { console.error(e); }
  };

  const stats = {
    total: schedules.length,
    active: schedules.filter(s => s.status === 'active').length,
    paused: schedules.filter(s => s.status === 'paused').length,
    errors: schedules.filter(s => (s.error_count || 0) > 0).length,
  };

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <PageHeader
        title="Programaciones"
        icon={Clock}
        badge={stats.active}
        subtitle="tareas programadas activas"
        actions={
          <div className="flex items-center gap-2">
            <button onClick={load} className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-gray-500 dark:text-slate-400 bg-white dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] hover:border-gray-300 dark:hover:border-white/[0.12] transition-all">
              <RefreshCw size={14} />
              Actualizar
            </button>
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <Plus size={15} />
              Nueva
            </button>
          </div>
        }
      />

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total', value: stats.total, color: 'text-gray-400' },
          { label: 'Activas', value: stats.active, color: 'text-green-400' },
          { label: 'Pausadas', value: stats.paused, color: 'text-amber-400' },
          { label: 'Con errores', value: stats.errors, color: 'text-red-400' },
        ].map(s => (
          <div key={s.label} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl px-4 py-3">
            <div className="text-xs text-gray-500 mb-1">{s.label}</div>
            <div className={`text-2xl font-bold font-mono ${s.color}`}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2 flex-wrap">
        {['', 'active', 'paused', 'disabled'].map(st => (
          <button
            key={st}
            onClick={() => setFilterStatus(st)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filterStatus === st ? 'bg-indigo-500/15 text-indigo-400' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 hover:text-gray-600 dark:text-gray-300'}`}
          >
            {st ? STATUS_LABEL[st] : 'Todas'}
          </button>
        ))}
      </div>

      {/* Schedule list */}
      {loading ? (
        <div className="flex items-center gap-3 text-gray-500 py-8">
          <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>
          <span className="text-sm">Cargando programaciones...</span>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(s => {
            const agent = agentById(s.agent_id);
            const expanded = expandedId === s.id;
            return (
              <div
                key={s.id}
                className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden transition-colors"
              >
                {/* Main row */}
                <div className="flex items-center gap-3 px-4 py-3">
                  {/* Status dot */}
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${s.status === 'active' ? 'bg-green-400' : s.status === 'paused' ? 'bg-amber-400' : 'bg-gray-500'}`} />

                  {/* Agent badge */}
                  {agent ? (
                    <AreaBadge area={agent.area} size="sm" icon={agent.icon} color={agent.color} />
                  ) : (
                    <div className="w-7 h-7 rounded-lg bg-gray-200 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
                      <Clock size={14} className="text-gray-400" />
                    </div>
                  )}

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        onClick={() => { setSelected(s); }}
                        className="text-sm font-semibold text-gray-900 dark:text-white hover:text-indigo-400 transition-colors text-left"
                      >
                        {s.name}
                      </button>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${STATUS_COLOR[s.status]}`}>
                        {STATUS_LABEL[s.status]}
                      </span>
                      {(s.error_count || 0) > 0 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded border bg-red-500/10 text-red-400 border-red-500/20">
                          {s.error_count} error{s.error_count > 1 ? 'es' : ''}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                      <span className="text-xs text-indigo-400 font-mono">{cronLabel(s.cron_expression)}</span>
                      {agent && <span className="text-xs text-gray-500">→ {agent.name}</span>}
                      {s.last_run_at && (
                        <span className="text-xs text-gray-500">
                          Última: {new Date(s.last_run_at).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                      <span className="text-xs text-gray-500">{s.run_count || 0} ejecuciones</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => toggleStatus(s)}
                      title={s.status === 'active' ? 'Pausar' : 'Activar'}
                      className={`p-1.5 rounded-lg transition-colors ${s.status === 'active' ? 'text-amber-400 hover:bg-amber-500/10' : 'text-green-400 hover:bg-green-500/10'}`}
                    >
                      {s.status === 'active' ? <Pause size={14} /> : <Play size={14} />}
                    </button>
                    <button
                      onClick={() => deleteSchedule(s.id)}
                      className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors"
                      title="Eliminar"
                    >
                      <Trash2 size={14} />
                    </button>
                    <button
                      onClick={() => setExpandedId(expanded ? null : s.id)}
                      className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    >
                      {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                  </div>
                </div>

                {/* Expanded details */}
                {expanded && (
                  <div className="border-t border-gray-100 dark:border-gray-800 px-4 py-3 bg-gray-50 dark:bg-white/[0.02] space-y-3">
                    {s.description && (
                      <p className="text-xs text-gray-500">{s.description}</p>
                    )}
                    <div>
                      <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Prompt de tarea</div>
                      <pre className="text-xs text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 rounded-lg p-3 whitespace-pre-wrap font-sans">{s.task_prompt}</pre>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                      <div className="bg-white dark:bg-gray-800 rounded-lg px-3 py-2">
                        <div className="text-gray-400 mb-0.5">Expresión cron</div>
                        <div className="font-mono text-indigo-400">{s.cron_expression}</div>
                      </div>
                      <div className="bg-white dark:bg-gray-800 rounded-lg px-3 py-2">
                        <div className="text-gray-400 mb-0.5">Ejecuciones</div>
                        <div className="font-mono text-gray-300">{s.run_count || 0}</div>
                      </div>
                      <div className="bg-white dark:bg-gray-800 rounded-lg px-3 py-2">
                        <div className="text-gray-400 mb-0.5">Errores</div>
                        <div className={`font-mono ${(s.error_count || 0) > 0 ? 'text-red-400' : 'text-gray-300'}`}>{s.error_count || 0}</div>
                      </div>
                      <div className="bg-white dark:bg-gray-800 rounded-lg px-3 py-2">
                        <div className="text-gray-400 mb-0.5">Último estado</div>
                        <div className="flex items-center gap-1">
                          {s.last_run_status === 'success' && <CheckCircle size={11} className="text-green-400" />}
                          {s.last_run_status === 'error' && <XCircle size={11} className="text-red-400" />}
                          {!s.last_run_status && <AlertCircle size={11} className="text-gray-500" />}
                          <span className={`font-mono ${s.last_run_status === 'success' ? 'text-green-400' : s.last_run_status === 'error' ? 'text-red-400' : 'text-gray-500'}`}>
                            {s.last_run_status || 'sin datos'}
                          </span>
                        </div>
                      </div>
                    </div>
                    {s.last_run_result && (
                      <div>
                        <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Último resultado</div>
                        <pre className="text-xs text-gray-500 bg-gray-100 dark:bg-gray-800 rounded-lg p-2 whitespace-pre-wrap max-h-24 overflow-y-auto">{s.last_run_result}</pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {filtered.length === 0 && (
            <div className="py-16 text-center">
              <Clock size={32} className="mx-auto text-gray-600 mb-3" />
              <div className="text-gray-500 text-sm">No hay programaciones</div>
              <button
                onClick={() => setShowCreate(true)}
                className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm rounded-lg transition-colors"
              >
                Crear primera programación
              </button>
            </div>
          )}
        </div>
      )}

      {/* Create Modal */}
      <Modal open={showCreate} onClose={() => { setShowCreate(false); setForm(emptyForm); }} title="Nueva programación" wide>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs text-gray-500 mb-1.5">Nombre</label>
              <input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Ej: Reporte semanal Google Ads"
                className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500 placeholder-gray-500"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-gray-500 mb-1.5">Descripción (opcional)</label>
              <input
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Qué hace esta programación..."
                className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500 placeholder-gray-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1.5">Agente responsable</label>
            <select
              value={form.agent_id}
              onChange={e => setForm(f => ({ ...f, agent_id: e.target.value }))}
              className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500"
            >
              <option value="">Sin asignar</option>
              <optgroup label="Dirección">
                {agents.filter(a => a.level === 0).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </optgroup>
              <optgroup label="Managers">
                {agents.filter(a => a.level === 1).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </optgroup>
              <optgroup label="Especialistas">
                {agents.filter(a => a.level === 2).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </optgroup>
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1.5">Frecuencia</label>
            <select
              value={form.cron_preset}
              onChange={e => {
                const v = e.target.value;
                if (v !== '__custom__') {
                  setForm(f => ({ ...f, cron_preset: v, cron_expression: v }));
                } else {
                  setForm(f => ({ ...f, cron_preset: v }));
                }
              }}
              className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500 mb-2"
            >
              {CRON_PRESETS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
            {form.cron_preset === '__custom__' && (
              <input
                value={form.cron_expression}
                onChange={e => setForm(f => ({ ...f, cron_expression: e.target.value }))}
                placeholder="Expresión cron (ej: 0 9 * * 1)"
                className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500 font-mono placeholder-gray-500"
              />
            )}
            {form.cron_expression && form.cron_preset !== '__custom__' && (
              <div className="text-xs text-indigo-400 font-mono mt-1 px-1">{cronLabel(form.cron_expression)}</div>
            )}
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1.5">Prompt / instrucción para el agente</label>
            <textarea
              value={form.task_prompt}
              onChange={e => setForm(f => ({ ...f, task_prompt: e.target.value }))}
              rows={4}
              placeholder="Describe qué tiene que hacer el agente cuando se ejecute esta programación..."
              className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500 placeholder-gray-500 resize-none"
            />
          </div>

          <button
            onClick={create}
            disabled={saving || !form.name.trim() || !form.cron_expression.trim() || !form.task_prompt.trim()}
            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-lg text-sm font-medium transition-colors"
          >
            {saving ? 'Guardando...' : 'Crear programación'}
          </button>
        </div>
      </Modal>

      {/* Detail Modal */}
      <Modal open={!!selected} onClose={() => setSelected(null)} title={selected?.name || ''} wide>
        {selected && (() => {
          const agent = agentById(selected.agent_id);
          return (
            <div className="space-y-4 text-sm">
              {/* Header */}
              <div className="bg-gray-100 dark:bg-white/[0.04] rounded-xl p-4 flex items-center gap-4">
                {agent ? (
                  <AreaBadge area={agent.area} size="lg" icon={agent.icon} color={agent.color} />
                ) : (
                  <div className="w-12 h-12 rounded-xl bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                    <Clock size={22} className="text-gray-400" />
                  </div>
                )}
                <div>
                  <div className="font-semibold text-gray-900 dark:text-white">{selected.name}</div>
                  {selected.description && <div className="text-gray-400 text-xs mt-0.5">{selected.description}</div>}
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className={`text-xs px-1.5 py-0.5 rounded border font-medium ${STATUS_COLOR[selected.status]}`}>
                      {STATUS_LABEL[selected.status]}
                    </span>
                    <span className="text-xs px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-mono">
                      {cronLabel(selected.cron_expression)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Agente', value: agent?.name || 'Sin asignar' },
                  { label: 'Cron', value: selected.cron_expression },
                  { label: 'Ejecuciones', value: String(selected.run_count || 0) },
                  { label: 'Errores', value: String(selected.error_count || 0) },
                  { label: 'Última ejecución', value: selected.last_run_at ? new Date(selected.last_run_at).toLocaleString('es-ES') : 'Nunca' },
                  { label: 'Estado última', value: selected.last_run_status || '—' },
                ].map(f => (
                  <div key={f.label} className="bg-gray-100 dark:bg-white/[0.04] rounded-lg px-3 py-2.5">
                    <div className="text-xs text-gray-500 mb-1">{f.label}</div>
                    <div className="text-gray-700 dark:text-gray-200 font-mono text-xs truncate">{f.value}</div>
                  </div>
                ))}
              </div>

              {/* Prompt */}
              <div>
                <div className="text-xs text-gray-500 mb-2 font-medium uppercase tracking-wider">Prompt de tarea</div>
                <pre className="bg-gray-100 dark:bg-gray-800 rounded-xl p-4 text-xs text-gray-600 dark:text-gray-300 whitespace-pre-wrap max-h-40 overflow-y-auto">{selected.task_prompt}</pre>
              </div>

              {selected.last_run_result && (
                <div>
                  <div className="text-xs text-gray-500 mb-2 font-medium uppercase tracking-wider">Último resultado</div>
                  <pre className="bg-gray-100 dark:bg-gray-800 rounded-xl p-4 text-xs text-gray-500 whitespace-pre-wrap max-h-32 overflow-y-auto">{selected.last_run_result}</pre>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={() => toggleStatus(selected)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 ${selected.status === 'active' ? 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-400' : 'bg-green-500/10 hover:bg-green-500/20 text-green-400'}`}
                >
                  {selected.status === 'active' ? <><Pause size={14} /> Pausar</> : <><Play size={14} /> Activar</>}
                </button>
                <button
                  onClick={() => { deleteSchedule(selected.id); setSelected(null); }}
                  className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                >
                  <Trash2 size={14} /> Eliminar
                </button>
              </div>
            </div>
          );
        })()}
      </Modal>

      <PageHelp
        summary="Las programaciones permiten que los agentes ejecuten tareas automáticamente según un calendario. Define la frecuencia, el agente responsable y el prompt que se enviará en cada ejecución."
        items={[
          { icon: '🕐', title: 'Expresión cron', description: 'Define cuándo se ejecuta la programación: cada hora, diariamente, semanalmente, etc.' },
          { icon: '▶️ / ⏸', title: 'Activar o pausar', description: 'Puedes suspender una programación temporalmente sin eliminarla.' },
          { icon: '📊', title: 'Estadísticas', description: 'Cada programación lleva un contador de ejecuciones, errores y el resultado de la última vez que corrió.' },
          { icon: '💡', title: 'Prompt de tarea', description: 'El texto que se enviará al agente en cada ejecución. Sé claro y específico sobre lo que debe hacer.' },
        ]}
      />
    </div>
  );
}
