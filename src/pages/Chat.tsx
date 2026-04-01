import { useState, useEffect, useRef, useMemo } from 'react';
import { fnCall, dbGet } from '../lib/insforge';
import { Agent, ChatMessage } from '../lib/types';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Send, Loader2, AlertCircle, MessageCircle, RefreshCw,
  Plus, Clock, ChevronLeft, X, CalendarDays, Paperclip,
} from 'lucide-react';
import AreaBadge from '../components/AreaBadge';
import PageHelp from '../components/PageHelp';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';

// PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

const STATUS_DOT: Record<string, string> = {
  active:  'bg-emerald-500',
  paused:  'bg-amber-500',
  error:   'bg-red-500',
  idle:    'bg-gray-400',
};

interface ConvGroup {
  date: string;          // "dd/mm/yyyy"
  label: string;         // "Hoy", "Ayer", "Lun 18 feb"...
  firstUserMsg: string;
  count: number;
  startedAt: string;     // ISO for sorting
}

function formatGroupDate(dateStr: string): string {
  // dateStr is "dd/mm/yyyy" from toLocaleDateString('es-ES')
  const [d, m, y] = dateStr.split('/').map(Number);
  const date = new Date(y, m - 1, d);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  const thisWeek = new Date(today); thisWeek.setDate(today.getDate() - 6);

  if (date >= today) return 'Hoy';
  if (date >= yesterday) return 'Ayer';
  if (date >= thisWeek) {
    return date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' });
  }
  return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Split text into ~maxWords-word chunks, respecting paragraph breaks */
/* ── Extractors ── */
async function extractPdf(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    pages.push(content.items.map((item: any) => item.str).join(' '));
  }
  return pages.join('\n\n');
}

async function extractDocx(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value;
}

function extractXlsx(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const lines: string[] = [];
        workbook.SheetNames.forEach(sheetName => {
          lines.push(`=== Hoja: ${sheetName} ===`);
          const sheet = workbook.Sheets[sheetName];
          const csv = XLSX.utils.sheet_to_csv(sheet);
          lines.push(csv);
        });
        resolve(lines.join('\n\n'));
      } catch (err) { reject(err); }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

async function extractText(file: File): Promise<string> {
  const ext = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
  if (ext === '.pdf') return extractPdf(file);
  if (ext === '.docx') return extractDocx(file);
  if (['.xlsx', '.xls', '.ods'].includes(ext)) return extractXlsx(file);
  return file.text(); // txt, md, csv, json
}

