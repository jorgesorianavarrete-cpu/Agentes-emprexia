// lib/research.ts — Cliente API para el módulo Investigador
// Todas las llamadas van a la edge function research-manager

const FUNCTIONS_URL = 'https://33kfzzkq.functions.insforge.app';
const FN_BASE = `${FUNCTIONS_URL}/research-manager`;

const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3OC0xMjM0LTU2NzgtOTBhYi1jZGVmMTIzNDU2NzgiLCJlbWFpbCI6ImFub25AaW5zZm9yZ2UuY29tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1ODcxNTZ9.zsda2D_WeYeSprL99XjGhBPdUZdUOOoNdUqOTcO-_rg';

function getAuthHeader(): Record<string, string> {
  // Mismo patron que insforge.ts: emprexia_api_key o fallback a ANON_KEY
  const token = localStorage.getItem('emprexia_api_key') || ANON_KEY;
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<{ data: T | null; error: string | null }> {
  try {
    const res = await fetch(`${FN_BASE}/${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader(),
        ...(options.headers || {}),
      },
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => res.statusText);
      let errMsg = errText;
      try { errMsg = JSON.parse(errText).error || errText; } catch { /* ok */ }
      return { data: null, error: errMsg };
    }
    const data = await res.json() as T;
    return { data, error: null };
  } catch (e: unknown) {
    return { data: null, error: e instanceof Error ? e.message : 'Error de red' };
  }
}

// ─── Tipos ──────────────────────────────────────────────────────────────────

export type ResearchType = 'dropshipping' | 'productos-ia' | 'marketplace-seller' | 'infoproducto' | 'saas-micro';
export type ResearchStatus = 'queued' | 'running' | 'done' | 'error';
export type Verdict = 'go' | 'conditional' | 'no-go';
export type DocType = 'pdf_full' | 'pdf_executive' | 'pdf_brandlab' | 'pdf_action_plan' | 'json_data';
export type DocStatus = 'pending' | 'generating' | 'ready' | 'error';

export interface ResearchDocument {
  id: string;
  investigation_id: string;
  type: DocType;
  label: string;
  storage_path: string | null;
  file_size_bytes: number | null;
  mime_type: string;
  generated_at: string;
  generation_status: DocStatus;
  error_message: string | null;
  download_url?: string | null;
}

export interface Supplier {
  name?: string; nombre?: string;
  location?: string; ubicacion?: string;
  shipping_es?: string; envio_es?: string;
  integration?: string; integracion?: string;
  return_policy?: string; devolucion?: string;
}

export interface Competitor {
  rank?: number;
  name: string;
  url?: string;
  main_channel?: string;
  traffic_estimate?: string;
  strengths?: string[];
  weaknesses?: string[];
  threat_level?: 'high' | 'medium' | 'low';
  exploitable_gap?: string;
}

export interface EntryEase {
  score?: number;
  capital_barrier?: string;
  supplier_barrier?: string;
  regulatory_barrier?: string;
  brand_barrier?: string;
  price_window?: boolean;
  channel_window?: boolean;
  format_window?: boolean;
  time_to_first_sale_weeks?: number;
  time_to_beat_median_months?: number;
  narrative?: string;
}

export interface Competition {
  level?: 'low' | 'medium' | 'high';
  level_label?: string;
  level_summary?: string;
  competitors?: Competitor[];
  entry_ease?: EntryEase;
  gaps?: string[];
  conclusion?: string;
}

export interface BrandName {
  name?: string; nombre?: string;
  style?: string; estilo?: string;
  com_available?: boolean;
  es_available?: boolean;
  score?: number;
  reason?: string; razon?: string;
  handle?: string;
}

export interface BrandProposals {
  recommended?: BrandName;
  names?: BrandName[];
  digital_checklist?: string[];
}

export interface ResearchResult {
  demand_score?: number;
  return_risk_score?: number;
  net_margin_pct?: number;
  supplier_verified?: boolean;
  trend_durability?: string;
  automation_pct?: number;
  community_es?: string;
  ltv_24m?: number;
  suppliers?: Supplier[];
  competition?: Competition;
  margin?: {
    cost_breakdown?: Array<{ label?: string; concepto?: string; amount?: number; importe?: number }>;
    net_margin?: number;
    ltv_scenarios?: Array<{ scenario?: string; escenario?: string; ltv_12m?: number; ltv_24m?: number; churn_rate?: string }>;
  };
  automation?: {
    tools?: Array<{ name?: string; category?: string; cost_monthly?: number; purpose?: string }>;
    hours_per_week?: number;
    automation_pct?: number;
    flow?: string[];
  };
  marketplaces?: Array<{ channel?: string; viable?: boolean; gap?: string; strategy?: string }>;
  community?: { signals?: string[]; trend_history?: string; durability?: string };
  action_plan?: {
    week1?: string[];
    week2?: string[];
    week3_4?: string[];
    month3_4?: string[];
    initial_investment?: Array<{ label?: string; concepto?: string; amount?: number; importe?: number }>;
    total_investment?: number;
    break_even?: string;
  };
  financial_projection?: {
    monthly?: Array<{ month?: string; mes?: string; revenue?: number; ingresos?: number; costs?: number; costes?: number; profit?: number; beneficio?: number }>;
    break_even?: string;
  };
  risks?: Array<{ risk?: string; riesgo?: string; probability?: string; mitigation?: string; mitigacion?: string }>;
  brand_proposals?: BrandProposals;
}

export interface Investigation {
  id: string;
  user_id: string;
  type: ResearchType;
  name: string;
  input_params: Record<string, unknown>;
  status: ResearchStatus;
  agent_key: string | null;
  run_id: string | null;
  progress: number;
  modules_done: string[];
  result: ResearchResult | null;
  verdict: Verdict | null;
  verdict_summary: string | null;
  brand_proposals: BrandProposals | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  documents?: ResearchDocument[];
  documents_ready?: number;
  documents_total?: number;
}

export interface StartParams {
  type: ResearchType;
  name?: string;
  input_params?: Record<string, unknown>;
}

// ─── API calls ───────────────────────────────────────────────────────────────

export const researchApi = {
  start: (params: StartParams) =>
    apiFetch<{ investigation_id: string; status: string; agent_key: string | null; run_id: string | null; documents: ResearchDocument[] }>(
      'start', { method: 'POST', body: JSON.stringify(params) }
    ),

  list: (filters?: { type?: string; verdict?: string; status?: string; limit?: number; offset?: number }) => {
    const qs = new URLSearchParams();
    if (filters?.type) qs.set('type', filters.type);
    if (filters?.verdict) qs.set('verdict', filters.verdict);
    if (filters?.status) qs.set('status', filters.status);
    if (filters?.limit) qs.set('limit', String(filters.limit));
    if (filters?.offset) qs.set('offset', String(filters.offset));
    const q = qs.toString();
    return apiFetch<{ investigations: Investigation[]; total: number }>(`list${q ? '?' + q : ''}`);
  },

  get: (id: string) =>
    apiFetch<Investigation>(`get?id=${id}`),

  documents: (id: string) =>
    apiFetch<{ documents: ResearchDocument[] }>(`documents?id=${id}`),

  downloadUrl: (id: string, docId: string) =>
    `${FN_BASE}/document-download?id=${id}&docId=${docId}&token=${localStorage.getItem('insforge_token') || ''}`,

  regenerateDoc: (id: string, docId: string) =>
    apiFetch<{ ok: boolean; message: string }>('document-regenerate', { method: 'POST', body: JSON.stringify({ id, docId }) }),

  archive: (id: string) =>
    apiFetch<{ ok: boolean }>('archive', { method: 'POST', body: JSON.stringify({ id }) }),

  retry: (id: string) =>
    apiFetch<{ ok: boolean; status: string }>('retry', { method: 'POST', body: JSON.stringify({ id }) }),

  downloadAllUrl: (id: string) =>
    `${FN_BASE}/download-all?id=${id}&token=${localStorage.getItem('insforge_token') || ''}`,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

export const TYPE_META: Record<ResearchType, { label: string; icon: string; color: string; description: string; active: boolean }> = {
  'dropshipping':        { label: 'Tienda Virtual (Dropshipping)', icon: '🛒', color: '#F97316', description: 'Dropshipping con fabricantes/distribuidores directos ES/EU. Sin stock. Automatización 100%.', active: true },
  'productos-ia':        { label: 'Negocios con Productos IA',      icon: '🤖', color: '#8B5CF6', description: 'Productos digitales generados con IA. Margen ~95%, cero devoluciones, automatizable.', active: true },
  'marketplace-seller':  { label: 'Vendedor en Marketplaces',       icon: '🏪', color: '#94A3B8', description: 'Venta como seller en Amazon, Etsy, Wallapop.', active: false },
  'infoproducto':        { label: 'Infoproductos y Formación',      icon: '📚', color: '#94A3B8', description: 'Cursos, ebooks y formación online.', active: false },
  'saas-micro':          { label: 'MicroSaaS y Herramientas IA',    icon: '⚙️', color: '#94A3B8', description: 'Software como servicio y herramientas de IA.', active: false },
};

export const STATUS_META: Record<ResearchStatus, { label: string; color: string; bg: string }> = {
  queued:  { label: 'En cola',    color: '#F59E0B', bg: '#FEF9C3' },
  running: { label: 'En proceso', color: '#3B82F6', bg: '#DBEAFE' },
  done:    { label: 'Completada', color: '#16A34A', bg: '#DCFCE7' },
  error:   { label: 'Error',      color: '#DC2626', bg: '#FEE2E2' },
};

export const VERDICT_META: Record<Verdict, { label: string; color: string; bg: string; emoji: string }> = {
  'go':          { label: 'GO',          color: '#16A34A', bg: '#DCFCE7', emoji: '🟢' },
  'conditional': { label: 'CONDICIONAL', color: '#F59E0B', bg: '#FEF9C3', emoji: '🟡' },
  'no-go':       { label: 'NO GO',       color: '#DC2626', bg: '#FEE2E2', emoji: '🔴' },
};

export const MODULES_ALL = [
  { key: 'filtro-categoria',       label: 'Filtro categoría' },
  { key: 'demanda-transaccional',  label: 'Demanda transaccional' },
  { key: 'proveedor-directo',      label: 'Proveedor directo' },
  { key: 'competencia',            label: '🏆 Competencia' },
  { key: 'margen-ltv',             label: 'Margen y LTV' },
  { key: 'marketplaces',           label: 'Marketplaces' },
  { key: 'automatizacion',         label: 'Automatización' },
  { key: 'comunidad-tendencia',    label: 'Comunidad/Tendencia' },
  { key: 'brandlab',               label: 'BrandLab' },
];

export const DOC_META: Record<DocType, { label: string; icon: string; mime: string; ext: string }> = {
  pdf_full:       { label: 'Informe Completo',            icon: '📋', mime: 'text/html',        ext: '.html' },
  pdf_executive:  { label: 'Resumen Ejecutivo',           icon: '📊', mime: 'text/html',        ext: '.html' },
  pdf_brandlab:   { label: 'BrandLab — Nombres y Dominios', icon: '🏷️', mime: 'text/html',     ext: '.html' },
  pdf_action_plan:{ label: 'Plan de Acción 30 Días',      icon: '📅', mime: 'text/html',        ext: '.html' },
  json_data:      { label: 'Datos exportables (JSON)',    icon: '💾', mime: 'application/json', ext: '.json' },
};
