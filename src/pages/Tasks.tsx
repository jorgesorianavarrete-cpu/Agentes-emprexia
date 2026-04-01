import { CheckCircle2, Plus, Pencil, Trash2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { fnCall, dbGet, dbDelete } from '../lib/insforge';
import { Task, Agent } from '../lib/types';
import Modal from '../components/Modal';
import AreaBadge from '../components/AreaBadge';
import PageHeader from '../components/PageHeader';
import PageHelp from '../components/PageHelp';

// ─── Constantes ────────────────────────────────────────────────────────────────

const PRIORITY_MAP: Record<number, { label: string; color: string }> = {
  1: { label: 'Crítica',  color: 'bg-red-500/10 text-red-400 border-red-500/20' },
  2: { label: 'Alta',     color: 'bg-orange-500/10 text-orange-400 border-orange-500/20' },
  3: { label: 'Media',    color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  4: { label: 'Baja',     color: 'bg-gray-700/50 text-gray-400 border-gray-200 dark:border-gray-700' },
  5: { label: 'Mínima',   color: 'bg-gray-100 dark:bg-white/[0.04] text-gray-500 border-gray-200 dark:border-gray-800' },
};

// Todos los estados posibles con su etiqueta en español y color
const STATUS_MAP: Record<string, { label: string; color: string }> = {
  inbox:       { label: 'Bandeja',         color: 'bg-blue-500/20 text-blue-400' },
  up_next:     { label: 'A continuación',  color: 'bg-cyan-500/20 text-cyan-400' },
  pending:     { label: 'Pendiente',       color: 'bg-yellow-500/20 text-yellow-400' },
  in_progress: { label: 'En progreso',     color: 'bg-amber-500/20 text-amber-400' },
  in_review:   { label: 'En revisión',     color: 'bg-purple-500/20 text-purple-400' },
  blocked:     { label: 'Bloqueada',       color: 'bg-red-500/20 text-red-400' },
  done:        { label: 'Completada',      color: 'bg-indigo-500/20 text-indigo-400' },
  completed:   { label: 'Completada',      color: 'bg-indigo-500/20 text-indigo-400' },
  failed:      { label: 'Fallida',         color: 'bg-red-600/20 text-red-500' },
  cancelled:   { label: 'Cancelada',       color: 'bg-gray-500/20 text-gray-500' },
};

// Transiciones válidas (espejo del edge function)
const TRANSITIONS: Record<string, string[]> = {
  inbox:       ['up_next', 'in_progress', 'cancelled'],
  up_next:     ['in_progress', 'inbox', 'cancelled'],
  pending:     ['in_progress', 'up_next', 'cancelled'],
  in_progress: ['in_review', 'completed', 'done', 'blocked', 'failed', 'cancelled'],
  in_review:   ['completed', 'done', 'in_progress', 'failed'],
  blocked:     ['in_progress', 'cancelled'],
  completed:   ['done'],
  done:        [],
  failed:      ['inbox', 'up_next', 'in_progress'],
  cancelled:   ['inbox'],
};

// Filtros de estado con etiqueta en español
const FILTER_TABS = [
  { id: 'all',         label: 'Todas' },
  { id: 'inbox',       label: 'Bandeja' },
  { id: 'up_next',     label: 'A continuación' },
  { id: 'in_progress', label: 'En progreso' },
  { id: 'in_review',   label: 'En revisión' },
  { id: 'blocked',     label: 'Bloqueada' },
  { id: 'done',        label: 'Completada' },
  { id: 'failed',      label: 'Fallida' },
  { id: 'cancelled',   label: 'Cancelada' },
];

// ─── Sub-componentes ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status?: string }) {
  const s = status ?? '—';
  const m = STATUS_MAP[s];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${m ? m.color : 'bg-gray-500/20 text-gray-400'}`}>
      {m ? m.label : s.replace(/_/g, ' ')}
    </span>
  );
}

function PriorityBadge({ p }: { p: number }) {
  const m = PRIORITY_MAP[p] || PRIORITY_MAP[3];
  return <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${m.color}`}>{m.label}</span>;
}

