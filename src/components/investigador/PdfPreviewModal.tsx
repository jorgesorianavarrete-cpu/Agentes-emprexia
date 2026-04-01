// PdfPreviewModal.tsx — Modal con iframe para previsualizar documentos
import React, { useEffect } from 'react';
import { ResearchDocument, researchApi } from '../../lib/research';

interface Props {
  document: ResearchDocument;
  investigationId: string;
  onClose: () => void;
}

export default function PdfPreviewModal({ document: doc, investigationId, onClose }: Props) {
  const url = researchApi.downloadUrl(investigationId, doc.id);

  // Cerrar con Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // Bloquear scroll del body
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black/80 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Header — siempre oscuro (overlay) */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-900 border-b border-gray-700 flex-shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-lg">👁</span>
          <div>
            <p className="text-sm font-semibold text-white">{doc.label}</p>
            {doc.file_size_bytes && (
              <p className="text-xs text-gray-400">{(doc.file_size_bytes / 1024).toFixed(1)} KB</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-500/10 border border-orange-500/30 text-orange-400 hover:bg-orange-500/20 rounded-lg text-xs font-medium transition-colors"
          >
            ⬇ Descargar
          </a>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
          >
            ✕
          </button>
        </div>
      </div>
      {/* iframe */}
      <div className="flex-1 overflow-hidden">
        <iframe
          src={url}
          className="w-full h-full border-0"
          title={doc.label}
          sandbox="allow-same-origin allow-scripts"
        />
      </div>
    </div>
  );
}
