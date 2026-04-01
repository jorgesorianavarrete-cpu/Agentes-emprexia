import { BookOpen, RefreshCw, Plus, Upload, Trash2, FileText, Search, X, ChevronDown, ChevronUp } from 'lucide-react';
import { useState, useEffect, useRef, useCallback } from 'react';
import { fnCall, dbGet } from '../lib/insforge';
import * as mammoth from 'mammoth';
import * as pdfjsLib from 'pdfjs-dist';
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();
import { KnowledgeChunk } from '../lib/types';
import Modal from '../components/Modal';
import PageHeader from '../components/PageHeader';
import PageHelp from '../components/PageHelp';

function fmt(d: string) {
  return new Date(d).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function countWords(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/** Split text into chunks of ~maxWords words, respecting paragraph breaks */
function chunkText(text: string, maxWords = 600): string[] {
  const paragraphs = text.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
  const chunks: string[] = [];
  let current = '';
  let currentWords = 0;

  for (const para of paragraphs) {
    const paraWords = countWords(para);
    if (currentWords + paraWords > maxWords && current) {
      chunks.push(current.trim());
      current = para;
      currentWords = paraWords;
    } else {
      current = current ? current + '\n\n' + para : para;
      currentWords += paraWords;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks.length ? chunks : [text.trim()];
}

interface DocGroup {
  sourceName: string;
  chunks: KnowledgeChunk[];
  expanded: boolean;
}

export default function KnowledgeBase() {
  const [chunks, setChunks] = useState<KnowledgeChunk[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<KnowledgeChunk | null>(null);
  const [msg, setMsg] = useState('');

  // Manual create
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ content: '', source_type: 'manual', source_name: '' });
  const [saving, setSaving] = useState(false);

  // File upload
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [uploadAgentId, setUploadAgentId] = useState('');
  const [uploadFileName, setUploadFileName] = useState('');
  const [uploadContent, setUploadContent] = useState('');
  const [agents, setAgents] = useState<{ id: string; name: string }[]>([]);

  // Grouping
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = async (query?: string) => {
    setLoading(true);
    try {
      const params = query ? `query=${encodeURIComponent(query)}` : '';
      const data = await fnCall('knowledge-base', 'GET', undefined, params);
      setChunks(data.chunks || data || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const loadAgents = async () => {
    try {
      const data = await dbGet('agents', 'select=id,name&order=level.asc,name.asc');
      setAgents(Array.isArray(data) ? data : []);
    } catch {}
  };

  useEffect(() => { load(); loadAgents(); }, []);

  /* ── Grouping by source_name ── */
  const groups: DocGroup[] = (() => {
    const map: Record<string, KnowledgeChunk[]> = {};
    for (const c of chunks) {
      const key = c.source_name || '(sin nombre)';
      if (!map[key]) map[key] = [];
      map[key].push(c);
    }
    return Object.entries(map).map(([sourceName, cks]) => ({
      sourceName,
      chunks: cks,
      expanded: expanded[sourceName] ?? true,
    }));
  })();

  const toggleGroup = (name: string) => {
    setExpanded(prev => ({ ...prev, [name]: !(prev[name] ?? true) }));
  };

  /* ── Delete ── */
  const deleteChunk = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('¿Eliminar este fragmento?')) return;
    try {
      await fnCall('knowledge-base', 'DELETE', undefined, `id=${id}`);
      setChunks(prev => prev.filter(c => c.id !== id));
      if (selected?.id === id) setSelected(null);
    } catch (err: any) { alert('Error: ' + err.message); }
  };

  const deleteGroup = async (sourceName: string) => {
    if (!confirm(`¿Eliminar todos los fragmentos de "${sourceName}"?`)) return;
    const toDelete = chunks.filter(c => (c.source_name || '(sin nombre)') === sourceName);
    try {
      await Promise.all(toDelete.map(c => fnCall('knowledge-base', 'DELETE', undefined, `id=${c.id}`)));
      setChunks(prev => prev.filter(c => (c.source_name || '(sin nombre)') !== sourceName));
    } catch (err: any) { alert('Error: ' + err.message); }
  };

  /* ── Manual create ── */
  const create = async () => {
    if (!form.content) return;
    setSaving(true);
    try {
      await fnCall('knowledge-base', 'POST', form);
      setMsg('Fragmento añadido ✓');
      setTimeout(() => { setShowCreate(false); setMsg(''); }, 1200);
      setForm({ content: '', source_type: 'manual', source_name: '' });
      load();
    } catch (e: any) { setMsg(`Error: ${e.message}`); }
    setSaving(false);
  };

  /* ── File reading ── */
  const readFileAsText = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => resolve(e.target?.result as string);
      reader.onerror = reject;
      reader.readAsText(file, 'UTF-8');
    });
  };

  const readFileAsArrayBuffer = (file: File): Promise<ArrayBuffer> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => resolve(e.target?.result as ArrayBuffer);
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  };

  const extractPdf = async (file: File): Promise<string> => {
    const buffer = await readFileAsArrayBuffer(file);
    const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
    const texts: string[] = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items.map((item: any) => item.str).join(' ');
      texts.push(pageText);
    }
    return texts.join('\n\n');
  };

  const extractDocx = async (file: File): Promise<string> => {
    const buffer = await readFileAsArrayBuffer(file);
    const result = await mammoth.extractRawText({ arrayBuffer: buffer });
    return result.value;
  };

  const handleFile = async (file: File) => {
    const allowed = ['.txt', '.md', '.csv', '.json', '.pdf', '.docx', '.doc'];
    const ext = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
    if (!allowed.includes(ext)) {
      alert(`Formato no soportado. Sube: .txt, .md, .csv, .json, .pdf, .docx`);
      return;
    }
    setShowUpload(true);
    setUploadFileName(file.name);
    setUploadContent('');
    setUploadProgress('Leyendo archivo...');
    try {
      let text = '';
      if (ext === '.pdf') {
        text = await extractPdf(file);
      } else if (ext === '.docx' || ext === '.doc') {
        text = await extractDocx(file);
      } else {
        text = await readFileAsText(file);
      }
      setUploadContent(text);
      setUploadProgress('');
    } catch (e: any) {
      setUploadProgress(`Error extrayendo texto: ${e.message}`);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, []);

  /* ── Upload (chunk + save) ── */
  const doUpload = async () => {
    if (!uploadContent) return;
    setUploading(true);
    const agentName = agents.find(a => a.id === uploadAgentId)?.name || '';
    const sourceName = agentName ? `${agentName} | ${uploadFileName}` : uploadFileName;
    const chunks = chunkText(uploadContent);

    try {
      setUploadProgress(`Dividiendo en ${chunks.length} fragmentos...`);
      const items = chunks.map((content, i) => ({
        content,
        source_type: 'file',
        source_name: sourceName,
        file_key: uploadFileName,
      }));

      // Upload in batches of 10
      let uploaded = 0;
      for (let i = 0; i < items.length; i += 10) {
        const batch = items.slice(i, i + 10);
        await fnCall('knowledge-base', 'POST', batch);
        uploaded += batch.length;
        setUploadProgress(`Subiendo... ${uploaded}/${items.length}`);
      }

      setUploadProgress(`✓ ${chunks.length} fragmentos subidos`);
      setTimeout(() => {
        setShowUpload(false);
        setUploadContent('');
        setUploadFileName('');
        setUploadAgentId('');
        setUploadProgress('');
        load();
      }, 1500);
    } catch (err: any) {
      setUploadProgress(`Error: ${err.message}`);
    }
    setUploading(false);
  };

  const previewChunks = uploadContent ? chunkText(uploadContent) : [];

  /* ── render ── */
  return (
    <div className="p-4 sm:p-6 space-y-5">
      <PageHeader
        title="Base de conocimiento"
        icon={BookOpen}
        badge={chunks.length}
        subtitle="fragmentos indexados"
        actions={
          <>
            <button onClick={() => load()} className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-gray-500 dark:text-slate-400 bg-white dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] hover:border-gray-300 dark:hover:border-white/[0.12] transition-all">
              <RefreshCw size={14} />
            </button>
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 px-3.5 py-2 bg-white dark:bg-white/[0.04] text-gray-700 dark:text-slate-300 border border-gray-200 dark:border-white/[0.08] hover:border-gray-300 dark:hover:border-white/[0.12] rounded-lg text-sm font-medium transition-colors"
            >
              <Plus size={15} />
              Texto
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <Upload size={15} />
              Subir documento
            </button>
            <input ref={fileInputRef} type="file" accept=".txt,.md,.csv,.json,.pdf,.docx,.doc" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }} />
          </>
        }
      />

      {/* Drop zone hint */}
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-xl py-5 text-center text-sm transition-colors cursor-pointer ${
          dragOver
            ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-500'
            : 'border-gray-200 dark:border-slate-700 text-gray-400 dark:text-slate-500 hover:border-gray-300 dark:hover:border-slate-600'
        }`}
        onClick={() => fileInputRef.current?.click()}
      >
        <Upload size={18} className="mx-auto mb-1.5 opacity-60" />
        Arrastra un archivo aquí o haz clic para seleccionarlo
        <span className="block text-xs mt-0.5 opacity-70">.pdf · .docx · .txt · .md · .csv · .json</span>
      </div>

      {/* Search */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500" size={14} />
          <input
            type="text" placeholder="Buscar fragmentos..." value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && load(search || undefined)}
            className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-gray-200 placeholder-gray-400 dark:placeholder-slate-500 rounded-lg pl-9 pr-3 py-2 text-sm focus:border-indigo-500 outline-none"
          />
        </div>
        <button onClick={() => load(search || undefined)} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-colors">
          Buscar
        </button>
        {search && (
          <button onClick={() => { setSearch(''); load(); }} className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 transition-colors">
            <X size={15} />
          </button>
        )}
      </div>

      {/* Groups */}
      {loading ? (
        <div className="flex items-center gap-3 text-gray-500 py-8">
          <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
          <span className="text-sm">Cargando...</span>
        </div>
      ) : groups.length === 0 ? (
        <div className="py-16 text-center text-gray-400 dark:text-slate-500">
          <BookOpen size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">No hay fragmentos. Sube un documento para empezar.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map(g => {
            const isOpen = expanded[g.sourceName] ?? true;
            const totalTokens = g.chunks.reduce((s, c) => s + (c.tokens_count || 0), 0);
            return (
              <div key={g.sourceName} className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl overflow-hidden">
                {/* Group header */}
                <div
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
                  onClick={() => toggleGroup(g.sourceName)}
                >
                  <FileText size={16} className="text-indigo-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm text-gray-900 dark:text-slate-100 truncate">{g.sourceName}</div>
                    <div className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">
                      {g.chunks.length} fragmentos · ~{totalTokens.toLocaleString()} tokens
                    </div>
                  </div>
                  <button
                    onClick={e => { e.stopPropagation(); deleteGroup(g.sourceName); }}
                    className="p-1.5 rounded-lg text-gray-300 dark:text-slate-600 hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors flex-shrink-0"
                    title="Eliminar documento completo"
                  >
                    <Trash2 size={14} />
                  </button>
                  {isOpen ? <ChevronUp size={15} className="text-gray-400 flex-shrink-0" /> : <ChevronDown size={15} className="text-gray-400 flex-shrink-0" />}
                </div>

                {/* Chunks list */}
                {isOpen && (
                  <div className="border-t border-gray-100 dark:border-slate-800 divide-y divide-gray-100 dark:divide-slate-800">
                    {g.chunks.map((c, idx) => (
                      <div
                        key={c.id}
                        className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors cursor-pointer group"
                        onClick={() => setSelected(c)}
                      >
                        <span className="text-xs font-mono text-gray-300 dark:text-slate-600 mt-0.5 flex-shrink-0 w-5 text-right">{idx + 1}</span>
                        <p className="flex-1 text-sm text-gray-600 dark:text-slate-300 line-clamp-2 leading-relaxed">{c.content}</p>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-[10px] text-gray-400 dark:text-slate-500 hidden sm:block">{fmt(c.created_at)}</span>
                          <button
                            onClick={e => deleteChunk(c.id, e)}
                            className="p-1 rounded text-gray-200 dark:text-slate-700 hover:text-red-400 group-hover:text-gray-300 dark:group-hover:text-slate-500 transition-colors opacity-0 group-hover:opacity-100"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Upload modal ── */}
      <Modal open={showUpload} onClose={() => { if (!uploading) { setShowUpload(false); setUploadContent(''); setUploadFileName(''); setUploadAgentId(''); setUploadProgress(''); } }} title="Subir documento" wide>
        <div className="space-y-4">
          {/* File info */}
          {uploadFileName && (
            <div className="flex items-center gap-2.5 bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 rounded-xl px-4 py-3">
              <FileText size={16} className="text-indigo-500 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-indigo-700 dark:text-indigo-300 truncate">{uploadFileName}</div>
                <div className="text-xs text-indigo-500 dark:text-indigo-400 mt-0.5">
                  {uploadContent.length.toLocaleString()} caracteres · {countWords(uploadContent).toLocaleString()} palabras · {previewChunks.length} fragmentos al subir
                </div>
              </div>
            </div>
          )}

          {/* Agent selector */}
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1.5">Asignar a agente (opcional)</label>
            <select
              value={uploadAgentId}
              onChange={e => setUploadAgentId(e.target.value)}
              className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500"
            >
              <option value="">— Conocimiento global (sin agente específico) —</option>
              {agents.map(a => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">El nombre del agente se prefija al nombre del documento para identificar a quién pertenece.</p>
          </div>

          {/* Preview chunks */}
          {previewChunks.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1.5">
                Vista previa de fragmentos ({previewChunks.length})
              </label>
              <div className="border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden max-h-52 overflow-y-auto divide-y divide-gray-100 dark:divide-slate-700">
                {previewChunks.slice(0, 5).map((chunk, i) => (
                  <div key={i} className="px-3 py-2.5">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-[10px] font-mono text-indigo-400">#{i + 1}</span>
                      <span className="text-[10px] text-gray-400 dark:text-slate-500">{countWords(chunk)} palabras</span>
                    </div>
                    <p className="text-xs text-gray-600 dark:text-slate-300 line-clamp-2">{chunk}</p>
                  </div>
                ))}
                {previewChunks.length > 5 && (
                  <div className="px-3 py-2 text-xs text-center text-gray-400 dark:text-slate-500 bg-gray-50 dark:bg-slate-800">
                    + {previewChunks.length - 5} fragmentos más
                  </div>
                )}
              </div>
            </div>
          )}

          {uploadProgress && (
            <div className={`text-sm text-center py-2 font-medium ${uploadProgress.startsWith('✓') ? 'text-emerald-500' : uploadProgress.startsWith('Error') ? 'text-red-400' : 'text-indigo-400'}`}>
              {uploadProgress}
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => { setShowUpload(false); setUploadContent(''); setUploadFileName(''); setUploadAgentId(''); setUploadProgress(''); }}
              disabled={uploading}
              className="flex-1 py-2.5 border border-gray-200 dark:border-slate-700 text-gray-500 dark:text-slate-400 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-40"
            >
              Cancelar
            </button>
            <button
              onClick={doUpload}
              disabled={uploading || !uploadContent}
              className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
            >
              {uploading ? (
                <><svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Subiendo...</>
              ) : (
                <><Upload size={15} />Subir {previewChunks.length} fragmentos</>
              )}
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Manual create modal ── */}
      <Modal open={showCreate} onClose={() => { setShowCreate(false); setMsg(''); }} title="Añadir fragmento manual">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1.5">Contenido</label>
            <textarea value={form.content} onChange={e => setForm({ ...form, content: e.target.value })}
              rows={7} placeholder="Escribe o pega el contenido que quieres indexar..."
              className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500 placeholder-gray-400 dark:placeholder-slate-500 resize-none" />
            {form.content && <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">{countWords(form.content)} palabras · ~{Math.ceil(form.content.length / 4)} tokens</p>}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1.5">Asignar a agente (opcional)</label>
            <select
              value={form.source_name}
              onChange={e => setForm({ ...form, source_name: e.target.value, source_type: e.target.value ? 'manual' : 'manual' })}
              className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500"
            >
              <option value="">— Sin agente —</option>
              {agents.map(a => (
                <option key={a.id} value={a.name}>{a.name}</option>
              ))}
            </select>
          </div>
          {msg && <div className={`text-sm text-center py-1 font-medium ${msg.startsWith('Error') ? 'text-red-400' : 'text-emerald-500'}`}>{msg}</div>}
          <button onClick={create} disabled={saving || !form.content}
            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-lg text-sm font-medium transition-colors">
            {saving ? 'Guardando...' : 'Guardar fragmento'}
          </button>
        </div>
      </Modal>

      {/* ── Detail modal ── */}
      <Modal open={!!selected} onClose={() => setSelected(null)} title="Fragmento de conocimiento" wide>
        {selected && (
          <div className="space-y-4 text-sm">
            <div className="flex items-center gap-2 flex-wrap">
              {selected.source_name && <span className="bg-indigo-50 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 px-2.5 py-1 rounded-full text-xs font-medium">{selected.source_name}</span>}
              <span className="bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400 px-2.5 py-1 rounded-full text-xs">{selected.source_type}</span>
              <span className="ml-auto text-gray-400 dark:text-slate-500 text-xs">{fmt(selected.created_at)}</span>
            </div>
            <div className="bg-gray-50 dark:bg-slate-800 rounded-xl p-4 max-h-80 overflow-y-auto">
              <p className="text-gray-700 dark:text-gray-200 whitespace-pre-wrap text-sm leading-relaxed">{selected.content}</p>
            </div>
            <div className="flex items-center justify-between">
              {(selected.tokens_count ?? 0) > 0 && (
                <span className="text-xs text-gray-400 dark:text-slate-500 font-mono">~{selected.tokens_count} tokens</span>
              )}
              <button
                onClick={e => { deleteChunk(selected.id, e); setSelected(null); }}
                className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-500 transition-colors ml-auto"
              >
                <Trash2 size={13} /> Eliminar fragmento
              </button>
            </div>
          </div>
        )}
      </Modal>

      <PageHelp
        summary="La base de conocimiento almacena información que los agentes pueden consultar para responder mejor: documentos de empresa, procedimientos, FAQs, datos de productos, etc. Los fragmentos se indexan semánticamente para búsqueda por significado."
        items={[
          { icon: '📄', title: 'Subir documento', description: 'Sube archivos PDF, Word (.docx), texto o CSV. El sistema extrae el texto y lo divide en fragmentos indexables.' },
          { icon: '✏️', title: 'Texto manual', description: 'También puedes añadir fragmentos escribiendo directamente el contenido y asignándole un título.' },
          { icon: '🔍', title: 'Búsqueda semántica', description: 'Busca por significado, no sólo por palabras exactas. El sistema encontrará los fragmentos más relevantes.' },
          { icon: '🏷️', title: 'Fuente', description: 'Cada fragmento recuerda de qué documento o fuente proviene para facilitar su gestión.' },
        ]}
      />
    </div>
  );
}