function chunkText(text: string, maxWords = 600): string[] {
  const paragraphs = text.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
  const chunks: string[] = [];
  let current = '';
  let currentWords = 0;
  for (const para of paragraphs) {
    const words = para.trim().split(/\s+/).filter(Boolean).length;
    if (currentWords + words > maxWords && current) {
      chunks.push(current.trim());
      current = para;
      currentWords = words;
    } else {
      current = current ? current + '\n\n' + para : para;
      currentWords += words;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks.length ? chunks : [text.trim()];
}

export default function Chat() {
  const { agentId } = useParams();
  const navigate = useNavigate();

  // Agent list
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loadingAgents, setLoadingAgents] = useState(true);
  const [agentError, setAgentError] = useState('');
  const [selectedId, setSelectedId] = useState(agentId || '');
  const [search, setSearch] = useState('');

  // Messages (rawMessages = all from DB, messages = filtered view)
  const [rawMessages, setRawMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [meta, setMeta] = useState<any>(null);

  // History / new-chat state
  const [showHistory, setShowHistory] = useState(false);
  const [historyDate, setHistoryDate] = useState<string | null>(null); // "dd/mm/yyyy"
  const [newChatSince, setNewChatSince] = useState<string | null>(null); // ISO timestamp
  const [refreshing, setRefreshing] = useState(false);

  // File upload
  const [uploadingFile, setUploadingFile] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);
  const prevRawLenRef = useRef(0);

  /* ── Scroll helpers ── */
  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    bottomRef.current?.scrollIntoView({ behavior });
  };

  // Track whether the user is near the bottom of the chat
  const handleScroll = () => {
    const el = chatContainerRef.current;
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    isAtBottomRef.current = scrollHeight - scrollTop - clientHeight < 80;
  };

  /* ── data loaders ── */
  const loadAgents = async () => {
    setLoadingAgents(true);
    setAgentError('');
    try {
      const a = await dbGet('agents', 'select=id,name,area,level,status,role,parent_agent_id&order=level.asc,name.asc');
      setAgents(Array.isArray(a) ? a : []);
    } catch (e: any) {
      setAgentError(e.message);
    } finally {
      setLoadingAgents(false);
    }
  };

  const loadMessages = async (aid: string) => {
    if (!aid) { setRawMessages([]); return; }
    try {
      const data = await dbGet('chat_messages', `agent_id=eq.${aid}&order=created_at.asc&limit=500`);
      setRawMessages(Array.isArray(data) ? data : []);
    } catch { setRawMessages([]); }
  };

  useEffect(() => { loadAgents(); }, []);
  useEffect(() => { if (agentId) setSelectedId(agentId); }, [agentId]);

  // Reset everything when agent changes
  useEffect(() => {
    setRawMessages([]);
    setHistoryDate(null);
    setNewChatSince(null);
    setShowHistory(false);
    setMeta(null);
    prevRawLenRef.current = 0;
    isAtBottomRef.current = true;
    loadMessages(selectedId);
  }, [selectedId]);

  // Smart auto-scroll: only when new messages arrive AND user was at bottom
  useEffect(() => {
    const newLen = rawMessages.length;
    if (newLen > prevRawLenRef.current && isAtBottomRef.current) {
      scrollToBottom('smooth');
    }
    prevRawLenRef.current = newLen;
  }, [rawMessages]);

  // When switching to history date: scroll to top (read from beginning)
  // When switching to new chat or clearing filter: scroll to bottom
  useEffect(() => {
    if (historyDate) {
      chatContainerRef.current?.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    } else {
      scrollToBottom('instant');
    }
  }, [historyDate]);

  useEffect(() => {
    scrollToBottom('instant');
  }, [newChatSince]);

  // Auto-refresh every 5s
  useEffect(() => {
    if (!selectedId) return;
    const interval = setInterval(() => loadMessages(selectedId), 5000);
    return () => clearInterval(interval);
  }, [selectedId]);

  useEffect(() => {
    if (selectedId) inputRef.current?.focus();
  }, [selectedId]);

  /* ── derived: conversation groups for history panel ── */
  const convGroups = useMemo<ConvGroup[]>(() => {
    const groups: Record<string, { msgs: ChatMessage[]; firstUserMsg: string }> = {};
    for (const m of rawMessages) {
      const d = new Date(m.created_at).toLocaleDateString('es-ES', {
        day: '2-digit', month: '2-digit', year: 'numeric',
      });
      if (!groups[d]) groups[d] = { msgs: [], firstUserMsg: '' };
      groups[d].msgs.push(m);
      if (!groups[d].firstUserMsg && m.role === 'user') {
        groups[d].firstUserMsg = m.content;
      }
    }
    return Object.entries(groups)
      .map(([date, { msgs, firstUserMsg }]) => ({
        date,
        label: formatGroupDate(date),
        firstUserMsg: firstUserMsg || msgs[0]?.content || '(sin mensaje)',
        count: msgs.length,
        startedAt: msgs[0]?.created_at || '',
      }))
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
  }, [rawMessages]);

  /* ── derived: filtered messages to display ── */
  const messages = useMemo(() => {
    if (historyDate) {
      return rawMessages.filter(m => {
        const d = new Date(m.created_at).toLocaleDateString('es-ES', {
          day: '2-digit', month: '2-digit', year: 'numeric',
        });
        return d === historyDate;
      });
    }
    if (newChatSince) {
      return rawMessages.filter(m => m.created_at >= newChatSince);
    }
    return rawMessages;
  }, [rawMessages, historyDate, newChatSince]);

  /* ── actions ── */
  const selectAgent = (id: string) => {
    setSelectedId(id);
    navigate(`/chat/${id}`, { replace: true });
  };

  const manualRefresh = async () => {
    if (!selectedId || refreshing) return;
    setRefreshing(true);
    await loadMessages(selectedId);
    setTimeout(() => setRefreshing(false), 600);
  };

  const startNewChat = () => {
    setNewChatSince(new Date().toISOString());
    setHistoryDate(null);
    setShowHistory(false);
    setMeta(null);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const selectHistoryDate = (date: string) => {
    setHistoryDate(date);
    setNewChatSince(null);
    setShowHistory(false);
  };

  const backToCurrent = () => {
    setHistoryDate(null);
    // newChatSince preserved so user returns to their new chat
  };

  const send = async () => {
    if (!input.trim() || !selectedId || historyDate) return;
    const userMsg = input;
    setInput('');
    setSending(true);
    const now = new Date().toISOString();
    const tempId = 'tmp-' + Date.now();
    // Force scroll to bottom when user sends a message
    isAtBottomRef.current = true;
    setRawMessages(prev => [...prev, {
      id: tempId, agent_id: selectedId, role: 'user', content: userMsg,
      tokens_used: 0, cost_eur: 0, model: '', created_at: now,
    }]);
    try {
      const res = await fnCall('chat-proxy', 'POST', { agent_id: selectedId, message: userMsg, save_user_message: true });
      isAtBottomRef.current = true;
      setRawMessages(prev => [
        ...prev.filter(m => m.id !== tempId),
        { id: 'u-' + Date.now(), agent_id: selectedId, role: 'user', content: userMsg, tokens_used: 0, cost_eur: 0, model: '', created_at: now },
        { id: res.message_id || 'a-' + Date.now(), agent_id: selectedId, role: 'assistant', content: res.reply, tokens_used: res.tokens_used || 0, cost_eur: res.cost_eur || 0, model: res.model || '', created_at: new Date().toISOString() },
      ]);
      setMeta({ tokens: res.tokens_used, cost: res.cost_eur, model: res.model, latency: res.latencyMs, rag: res.rag_chunks_used });
    } catch (e: any) {
      isAtBottomRef.current = true;
      setRawMessages(prev => [
        ...prev.filter(m => m.id !== tempId),
        { id: 'u-' + Date.now(), agent_id: selectedId, role: 'user', content: userMsg, tokens_used: 0, cost_eur: 0, model: '', created_at: now },
        { id: 'err-' + Date.now(), agent_id: selectedId, role: 'assistant', content: `Error: ${e.message}`, tokens_used: 0, cost_eur: 0, model: '', created_at: new Date().toISOString() },
      ]);
    }
    setSending(false);
    inputRef.current?.focus();
  };

  /* ── File upload to knowledge base ── */
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedId) return;
    e.target.value = '';

    const allowed = ['.txt', '.md', '.csv', '.json', '.pdf', '.docx', '.xlsx', '.xls', '.ods'];
    const ext = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
    if (!allowed.includes(ext)) {
      alert(`Formato no soportado. Usa: ${allowed.join(', ')}`);
      return;
    }

    setUploadingFile(true);
    isAtBottomRef.current = true;

    // Show upload-start notice in chat
    const now = new Date().toISOString();
    const agentName = selected?.name || 'Agente';
    const noticeId = 'upload-start-' + Date.now();
    setRawMessages(prev => [...prev, {
      id: noticeId,
      agent_id: selectedId,
      role: 'assistant',
      content: `📎 Extrayendo texto de **${file.name}**...`,
      tokens_used: 0, cost_eur: 0, model: '', created_at: now,
    }]);

    try {
      const text = await extractText(file);
      const chunks = chunkText(text);
      const sourceName = `${agentName} | ${file.name}`;

      const items = chunks.map((content) => ({
        content,
        source_type: 'file',
        source_name: sourceName,
        file_key: file.name,
      }));

      // Upload in batches of 10
      for (let i = 0; i < items.length; i += 10) {
        await fnCall('knowledge-base', 'POST', items.slice(i, i + 10));
      }

      // Replace notice with success message
      setRawMessages(prev => prev.map(m =>
        m.id === noticeId
          ? {
              ...m,
              content: `✅ **${file.name}** añadido al conocimiento de ${agentName}.\n\n• **${chunks.length} fragmento${chunks.length !== 1 ? 's' : ''}** indexados\n• El agente ya puede consultar este documento via RAG`,
            }
          : m
      ));
    } catch (err: any) {
      setRawMessages(prev => prev.map(m =>
        m.id === noticeId
          ? { ...m, content: `❌ Error al subir **${file.name}**: ${err.message}` }
          : m
      ));
    }

    setUploadingFile(false);
  };

  /* ── derived ── */
  const selected = agents.find(a => a.id === selectedId);
  const matchSearch = (a: Agent) =>
    !search ||
    a.name.toLowerCase().includes(search.toLowerCase()) ||
    a.area?.toLowerCase().includes(search.toLowerCase());

  const directors  = agents.filter(a => a.level === 0 && matchSearch(a));
  const managers   = agents.filter(a => a.level === 1);
  const specialists = agents.filter(a => a.level === 2);

  // Managers visible: those that match search OR have a matching specialist
  const visibleManagers = managers.filter(m =>
    matchSearch(m) || specialists.some(s => s.parent_agent_id === m.id && matchSearch(s))
  );

  const isViewingHistory = !!historyDate;
  const isNewChat = !historyDate && !!newChatSince;
  const selectedGroup = convGroups.find(g => g.date === historyDate);

  /* ── render ── */
  return (
    <div className="flex h-full bg-gray-50 dark:bg-slate-950">

      {/* ── Agent sidebar ── */}
      <div className="w-64 flex-shrink-0 flex flex-col bg-white dark:bg-slate-900 border-r border-gray-200 dark:border-slate-800">

        {/* Search */}
        <div className="p-3 border-b border-gray-200 dark:border-slate-800">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar agente..."
              className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg pl-8 pr-3 py-2 text-sm text-gray-900 dark:text-slate-200 placeholder-gray-400 dark:placeholder-slate-500 focus:border-indigo-500 dark:focus:border-indigo-400 outline-none"
            />
          </div>
        </div>

        {/* Agent list */}
        <div className="flex-1 overflow-y-auto">
          {loadingAgents && (
            <div className="flex items-center gap-2 text-gray-400 dark:text-slate-500 text-sm p-4">
              <Loader2 size={14} className="animate-spin" />
              <span>Cargando...</span>
            </div>
          )}

          {!loadingAgents && agentError && (
            <div className="p-4 space-y-2">
              <div className="flex items-start gap-2 text-red-500 dark:text-red-400 text-xs">
                <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
                <span>{agentError}</span>
              </div>
              <button onClick={loadAgents} className="flex items-center gap-1.5 text-xs text-indigo-600 dark:text-indigo-400 hover:underline">
                <RefreshCw size={11} /> Reintentar
              </button>
            </div>
          )}

          {!loadingAgents && !agentError && (() => {
            const totalVisible = directors.length + visibleManagers.length;
            if (totalVisible === 0) return (
              <p className="text-sm text-gray-400 dark:text-slate-500 text-center py-8">Sin resultados</p>
            );

            return (
              <>
                {/* ── Sección Dirección ── */}
                {directors.length > 0 && (
                  <div>
                    <div className="px-3 pt-3 pb-1 flex items-center gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-amber-500 dark:text-amber-400">Dirección</span>
                      <div className="flex-1 h-px bg-amber-200 dark:bg-amber-500/20" />
                    </div>
                    {directors.map(a => {
                      const isSel = selectedId === a.id;
                      return (
                        <button
                          key={a.id}
                          onClick={() => selectAgent(a.id)}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                            isSel
                              ? 'bg-amber-50 dark:bg-amber-500/10 border-r-2 border-amber-500 dark:border-amber-400'
                              : 'hover:bg-gray-50 dark:hover:bg-slate-800'
                          }`}
                        >
                          <div className="relative flex-shrink-0">
                            <AreaBadge area={a.area} size="md" icon={a.icon} color={a.color} />
                            <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-slate-900 ${STATUS_DOT[a.status] || 'bg-gray-400'}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className={`text-sm font-semibold truncate ${isSel ? 'text-amber-600 dark:text-amber-400' : 'text-gray-900 dark:text-slate-200'}`}>
                              {a.name}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-slate-500 truncate capitalize">{a.area}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* ── Sección Managers ── */}
                {visibleManagers.length > 0 && (
                  <div>
                    <div className="px-3 pt-4 pb-1 flex items-center gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-blue-500 dark:text-blue-400">Managers</span>
                      <div className="flex-1 h-px bg-blue-200 dark:bg-blue-500/20" />
                    </div>
                    {visibleManagers.map(m => {
                      const isMgrSel = selectedId === m.id;
                      const mySpecialists = specialists.filter(s =>
                        s.parent_agent_id === m.id && matchSearch(s)
                      );
                      // show specialists even if manager doesn't match search (but has matching specialist)
                      const showSpecs = mySpecialists.length > 0;

                      return (
                        <div key={m.id}>
                          {/* Manager row */}
                          <button
                            onClick={() => selectAgent(m.id)}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                              isMgrSel
                                ? 'bg-blue-50 dark:bg-blue-500/10 border-r-2 border-blue-500 dark:border-blue-400'
                                : 'hover:bg-gray-50 dark:hover:bg-slate-800'
                            }`}
                          >
                            <div className="relative flex-shrink-0">
                              <AreaBadge area={m.area} size="md" icon={m.icon} color={m.color} />
                              <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-slate-900 ${STATUS_DOT[m.status] || 'bg-gray-400'}`} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className={`text-sm font-medium truncate ${isMgrSel ? 'text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-slate-200'}`}>
                                {m.name}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-slate-500 truncate capitalize">{m.area}</div>
                            </div>
                            {showSpecs && (
                              <span className="text-[10px] text-gray-400 dark:text-slate-600 flex-shrink-0">{mySpecialists.length}</span>
                            )}
                          </button>

                          {/* Specialists indented */}
                          {showSpecs && mySpecialists.map(s => {
                            const isSel = selectedId === s.id;
                            return (
                              <button
                                key={s.id}
                                onClick={() => selectAgent(s.id)}
                                className={`w-full flex items-center gap-2.5 text-left transition-colors ${
                                  isSel
                                    ? 'bg-indigo-50 dark:bg-indigo-500/10 border-r-2 border-indigo-500 dark:border-indigo-400'
                                    : 'hover:bg-gray-50 dark:hover:bg-slate-800'
                                }`}
                              >
                                {/* connector line */}
                                <div className="pl-5 flex items-center gap-2.5 flex-1 min-w-0 pr-3 py-2">
                                  <div className="flex-shrink-0 flex items-start self-stretch pt-2.5">
                                    <div className="w-3 h-3 border-l border-b border-gray-300 dark:border-slate-700 rounded-bl-sm" />
                                  </div>
                                  <div className="relative flex-shrink-0">
                                    <div className="w-5 h-5 rounded-md bg-gray-100 dark:bg-slate-800 flex items-center justify-center text-[10px]">
                                      🧑‍💼
                                    </div>
                                    <div className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-white dark:border-slate-900 ${STATUS_DOT[s.status] || 'bg-gray-400'}`} />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className={`text-xs font-medium truncate ${isSel ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-700 dark:text-slate-400'}`}>
                                      {s.client_name || s.name}
                                    </div>
                                    <div className="text-[10px] text-gray-400 dark:text-slate-600 truncate">{s.name}</div>
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            );
          })()}
        </div>

        {agents.length > 0 && (
          <div className="px-4 py-2.5 border-t border-gray-200 dark:border-slate-800 text-xs text-gray-400 dark:text-slate-500 text-center">
            {agents.filter(a => a.status === 'active').length} / {agents.length} activos
          </div>
        )}
      </div>

      {/* ── Main chat + history ── */}
      <div className="flex-1 flex min-w-0">

        {/* Chat column */}
        <div className="flex-1 flex flex-col min-w-0">

          {/* Chat header */}
          <div className="px-4 py-3.5 border-b border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center gap-3">
            {selected ? (
              <>
                {/* Back button when viewing history */}
                {isViewingHistory && (
                  <button
                    onClick={backToCurrent}
                    title="Volver al chat actual"
                    className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-500 dark:text-slate-400 flex-shrink-0 transition-colors"
                  >
                    <ChevronLeft size={16} />
                  </button>
                )}

                <AreaBadge area={selected.area} size="md" />

                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-gray-900 dark:text-white text-sm truncate">{selected.name}</div>
                  <div className="text-xs text-gray-500 dark:text-slate-400 capitalize truncate">
                    {isViewingHistory
                      ? `Historial · ${selectedGroup?.label ?? historyDate}`
                      : isNewChat
                        ? 'Nuevo chat'
                        : selected.area}
                  </div>
                </div>

                {/* Meta badges */}
                {meta && !isViewingHistory && (
                  <div className="hidden sm:flex gap-1.5 text-xs flex-shrink-0">
                    {meta.model && <span className="px-1.5 py-1 rounded bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400">{meta.model.split('/').pop()}</span>}
                    {meta.tokens > 0 && <span className="px-1.5 py-1 rounded bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400">{meta.tokens}t</span>}
                    {meta.cost != null && <span className="px-1.5 py-1 rounded bg-indigo-50 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-400">{meta.cost?.toFixed(2)}€</span>}
                  </div>
                )}

                {/* Refresh button */}
                <button
                  onClick={manualRefresh}
                  title="Actualizar mensajes"
                  disabled={refreshing}
                  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-400 dark:text-slate-500 transition-colors flex-shrink-0 disabled:opacity-50"
                >
                  <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
                </button>

                {/* Historial toggle */}
                <button
                  onClick={() => setShowHistory(h => !h)}
                  title={showHistory ? 'Cerrar historial' : 'Ver historial'}
                  className={`p-2 rounded-lg transition-colors flex-shrink-0 ${
                    showHistory
                      ? 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400'
                      : 'hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-400 dark:text-slate-500'
                  }`}
                >
                  <Clock size={16} />
                </button>

                {/* Nuevo chat */}
                <button
                  onClick={startNewChat}
                  title="Nuevo chat"
                  className={`p-2 rounded-lg transition-colors flex-shrink-0 ${
                    isNewChat && !isViewingHistory
                      ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                      : 'hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-400 dark:text-slate-500'
                  }`}
                >
                  <Plus size={16} />
                </button>
              </>
            ) : (
              <p className="text-sm text-gray-400 dark:text-slate-500">Selecciona un agente del panel izquierdo</p>
            )}
          </div>

          {/* Messages area */}
          <div
            ref={chatContainerRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto p-5 space-y-4"
          >
            {!selectedId && (
              <div className="flex flex-col items-center justify-center h-full gap-4 text-gray-400 dark:text-slate-500">
                <MessageCircle size={48} strokeWidth={1.5} />
                <div className="text-center">
                  <div className="font-medium text-gray-600 dark:text-slate-300 mb-1">Chat con Agentes</div>
                  <div className="text-sm">Elige un agente del panel izquierdo para empezar</div>
                </div>
              </div>
            )}

            {/* New chat empty state */}
            {selectedId && isNewChat && messages.length === 0 && !sending && (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-400 dark:text-slate-500">
                <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center">
                  <Plus size={22} className="text-emerald-500 dark:text-emerald-400" />
                </div>
                <div className="text-center">
                  <div className="font-medium text-gray-600 dark:text-slate-300">Nuevo chat iniciado</div>
                  <div className="text-sm mt-1">Escribe tu primer mensaje a {selected?.name}</div>
                </div>
              </div>
            )}

            {/* History empty state */}
            {selectedId && isViewingHistory && messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-400 dark:text-slate-500">
                <CalendarDays size={40} strokeWidth={1.5} />
                <div className="text-center">
                  <div className="font-medium text-gray-600 dark:text-slate-300">Sin mensajes</div>
                  <div className="text-sm mt-1">No hay mensajes para esta fecha</div>
                </div>
              </div>
            )}

            {/* Default empty (no new chat, no history filter) */}
            {selectedId && !isNewChat && !isViewingHistory && messages.length === 0 && !sending && (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-400 dark:text-slate-500">
                <AreaBadge area={selected?.area || ''} size="lg" />
                <div className="text-center">
                  <div className="font-medium text-gray-600 dark:text-slate-300">{selected?.name}</div>
                  <div className="text-sm mt-1">Escribe un mensaje para empezar</div>
                </div>
              </div>
            )}

            {/* History banner */}
            {isViewingHistory && messages.length > 0 && (
              <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-slate-500 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-xl px-4 py-2.5">
                <CalendarDays size={13} className="flex-shrink-0 text-amber-500 dark:text-amber-400" />
                <span className="text-amber-700 dark:text-amber-300 font-medium">
                  Historial del {selectedGroup?.label ?? historyDate} · {messages.length} mensajes
                </span>
                <button
                  onClick={backToCurrent}
                  className="ml-auto flex items-center gap-1 text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 font-medium transition-colors"
                >
                  Volver al actual <X size={11} />
                </button>
              </div>
            )}

            {/* Messages */}
            {messages.map((m, i) => (
              <div key={m.id || i} className={`flex gap-3 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-semibold ${
                  m.role === 'user'
                    ? 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400'
                    : 'bg-gray-200 dark:bg-slate-700 text-gray-500 dark:text-slate-400'
                }`}>
                  {m.role === 'user' ? 'TÚ' : 'IA'}
                </div>
                <div className={`max-w-[72%] flex flex-col gap-1 ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                  <div className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                    m.role === 'user'
                      ? 'bg-indigo-600 text-white rounded-tr-sm'
                      : 'bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 rounded-tl-sm border border-gray-100 dark:border-slate-700'
                  }`}>
                    {m.role === 'user' ? (
                      <div className="whitespace-pre-wrap break-words">{m.content}</div>
                    ) : (
                      <div className="prose prose-sm dark:prose-invert max-w-none
                        prose-p:my-1 prose-p:leading-relaxed
                        prose-headings:font-semibold prose-headings:mt-3 prose-headings:mb-1
                        prose-h1:text-base prose-h2:text-sm prose-h3:text-sm
                        prose-ul:my-1 prose-ul:pl-4 prose-ol:my-1 prose-ol:pl-4
                        prose-li:my-0.5
                        prose-code:text-xs prose-code:bg-gray-100 dark:prose-code:bg-slate-700 prose-code:px-1 prose-code:py-0.5 prose-code:rounded
                        prose-pre:bg-gray-100 dark:prose-pre:bg-slate-700 prose-pre:rounded-lg prose-pre:p-3 prose-pre:text-xs prose-pre:overflow-x-auto
                        prose-strong:font-semibold
                        prose-hr:my-2 prose-hr:border-gray-200 dark:prose-hr:border-slate-600
                        prose-blockquote:border-l-2 prose-blockquote:border-gray-300 dark:prose-blockquote:border-slate-500 prose-blockquote:pl-3 prose-blockquote:italic prose-blockquote:text-gray-500 dark:prose-blockquote:text-slate-400
                        prose-table:text-xs prose-th:font-semibold prose-th:p-1 prose-td:p-1">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-gray-400 dark:text-slate-500 px-1">
                    <span>{new Date(m.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</span>
                    {m.role === 'assistant' && m.tokens_used > 0 && (
                      <><span>·</span><span>{m.tokens_used} tok</span><span>·</span><span>{m.cost_eur?.toFixed(2)}€</span></>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {/* Typing indicator */}
            {sending && (
              <div className="flex gap-3">
                <div className="w-7 h-7 rounded-lg bg-gray-200 dark:bg-slate-700 flex items-center justify-center text-[11px] font-semibold text-gray-500 dark:text-slate-400">IA</div>
                <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-2xl rounded-tl-sm px-4 py-3">
                  <div className="flex gap-1.5">
                    {[0, 150, 300].map((d, k) => (
                      <div key={k} className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: `${d}ms` }} />
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="p-4 border-t border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900">
            {isViewingHistory ? (
              /* Read-only notice when in history mode */
              <div className="flex items-center justify-center gap-2 py-2 text-sm text-amber-600 dark:text-amber-400">
                <CalendarDays size={14} />
                <span>Modo historial — </span>
                <button onClick={backToCurrent} className="underline font-medium hover:text-amber-700 dark:hover:text-amber-300 transition-colors">
                  volver al chat actual
                </button>
              </div>
            ) : (
              <div className="flex gap-2 items-center">
                {/* Hidden file input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt,.md,.csv,.json,.pdf,.docx,.xlsx,.xls,.ods"
                  onChange={handleFileUpload}
                  className="hidden"
                />

                {/* File upload button */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={!selectedId || uploadingFile || sending}
                  title="Subir documento al agente (.txt, .md, .csv, .json)"
                  className="h-[46px] w-[46px] flex-shrink-0 flex items-center justify-center border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800 disabled:opacity-40 text-gray-400 dark:text-slate-500 hover:text-indigo-500 dark:hover:text-indigo-400 rounded-xl transition-all"
                >
                  {uploadingFile
                    ? <Loader2 size={16} className="animate-spin text-indigo-500" />
                    : <Paperclip size={16} />
                  }
                </button>

                <input
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
                  disabled={!selectedId || sending}
                  placeholder={selectedId ? `Mensaje a ${selected?.name || 'agente'}...` : 'Selecciona un agente primero'}
                  className="flex-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-slate-100 disabled:opacity-50 placeholder-gray-400 dark:placeholder-slate-500 focus:border-indigo-500 dark:focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 dark:focus:ring-indigo-400/20 outline-none transition-all"
                />
                <button
                  onClick={send}
                  disabled={!selectedId || sending || !input.trim()}
                  className="h-[46px] px-5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-xl text-sm font-medium transition-all flex items-center gap-2 flex-shrink-0"
                >
                  {sending ? <Loader2 size={15} className="animate-spin" /> : <><Send size={14} /><span>Enviar</span></>}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── History panel (slide-in from right) ── */}
        {showHistory && selectedId && (
          <div className="w-72 flex-shrink-0 flex flex-col bg-white dark:bg-slate-900 border-l border-gray-200 dark:border-slate-800">
            {/* History header */}
            <div className="px-4 py-3.5 border-b border-gray-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <div className="font-semibold text-sm text-gray-900 dark:text-white">Historial</div>
                <div className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">
                  {convGroups.length} {convGroups.length === 1 ? 'día' : 'días'} con mensajes
                </div>
              </div>
              <button
                onClick={() => setShowHistory(false)}
                className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-400 dark:text-slate-500 transition-colors"
              >
                <X size={15} />
              </button>
            </div>

            {/* Conversation list */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {/* "Current chat" / "All messages" option */}
              <button
                onClick={() => { setHistoryDate(null); setNewChatSince(null); setShowHistory(false); }}
                className={`w-full text-left px-3 py-3 rounded-xl transition-colors border ${
                  !historyDate && !newChatSince
                    ? 'bg-indigo-50 dark:bg-indigo-500/10 border-indigo-200 dark:border-indigo-500/30'
                    : 'border-transparent hover:bg-gray-50 dark:hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center gap-2 mb-0.5">
                  <MessageCircle size={12} className={!historyDate && !newChatSince ? 'text-indigo-500' : 'text-gray-400 dark:text-slate-500'} />
                  <span className={`text-xs font-semibold ${!historyDate && !newChatSince ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-600 dark:text-slate-300'}`}>
                    Todo el historial
                  </span>
                </div>
                <div className="text-xs text-gray-400 dark:text-slate-500 truncate ml-[20px]">
                  {rawMessages.length} mensajes en total
                </div>
              </button>

              {convGroups.length === 0 && (
                <div className="text-center text-xs text-gray-400 dark:text-slate-500 py-8">
                  <CalendarDays size={28} className="mx-auto mb-2 opacity-40" />
                  Sin historial disponible
                </div>
              )}

              {convGroups.map(g => (
                <button
                  key={g.date}
                  onClick={() => selectHistoryDate(g.date)}
                  className={`w-full text-left px-3 py-3 rounded-xl transition-colors border ${
                    historyDate === g.date
                      ? 'bg-indigo-50 dark:bg-indigo-500/10 border-indigo-200 dark:border-indigo-500/30'
                      : 'border-transparent hover:bg-gray-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-xs font-semibold ${
                      historyDate === g.date
                        ? 'text-indigo-600 dark:text-indigo-400'
                        : 'text-gray-600 dark:text-slate-300'
                    }`}>
                      {g.label}
                    </span>
                    <span className="text-[10px] text-gray-400 dark:text-slate-500 bg-gray-100 dark:bg-slate-700 px-1.5 py-0.5 rounded-full flex-shrink-0">
                      {g.count}
                    </span>
                  </div>
                  <div className="text-xs text-gray-400 dark:text-slate-500 truncate leading-relaxed">
                    {g.firstUserMsg}
                  </div>
                </button>
              ))}
            </div>

            {/* New chat CTA at bottom */}
            <div className="p-3 border-t border-gray-200 dark:border-slate-800">
              <button
                onClick={startNewChat}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors"
              >
                <Plus size={15} />
                Nuevo chat
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="px-4 pb-6">
        <PageHelp
          summary="El chat te permite hablar directamente con cualquier agente del sistema. Puedes darle instrucciones, hacerle preguntas, adjuntar archivos y revisar el historial de conversaciones anteriores."
          items={[
            { icon: '📎', title: 'Adjuntar archivos', description: 'Sube PDFs, documentos Word, Excel, imágenes o texto para que el agente los analice.' },
            { icon: '🕐', title: 'Historial', description: 'Cada agente conserva el historial de sus conversaciones. Puedes retomar una conversación anterior o crear un chat nuevo.' },
            { icon: '📅', title: 'Programar tarea', description: 'Desde el chat puedes crear una tarea programada que el agente ejecutará automáticamente.' },
            { icon: '🔀', title: 'Cambiar de agente', description: 'Usa el panel lateral para seleccionar con qué agente quieres hablar.' },
          ]}
        />
      </div>
    </div>
  );
}
