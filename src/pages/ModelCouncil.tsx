import { Scale, RefreshCw } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { fnCall } from '../lib/insforge';
import Modal from '../components/Modal';
import PageHeader from '../components/PageHeader';
import PageHelp from '../components/PageHelp';

const MODELS = ['claude-3-5-sonnet', 'gpt-4o', 'gemini-1.5-pro'];
const MODEL_ICONS: Record<string, string> = {
  claude: '●', gpt: '●', gemini: '●', default: '○',
};
function modelIcon(model: string) {
  const m = model?.toLowerCase() || '';
  if (m.includes('claude')) return MODEL_ICONS.claude;
  if (m.includes('gpt')) return MODEL_ICONS.gpt;
  if (m.includes('gemini')) return MODEL_ICONS.gemini;
  return MODEL_ICONS.default;
}

function fmt(d: string) {
  return new Date(d).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export default function ModelCouncil() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [selected, setSelected] = useState<any>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await fnCall('model-council');
      setSessions(data.sessions || data || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const submit = async () => {
    if (!query.trim()) return;
    setSending(true);
    setResult(null);
    try {
      const data = await fnCall('model-council', 'POST', { query: query.trim() });
      setResult(data);
      setQuery('');
      load();
    } catch (e: any) { setResult({ error: e.message }); }
    setSending(false);
  };

  return (
    <div className="p-4 sm:p-6 space-y-5">
            <PageHeader
        title="Consejo de Modelos"
        icon={Scale}
        subtitle="consulta múltiples modelos IA"
      />

      {/* Models participating */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4">
        <div className="text-xs text-gray-500 mb-3 font-medium uppercase tracking-wider">Modelos participantes</div>
        <div className="flex items-center gap-3">
          {MODELS.map(m => (
            <div key={m} className="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 rounded-lg px-3 py-2">
              <span>{modelIcon(m)}</span>
              <span className="text-xs text-gray-600 dark:text-gray-300 font-mono">{m}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Query input */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 space-y-3">
        <div className="text-xs text-gray-500 font-medium uppercase tracking-wider">Nueva consulta al consejo</div>
        <textarea
          ref={textRef}
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit(); }}
          placeholder="Escribe la pregunta que los modelos debatirán... (Cmd+Enter para enviar)"
          rows={3}
          className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500 placeholder-gray-600 resize-none"
        />
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-600">Los {MODELS.length} modelos responderán y se calculará un consenso</span>
          <button onClick={submit} disabled={sending || !query.trim()}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-lg text-sm font-medium transition-colors">
            {sending ? (
              <><svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Consultando...</>
            ) : 'Consultar'}
          </button>
        </div>
      </div>

      {/* Result */}
      {result && (
        <div className="bg-white dark:bg-gray-900 border border-indigo-500/20 rounded-xl p-5 space-y-4">
          <div className="text-xs text-indigo-400 font-medium uppercase tracking-wider flex items-center gap-2">
            Resultado del consejo
          </div>
          {result.error ? (
            <div className="text-red-400 text-sm"> {result.error}</div>
          ) : (
            <>
              {result.consensus && (
                <div className="bg-gray-100 dark:bg-gray-800 rounded-xl p-4">
                  <div className="text-xs text-gray-500 mb-2">Consenso</div>
                  <p className="text-gray-700 dark:text-gray-200 text-sm leading-relaxed whitespace-pre-wrap">{result.consensus}</p>
                </div>
              )}
              {result.responses && (
                <div className="space-y-2">
                  <div className="text-xs text-gray-500 font-medium">Respuestas individuales</div>
                  {Object.entries(result.responses).map(([model, resp]: [string, any]) => (
                    <div key={model} className="bg-gray-100 dark:bg-white/[0.04] rounded-xl p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <span>{modelIcon(model)}</span>
                        <span className="text-xs font-mono text-gray-400">{model}</span>
                      </div>
                      <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">{resp?.content || JSON.stringify(resp)}</p>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Session history */}
      <div>
        <div className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-3">Historial de consultas</div>
        {loading ? (
          <div className="flex items-center gap-3 text-gray-500 py-6">
            <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
            <span className="text-sm">Cargando historial...</span>
          </div>
        ) : (
          <div className="space-y-2">
            {sessions.map((s, i) => (
              <button key={s.id || i} onClick={() => setSelected(s)} className="w-full text-left bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 hover:border-gray-200 dark:border-gray-700 rounded-xl p-4 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-600 dark:text-gray-300 truncate">{s.query || s.prompt}</p>
                    {s.consensus && <p className="text-xs text-gray-600 mt-0.5 truncate">{s.consensus}</p>}
                  </div>
                  <div className="text-xs text-gray-600 flex-shrink-0">{s.created_at ? fmt(s.created_at) : ''}</div>
                </div>
              </button>
            ))}
            {sessions.length === 0 && <div className="py-8 text-center text-gray-600 text-sm">No hay sesiones previas</div>}
          </div>
        )}
      </div>

      <PageHelp
        summary="El Consejo de Modelos envía la misma consulta a varios modelos de IA simultáneamente (Claude, GPT-4, Gemini) y genera un consenso combinando sus respuestas. Útil para decisiones importantes o análisis que se benefician de perspectivas múltiples."
        items={[
          { icon: '🗳️', title: 'Consenso', description: 'Resumen unificado calculado a partir de las respuestas de todos los modelos participantes.' },
          { icon: '📋', title: 'Respuestas individuales', description: 'Puedes comparar qué respondió cada modelo para la misma pregunta.' },
          { icon: '⌨️', title: 'Atajo de teclado', description: 'Usa Cmd+Enter (o Ctrl+Enter) para enviar la consulta rápidamente.' },
        ]}
      />

      {/* Detail Modal */}
      <Modal open={!!selected} onClose={() => setSelected(null)} title="Sesión del Consejo" wide>
        {selected && (
          <div className="space-y-4 text-sm">
            <div className="bg-gray-100 dark:bg-white/[0.04] rounded-lg px-3 py-2.5">
              <div className="text-xs text-gray-500 mb-1">Consulta</div>
              <div className="text-gray-700 dark:text-gray-200">{selected.query || selected.prompt}</div>
            </div>
            {selected.consensus && (
              <div className="bg-gray-100 dark:bg-gray-800 rounded-xl p-4">
                <div className="text-xs text-gray-500 mb-2">Consenso</div>
                <p className="text-gray-700 dark:text-gray-200 whitespace-pre-wrap leading-relaxed">{selected.consensus}</p>
              </div>
            )}
            {selected.responses && (
              <div>
                <div className="text-xs text-gray-500 mb-2 font-medium uppercase tracking-wider">Respuestas</div>
                <pre className="bg-gray-100 dark:bg-gray-800 rounded-xl p-4 text-xs text-gray-600 dark:text-gray-300 whitespace-pre-wrap max-h-64 overflow-y-auto">{JSON.stringify(selected.responses, null, 2)}</pre>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