function fmt(d: string) {
  return new Date(d).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function Spinner() {
  return (
    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
    </svg>
  );
}

// ─── Componente principal ──────────────────────────────────────────────────────

export default function Tasks() {
  const [tasks, setTasks]         = useState<Task[]>([]);
  const [agents, setAgents]       = useState<Agent[]>([]);
  const [loading, setLoading]     = useState(true);
  const [filter, setFilter]       = useState('all');
  const [agentFilter, setAgentFilter] = useState('');
  const [search, setSearch]       = useState('');

  // Modales
  const [showCreate, setShowCreate]   = useState(false);
  const [editTask, setEditTask]       = useState<Task | null>(null);
  const [detailTask, setDetailTask]   = useState<Task | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Task | null>(null);

  // Formulario crear / editar
  const emptyForm = { agent_id: '', title: '', description: '', priority: 3 };
  const [form, setForm]   = useState(emptyForm);
  const [editForm, setEditForm] = useState<{ title: string; description: string; priority: number; agent_id: string; status: string }>({ title: '', description: '', priority: 3, agent_id: '', status: '' });
  const [msg, setMsg]     = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // ── Carga de datos ──────────────────────────────────────────────────────────
  const load = async () => {
    setLoading(true);
    try {
      const params = agentFilter ? `agent_id=${agentFilter}` : '';
      const [t, a] = await Promise.all([
        fnCall('task-manager', 'GET', undefined, params),
        dbGet('agents', 'select=id,name,area'),
      ]);
      setTasks(t.tasks || t || []);
      setAgents(a);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { load(); }, [agentFilter]);

  const agentName = (id: string) => agents.find(a => a.id === id)?.name || id?.slice(0, 8) + '…';
  const agentArea = (id: string) => agents.find(a => a.id === id)?.area || '';

  const filtered = tasks.filter(t => {
    const matchStatus = filter === 'all' || t.status === filter;
    const matchSearch = !search || t.title?.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  const statusCounts = tasks.reduce((acc: Record<string, number>, t) => {
    acc[t.status] = (acc[t.status] || 0) + 1;
    return acc;
  }, {});

  // ── Crear ───────────────────────────────────────────────────────────────────
  const create = async () => {
    if (!form.agent_id || !form.title) return;
    setSaving(true); setMsg('');
    try {
      await fnCall('task-manager', 'POST', form);
      setMsg('Tarea creada');
      setShowCreate(false);
      setForm(emptyForm);
      load();
    } catch (e: any) { setMsg(`Error: ${e.message}`); }
    setSaving(false);
  };

  // ── Editar ──────────────────────────────────────────────────────────────────
  const openEdit = (t: Task, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditForm({ title: t.title, description: t.description || '', priority: t.priority, agent_id: t.agent_id, status: t.status });
    setEditTask(t);
    setMsg('');
  };

  const saveEdit = async () => {
    if (!editTask) return;
    setSaving(true); setMsg('');
    try {
      // Cambio de estado → transición vía PATCH status
      const payload: Record<string, any> = {
        task_id: editTask.id,
        title:   editForm.title,
        description: editForm.description,
        priority: editForm.priority,
        agent_id: editForm.agent_id || null,
      };
      // Si el estado cambió, añadir el nuevo estado
      if (editForm.status !== editTask.status) {
        payload.status = editForm.status;
      }
      await fnCall('task-manager', 'PATCH', payload);
      setEditTask(null);
      load();
    } catch (e: any) { setMsg(`Error: ${e.message}`); }
    setSaving(false);
  };

  // ── Eliminar ────────────────────────────────────────────────────────────────
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await dbDelete('tasks', `id=eq.${deleteTarget.id}`);
      setDeleteTarget(null);
      setDetailTask(null);
      load();
    } catch (e: any) { console.error(e); }
    setDeleting(false);
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="p-4 sm:p-6 space-y-5">
      <PageHeader
        title="Tareas"
        icon={CheckCircle2}
        badge={tasks.length}
        subtitle="tareas totales"
        actions={
          <button onClick={() => { setShowCreate(true); setMsg(''); }}
            className="flex items-center gap-2 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-colors">
            <Plus size={15} />
            Nueva tarea
          </button>
        }
      />

      {/* Filtros */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
          <input type="text" placeholder="Buscar tarea..." value={search} onChange={e => setSearch(e.target.value)}
            className="bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 placeholder-gray-600 rounded-lg pl-9 pr-3 py-2 text-sm focus:border-indigo-500 outline-none w-52" />
        </div>
        <select value={agentFilter} onChange={e => setAgentFilter(e.target.value)}
          className="bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500">
          <option value="">Todos los agentes</option>
          {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        {/* Tabs de estado en español */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {FILTER_TABS.map(s => (
            <button key={s.id} onClick={() => setFilter(s.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filter === s.id ? 'bg-indigo-500/15 text-indigo-400' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 hover:text-gray-600 dark:text-gray-300'}`}>
              {s.label}
              {s.id !== 'all' && statusCounts[s.id] ? <span className="ml-1.5 opacity-60">{statusCounts[s.id]}</span> : null}
            </button>
          ))}
        </div>
      </div>

      {/* Lista de tareas */}
      {loading ? (
        <div className="flex items-center gap-3 text-gray-500 py-8">
          <Spinner /><span className="text-sm">Cargando tareas...</span>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(t => (
            <div key={t.id} className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 transition-colors group">
              <div className="flex items-start justify-between gap-3">
                {/* Info principal — clic abre el detalle */}
                <button className="flex-1 min-w-0 text-left" onClick={() => setDetailTask(t)}>
                  <div className="flex items-center gap-2 mb-1">
                    <StatusBadge status={t.status} />
                    <PriorityBadge p={t.priority} />
                  </div>
                  <div className="font-medium text-gray-900 dark:text-white text-sm truncate">{t.title}</div>
                  {t.description && <div className="text-xs text-gray-500 mt-0.5 truncate">{t.description}</div>}
                </button>

                {/* Lado derecho */}
                <div className="flex items-start gap-3 flex-shrink-0">
                  <div className="text-right hidden sm:block">
                    <div className="text-xs text-gray-400 font-medium">{agentName(t.agent_id)}</div>
                    <div className="text-xs text-gray-600 mt-0.5">{fmt(t.created_at)}</div>
                  </div>
                  {/* Acciones: editar / eliminar */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={e => openEdit(t, e)} title="Editar"
                      className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-400 hover:bg-indigo-500/10 transition-colors">
                      <Pencil size={13} />
                    </button>
                    <button onClick={e => { e.stopPropagation(); setDeleteTarget(t); }} title="Eliminar"
                      className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
          {filtered.length === 0 && <div className="py-12 text-center text-gray-600 text-sm">No hay tareas que coincidan</div>}
        </div>
      )}

      {/* ── Modal: Crear tarea ─────────────────────────────────────────────── */}
      <Modal open={showCreate} onClose={() => { setShowCreate(false); setMsg(''); }} title="Nueva tarea">
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
            <label className="block text-xs text-gray-500 mb-1.5">Título</label>
            <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
              placeholder="Descripción breve de la tarea"
              className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500 placeholder-gray-600" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1.5">Descripción detallada</label>
            <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
              rows={3} placeholder="Instrucciones adicionales..."
              className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500 placeholder-gray-600 resize-none" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1.5">Prioridad</label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map(p => (
                <button key={p} onClick={() => setForm({ ...form, priority: p })}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors ${form.priority === p ? PRIORITY_MAP[p].color : 'border-gray-200 dark:border-gray-700 text-gray-500 bg-gray-100 dark:bg-gray-800'}`}>
                  {PRIORITY_MAP[p].label}
                </button>
              ))}
            </div>
          </div>
          {msg && <div className="text-sm text-center py-1 text-gray-400">{msg}</div>}
          <button onClick={create} disabled={saving || !form.agent_id || !form.title}
            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2">
            {saving ? <><Spinner/>Creando...</> : 'Crear tarea'}
          </button>
        </div>
      </Modal>

      {/* ── Modal: Editar tarea ────────────────────────────────────────────── */}
      <Modal open={!!editTask} onClose={() => { setEditTask(null); setMsg(''); }} title="Editar tarea">
        {editTask && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1.5">Título</label>
              <input value={editForm.title} onChange={e => setEditForm({ ...editForm, title: e.target.value })}
                className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1.5">Descripción</label>
              <textarea value={editForm.description} onChange={e => setEditForm({ ...editForm, description: e.target.value })}
                rows={3}
                className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500 resize-none" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1.5">Agente</label>
              <select value={editForm.agent_id} onChange={e => setEditForm({ ...editForm, agent_id: e.target.value })}
                className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500">
                <option value="">Sin asignar</option>
                {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1.5">Estado</label>
              <div className="flex flex-wrap gap-2">
                {/* Estado actual siempre seleccionable */}
                {[editTask.status, ...(TRANSITIONS[editTask.status] || [])].filter((v, i, a) => a.indexOf(v) === i).map(s => (
                  <button key={s} onClick={() => setEditForm({ ...editForm, status: s })}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      editForm.status === s
                        ? (STATUS_MAP[s]?.color || 'bg-indigo-500/20 text-indigo-400') + ' border-transparent'
                        : 'border-gray-200 dark:border-gray-700 text-gray-500 bg-gray-100 dark:bg-gray-800'
                    }`}>
                    {STATUS_MAP[s]?.label || s}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1.5">Prioridad</label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map(p => (
                  <button key={p} onClick={() => setEditForm({ ...editForm, priority: p })}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors ${editForm.priority === p ? PRIORITY_MAP[p].color : 'border-gray-200 dark:border-gray-700 text-gray-500 bg-gray-100 dark:bg-gray-800'}`}>
                    {PRIORITY_MAP[p].label}
                  </button>
                ))}
              </div>
            </div>
            {msg && <div className="text-sm text-center py-1 text-red-400">{msg}</div>}
            <div className="flex gap-2">
              <button onClick={() => { setEditTask(null); setMsg(''); }}
                className="flex-1 py-2.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg text-sm font-medium transition-colors">
                Cancelar
              </button>
              <button onClick={saveEdit} disabled={saving || !editForm.title}
                className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2">
                {saving ? <><Spinner/>Guardando...</> : 'Guardar cambios'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Modal: Detalle ─────────────────────────────────────────────────── */}
      <Modal open={!!detailTask} onClose={() => setDetailTask(null)} title={detailTask?.title || ''} wide>
        {detailTask && (
          <div className="space-y-4 text-sm">
            <div className="flex items-center gap-2">
              <StatusBadge status={detailTask.status} />
              <PriorityBadge p={detailTask.priority} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Agente',    value: agentName(detailTask.agent_id) },
                { label: 'Creada',    value: fmt(detailTask.created_at) },
                { label: 'Estado',    value: STATUS_MAP[detailTask.status]?.label || detailTask.status },
                { label: 'Prioridad', value: PRIORITY_MAP[detailTask.priority]?.label || String(detailTask.priority) },
              ].map(f => (
                <div key={f.label} className="bg-gray-100 dark:bg-white/[0.04] rounded-lg px-3 py-2.5">
                  <div className="text-xs text-gray-500 mb-1">{f.label}</div>
                  <div className="text-gray-700 dark:text-gray-200">{f.value}</div>
                </div>
              ))}
            </div>
            {detailTask.description && (
              <div className="bg-gray-100 dark:bg-white/[0.04] rounded-lg px-3 py-2.5">
                <div className="text-xs text-gray-500 mb-1">Descripción</div>
                <div className="text-gray-600 dark:text-gray-300 whitespace-pre-wrap">{detailTask.description}</div>
              </div>
            )}
            {/* Acciones desde el detalle */}
            <div className="flex gap-2 pt-1">
              <button onClick={e => { openEdit(detailTask, e); setDetailTask(null); }}
                className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-colors">
                <Pencil size={13} /> Editar
              </button>
              <button onClick={() => { setDeleteTarget(detailTask); setDetailTask(null); }}
                className="flex items-center gap-1.5 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-sm font-medium transition-colors">
                <Trash2 size={13} /> Eliminar
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Modal: Confirmar eliminación ───────────────────────────────────── */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Eliminar tarea">
        {deleteTarget && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-300">
              ¿Seguro que quieres eliminar la tarea <span className="font-semibold text-gray-900 dark:text-white">"{deleteTarget.title}"</span>? Esta acción no se puede deshacer.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setDeleteTarget(null)} disabled={deleting}
                className="flex-1 py-2.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg text-sm font-medium transition-colors">
                Cancelar
              </button>
              <button onClick={confirmDelete} disabled={deleting}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2">
                {deleting ? <><Spinner/>Eliminando...</> : 'Sí, eliminar'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      <PageHelp
        summary="Las tareas son las unidades de trabajo del sistema. Los agentes las crean, ejecutan y actualizan su estado a medida que progresan. También puedes crear y modificar tareas manualmente desde aquí."
        items={[
          { icon: '📥', title: 'Bandeja', description: 'Tareas recién creadas que aún no han sido asignadas ni comenzadas.' },
          { icon: '▶️', title: 'En progreso', description: 'Un agente está trabajando activamente en esta tarea ahora mismo.' },
          { icon: '🔍', title: 'En revisión', description: 'La tarea fue completada por el agente y espera validación.' },
          { icon: '✅', title: 'Completada', description: 'La tarea fue finalizada y validada correctamente.' },
          { icon: '✏️', title: 'Editar / Eliminar', description: 'Pasa el ratón sobre una tarea para ver los iconos de edición y eliminación.' },
        ]}
      />
    </div>
  );
}
