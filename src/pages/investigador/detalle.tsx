// pages/investigador/detalle.tsx — /investigador/:id — Progreso + Ficha
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { researchApi, Investigation } from '../../lib/research';
import ProgressCard from '../../components/investigador/ProgressCard';
import ResultCard from '../../components/investigador/ResultCard';

const POLL_STATUS_MS = 3000;
const POLL_DOCS_MS = 5000;

export default function InvestigadorDetalle() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [investigation, setInvestigation] = useState<Investigation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    const { data, error: err } = await researchApi.get(id);
    if (err) {
      setError(err);
      setLoading(false);
      return;
    }
    setInvestigation(data);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!investigation) return;
    const isActive = investigation.status === 'queued' || investigation.status === 'running';
    const hasDocsGenerating = investigation.documents?.some(d => d.generation_status === 'pending' || d.generation_status === 'generating');

    if (isActive || hasDocsGenerating) {
      const interval = isActive ? POLL_STATUS_MS : POLL_DOCS_MS;
      pollRef.current = setInterval(load, interval);
    } else {
      if (pollRef.current) clearInterval(pollRef.current);
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [investigation, load]);

  const handleArchive = async () => {
    if (!id || !window.confirm('¿Archivar esta investigación? Desaparecerá del listado.')) return;
    await researchApi.archive(id);
    navigate('/investigador');
  };

  const handleRetry = async () => {
    if (!id) return;
    await researchApi.retry(id);
    await load();
  };

  if (loading && !investigation) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-500 dark:text-slate-400">
        <svg className="animate-spin w-6 h-6 mr-3 text-orange-500" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        Cargando investigación…
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700/40 rounded-xl text-red-600 dark:text-red-400 text-sm">
          ⚠️ {error}
          <button onClick={load} className="ml-3 underline hover:no-underline">Reintentar</button>
        </div>
      </div>
    );
  }

  if (!investigation) return null;

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-slate-400 mb-4">
        <a href="/investigador" className="hover:text-gray-900 dark:hover:text-white transition-colors">🔍 Investigador</a>
        <span>›</span>
        <span className="text-gray-700 dark:text-slate-300 truncate max-w-[200px]">{investigation.name}</span>
      </div>

      {/* Vista según estado */}
      {investigation.status === 'done' ? (
        <ResultCard
          investigation={investigation}
          onArchive={handleArchive}
          onRetry={handleRetry}
          onDocumentsChange={load}
        />
      ) : (
        <>
          <ProgressCard investigation={investigation} />
          {investigation.status === 'error' && (
            <div className="mt-4 flex gap-3">
              <button
                onClick={handleRetry}
                className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl text-sm transition-colors"
              >
                🔁 Relanzar investigación
              </button>
              <button
                onClick={handleArchive}
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-300 hover:text-red-500 hover:border-red-300 dark:hover:text-red-400 dark:hover:border-red-700/50 rounded-xl text-sm transition-colors"
              >
                🗑️ Archivar
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
