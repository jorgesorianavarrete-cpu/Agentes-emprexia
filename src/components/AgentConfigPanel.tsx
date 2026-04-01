import { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, Eye, EyeOff, Copy, ChevronDown, ChevronUp, Share2 } from 'lucide-react';
import { dbGet, dbPost, dbDelete, dbPatch } from '../lib/insforge';

interface AgentConfig {
  id: string;
  agent_id: string;
  key: string;
  value: string;
  description: string;
  is_secret: boolean;
  created_at: string;
  inherited?: boolean;
  inherited_from?: string;
}

interface AgentConfigPanelProps {
  agentId: string;
  agentName: string;
  parentAgentId?: string | null;
  parentAgentName?: string | null;
  /** IDs de agentes hijos (especialistas) para propagación */
  childAgentIds?: string[];
  childAgentNames?: string[];
}

const emptyForm = { key: '', value: '', description: '', is_secret: false };

export default function AgentConfigPanel({
  agentId,
  agentName,
  parentAgentId,
  parentAgentName,
  childAgentIds = [],
  childAgentNames = [],
}: AgentConfigPanelProps) {
  const [configs, setConfigs] = useState<AgentConfig[]>([]);
  const [parentConfigs, setParentConfigs] = useState<AgentConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState<string | null>(null);
  const [showInherited, setShowInherited] = useState(false);
  const [propagating, setPropagating] = useState(false);
  const [propagateMsg, setPropagateMsg] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const own = await dbGet('agent_config', `agent_id=eq.${agentId}&order=key.asc`);
      setConfigs(own || []);
      if (parentAgentId) {
        const parent = await dbGet('agent_config', `agent_id=eq.${parentAgentId}&order=key.asc`);
        setParentConfigs(parent || []);
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [agentId, parentAgentId]);

  useEffect(() => { load(); }, [load]);

  const addConfig = async () => {
    if (!form.key.trim() || !form.value.trim()) return;
    setSaving(true);
    try {
      await dbPost('agent_config', [{
        agent_id: agentId,
        key: form.key.trim(),
        value: form.value.trim(),
        description: form.description.trim(),
        is_secret: form.is_secret,
      }]);
      setForm(emptyForm);
      setShowAdd(false);
      await load();
    } catch (e: any) { console.error(e); }
    setSaving(false);
  };

  const deleteConfig = async (id: string) => {
    setDeleting(id);
    try {
      await dbDelete('agent_config', `id=eq.${id}`);
      setConfigs(prev => prev.filter(c => c.id !== id));
    } catch (e) { console.error(e); }
    setDeleting(null);
  };

  const toggleReveal = (id: string) => {
    setRevealed(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const propagateToChildren = async () => {
    if (!childAgentIds.length) return;
    setPropagating(true);
    setPropagateMsg('');
    try {
      let count = 0;
      for (const childId of childAgentIds) {
        for (const cfg of configs) {
          try {
            // Upsert: si existe actualiza, si no crea
            const existing = await dbGet('agent_config', `agent_id=eq.${childId}&key=eq.${encodeURIComponent(cfg.key)}`);
            if (existing && existing.length > 0) {
              await dbPatch('agent_config', `id=eq.${existing[0].id}`, { value: cfg.value, description: cfg.description, is_secret: cfg.is_secret });
            } else {
              await dbPost('agent_config', [{ agent_id: childId, key: cfg.key, value: cfg.value, description: cfg.description, is_secret: cfg.is_secret }]);
            }
            count++;
          } catch {}
        }
      }
      setPropagateMsg(`✓ ${count} configs propagadas a ${childAgentIds.length} especialista${childAgentIds.length > 1 ? 's' : ''}`);
      setTimeout(() => setPropagateMsg(''), 3000);
    } catch (e: any) {
      setPropagateMsg(`Error: ${e.message}`);
    }
    setPropagating(false);
  };

  const parentOnlyConfigs = parentConfigs.filter(
    pc => !configs.find(c => c.key === pc.key)
  );

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="text-xs text-gray-500 font-medium uppercase tracking-wider">Configuración</div>
        <div className="flex items-center gap-2">
          {childAgentIds.length > 0 && configs.length > 0 && (
            <button
              onClick={propagateToChildren}
              disabled={propagating}
              title={`Propagar a ${childAgentNames.join(', ')}`}
              className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 text-xs rounded-lg font-medium transition-colors disabled:opacity-40"
            >
              <Share2 size={12} />
              {propagating ? 'Propagando…' : `Propagar a especialistas (${childAgentIds.length})`}
            </button>
          )}
          <button
            onClick={() => setShowAdd(v => !v)}
            className="flex items-center gap-1.5 px-2.5 py-1 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 text-xs rounded-lg font-medium transition-colors"
          >
            <Plus size={12} />
            Añadir
          </button>
        </div>
      </div>

      {propagateMsg && (
        <div className="text-xs px-3 py-1.5 rounded-lg bg-green-500/10 text-green-400 border border-green-500/20">
          {propagateMsg}
        </div>
      )}

      {/* Add form */}
      {showAdd && (
        <div className="bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Clave</label>
              <input
                value={form.key}
                onChange={e => setForm(f => ({ ...f, key: e.target.value }))}
                placeholder="ej: google_ads_customer_id"
                className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded-lg px-2.5 py-1.5 text-xs text-gray-900 dark:text-white focus:outline-none focus:border-indigo-500/50 font-mono"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Valor</label>
              <input
                value={form.value}
                onChange={e => setForm(f => ({ ...f, value: e.target.value }))}
                placeholder="valor..."
                className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded-lg px-2.5 py-1.5 text-xs text-gray-900 dark:text-white focus:outline-none focus:border-indigo-500/50 font-mono"
              />
            </div>
          </div>
          <input
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            placeholder="Descripción (opcional)"
            className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded-lg px-2.5 py-1.5 text-xs text-gray-900 dark:text-white focus:outline-none focus:border-indigo-500/50"
          />
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer">
              <input
                type="checkbox"
                checked={form.is_secret}
                onChange={e => setForm(f => ({ ...f, is_secret: e.target.checked }))}
                className="rounded"
              />
              Secreto (ocultar valor)
            </label>
            <div className="flex gap-2">
              <button onClick={() => { setShowAdd(false); setForm(emptyForm); }} className="px-2.5 py-1 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors">
                Cancelar
              </button>
              <button
                onClick={addConfig}
                disabled={saving || !form.key.trim() || !form.value.trim()}
                className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs rounded-lg font-medium transition-colors"
              >
                {saving ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Own configs */}
      {loading ? (
        <div className="text-xs text-gray-500 py-2">Cargando...</div>
      ) : configs.length === 0 && !showAdd ? (
        <div className="text-xs text-gray-500 py-2 text-center bg-gray-100 dark:bg-white/[0.02] rounded-lg border border-dashed border-gray-200 dark:border-gray-700 py-4">
          Sin configuraciones. Añade credenciales o datos de acceso para este agente.
        </div>
      ) : (
        <div className="space-y-1.5">
          {configs.map(cfg => (
            <ConfigRow
              key={cfg.id}
              cfg={cfg}
              revealed={revealed.has(cfg.id)}
              onReveal={() => toggleReveal(cfg.id)}
              onDelete={() => deleteConfig(cfg.id)}
              deleting={deleting === cfg.id}
            />
          ))}
        </div>
      )}

      {/* Inherited configs from parent */}
      {parentAgentId && parentOnlyConfigs.length > 0 && (
        <div>
          <button
            onClick={() => setShowInherited(v => !v)}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-400 transition-colors w-full py-1"
          >
            {showInherited ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            {parentOnlyConfigs.length} config{parentOnlyConfigs.length > 1 ? 's' : ''} heredada{parentOnlyConfigs.length > 1 ? 's' : ''} de {parentAgentName}
          </button>
          {showInherited && (
            <div className="space-y-1.5 mt-1.5 opacity-60">
              {parentOnlyConfigs.map(cfg => (
                <ConfigRow
                  key={cfg.id}
                  cfg={cfg}
                  revealed={revealed.has(cfg.id + '-parent')}
                  onReveal={() => toggleReveal(cfg.id + '-parent')}
                  readonly
                  inheritedFrom={parentAgentName || 'padre'}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Config Row ─────────────────────────────────────────────────────────────
interface ConfigRowProps {
  cfg: AgentConfig;
  revealed: boolean;
  onReveal: () => void;
  onDelete?: () => void;
  deleting?: boolean;
  readonly?: boolean;
  inheritedFrom?: string;
}

function ConfigRow({ cfg, revealed, onReveal, onDelete, deleting, readonly, inheritedFrom }: ConfigRowProps) {
  const displayValue = cfg.is_secret && !revealed
    ? '••••••••••••'
    : cfg.value;

  const copyValue = () => {
    navigator.clipboard.writeText(cfg.value).catch(() => {});
  };

  return (
    <div className={`group flex items-start gap-2 px-3 py-2 rounded-lg border ${readonly
      ? 'bg-gray-100/50 dark:bg-white/[0.01] border-gray-200/50 dark:border-gray-800/50'
      : 'bg-gray-100 dark:bg-white/[0.03] border-gray-200 dark:border-gray-700/50'
    }`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-mono font-semibold text-indigo-400 dark:text-indigo-400">{cfg.key}</span>
          {cfg.is_secret && (
            <span className="text-[10px] px-1.5 py-0.5 bg-amber-500/10 text-amber-400 rounded border border-amber-500/20">secreto</span>
          )}
          {inheritedFrom && (
            <span className="text-[10px] px-1.5 py-0.5 bg-gray-500/10 text-gray-400 rounded border border-gray-500/20">
              de {inheritedFrom}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="text-xs font-mono text-gray-600 dark:text-gray-300 truncate">{displayValue}</span>
        </div>
        {cfg.description && (
          <div className="text-[10px] text-gray-400 mt-0.5 truncate">{cfg.description}</div>
        )}
      </div>
      <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        {cfg.is_secret && (
          <button onClick={onReveal} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors" title={revealed ? 'Ocultar' : 'Mostrar'}>
            {revealed ? <EyeOff size={12} /> : <Eye size={12} />}
          </button>
        )}
        <button onClick={copyValue} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors" title="Copiar valor">
          <Copy size={12} />
        </button>
        {!readonly && onDelete && (
          <button
            onClick={onDelete}
            disabled={deleting}
            className="p-1 text-red-400 hover:text-red-600 transition-colors disabled:opacity-40"
            title="Eliminar"
          >
            {deleting ? <span className="text-[10px]">...</span> : <Trash2 size={12} />}
          </button>
        )}
      </div>
    </div>
  );
}
