import { GitBranch, RefreshCw } from 'lucide-react';
import { useState, useEffect } from 'react';
import { dbGet, fnCall } from '../lib/insforge';
import { Approval, Agent } from '../lib/types';
import StatusBadge from '../components/StatusBadge';
import Modal from '../components/Modal';
import PageHeader from '../components/PageHeader';
import PageHelp from '../components/PageHelp';

const FILTER_LABELS: Record<string, string> = {
  all: 'Todas',
  pending: 'Pendientes',
  approved: 'Aprobadas',
  rejected: 'Rechazadas',
};

function fmt(d: string) {
  return new Date(d).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}



export default function Approvals() {
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [agents, setAgents] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Approval | null>(null);
  const [filter, setFilter] = useState('pending');
  const [msg, setMsg] = useState('');
  const [processing, setProcessing] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const params = filter === 'all' ? 'select=*&order=created_at.desc&limit=100' : `select=*&status=eq.${filter}&order=created_at.desc&limit=100`;
      const [ap, a] = await Promise.all([
        dbGet('approvals', params),
        dbGet('agents', 'select=id,name'),
      ]);
      setApprovals(ap);
      const map: Record<string, string> = {};
      a.forEach((ag: Agent) => { map[ag.id] = ag.name; });
      setAgents(map);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { load(); }, [filter]);

  const decide = async (approval: Approval, decision: 'approved' | 'rejected') => {
    setProcessing(approval.id);
    try {
      await fnCall('approval-decision', 'POST', { approval_id: approval.id, decision });
      setMsg(` ${decision === 'approved' ? 'Aprobado' : 'Rechazado'}`);
      setTimeout(() => setMsg(''), 3000);
      setSelected(null);
      load();
    } catch (e: any) { setMsg(`Error:  ${e.message}`); }
    setProcessing('');
  };

  const statusCounts = approvals.reduce((acc: Record<string, number>, a) => {
    acc[a.status] = (acc[a.status] || 0) + 1;
    return acc;
  }, {});

  const agentName = (id: string) => agents[id] || id?.slice(0, 8) + '…';

  return (
    <div className="p-4 sm:p-6 space-y-5">
            <PageHeader
        title="Aprobaciones"
        icon={GitBranch}
        badge={approvals.length}
        subtitle="pendientes de revisión"
        actions={
          <button onClick={load} className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-gray-500 dark:text-slate-400 bg-white dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] hover:border-gray-300 dark:hover:border-white/[0.12] transition-all">
            <RefreshCw size={14} />
            Actualizar
          </button>
        }
      />

      {/* Pending alert */}
      {(statusCounts['pending'] || 0) > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3 flex items-center gap-3">
          <span className="text-xl">⏳</span>
          <span className="text-sm text-amber-300 font-medium">{statusCounts['pending']} solicitudes esperan tu aprobación</span>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-1.5">
        {['pending', 'all', 'approved', 'rejected'].map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filter === s ? 'bg-indigo-500/15 text-indigo-400' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 hover:text-gray-600 dark:text-gray-300'}`}>
            {FILTER_LABELS[s] ?? s}
            {s !== 'all' && statusCounts[s] ? <span className="ml-1.5 opacity-60">{statusCounts[s]}</span> : null}
          </button>
        ))}
      </div>

      {/* Approval list */}
      {loading ? (
        <div className="flex items-center gap-3 text-gray-500 py-8">
          <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
          <span className="text-sm">Cargando aprobaciones...</span>
        </div>
      ) : (
        <div className="space-y-2">
          {approvals.map(a => (
            <div key={a.id} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-gray-900 dark:text-white truncate">{a.action_type}</div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {agentName(a.agent_id)} · {fmt(a.created_at)}
                    </div>
                  </div>
                </div>
                <StatusBadge status={a.status} />
              </div>
              {a.status === 'pending' && (
                <div className="flex gap-2 pt-1">
                  <button onClick={() => setSelected(a)}
                    className="flex-1 py-1.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-lg text-xs font-medium transition-colors">
                    Ver detalle
                  </button>
                  <button onClick={() => decide(a, 'approved')} disabled={!!processing}
                    className="flex-1 py-1.5 bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-400 rounded-lg text-xs font-medium transition-colors disabled:opacity-50">
                    {processing === a.id ? '...' : 'Aprobar'}
                  </button>
                  <button onClick={() => decide(a, 'rejected')} disabled={!!processing}
                    className="flex-1 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-xs font-medium transition-colors disabled:opacity-50">
                    {processing === a.id ? '...' : 'Rechazar'}
                  </button>
                </div>
              )}
              {a.status !== 'pending' && (
                <button onClick={() => setSelected(a)} className="text-xs text-gray-600 hover:text-gray-400 transition-colors">
                  Ver detalle →
                </button>
              )}
            </div>
          ))}
          {approvals.length === 0 && <div className="py-12 text-center text-gray-600 text-sm">No hay aprobaciones</div>}
        </div>
      )}

      {msg && (
        <div className="fixed bottom-6 right-6 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm text-gray-700 dark:text-gray-200 shadow-xl z-50">
          {msg}
        </div>
      )}

      <PageHelp
        summary="Las aprobaciones son solicitudes que los agentes generan cuando necesitan confirmación humana antes de ejecutar una acción sensible (enviar un email, hacer un pago, borrar datos, etc.)."
        items={[
          { icon: '⏳', title: 'Pendientes', description: 'Solicitudes que esperan tu decisión. Revisa el detalle y aprueba o rechaza.' },
          { icon: '✅', title: 'Aprobadas', description: 'El agente recibió luz verde y ejecutó la acción.' },
          { icon: '❌', title: 'Rechazadas', description: 'La acción fue bloqueada. El agente registra el rechazo y puede intentar una alternativa.' },
        ]}
      />

      {/* Detail Modal */}
      <Modal open={!!selected} onClose={() => setSelected(null)} title="Solicitud de aprobación" wide>
        {selected && (
          <div className="space-y-4 text-sm">
            <div className="bg-gray-50 dark:bg-white/[0.04] rounded-xl p-4 flex items-start gap-3">
              <div className="px-2 py-1 rounded-md bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 text-xs font-mono mr-1">{selected.action_type}</div>
              <div>
                <div className="font-medium text-gray-900 dark:text-white">{selected.action_type}</div>
                <div className="text-xs text-gray-500 mt-1">Agente: {agentName(selected.agent_id)}</div>
                <div className="mt-1.5"><StatusBadge status={selected.status} /></div>
              </div>
            </div>
            {selected.action_payload && (
              <div>
                <div className="text-xs text-gray-500 mb-2 font-medium uppercase tracking-wider">Parámetros</div>
                <pre className="bg-gray-100 dark:bg-gray-800 rounded-xl p-4 text-xs text-gray-600 dark:text-gray-300 whitespace-pre-wrap max-h-48 overflow-y-auto">{JSON.stringify(selected.action_payload, null, 2)}</pre>
              </div>
            )}
            {selected.status === 'pending' && (
              <div className="flex gap-3 pt-1">
                <button onClick={() => decide(selected, 'rejected')} disabled={!!processing}
                  className="flex-1 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-sm font-medium transition-colors">
                  Rechazar
                </button>
                <button onClick={() => decide(selected, 'approved')} disabled={!!processing}
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-colors">
                  Aprobar
                </button>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
