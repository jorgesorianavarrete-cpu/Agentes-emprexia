// DocumentsPanel.tsx — Panel de documentos con descarga y previsualización
import React, { useState } from 'react';
import { ResearchDocument, DOC_META, DocStatus, researchApi } from '../../lib/research';
import PdfPreviewModal from './PdfPreviewModal';

interface Props {
  investigationId: string;
  documents: ResearchDocument[];
  investigationName: string;
  onRegenerate?: (docId: string) => void;
}

function StatusPill({ status }: { status: DocStatus }) {
  const map: Record<DocStatus, { label: string; color: string; bg: string }> = {
    pending:    { label: 'Pendiente',   color: '#B45309', bg: '#FEF9C3' },
    generating: { label: 'Generando…', color: '#2563EB', bg: '#DBEAFE' },
    ready:      { label: 'Listo',       color: '#16A34A', bg: '#DCFCE7' },
    error:      { label: 'Error',       color: '#DC2626', bg: '#FEE2E2' },
  };
  const m = map[status];
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold" style={{ color: m.color, background: m.bg }}>
      {status === 'generating' && (
        <svg className="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {status === 'ready' && '✅'}
      {m.label}
    </span>
  );
}

export default function DocumentsPanel({ investigationId, documents, investigationName, onRegenerate }: Props) {
  const [previewDoc, setPreviewDoc] = useState<ResearchDocument | null>(null);
  const [regenerating, setRegenerating] = useState<Set<string>>(new Set());

  const handleRegenerate = async (doc: ResearchDocument) => {
    setRegenerating(prev => new Set(prev).add(doc.id));
    await researchApi.regenerateDoc(investigationId, doc.id);
    onRegenerate?.(doc.id);
    setTimeout(() => setRegenerating(prev => { const n = new Set(prev); n.delete(doc.id); return n; }), 2000);
  };

  const handleDownloadAll = () => {
    const url = researchApi.downloadAllUrl(investigationId);
    window.open(url, '_blank');
  };

  const readyCount = documents.filter(d => d.generation_status === 'ready').length;

  return (
    <>
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">📄 Documentos Generados</h3>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">{readyCount}/{documents.length} listos</p>
          </div>
          {readyCount > 0 && (
            <button
              onClick={handleDownloadAll}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 border border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-300 hover:text-gray-900 dark:hover:text-white rounded-lg text-xs font-medium transition-all"
            >
              📥 Descargar todo (.zip)
            </button>
          )}
        </div>

        {/* Documents list */}
        <div className="divide-y divide-gray-100 dark:divide-slate-700/50 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
          {documents.map(doc => {
            const meta = DOC_META[doc.type] || { label: doc.label, icon: '📄', ext: '' };
            const isReady = doc.generation_status === 'ready';
            const isError = doc.generation_status === 'error';
            const isRegen = regenerating.has(doc.id);
            const downloadUrl = researchApi.downloadUrl(investigationId, doc.id);

            return (
              <div key={doc.id} className="flex flex-wrap items-center gap-3 px-4 py-3 bg-white dark:bg-slate-800/40 hover:bg-gray-50 dark:hover:bg-slate-800/60 transition-colors">
                {/* Icon + label */}
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="text-lg flex-shrink-0">{meta.icon}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{doc.label}</p>
                    {doc.file_size_bytes && (
                      <p className="text-xs text-gray-400 dark:text-slate-500">{(doc.file_size_bytes / 1024).toFixed(1)} KB</p>
                    )}
                  </div>
                </div>

                {/* Status */}
                <StatusPill status={doc.generation_status} />

                {/* Actions */}
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {isReady && (
                    <>
                      <a
                        href={downloadUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 px-2.5 py-1 bg-orange-50 dark:bg-orange-500/10 border border-orange-200 dark:border-orange-500/30 text-orange-600 dark:text-orange-400 hover:bg-orange-100 dark:hover:bg-orange-500/20 rounded-lg text-xs font-medium transition-colors"
                      >
                        ⬇ Descargar
                      </a>
                      <button
                        onClick={() => setPreviewDoc(doc)}
                        className="flex items-center gap-1 px-2.5 py-1 bg-gray-100 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-slate-600 rounded-lg text-xs font-medium transition-colors"
                      >
                        👁 Ver
                      </button>
                    </>
                  )}
                  {isError && (
                    <button
                      onClick={() => handleRegenerate(doc)}
                      disabled={isRegen}
                      className="flex items-center gap-1 px-2.5 py-1 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700/30 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                    >
                      {isRegen ? '…' : '🔄 Regenerar'}
                    </button>
                  )}
                  {isError && doc.error_message && (
                    <span className="text-xs text-red-500 dark:text-red-400 truncate max-w-[150px]" title={doc.error_message}>
                      ⚠️ {doc.error_message}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Preview Modal */}
      {previewDoc && (
        <PdfPreviewModal
          document={previewDoc}
          investigationId={investigationId}
          onClose={() => setPreviewDoc(null)}
        />
      )}
    </>
  );
}
