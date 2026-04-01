
import PageHeader from '../components/PageHeader';
import PageHelp from '../components/PageHelp';
import { useState, useEffect, useCallback } from 'react';
import { dbGet, dbPost, dbPatch, dbDelete, fnCall, SITE_URL, FUNCTIONS_URL } from '../lib/insforge';
import { sha256, getPassHash, PASS_HASH_KEY, clearSession } from '../components/LoginScreen';
import StatusBadge from '../components/StatusBadge';
import Modal from '../components/Modal';

type Tab = 'conexion' | 'agentes' | 'funciones' | 'modelos' | 'salud' | 'tenant' | 'usuarios' | 'mantenimiento' | 'seguridad' | 'skills' | 'backup' | 'openclaw';

interface ConfigEntry {
  id: string;
  key: string;
  value: string;
  updated_at: string;
}

interface Agent {
  id: string;
  name: string;
  role: string;
  model_id: string;
  status: string;
  area: string;
  level: 0 | 1 | 2;
  cost_used_today_eur: number;
  tokens_used_today: number;
  parent_agent_id?: string;
}

interface TenantMember {
  id: string;
  user_id: string;
  role: string;
  created_at: string;
}

interface TenantApiKey {
  id: string;
  key_name: string;
  service: string;
  key_value: string;
  created_at: string;
}

interface AllowedUser {
  id: string;
  email: string;
  role: string;
  status: string;
  created_at: string;
}

// ─── Skill types ────────────────────────────────────────────────────────────────
// SkillCatalogEntry → viene de skills_catalog (sincronizado desde OpenClaw)
interface SkillCatalogEntry {
  skill_id: string;
  name: string;
  description: string;
  source: string;            // 'openclaw-bundled' | 'openclaw-workspace'
  ready: boolean;
  blocked_reasons: string[];
  workspace_enabled: boolean;
  last_seen_at: string;
}

// AgentSkillOverride → viene de agent_skill_overrides
interface AgentSkillOverride {
  id: string;
  agent_id: string;
  skill_id: string;
  allowed: boolean;
}

// SkillDef → registro LOCAL de skills que necesitan configuración en agent_config (API skills)
interface SkillDef {
  id: string;
  triggerKey: string;
  requiredKeys: string[];
  optionalKeys: Record<string, string>;
}

// API Skills: las que además de estar en OpenClaw necesitan config en agent_config
const SKILL_REGISTRY: SkillDef[] = [
  {
    id: 'google-ads',
    triggerKey: 'google_ads_connection_id',
    requiredKeys: ['google_ads_connection_id'],
    optionalKeys: {
      'google_ads_customer_mobiocasion': 'Customer ID Mobiocasión (1655815573)',
      'google_ads_customer_id': 'Customer ID genérico',
    },
  },
];

interface AgentConfigEntry {
  id: string;
  agent_id: string;
  key: string;
  value: string;
  description: string;
  is_secret: boolean;
}

const CONFIG_META: Record<string, { label: string; desc: string; type: 'text' | 'password' | 'bool' | 'number'; group: string }> = {
  BACKUP_ENABLED: { label: 'Backups activos', desc: 'Habilitar copias de seguridad automáticas', type: 'bool', group: 'backup' },
  BACKUP_TARGET: { label: 'Destino de backup', desc: 'dropbox, gdrive, o both', type: 'text', group: 'backup' },
  BACKUP_RETENTION_DAYS: { label: 'Retención (días)', desc: 'Días que se conservan los backups', type: 'number', group: 'backup' },
  DROPBOX_TOKEN: { label: 'Dropbox Access Token', desc: 'Token de acceso de Dropbox', type: 'password', group: 'backup' },
  GDRIVE_TOKEN: { label: 'Google Drive Token', desc: 'Token OAuth de Google Drive', type: 'password', group: 'backup' },
  GDRIVE_FOLDER_ID: { label: 'Google Drive Folder ID', desc: 'ID de la carpeta destino en Google Drive', type: 'text', group: 'backup' },
  OPENCLAW_VPS_HOST: { label: 'IP / Host del servidor', desc: 'Dirección IP o hostname del VPS donde corre OpenClaw', type: 'text', group: 'openclaw' },
  OPENCLAW_VPS_PORT: { label: 'Puerto del servidor', desc: 'Puerto donde escucha el servidor OpenClaw (por defecto 9001)', type: 'text', group: 'openclaw' },
  OPENCLAW_BACKUP_TOKEN: { label: 'Token de acceso', desc: 'Bearer token para autenticar las peticiones al servidor OpenClaw', type: 'password', group: 'openclaw' },
  OPENCLAW_GATEWAY_PORT: { label: 'Puerto del gateway OpenClaw', desc: 'Puerto en el que escucha el gateway de OpenClaw (por defecto 3000)', type: 'text', group: 'openclaw' },
  HMAC_SECRET: { label: 'HMAC Secret', desc: 'Secret para firmar peticiones al bridge', type: 'password', group: 'system' },
  BRIDGE_URL: { label: 'Bridge URL', desc: 'URL del bridge proxy (VPS/Tailscale)', type: 'text', group: 'system' },
  WEBHOOK_SECRET: { label: 'Webhook Secret', desc: 'Secret para validar webhooks entrantes', type: 'password', group: 'system' },
  WEBHOOK_URL: { label: 'Webhook URL', desc: 'URL pública para recibir webhooks', type: 'text', group: 'system' },
  DEFAULT_MODEL: { label: 'Modelo por defecto', desc: 'Modelo IA por defecto para agentes nuevos', type: 'text', group: 'system' },
  DAILY_COST_LIMIT_EUR: { label: 'Límite coste diario global', desc: 'Presupuesto máximo en EUR/día', type: 'number', group: 'system' },
  TENANT_ID: { label: 'Tenant ID', desc: 'ID del tenant principal', type: 'text', group: 'tenant' },
  CHATBOT_ID: { label: 'Chatbot ID', desc: 'ID del chatbot para Knowledge Base', type: 'text', group: 'tenant' },
};

const AVAILABLE_MODELS = ['anthropic/claude-sonnet-4.5', 'openai/gpt-4o-mini', 'deepseek/deepseek-v3.2', 'x-ai/grok-4.1-fast', 'minimax/minimax-m2.1'];
const LIMIT_ACTIONS = ['warn', 'pause', 'block'];
const DB_TABLES = ['agents', 'tasks', 'handoffs', 'agent_runs', 'chat_messages', 'knowledge_chunks', 'approvals', 'activity_log', 'agent_memory', 'model_council_sessions', 'model_council_responses', 'system_config', 'allowed_users', 'tenants', 'tenant_members', 'tenant_api_keys'];

const KNOWN_FUNCTIONS = [
  { slug: 'chat-proxy', name: 'Chat Proxy v10', desc: 'Proxy de chat con RAG, herencia de contexto y subagentes' },
  { slug: 'agent-task', name: 'Agent Task v2', desc: 'CRUD y transiciones de estado de tareas' },
  { slug: 'agent-state', name: 'Agent State v2', desc: 'Gestión de estado de agentes (active/paused/error)' },
  { slug: 'agent-messages', name: 'Agent Messages v2', desc: 'Historial de mensajes por agente' },
  { slug: 'approval-decision', name: 'Approval Decision v2', desc: 'Aprobar/denegar acciones de agentes' },
  { slug: 'webhook-receiver', name: 'Webhook Receiver', desc: 'Receptor de webhooks externos' },
  { slug: 'agent-handoff', name: 'Agent Handoff', desc: 'Transferencia de tareas entre agentes' },
  { slug: 'task-manager', name: 'Task Manager', desc: 'Máquina de estados de tareas' },
  { slug: 'cost-reset', name: 'Cost Reset', desc: 'Reset diario de costes (POST para ejecutar)' },
  { slug: 'knowledge-base', name: 'Knowledge Base', desc: 'CRUD de chunks RAG' },
  { slug: 'dashboard-stats', name: 'Dashboard Stats', desc: 'Estadísticas agregadas del sistema' },
  { slug: 'model-council', name: 'Model Council', desc: 'Consulta multi-modelo con síntesis' },
  { slug: 'backup-manager', name: 'Backup Manager', desc: 'Crear copias de seguridad (POST)' },
  { slug: 'backup-sync', name: 'Backup Sync', desc: 'Sincronización a Dropbox/GDrive (GET para status)' },
  { slug: 'subagent-manager', name: 'Subagent Manager', desc: 'CRUD de subagentes por cliente' },
  { slug: 'health-check', name: 'Health Check', desc: 'Comprobación de salud del sistema (GET)' },
];

export default function Settings() {
  const [tab, setTab] = useState<Tab>('conexion');
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);

  const [configs, setConfigs] = useState<ConfigEntry[]>([]);
  const [editedValues, setEditedValues] = useState<Record<string, string>>({});
  
  const [agents, setAgents] = useState<Agent[]>([]);
  const [editingAgent, setEditingAgent] = useState<string | null>(null);
  const [agentEdits, setAgentEdits] = useState<Record<string, any>>({});
  
  const [tenantInfo, setTenantInfo] = useState<any>(null);
  const [tenantMembers, setTenantMembers] = useState<TenantMember[]>([]);
  const [tenantApiKeys, setTenantApiKeys] = useState<TenantApiKey[]>([]);
  
  const [allowedUsers, setAllowedUsers] = useState<AllowedUser[]>([]);
  const [health, setHealth] = useState<any>(null);
  const [syncStatus, setSyncStatus] = useState<any>(null);
  
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ text: string; type: 'ok' | 'err' }>({ text: '', type: 'ok' });
  
  const [costResetConfirm, setCostResetConfirm] = useState(false);
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserRole, setNewUserRole] = useState('user');
  
  const [showAddMember, setShowAddMember] = useState(false);
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberRole, setNewMemberRole] = useState('member');
  
  const [showAddApiKey, setShowAddApiKey] = useState(false);
  const [newApiKeyName, setNewApiKeyName] = useState('');
  const [generatedApiKey, setGeneratedApiKey] = useState<string | null>(null);
  
  const [purgeOlderThan, setPurgeOlderThan] = useState(30);
  const [purgeTarget, setPurgeTarget] = useState('agent_runs');
  const [showPurgeConfirm, setShowPurgeConfirm] = useState(false);
  const [purgeResult, setPurgeResult] = useState<string | null>(null);
  
  const [showAddConfig, setShowAddConfig] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [newVal, setNewVal] = useState('');

  // OpenClaw tab state
  const [openclawHealth, setOpenclawHealth] = useState<null | { ok: boolean; status?: string; version?: string; uptime?: number; error?: string }>(null);
  const [openclawHealthLoading, setOpenclawHealthLoading] = useState(false);

  // Skills tab state
  const [allAgentConfigs, setAllAgentConfigs] = useState<AgentConfigEntry[]>([]);
  const [skillsAgents, setSkillsAgents] = useState<Agent[]>([]);
  const [showAddSkillConfig, setShowAddSkillConfig] = useState<{ skillId: string; configKey: string; agentId: string } | null>(null);
  const [skillConfigValue, setSkillConfigValue] = useState('');
  const [skillConfigDesc, setSkillConfigDesc] = useState('');
  const [skillConfigSecret, setSkillConfigSecret] = useState(false);
  // Skills catalog (from DB, synced from OpenClaw)
  const [skillsCatalog, setSkillsCatalog] = useState<SkillCatalogEntry[]>([]);
  const [skillOverrides, setSkillOverrides] = useState<AgentSkillOverride[]>([]);
  const [skillsLastSync, setSkillsLastSync] = useState<string | null>(null);
  const [skillsFilter, setSkillsFilter] = useState<'workspace' | 'bundled' | 'all'>('workspace');
  const [skillsSearch, setSkillsSearch] = useState('');
  const [skillsExpandedCards, setSkillsExpandedCards] = useState<Set<string>>(new Set());

  const toast = useCallback((text: string, type: 'ok' | 'err' = 'ok') => {
    setMsg({ text, type });
    setTimeout(() => setMsg({ text: '', type: 'ok' }), 3000);
  }, []);

  const loadConfigs = useCallback(async () => {
    try {
      const data = await dbGet('system_config', 'select=*&order=key.asc');
      setConfigs(data || []);
      setEditedValues({});
    } catch (e: any) {
      toast('Error loading configs: ' + e.message, 'err');
    }
  }, [toast]);

  const loadAgents = useCallback(async () => {
    try {
      const data = await dbGet('agents', 'select=id,name,role,model_id,status,area,level,cost_used_today_eur,tokens_used_today,parent_agent_id&order=level.asc,name.asc');
      setAgents(data || []);
    } catch (e: any) {
      toast('Error loading agents: ' + e.message, 'err');
    }
  }, [toast]);

  const loadSyncStatus = useCallback(async () => {
    try {
      const data = await fnCall('backup-sync');
      setSyncStatus(data);
    } catch (e: any) {
      toast('Error loading sync status: ' + e.message, 'err');
    }
  }, [toast]);

  const loadTenantData = useCallback(async () => {
    try {
      const tenants = await dbGet('tenants', 'select=*&limit=1');
      if (tenants && tenants.length > 0) {
        setTenantInfo(tenants[0]);
        const members = await dbGet('tenant_members', `select=*&tenant_id=eq.${tenants[0].id}&order=created_at.asc`);
        const keys = await dbGet('tenant_api_keys', `select=*&tenant_id=eq.${tenants[0].id}&order=created_at.desc`);
        setTenantMembers(members || []);
        setTenantApiKeys(keys || []);
      }
    } catch (e: any) {
      toast('Error loading tenant data: ' + e.message, 'err');
    }
  }, [toast]);

  const loadAllowedUsers = useCallback(async () => {
    try {
      const data = await dbGet('allowed_users', 'select=*&order=email.asc');
      setAllowedUsers(data || []);
    } catch (e: any) {
      toast('Error loading allowed users: ' + e.message, 'err');
    }
  }, [toast]);

  const loadSkillsData = useCallback(async () => {
    try {
      const [agentsData, configsData, catalogData, overridesData, syncCfg] = await Promise.all([
        dbGet('agents', 'select=id,name,level,parent_agent_id,area&order=level.asc,name.asc'),
        dbGet('agent_config', 'select=id,agent_id,key,value,description,is_secret&order=key.asc'),
        dbGet('skills_catalog', 'select=*&order=source.asc,skill_id.asc&limit=200').catch(() => []),
        dbGet('agent_skill_overrides', 'select=*').catch(() => []),
        dbGet('system_config', 'select=value&key=eq.SKILLS_LAST_SYNC&limit=1').catch(() => []),
      ]);
      setSkillsAgents(agentsData || []);
      setAllAgentConfigs(configsData || []);
      setSkillsCatalog(catalogData || []);
      setSkillOverrides(overridesData || []);
      setSkillsLastSync((syncCfg as any)?.[0]?.value ?? null);
    } catch (e: any) {
      toast('Error cargando skills: ' + e.message, 'err');
    }
  }, [toast]);

  // Computa qué configs tiene cada agente (propias + heredadas de padres)
  const getInheritedConfigMap = useCallback((agentId: string): Record<string, { value: string; ownerId: string; ownerName: string; isDirect: boolean }> => {
    const result: Record<string, { value: string; ownerId: string; ownerName: string; isDirect: boolean }> = {};
    // Build chain: walk up to Director
    const chain: Agent[] = [];
    let currentId: string | undefined = agentId;
    while (currentId) {
      const agent = skillsAgents.find(a => a.id === currentId);
      if (!agent) break;
      chain.unshift(agent); // Director first
      currentId = agent.parent_agent_id;
    }
    // Merge configs from Director → ... → this agent
    for (const agent of chain) {
      const configs = allAgentConfigs.filter(c => c.agent_id === agent.id);
      for (const c of configs) {
        result[c.key] = {
          value: c.value,
          ownerId: agent.id,
          ownerName: agent.name,
          isDirect: agent.id === agentId,
        };
      }
    }
    return result;
  }, [skillsAgents, allAgentConfigs]);

  const addSkillConfig = useCallback(async () => {
    if (!showAddSkillConfig || !skillConfigValue.trim()) {
      toast('Valor requerido', 'err');
      return;
    }
    try {
      const existing = allAgentConfigs.find(c => c.agent_id === showAddSkillConfig.agentId && c.key === showAddSkillConfig.configKey);
      if (existing) {
        await dbPatch('agent_config', `id=eq.${existing.id}`, { value: skillConfigValue, description: skillConfigDesc, is_secret: skillConfigSecret });
      } else {
        await dbPost('agent_config', [{ agent_id: showAddSkillConfig.agentId, key: showAddSkillConfig.configKey, value: skillConfigValue, description: skillConfigDesc, is_secret: skillConfigSecret }]);
      }
      setShowAddSkillConfig(null);
      setSkillConfigValue('');
      setSkillConfigDesc('');
      setSkillConfigSecret(false);
      await loadSkillsData();
      toast('Config guardada ✓', 'ok');
    } catch (e: any) {
      toast('Error: ' + e.message, 'err');
    }
  }, [showAddSkillConfig, skillConfigValue, skillConfigDesc, skillConfigSecret, allAgentConfigs, loadSkillsData, toast]);

  const removeSkillConfig = useCallback(async (agentId: string, configKey: string) => {
    const entry = allAgentConfigs.find(c => c.agent_id === agentId && c.key === configKey);
    if (!entry) return;
    if (!window.confirm(`¿Eliminar "${configKey}" del agente?`)) return;
    try {
      await dbDelete('agent_config', `id=eq.${entry.id}`);
      await loadSkillsData();
      toast('Config eliminada', 'ok');
    } catch (e: any) {
      toast('Error: ' + e.message, 'err');
    }
  }, [allAgentConfigs, loadSkillsData, toast]);

  const blockSkill = useCallback(async (agentId: string, skillId: string, agentName: string) => {
    if (!window.confirm(`¿Bloquear la skill "${skillId}" para ${agentName}?`)) return;
    try {
      await dbPost('agent_skill_overrides', [{ agent_id: agentId, skill_id: skillId, allowed: false }]);
      await loadSkillsData();
      toast(`Skill bloqueada para ${agentName}`, 'ok');
    } catch (e: any) {
      toast('Error: ' + e.message, 'err');
    }
  }, [loadSkillsData, toast]);

  const unblockSkill = useCallback(async (overrideId: string, agentName: string) => {
    try {
      await dbDelete('agent_skill_overrides', `id=eq.${overrideId}`);
      await loadSkillsData();
      toast(`Acceso restaurado para ${agentName}`, 'ok');
    } catch (e: any) {
      toast('Error: ' + e.message, 'err');
    }
  }, [loadSkillsData, toast]);

  const getConfig = useCallback((key: string) => {
    const entry = configs.find(c => c.key === key);
    if (!entry) return null;
    return {
      ...entry,
      editedValue: editedValues[entry.id] ?? entry.value,
    };
  }, [configs, editedValues]);

  const setEditedValue = useCallback((id: string, value: string) => {
    setEditedValues(prev => ({ ...prev, [id]: value }));
  }, []);

  const saveConfig = useCallback(async (id: string) => {
    try {
      const value = editedValues[id];
      if (value === undefined) return;
      await dbPatch('system_config', `id=eq.${id}`, { value });
      await loadConfigs();
      toast('Config saved', 'ok');
    } catch (e: any) {
      toast('Error saving config: ' + e.message, 'err');
    }
  }, [editedValues, loadConfigs, toast]);

  const deleteConfig = useCallback(async (id: string, key: string) => {
    if (!window.confirm(`Delete config ${key}?`)) return;
    try {
      await dbDelete('system_config', `id=eq.${id}`);
      await loadConfigs();
      toast('Config deleted', 'ok');
    } catch (e: any) {
      toast('Error deleting config: ' + e.message, 'err');
    }
  }, [loadConfigs, toast]);

  const addConfig = useCallback(async () => {
    if (!newKey.trim() || !newVal.trim()) {
      toast('Key and value required', 'err');
      return;
    }
    try {
      await dbPost('system_config', [{ key: newKey, value: newVal }]);
      setNewKey('');
      setNewVal('');
      setShowAddConfig(false);
      await loadConfigs();
      toast('Config added', 'ok');
    } catch (e: any) {
      toast('Error adding config: ' + e.message, 'err');
    }
  }, [newKey, newVal, loadConfigs, toast]);

  const saveApiKey = useCallback(() => {
    localStorage.setItem('emprexia_api_key', apiKey);
    toast('API Key saved', 'ok');
  }, [apiKey, toast]);

  const checkHealth = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fnCall('health-check');
      setHealth(data);
      toast('Health check completed', 'ok');
    } catch (e: any) {
      toast('Error checking health: ' + e.message, 'err');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const checkOpenclawHealth = useCallback(async () => {
    setOpenclawHealthLoading(true);
    setOpenclawHealth(null);
    try {
      const data = await fnCall('openclaw-backup', 'GET', undefined, '/health');
      setOpenclawHealth({ ok: true, ...data });
    } catch (e: any) {
      setOpenclawHealth({ ok: false, error: e.message });
    } finally {
      setOpenclawHealthLoading(false);
    }
  }, []);

  const triggerCostReset = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fnCall('cost-reset', 'POST');
      toast(`Cost reset executed: ${data.reset_count} agents reset`, 'ok');
      setCostResetConfirm(false);
      await loadAgents();
    } catch (e: any) {
      toast('Error resetting costs: ' + e.message, 'err');
    } finally {
      setLoading(false);
    }
  }, [loadAgents, toast]);

  const triggerBackup = useCallback(async () => {
    try {
      setLoading(true);
      await fnCall('backup-manager', 'POST');
      toast('Backup triggered successfully', 'ok');
      await loadSyncStatus();
    } catch (e: any) {
      toast('Error triggering backup: ' + e.message, 'err');
    } finally {
      setLoading(false);
    }
  }, [loadSyncStatus, toast]);

  const saveAgent = useCallback(async (id: string) => {
    try {
      const edits = agentEdits[id];
      if (!edits || Object.keys(edits).length === 0) return;
      await dbPatch('agents', `id=eq.${id}`, edits);
      setEditingAgent(null);
      setAgentEdits(prev => {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      });
      await loadAgents();
      toast('Agent updated', 'ok');
    } catch (e: any) {
      toast('Error saving agent: ' + e.message, 'err');
    }
  }, [agentEdits, loadAgents, toast]);

  const addAllowedUser = useCallback(async () => {
    if (!newUserEmail.trim()) {
      toast('Email required', 'err');
      return;
    }
    try {
      await dbPost('allowed_users', [{ email: newUserEmail, role: newUserRole }]);
      setNewUserEmail('');
      setNewUserRole('user');
      setShowAddUser(false);
      await loadAllowedUsers();
      toast('User added', 'ok');
    } catch (e: any) {
      toast('Error adding user: ' + e.message, 'err');
    }
  }, [newUserEmail, newUserRole, loadAllowedUsers, toast]);

  const deleteUser = useCallback(async (id: string) => {
    if (!window.confirm('Delete this user?')) return;
    try {
      await dbDelete('allowed_users', `id=eq.${id}`);
      await loadAllowedUsers();
      toast('User deleted', 'ok');
    } catch (e: any) {
      toast('Error deleting user: ' + e.message, 'err');
    }
  }, [loadAllowedUsers, toast]);

  const addTenantMember = useCallback(async () => {
    if (!newMemberEmail.trim() || !tenantInfo) {
      toast('Email required', 'err');
      return;
    }
    try {
      await dbPost('tenant_members', [{ tenant_id: tenantInfo.id, user_id: newMemberEmail, role: newMemberRole }]);
      setNewMemberEmail('');
      setNewMemberRole('member');
      setShowAddMember(false);
      await loadTenantData();
      toast('Member added', 'ok');
    } catch (e: any) {
      toast('Error adding member: ' + e.message, 'err');
    }
  }, [newMemberEmail, newMemberRole, tenantInfo, loadTenantData, toast]);

  const deleteTenantMember = useCallback(async (id: string) => {
    if (!window.confirm('Remove this member?')) return;
    try {
      await dbDelete('tenant_members', `id=eq.${id}`);
      await loadTenantData();
      toast('Member removed', 'ok');
    } catch (e: any) {
      toast('Error removing member: ' + e.message, 'err');
    }
  }, [loadTenantData, toast]);

  const generateApiKey = useCallback(async () => {
    if (!newApiKeyName.trim() || !tenantInfo) {
      toast('Key name required', 'err');
      return;
    }
    try {
      const arr = new Uint8Array(32);
      crypto.getRandomValues(arr);
      const key = Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
      await dbPost('tenant_api_keys', [{ tenant_id: tenantInfo.id, key_name: newApiKeyName, service: 'custom', key_value: key }]);
      setGeneratedApiKey(key);
      setNewApiKeyName('');
      await loadTenantData();
      toast('API Key generated', 'ok');
    } catch (e: any) {
      toast('Error generating API key: ' + e.message, 'err');
    }
  }, [newApiKeyName, tenantInfo, loadTenantData, toast]);

  const executePurge = useCallback(async () => {
    try {
      setLoading(true);
      const cutoff = new Date(Date.now() - purgeOlderThan * 86400000).toISOString();
      await dbDelete(purgeTarget as any, `created_at=lt.${cutoff}`);
      setPurgeResult(`Purged records from ${purgeTarget} older than ${purgeOlderThan} days`);
      setShowPurgeConfirm(false);
      toast('Purge completed', 'ok');
    } catch (e: any) {
      toast('Error purging data: ' + e.message, 'err');
    } finally {
      setLoading(false);
    }
  }, [purgeOlderThan, purgeTarget, toast]);

  const exportConfig = useCallback(async () => {
    try {
      setLoading(true);
      const configData = await dbGet('system_config', 'select=*');
      const agentData = await dbGet('agents', 'select=*');
      const data = { configs: configData, agents: agentData, exportedAt: new Date().toISOString() };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `emprexia-config-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast('Configuration exported', 'ok');
    } catch (e: any) {
      toast('Error exporting config: ' + e.message, 'err');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    const stored = localStorage.getItem('emprexia_api_key') || '';
    setApiKey(stored);
  }, []);

  useEffect(() => {
    if (tab === 'conexion') {
      loadConfigs();
    } else if (tab === 'agentes') {
      loadAgents();
    } else if (tab === 'tenant') {
      loadTenantData();
    } else if (tab === 'usuarios') {
      loadAllowedUsers();
    } else if (tab === 'salud') {
      loadConfigs();
    } else if (tab === 'skills') {
      loadSkillsData();
    } else if (tab === 'openclaw') {
      loadConfigs();
    }
  }, [tab, loadConfigs, loadAgents, loadTenantData, loadAllowedUsers, loadSkillsData]);

  const renderConfigRow = (c: ConfigEntry, meta?: typeof CONFIG_META[keyof typeof CONFIG_META]) => {
    const edited = editedValues[c.id];
    const value = edited !== undefined ? edited : c.value;
    const meta_info = meta || CONFIG_META[c.key];
    
    return (
      <div key={c.id} className="flex items-center gap-4 p-3 bg-gray-100 dark:bg-white/[0.04] rounded-xl border border-gray-200 dark:border-gray-700">
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-gray-100">{meta_info?.label || c.key}</div>
          <div className="text-xs text-gray-400">{meta_info?.desc}</div>
        </div>
        <div className="w-64">
          {meta_info?.type === 'bool' ? (
            <div className="flex gap-2">
              <button
                onClick={() => setEditedValue(c.id, 'true')}
                className={`px-3 py-1 rounded text-sm font-medium ${value === 'true' ? 'bg-indigo-600 text-white' : 'bg-gray-100 dark:bg-white/[0.05] text-gray-500 dark:text-gray-400'}`}
              >
                Sí
              </button>
              <button
                onClick={() => setEditedValue(c.id, 'false')}
                className={`px-3 py-1 rounded text-sm font-medium ${value === 'false' ? 'bg-indigo-600 text-white' : 'bg-gray-100 dark:bg-white/[0.05] text-gray-500 dark:text-gray-400'}`}
              >
                No
              </button>
            </div>
          ) : meta_info?.type === 'password' ? (
            <input
              type="password"
              value={value}
              onChange={(e) => setEditedValue(c.id, e.target.value)}
              className="w-full px-3 py-1 bg-white dark:bg-white/[0.05] border border-gray-200 dark:border-white/[0.08] rounded text-gray-900 dark:text-gray-100 text-sm"
            />
          ) : (
            <input
              type={meta_info?.type === 'number' ? 'number' : 'text'}
              value={value}
              onChange={(e) => setEditedValue(c.id, e.target.value)}
              className="w-full px-3 py-1 bg-white dark:bg-white/[0.05] border border-gray-200 dark:border-white/[0.08] rounded text-gray-900 dark:text-gray-100 text-sm"
            />
          )}
        </div>
        <div className="flex gap-2">
          {edited !== undefined && (
            <button
              onClick={() => saveConfig(c.id)}
              className="px-3 py-1 bg-indigo-600 text-white rounded text-sm font-medium hover:bg-indigo-700"
            >
              Guardar
            </button>
          )}
          <button
            onClick={() => deleteConfig(c.id, c.key)}
            className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
          >
            Eliminar
          </button>
        </div>
      </div>
    );
  };

  const renderMissingConfig = (key: string, meta: typeof CONFIG_META[keyof typeof CONFIG_META]) => (
    <div key={key} className="flex items-center justify-between p-3 bg-gray-100 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
      <div className="flex-1">
        <div className="font-semibold text-gray-100">{meta.label}</div>
        <div className="text-xs text-gray-400">{meta.desc}</div>
        <div className="text-xs text-orange-400 mt-1">No existe aún</div>
      </div>
      <button
        onClick={() => {
          setNewKey(key);
          setNewVal('');
          setShowAddConfig(true);
        }}
        className="px-3 py-1 bg-indigo-600 text-white rounded text-sm font-medium hover:bg-indigo-700"
      >
        Crear
      </button>
    </div>
  );

  return (
    <div className="p-4 sm:p-6 space-y-5">
      {/* Header */}
      <div>
        <PageHeader title="Configuración" subtitle="Ajustes del sistema y conexión" />
        <p className="text-sm text-gray-500 mt-0.5">Ajustes del sistema y conexiones</p>
      </div>

      {/* Toast */}
      {msg.text && (
        <div className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl border text-sm font-medium shadow-xl ${msg.type === 'ok' ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-300' : 'bg-red-500/10 border-red-500/20 text-red-300'}`}>
          {msg.text}
        </div>
      )}

      {/* Tab nav */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {[
          { id: 'conexion', label: 'Conexión' },
          { id: 'agentes', label: 'Agentes' },
          { id: 'skills', label: '⚡ Skills' },
          { id: 'funciones', label: 'Funciones' },
          { id: 'modelos', label: 'Modelos IA' },
          { id: 'tenant', label: 'Organización' },
          { id: 'usuarios', label: 'Usuarios' },
          { id: 'backup', label: '💾 Backups' },
          { id: 'openclaw', label: '🔌 OpenClaw' },
          { id: 'mantenimiento', label: 'Mantenimiento' },
          { id: 'salud', label: 'Salud' },
          { id: 'seguridad', label: 'Seguridad' },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as Tab)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${tab === t.id ? 'bg-indigo-500/15 text-indigo-400' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 hover:text-gray-600 dark:text-gray-300'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {tab === 'conexion' && (
          <>
            <div className="bg-white dark:bg-gray-900 p-5 rounded-xl border border-gray-200 dark:border-gray-800">
              <h3 className="font-bold text-indigo-400 mb-3">API Key</h3>
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    className="flex-1 px-3 py-2 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded text-gray-100"
                    placeholder="Tu API Key (Insforge anon JWT)"
                  />
                  <button
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="px-3 py-2 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded text-gray-400 hover:text-gray-700 dark:text-gray-200"
                  >
                    {showApiKey ? 'Ocultar' : 'Ver'}
                  </button>
                  <button
                    onClick={saveApiKey}
                    className="px-4 py-2 bg-indigo-600 text-white rounded font-medium hover:bg-indigo-700"
                  >
                    Guardar
                  </button>
                </div>
                <div className="text-xs text-gray-400">
                  Longitud: {apiKey.length} chars | Prefijo: {apiKey.substring(0, 10)}...
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-900 p-5 rounded-xl border border-gray-200 dark:border-gray-800">
              <h3 className="font-bold text-indigo-400 mb-3">Endpoints</h3>
              <div className="space-y-2 text-sm">
                <div>
                  <div className="text-gray-400">SITE_URL:</div>
                  <div className="font-mono text-indigo-300">{SITE_URL}</div>
                </div>
                <div>
                  <div className="text-gray-400">FUNCTIONS_URL:</div>
                  <div className="font-mono text-indigo-300">{FUNCTIONS_URL}</div>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-900 p-5 rounded-xl border border-gray-200 dark:border-gray-800">
              <h3 className="font-bold text-indigo-400 mb-3">Claves del Sistema</h3>
              <div className="space-y-3">
                {['HMAC_SECRET', 'BRIDGE_URL', 'WEBHOOK_SECRET', 'WEBHOOK_URL'].map(key => {
                  const config = getConfig(key);
                  const meta = CONFIG_META[key];
                  return config ? renderConfigRow(config, meta) : renderMissingConfig(key, meta);
                })}
              </div>
            </div>

            <div className="bg-white dark:bg-gray-900 p-5 rounded-xl border border-gray-200 dark:border-gray-800">
              <h3 className="font-bold text-indigo-400 mb-3">Valores por Defecto</h3>
              <div className="space-y-3">
                {['DEFAULT_MODEL', 'DAILY_COST_LIMIT_EUR'].map(key => {
                  const config = getConfig(key);
                  const meta = CONFIG_META[key];
                  return config ? renderConfigRow(config, meta) : renderMissingConfig(key, meta);
                })}
              </div>
            </div>

            <div className="bg-white dark:bg-gray-900 p-5 rounded-xl border border-gray-200 dark:border-gray-800">
              <h3 className="font-bold text-indigo-400 mb-3">Identificadores</h3>
              <div className="space-y-3">
                {['TENANT_ID', 'CHATBOT_ID'].map(key => {
                  const config = getConfig(key);
                  const meta = CONFIG_META[key];
                  return config ? renderConfigRow(config, meta) : renderMissingConfig(key, meta);
                })}
              </div>
            </div>
          </>
        )}

        {tab === 'agentes' && (
          <>
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold text-indigo-400">Agentes</h3>
              <button
                onClick={() => setCostResetConfirm(true)}
                className="px-4 py-2 bg-orange-600 text-white rounded font-medium hover:bg-orange-700"
              >
                Reiniciar Costes
              </button>
            </div>

            {agents.length === 0 ? (
              <div className="text-center py-8 text-gray-400">No agents found</div>
            ) : (
              <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="text-left py-2 px-3 text-gray-400">Agente</th>
                      <th className="text-left py-2 px-3 text-gray-400">Nivel</th>
                      <th className="text-left py-2 px-3 text-gray-400">Área</th>
                      <th className="text-left py-2 px-3 text-gray-400">Modelo</th>
                      <th className="text-right py-2 px-3 text-gray-400">Coste</th>
                      <th className="text-right py-2 px-3 text-gray-400">Tokens</th>
                      <th className="text-left py-2 px-3 text-gray-400">Estado</th>
                      <th className="text-left py-2 px-3 text-gray-400">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {agents.map(a => (
                      <tr key={a.id} className="border-b border-gray-200 dark:border-gray-800 hover:bg-gray-100 dark:bg-white/[0.04]">
                        <td className="py-2 px-3">
                          <div className="font-semibold text-gray-100">{a.name}</div>
                          <div className="text-xs text-gray-500 capitalize">{a.area}</div>
                        </td>
                        <td className="py-2 px-3">
                          <span className={`text-xs font-bold px-2 py-1 rounded ${a.level === 0 ? 'bg-purple-900 text-purple-200' : a.level === 1 ? 'bg-blue-900 text-blue-200' : 'bg-indigo-50 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-200'}`}>
                            {a.level === 0 ? 'Director' : a.level === 1 ? 'Manager' : 'Operativo'}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-gray-600 dark:text-gray-300">{a.area}</td>
                        <td className="py-2 px-3">
                          {editingAgent === a.id ? (
                            <select
                              value={agentEdits[a.id]?.model_id || a.model_id}
                              onChange={(e) => setAgentEdits(prev => ({ ...prev, [a.id]: { ...prev[a.id], model_id: e.target.value } }))}
                              className="w-full px-2 py-1 bg-white dark:bg-white/[0.05] border border-gray-200 dark:border-white/[0.08] rounded text-gray-900 dark:text-gray-100 text-xs"
                            >
                              {AVAILABLE_MODELS.map(m => (
                                <option key={m} value={m}>{m}</option>
                              ))}
                            </select>
                          ) : (
                            <code className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded text-indigo-300">{a.model_id.substring(a.model_id.indexOf('/') + 1)}</code>
                          )}
                        </td>
                        <td className="py-2 px-3 text-right text-amber-400 font-semibold">{a.cost_used_today_eur.toFixed(2)}€</td>
                        <td className="py-2 px-3 text-right text-gray-600 dark:text-gray-300">{a.tokens_used_today}</td>
                        <td className="py-2 px-3">
                          <StatusBadge status={a.status} />
                        </td>
                        <td className="py-2 px-3">
                          {editingAgent === a.id ? (
                            <div className="flex gap-1">
                              <button
                                onClick={() => saveAgent(a.id)}
                                className="px-2 py-1 bg-indigo-600 text-white text-xs rounded hover:bg-indigo-700"
                              >
                                Guardar
                              </button>
                              <button
                                onClick={() => {
                                  setEditingAgent(null);
                                  setAgentEdits(prev => { const c = { ...prev }; delete c[a.id]; return c; });
                                }}
                                className="px-2 py-1 bg-gray-100 dark:bg-white/[0.05] text-gray-600 dark:text-gray-400 text-xs rounded hover:bg-gray-200 dark:hover:bg-white/[0.08]"
                              >
                                Cancelar
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setEditingAgent(a.id)}
                              className="px-2 py-1 bg-gray-100 dark:bg-white/[0.05] text-gray-600 dark:text-gray-400 text-xs rounded hover:bg-gray-200 dark:hover:bg-white/[0.08]"
                            >
                              Editar
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-gray-100 dark:bg-white/[0.04] font-semibold">
                      <td colSpan={4} className="py-3 px-3 text-indigo-400">Total</td>
                      <td className="py-3 px-3 text-right text-amber-400">{agents.reduce((s, a) => s + a.cost_used_today_eur, 0).toFixed(2)}€</td>
                      <td className="py-3 px-3 text-right text-gray-600 dark:text-gray-300">{agents.reduce((s, a) => s + a.tokens_used_today, 0)}</td>
                      <td colSpan={3}></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            <Modal open={costResetConfirm} onClose={() => setCostResetConfirm(false)} title="Confirmar Reinicio de Costes">
              <div className="space-y-4">
                <p className="text-gray-600 dark:text-gray-300">Este proceso reiniciará los contadores de coste de todos los agentes. Continuar?</p>
                <div className="flex gap-2 justify-end">
                  <button onClick={() => setCostResetConfirm(false)} className="px-4 py-2 bg-gray-100 dark:bg-white/[0.05] text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-white/[0.08]">Cancelar</button>
                  <button onClick={triggerCostReset} disabled={loading} className="px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700 disabled:opacity-50">{loading ? 'Procesando...' : 'Reiniciar'}</button>
                </div>
              </div>
            </Modal>
          </>
        )}

        {tab === 'funciones' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {KNOWN_FUNCTIONS.map(f => (
              <div key={f.slug} className="bg-white dark:bg-gray-900 p-4 rounded border border-gray-200 dark:border-gray-700 hover:border-indigo-500 transition">
                <div className="flex items-start gap-3 mb-2">
                  <div className="text-2xl">ƒ</div>
                  <div className="flex-1">
                    <h4 className="font-bold text-indigo-400">{f.name}</h4>
                    <StatusBadge status="active" />
                  </div>
                </div>
                <div className="font-mono text-xs bg-gray-100 dark:bg-gray-800 p-2 rounded mb-2 text-indigo-300 break-all">{f.slug}</div>
                <p className="text-xs text-gray-400">{f.desc}</p>
              </div>
            ))}
          </div>
        )}

        {tab === 'modelos' && (
          <>
            <div className="bg-white dark:bg-gray-900 p-5 rounded-xl border border-gray-200 dark:border-gray-800">
              <h3 className="font-bold text-indigo-400 mb-3">Modelos IA Habilitados</h3>
              <div className="space-y-2">
                {[
                  { model: 'anthropic/claude-sonnet-4.5', name: 'Claude Sonnet 4.5', tier: 'premium' },
                  { model: 'openai/gpt-4o-mini', name: 'GPT-4o Mini', tier: 'económico' },
                  { model: 'deepseek/deepseek-v3.2', name: 'DeepSeek v3.2', tier: 'económico' },
                  { model: 'x-ai/grok-4.1-fast', name: 'Grok 4.1 Fast', tier: 'estándar' },
                  { model: 'minimax/minimax-m2.1', name: 'MiniMax M2.1', tier: 'económico' },
                ].map(m => (
                  <div key={m.model} className="flex items-center justify-between p-2 bg-gray-100 dark:bg-gray-800 rounded">
                    <div>
                      <div className="font-semibold text-gray-100">{m.name}</div>
                      <code className="text-xs text-gray-400">{m.model}</code>
                    </div>
                    <span className={`text-xs font-bold px-2 py-1 rounded ${m.tier === 'premium' ? 'bg-amber-900 text-amber-200' : m.tier === 'estándar' ? 'bg-blue-900 text-blue-200' : 'bg-indigo-50 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-200'}`}>
                      {m.tier}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white dark:bg-gray-900 p-5 rounded-xl border border-gray-200 dark:border-gray-800">
              <h3 className="font-bold text-indigo-400 mb-3">Asignación de Modelos por Agente</h3>
              {agents.length === 0 ? (
                <div className="text-gray-400 text-sm">No agents found</div>
              ) : (
                <div className="space-y-1 max-h-96 overflow-y-auto">
                  {agents.map(a => (
                    <div key={a.id} className="flex justify-between items-center p-2 bg-gray-100 dark:bg-gray-800 rounded text-sm">
                      <span className="text-gray-600 dark:text-gray-300">{a.name}</span>
                      <code className="text-xs text-indigo-300">{a.model_id.substring(a.model_id.indexOf('/') + 1)}</code>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {tab === 'tenant' && (
          <>
            {tenantInfo && (
              <div className="bg-white dark:bg-gray-900 p-5 rounded-xl border border-gray-200 dark:border-gray-800">
                <h3 className="font-bold text-indigo-400 mb-3">Información del Tenant</h3>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-gray-400">Nombre:</span>
                    <span className="ml-2 text-gray-100">{tenantInfo.name}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Plan:</span>
                    <span className="ml-2 text-gray-100">{tenantInfo.plan || 'standard'}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Creado:</span>
                    <span className="ml-2 text-gray-100">{new Date(tenantInfo.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-between items-center mb-2">
              <h3 className="font-bold text-indigo-400">Miembros del Tenant</h3>
              <button
                onClick={() => setShowAddMember(true)}
                className="px-3 py-1 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700"
              >
                + Agregar Miembro
              </button>
            </div>

            {tenantMembers.length === 0 ? (
              <div className="text-center py-6 text-gray-400">No members found</div>
            ) : (
              <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="text-left py-2 px-3 text-gray-400">Usuario</th>
                      <th className="text-left py-2 px-3 text-gray-400">Rol</th>
                      <th className="text-left py-2 px-3 text-gray-400">Creado</th>
                      <th className="text-left py-2 px-3 text-gray-400">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tenantMembers.map(m => (
                      <tr key={m.id} className="border-b border-gray-200 dark:border-gray-800 hover:bg-gray-100 dark:bg-white/[0.04]">
                        <td className="py-2 px-3 text-gray-100">{m.user_id}</td>
                        <td className="py-2 px-3"><span className="text-xs bg-blue-900 text-blue-200 px-2 py-1 rounded">{m.role}</span></td>
                        <td className="py-2 px-3 text-gray-400 text-xs">{new Date(m.created_at).toLocaleDateString()}</td>
                        <td className="py-2 px-3">
                          <button
                            onClick={() => deleteTenantMember(m.id)}
                            className="px-2 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700"
                          >
                            Eliminar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex justify-between items-center mb-2 mt-6">
              <h3 className="font-bold text-indigo-400">API Keys del Tenant</h3>
              <button
                onClick={() => {
                  setGeneratedApiKey(null);
                  setNewApiKeyName('');
                  setShowAddApiKey(true);
                }}
                className="px-3 py-1 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700"
              >
                + Generar Clave
              </button>
            </div>

            {tenantApiKeys.length === 0 ? (
              <div className="text-center py-6 text-gray-400">No API keys found</div>
            ) : (
              <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="text-left py-2 px-3 text-gray-400">Nombre</th>
                      <th className="text-left py-2 px-3 text-gray-400">Servicio</th>
                      <th className="text-left py-2 px-3 text-gray-400">Prefijo</th>
                      <th className="text-left py-2 px-3 text-gray-400">Creada</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tenantApiKeys.map(k => (
                      <tr key={k.id} className="border-b border-gray-200 dark:border-gray-800 hover:bg-gray-100 dark:bg-white/[0.04]">
                        <td className="py-2 px-3 text-gray-100">{k.key_name}</td>
                        <td className="py-2 px-3 text-gray-400 text-xs">{k.service}</td>
                        <td className="py-2 px-3 font-mono text-xs text-indigo-300">{k.key_value ? k.key_value.substring(0, 8) + '...' : '—'}</td>
                        <td className="py-2 px-3 text-gray-400 text-xs">{new Date(k.created_at).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <Modal open={showAddMember} onClose={() => setShowAddMember(false)} title="Agregar Miembro al Tenant">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">User ID / Email</label>
                  <input
                    type="text"
                    value={newMemberEmail}
                    onChange={(e) => setNewMemberEmail(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded text-gray-100"
                    placeholder="user@example.com o ID de usuario"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Rol</label>
                  <select
                    value={newMemberRole}
                    onChange={(e) => setNewMemberRole(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded text-gray-100"
                  >
                    <option value="admin">Admin</option>
                    <option value="member">Member</option>
                    <option value="viewer">Viewer</option>
                  </select>
                </div>
                <div className="flex gap-2 justify-end">
                  <button onClick={() => setShowAddMember(false)} className="px-4 py-2 bg-gray-100 dark:bg-white/[0.05] text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-white/[0.08]">Cancelar</button>
                  <button onClick={addTenantMember} className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700">Agregar</button>
                </div>
              </div>
            </Modal>

            <Modal open={showAddApiKey} onClose={() => setShowAddApiKey(false)} title="Generar API Key" wide={generatedApiKey ? true : false}>
              <div className="space-y-4">
                {!generatedApiKey ? (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Nombre de la Clave</label>
                      <input
                        type="text"
                        value={newApiKeyName}
                        onChange={(e) => setNewApiKeyName(e.target.value)}
                        className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded text-gray-100"
                        placeholder="e.g., Production API"
                      />
                    </div>
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => setShowAddApiKey(false)} className="px-4 py-2 bg-gray-100 dark:bg-white/[0.05] text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-white/[0.08]">Cancelar</button>
                      <button onClick={generateApiKey} className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700">Generar</button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded border border-orange-600">
                      <p className="text-orange-200 text-sm mb-2 font-semibold">IMPORTANTE: Copia esta clave ahora. No podrás verla de nuevo.</p>
                      <div className="font-mono text-sm text-indigo-300 bg-white dark:bg-gray-900 p-3 rounded break-all select-all cursor-pointer">{generatedApiKey}</div>
                    </div>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(generatedApiKey);
                        toast('Clave copiada al portapapeles', 'ok');
                      }}
                      className="w-full px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
                    >
                      Copiar Clave
                    </button>
                    <button
                      onClick={() => setShowAddApiKey(false)}
                      className="w-full px-4 py-2 bg-gray-700 text-gray-600 dark:text-gray-300 rounded hover:bg-gray-600"
                    >
                      Cerrar
                    </button>
                  </>
                )}
              </div>
            </Modal>
          </>
        )}

        {tab === 'usuarios' && (
          <>
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-bold text-indigo-400">Usuarios Permitidos</h3>
              <button
                onClick={() => setShowAddUser(true)}
                className="px-3 py-1 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700"
              >
                + Agregar Usuario
              </button>
            </div>

            {allowedUsers.length === 0 ? (
              <div className="text-center py-8 text-gray-400">No users found</div>
            ) : (
              <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="text-left py-2 px-3 text-gray-400">Email</th>
                      <th className="text-left py-2 px-3 text-gray-400">Rol</th>
                      <th className="text-left py-2 px-3 text-gray-400">Estado</th>
                      <th className="text-left py-2 px-3 text-gray-400">Creado</th>
                      <th className="text-left py-2 px-3 text-gray-400">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allowedUsers.map(u => (
                      <tr key={u.id} className="border-b border-gray-200 dark:border-gray-800 hover:bg-gray-100 dark:bg-white/[0.04]">
                        <td className="py-2 px-3 text-gray-100">{u.email}</td>
                        <td className="py-2 px-3"><span className="text-xs bg-blue-900 text-blue-200 px-2 py-1 rounded">{u.role}</span></td>
                        <td className="py-2 px-3"><StatusBadge status={u.status} /></td>
                        <td className="py-2 px-3 text-gray-400 text-xs">{new Date(u.created_at).toLocaleDateString()}</td>
                        <td className="py-2 px-3">
                          <button
                            onClick={() => deleteUser(u.id)}
                            className="px-2 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700"
                          >
                            Eliminar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <Modal open={showAddUser} onClose={() => setShowAddUser(false)} title="Agregar Usuario Permitido">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Email</label>
                  <input
                    type="email"
                    value={newUserEmail}
                    onChange={(e) => setNewUserEmail(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded text-gray-100"
                    placeholder="user@example.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Rol</label>
                  <select
                    value={newUserRole}
                    onChange={(e) => setNewUserRole(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded text-gray-100"
                  >
                    <option value="admin">Admin</option>
                    <option value="user">User</option>
                  </select>
                </div>
                <div className="flex gap-2 justify-end">
                  <button onClick={() => setShowAddUser(false)} className="px-4 py-2 bg-gray-100 dark:bg-white/[0.05] text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-white/[0.08]">Cancelar</button>
                  <button onClick={addAllowedUser} className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700">Agregar</button>
                </div>
              </div>
            </Modal>
          </>
        )}

        {tab === 'mantenimiento' && (
          <>
            <div className="bg-white dark:bg-gray-900 p-5 rounded-xl border border-gray-200 dark:border-gray-800">
              <h3 className="font-bold text-indigo-400 mb-3">Purgar Datos</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Tabla</label>
                  <select
                    value={purgeTarget}
                    onChange={(e) => setPurgeTarget(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded text-gray-100"
                  >
                    <option value="agent_runs">Agent Runs</option>
                    <option value="chat_messages">Chat Messages</option>
                    <option value="activity_log">Activity Log</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Eliminar registros más antiguos que (días)</label>
                  <select
                    value={purgeOlderThan}
                    onChange={(e) => setPurgeOlderThan(parseInt(e.target.value))}
                    className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded text-gray-100"
                  >
                    <option value={7}>7 días</option>
                    <option value={14}>14 días</option>
                    <option value={30}>30 días</option>
                    <option value={60}>60 días</option>
                    <option value={90}>90 días</option>
                  </select>
                </div>
                <button
                  onClick={() => setShowPurgeConfirm(true)}
                  className="w-full px-4 py-2 bg-red-600 text-white rounded font-medium hover:bg-red-700"
                >
                  Purgar Ahora
                </button>
                {purgeResult && (
                  <div className="p-3 bg-indigo-900 text-indigo-200 rounded text-sm">
                    {purgeResult}
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white dark:bg-gray-900 p-5 rounded-xl border border-gray-200 dark:border-gray-800">
              <h3 className="font-bold text-indigo-400 mb-3">Exportar Configuración</h3>
              <button
                onClick={exportConfig}
                disabled={loading}
                className="w-full px-4 py-2 bg-indigo-600 text-white rounded font-medium hover:bg-indigo-700 disabled:opacity-50"
              >
                {loading ? 'Exportando...' : 'Descargar Config JSON'}
              </button>
            </div>

            <div className="bg-white dark:bg-gray-900 p-5 rounded-xl border border-gray-200 dark:border-gray-800">
              <h3 className="font-bold text-indigo-400 mb-3">Tablas de Base de Datos</h3>
              <div className="flex flex-wrap gap-2">
                {DB_TABLES.map(t => (
                  <span key={t} className="px-3 py-1 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded text-xs text-gray-600 dark:text-gray-300 font-mono">
                    {t}
                  </span>
                ))}
              </div>
            </div>

            <Modal open={showPurgeConfirm} onClose={() => setShowPurgeConfirm(false)} title="Confirmar Purga de Datos">
              <div className="space-y-4">
                <p className="text-gray-600 dark:text-gray-300">Se eliminarán todos los registros de <strong>{purgeTarget}</strong> más antiguos que <strong>{purgeOlderThan} días</strong>. Esta acción no se puede deshacer.</p>
                <div className="flex gap-2 justify-end">
                  <button onClick={() => setShowPurgeConfirm(false)} className="px-4 py-2 bg-gray-100 dark:bg-white/[0.05] text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-white/[0.08]">Cancelar</button>
                  <button onClick={executePurge} disabled={loading} className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50">{loading ? 'Purgando...' : 'Purgar'}</button>
                </div>
              </div>
            </Modal>
          </>
        )}

        {tab === 'salud' && (
          <>
            <div className="bg-white dark:bg-gray-900 p-5 rounded-xl border border-gray-200 dark:border-gray-800">
              <h3 className="font-bold text-indigo-400 mb-3">Información del Entorno</h3>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-gray-400">SITE_URL:</span>
                  <div className="font-mono text-indigo-300 mt-1 break-all">{SITE_URL}</div>
                </div>
                <div>
                  <span className="text-gray-400">FUNCTIONS_URL:</span>
                  <div className="font-mono text-indigo-300 mt-1 break-all">{FUNCTIONS_URL}</div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <button
                onClick={checkHealth}
                disabled={loading}
                className="px-4 py-3 bg-blue-600 text-white rounded font-medium hover:bg-blue-700 disabled:opacity-50 text-center"
              >
                {loading ? 'Comprobando...' : 'Health Check'}
              </button>
              <button
                onClick={() => setCostResetConfirm(true)}
                className="px-4 py-3 bg-orange-600 text-white rounded font-medium hover:bg-orange-700 text-center"
              >
                Reiniciar Costes
              </button>
              <button
                onClick={triggerBackup}
                disabled={loading}
                className="px-4 py-3 bg-indigo-600 text-white rounded font-medium hover:bg-indigo-700 disabled:opacity-50 text-center"
              >
                {loading ? 'Creando...' : 'Manual Backup'}
              </button>
            </div>

            {health && (
              <div className="bg-white dark:bg-gray-900 p-5 rounded-xl border border-gray-200 dark:border-gray-800">
                <h3 className="font-bold text-indigo-400 mb-2">Health Check Result</h3>
                <pre className="text-xs text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 p-3 rounded overflow-auto max-h-48">
                  {JSON.stringify(health, null, 2)}
                </pre>
              </div>
            )}

            <div className="bg-white dark:bg-gray-900 p-5 rounded-xl border border-gray-200 dark:border-gray-800">
              <h3 className="font-bold text-indigo-400 mb-3">Tablas de Base de Datos</h3>
              <div className="flex flex-wrap gap-2">
                {DB_TABLES.map(t => (
                  <span key={t} className="px-3 py-1 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded text-xs text-gray-600 dark:text-gray-300 font-mono">
                    {t}
                  </span>
                ))}
              </div>
            </div>

            <div className="bg-white dark:bg-gray-900 p-5 rounded-xl border border-gray-200 dark:border-gray-800">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-bold text-indigo-400">Otras Claves de Configuración</h3>
                <button
                  onClick={() => {
                    setNewKey('');
                    setNewVal('');
                    setShowAddConfig(true);
                  }}
                  className="px-3 py-1 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700"
                >
                  + Agregar
                </button>
              </div>
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {configs
                  .filter(c => !Object.keys(CONFIG_META).includes(c.key))
                  .map(c => (
                    <div key={c.id} className="flex items-center justify-between p-2 bg-gray-100 dark:bg-gray-800 rounded text-sm border border-gray-200 dark:border-gray-700">
                      <div>
                        <div className="font-semibold text-gray-100">{c.key}</div>
                        <div className="text-xs text-gray-500">{c.value.substring(0, 50)}{c.value.length > 50 ? '...' : ''}</div>
                      </div>
                      <button
                        onClick={() => deleteConfig(c.id, c.key)}
                        className="px-2 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700"
                      >
                        Eliminar
                      </button>
                    </div>
                  ))}
              </div>
            </div>

            <Modal open={showAddConfig} onClose={() => setShowAddConfig(false)} title="Agregar Configuración">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Clave</label>
                  <input
                    type="text"
                    value={newKey}
                    onChange={(e) => setNewKey(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded text-gray-100"
                    placeholder="CONFIG_KEY"
                    disabled={Object.keys(CONFIG_META).includes(newKey)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Valor</label>
                  <textarea
                    value={newVal}
                    onChange={(e) => setNewVal(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded text-gray-100 text-sm font-mono"
                    placeholder="value"
                    rows={4}
                  />
                </div>
                <div className="flex gap-2 justify-end">
                  <button onClick={() => setShowAddConfig(false)} className="px-4 py-2 bg-gray-100 dark:bg-white/[0.05] text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-white/[0.08]">Cancelar</button>
                  <button onClick={addConfig} className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700">Crear</button>
                </div>
              </div>
            </Modal>
          </>
        )}

        {tab === 'backup' && <BackupTab configs={configs} editedValues={editedValues} setEditedValue={setEditedValue} saveConfig={saveConfig} />}

        {tab === 'openclaw' && (
          <>
            {/* Connection status card */}
            <div className="bg-white dark:bg-gray-900 p-5 rounded-xl border border-gray-200 dark:border-gray-800">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-indigo-400">Estado de la conexión</h3>
                <button
                  onClick={checkOpenclawHealth}
                  disabled={openclawHealthLoading}
                  className="flex items-center gap-2 px-3 py-1.5 bg-indigo-500/15 text-indigo-400 border border-indigo-500/20 rounded-lg text-xs font-medium hover:bg-indigo-500/25 transition-colors disabled:opacity-40"
                >
                  {openclawHealthLoading ? (
                    <><svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Verificando...</>
                  ) : '↻ Verificar conexión'}
                </button>
              </div>
              {openclawHealth === null && !openclawHealthLoading && (
                <p className="text-sm text-gray-500">Haz clic en «Verificar conexión» para comprobar el estado del servidor OpenClaw.</p>
              )}
              {openclawHealth && (
                <div className={`rounded-xl p-4 flex items-start gap-3 ${openclawHealth.ok ? 'bg-green-500/10 border border-green-500/20' : 'bg-red-500/10 border border-red-500/20'}`}>
                  <span className="text-xl mt-0.5">{openclawHealth.ok ? '✅' : '❌'}</span>
                  <div className="space-y-1 text-sm">
                    {openclawHealth.ok ? (
                      <>
                        <div className="font-medium text-green-400">Servidor accesible</div>
                        {openclawHealth.status && <div className="text-gray-400">Estado: <span className="text-gray-200">{openclawHealth.status}</span></div>}
                        {openclawHealth.version && <div className="text-gray-400">Versión: <span className="font-mono text-gray-200">{openclawHealth.version}</span></div>}
                        {openclawHealth.uptime != null && <div className="text-gray-400">Uptime: <span className="font-mono text-gray-200">{Math.floor(openclawHealth.uptime / 60)}m {openclawHealth.uptime % 60}s</span></div>}
                      </>
                    ) : (
                      <>
                        <div className="font-medium text-red-400">No se pudo conectar</div>
                        {openclawHealth.error && <div className="text-gray-400 text-xs font-mono">{openclawHealth.error}</div>}
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Server details */}
            <div className="bg-white dark:bg-gray-900 p-5 rounded-xl border border-gray-200 dark:border-gray-800">
              <h3 className="font-bold text-indigo-400 mb-3">Servidor OpenClaw</h3>
              <div className="space-y-3">
                {['OPENCLAW_VPS_HOST', 'OPENCLAW_VPS_PORT'].map(key => {
                  const config = getConfig(key);
                  const meta = CONFIG_META[key];
                  return config ? renderConfigRow(config, meta) : renderMissingConfig(key, meta);
                })}
              </div>
            </div>

            {/* Auth token */}
            <div className="bg-white dark:bg-gray-900 p-5 rounded-xl border border-gray-200 dark:border-gray-800">
              <h3 className="font-bold text-indigo-400 mb-3">Autenticación</h3>
              <div className="space-y-3">
                {['OPENCLAW_BACKUP_TOKEN'].map(key => {
                  const config = getConfig(key);
                  const meta = CONFIG_META[key];
                  return config ? renderConfigRow(config, meta) : renderMissingConfig(key, meta);
                })}
              </div>
            </div>

            {/* Gateway port */}
            <div className="bg-white dark:bg-gray-900 p-5 rounded-xl border border-gray-200 dark:border-gray-800">
              <h3 className="font-bold text-indigo-400 mb-3">Gateway</h3>
              <div className="space-y-3">
                {['OPENCLAW_GATEWAY_PORT'].map(key => {
                  const config = getConfig(key);
                  const meta = CONFIG_META[key];
                  return config ? renderConfigRow(config, meta) : renderMissingConfig(key, meta);
                })}
              </div>
            </div>
          </>
        )}

        {tab === 'skills' && (() => {
          // Compute filtered + searched skills from DB catalog
          const filteredSkills = skillsCatalog.filter(s => {
            if (skillsFilter === 'workspace' && !s.workspace_enabled) return false;
            if (skillsFilter === 'bundled' && s.workspace_enabled) return false;
            if (skillsSearch) {
              const q = skillsSearch.toLowerCase();
              if (!s.skill_id.toLowerCase().includes(q) && !s.name.toLowerCase().includes(q)) return false;
            }
            return true;
          });

          // Staleness check
          const isStale = skillsLastSync
            ? (Date.now() - new Date(skillsLastSync).getTime()) > 24 * 60 * 60 * 1000
            : true;

          const levelLabel = (lvl: number) =>
            lvl === 0 ? 'Director' : lvl === 1 ? 'Manager' : 'Especialista';
          const levelColor = (lvl: number) =>
            lvl === 0 ? 'bg-purple-500/20 text-purple-300'
            : lvl === 1 ? 'bg-blue-500/20 text-blue-300'
            : 'bg-cyan-500/20 text-cyan-300';

          return (
          <>
            {/* Header: sync status + filters */}
            <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">⚡</span>
                  <div>
                    <h3 className="font-bold text-indigo-300">Catálogo de Skills</h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Sincronizado desde OpenClaw vía <code className="bg-gray-800 px-1 rounded text-indigo-300">skills-sync</code>
                      {skillsLastSync ? (
                        <span className={`ml-2 ${isStale ? 'text-orange-400' : 'text-gray-500'}`}>
                          · última sync {new Date(skillsLastSync).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                          {isStale && ' ⚠️ hace más de 24h'}
                        </span>
                      ) : (
                        <span className="ml-2 text-orange-400">· sin datos — ejecuta sync desde OpenClaw</span>
                      )}
                    </p>
                  </div>
                </div>
                <button
                  onClick={loadSkillsData}
                  className="text-xs px-3 py-1.5 bg-indigo-500/15 text-indigo-400 border border-indigo-500/20 rounded-lg hover:bg-indigo-500/25 transition-colors whitespace-nowrap"
                >
                  ↻ Recargar
                </button>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <div className="flex rounded-lg overflow-hidden border border-gray-700 text-xs">
                  {(['workspace', 'bundled', 'all'] as const).map(f => (
                    <button
                      key={f}
                      onClick={() => setSkillsFilter(f)}
                      className={`px-3 py-1.5 transition-colors ${skillsFilter === f ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
                    >
                      {f === 'workspace' ? 'Workspace' : f === 'bundled' ? 'Bundled' : 'Todas'}
                      {f === 'workspace' && <span className="ml-1 text-purple-300">{skillsCatalog.filter(s => s.workspace_enabled).length}</span>}
                      {f === 'bundled' && <span className="ml-1 text-gray-500">{skillsCatalog.filter(s => !s.workspace_enabled).length}</span>}
                      {f === 'all' && <span className="ml-1 text-gray-500">{skillsCatalog.length}</span>}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={skillsSearch}
                  onChange={e => setSkillsSearch(e.target.value)}
                  placeholder="Buscar skill…"
                  className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-xs text-gray-300 placeholder-gray-600 focus:outline-none focus:border-indigo-500/50 w-48"
                />
              </div>
            </div>

            {/* Empty state */}
            {skillsCatalog.length === 0 && (
              <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-10 text-center">
                <div className="text-4xl mb-3">📡</div>
                <p className="text-gray-400 font-medium mb-1">Catálogo vacío</p>
                <p className="text-sm text-gray-600">Ejecuta la sincronización desde OpenClaw para poblar el catálogo.</p>
              </div>
            )}

            {/* Skill cards from DB catalog */}
            {filteredSkills.map(skill => {
              const apiDef = SKILL_REGISTRY.find(r => r.id === skill.skill_id);
              const isExpanded = skillsExpandedCards.has(skill.skill_id);

              return (
                <div key={skill.skill_id} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
                  {/* Skill header */}
                  <button
                    className="w-full text-left p-5 border-b border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors"
                    onClick={() => setSkillsExpandedCards(prev => {
                      const next = new Set(prev);
                      next.has(skill.skill_id) ? next.delete(skill.skill_id) : next.add(skill.skill_id);
                      return next;
                    })}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className="font-bold text-gray-900 dark:text-gray-100">{skill.name}</span>
                          {/* Source badge */}
                          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${skill.workspace_enabled ? 'bg-purple-500/20 text-purple-300' : 'bg-gray-500/20 text-gray-400'}`}>
                            {skill.workspace_enabled ? 'Workspace' : 'Bundled'}
                          </span>
                          {/* API badge */}
                          {apiDef && (
                            <span className="text-xs px-1.5 py-0.5 rounded font-medium bg-blue-500/20 text-blue-300">API</span>
                          )}
                          {/* Ready badge */}
                          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${skill.ready ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'}`}>
                            {skill.ready ? '✓ Ready' : '✗ Bloqueada'}
                          </span>
                        </div>
                        {skill.description && (
                          <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{skill.description}</p>
                        )}
                        {!skill.ready && skill.blocked_reasons && (skill.blocked_reasons as string[]).length > 0 && (
                          <p className="text-xs text-red-400/70 mt-0.5 truncate">
                            ↳ {(skill.blocked_reasons as string[]).join(' · ')}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <code className="text-xs text-gray-500 hidden sm:block">{skill.skill_id}</code>
                        <span className="text-gray-500 text-sm">{isExpanded ? '▲' : '▼'}</span>
                      </div>
                    </div>
                  </button>

                  {/* Expanded: agent access + optional API config */}
                  {isExpanded && (
                    <div className="p-5 space-y-4">

                      {/* API credential section (only for skills in SKILL_REGISTRY) */}
                      {apiDef && (
                        <div>
                          <h4 className="text-xs font-semibold text-blue-400 uppercase tracking-wider mb-2">Credenciales API</h4>
                          <div className="space-y-2">
                            {skillsAgents.filter(a => a.level === 0).map(agent => {
                              const directConfig = allAgentConfigs.find(c => c.agent_id === agent.id && c.key === apiDef.triggerKey);
                              const hasSkill = !!directConfig;
                              return (
                                <div key={agent.id} className={`rounded-lg border p-3 ${hasSkill ? 'border-green-500/30 bg-green-500/5' : 'border-gray-700 bg-gray-800/30'}`}>
                                  <div className="flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 font-medium">Director</span>
                                      <span className="font-medium text-gray-200 text-sm">{agent.name}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      {hasSkill ? (
                                        <>
                                          <span className="text-xs text-green-400">✓ Configurado</span>
                                          <button onClick={() => removeSkillConfig(agent.id, apiDef.triggerKey)} className="text-xs px-2 py-1 bg-red-500/10 text-red-400 border border-red-500/20 rounded hover:bg-red-500/20">Quitar</button>
                                        </>
                                      ) : (
                                        <button
                                          onClick={() => { setShowAddSkillConfig({ skillId: apiDef.id, configKey: apiDef.triggerKey, agentId: agent.id }); setSkillConfigValue(''); setSkillConfigDesc(`Conexión ${skill.name} para ${agent.name}`); setSkillConfigSecret(true); }}
                                          className="text-xs px-2 py-1 bg-indigo-500/15 text-indigo-400 border border-indigo-500/20 rounded hover:bg-indigo-500/25"
                                        >+ Asignar</button>
                                      )}
                                    </div>
                                  </div>
                                  {hasSkill && (
                                    <div className="mt-2 space-y-1">
                                      <div className="flex items-center gap-2 text-xs">
                                        <code className="text-indigo-300 bg-gray-800 px-1 rounded">{apiDef.triggerKey}</code>
                                        <span className="text-gray-500">= {directConfig.is_secret ? '••••••••' : directConfig.value.substring(0, 24)}</span>
                                      </div>
                                      {Object.entries(apiDef.optionalKeys).map(([optKey, optLabel]) => {
                                        const optConfig = allAgentConfigs.find(c => c.agent_id === agent.id && c.key === optKey);
                                        return (
                                          <div key={optKey} className="flex items-center justify-between text-xs">
                                            <div className="flex items-center gap-2">
                                              <code className="text-gray-400 bg-gray-800 px-1 rounded">{optKey}</code>
                                              {optConfig ? <span className="text-gray-500">= {optConfig.is_secret ? '••••••••' : optConfig.value}</span> : <span className="text-orange-400">no configurado</span>}
                                            </div>
                                            {!optConfig && (
                                              <button onClick={() => { setShowAddSkillConfig({ skillId: apiDef.id, configKey: optKey, agentId: agent.id }); setSkillConfigValue(''); setSkillConfigDesc(optLabel); setSkillConfigSecret(false); }} className="text-xs px-1.5 py-0.5 bg-orange-500/10 text-orange-400 border border-orange-500/20 rounded hover:bg-orange-500/20">+ Añadir</button>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Agent access overrides */}
                      <div>
                        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Acceso por agente</h4>
                        {skillsAgents.length === 0 ? (
                          <p className="text-sm text-gray-500 text-center py-3">Cargando agentes…</p>
                        ) : (
                          <div className="space-y-1.5">
                            {skillsAgents.map(agent => {
                              const override = skillOverrides.find(o => o.agent_id === agent.id && o.skill_id === skill.skill_id);
                              const isBlocked = override && !override.allowed;
                              return (
                                <div key={agent.id} className={`flex items-center justify-between gap-3 px-3 py-2 rounded-lg text-sm ${isBlocked ? 'bg-red-500/5 border border-red-500/20' : 'bg-gray-50 dark:bg-gray-800/40 border border-transparent'}`}>
                                  <div className="flex items-center gap-2 min-w-0">
                                    {'  '.repeat(agent.level).split('').map((_, i) => (
                                      <span key={i} className="w-3 inline-block shrink-0"></span>
                                    ))}
                                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium shrink-0 ${levelColor(agent.level)}`}>
                                      {levelLabel(agent.level)}
                                    </span>
                                    <span className="text-gray-300 truncate">{agent.name}</span>
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0">
                                    {isBlocked ? (
                                      <>
                                        <span className="text-xs text-red-400">⊘ Bloqueada</span>
                                        <button
                                          onClick={() => unblockSkill(override!.id, agent.name)}
                                          className="text-xs px-2 py-1 bg-green-500/10 text-green-400 border border-green-500/20 rounded hover:bg-green-500/20 transition-colors"
                                        >
                                          Restaurar acceso
                                        </button>
                                      </>
                                    ) : (
                                      <>
                                        <span className="text-xs text-gray-500">✓ Acceso heredado</span>
                                        <button
                                          onClick={() => blockSkill(agent.id, skill.skill_id, agent.name)}
                                          className="text-xs px-2 py-1 bg-red-500/10 text-red-400 border border-red-500/20 rounded hover:bg-red-500/20 transition-colors"
                                        >
                                          Bloquear
                                        </button>
                                      </>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Add skill config modal */}
            {showAddSkillConfig && (
              <Modal onClose={() => setShowAddSkillConfig(null)}>
                <div className="space-y-4">
                  <h3 className="text-lg font-bold text-indigo-400">
                    Configurar: <code className="text-sm text-gray-300">{showAddSkillConfig.configKey}</code>
                  </h3>
                  <p className="text-sm text-gray-400">
                    Agente: <strong className="text-gray-200">{skillsAgents.find(a => a.id === showAddSkillConfig.agentId)?.name}</strong>
                  </p>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Valor *</label>
                      <input
                        type={skillConfigSecret ? 'password' : 'text'}
                        value={skillConfigValue}
                        onChange={e => setSkillConfigValue(e.target.value)}
                        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-gray-100 text-sm focus:border-indigo-500 focus:outline-none"
                        placeholder="Ej: 0a340428-2f6d-4ef6-bc1c-61e8009bc06a"
                        autoFocus
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Descripción</label>
                      <input
                        type="text"
                        value={skillConfigDesc}
                        onChange={e => setSkillConfigDesc(e.target.value)}
                        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-gray-100 text-sm focus:border-indigo-500 focus:outline-none"
                        placeholder="Descripción de la config"
                      />
                    </div>
                    <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={skillConfigSecret}
                        onChange={e => setSkillConfigSecret(e.target.checked)}
                        className="rounded"
                      />
                      Es secreto (se oculta en el panel)
                    </label>
                  </div>
                  <div className="flex gap-2 justify-end pt-2">
                    <button
                      onClick={() => setShowAddSkillConfig(null)}
                      className="px-4 py-2 bg-gray-700 text-gray-300 rounded hover:bg-gray-600"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={addSkillConfig}
                      className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 font-medium"
                    >
                      Guardar
                    </button>
                  </div>
                </div>
              </Modal>
            )}
          </>
          );
        })()}

        {tab === 'seguridad' && (
          <SecurityTab />
        )}
      </div>
    </div>
  );
}

// ─── Backup Tab ───────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
    </svg>
  );
}

function fmtDate(d: string) {
  return d ? new Date(d).toLocaleString('es-ES', { day:'2-digit', month:'2-digit', year:'2-digit', hour:'2-digit', minute:'2-digit' }) : '—';
}

const BACKUP_CFG_KEYS = ['BACKUP_ENABLED','BACKUP_TARGET','BACKUP_RETENTION_DAYS','DROPBOX_TOKEN','GDRIVE_TOKEN','GDRIVE_FOLDER_ID'];

function BackupTab({
  configs, editedValues, setEditedValue, saveConfig
}: {
  configs: ConfigEntry[];
  editedValues: Record<string, string>;
  setEditedValue: (id: string, v: string) => void;
  saveConfig: (id: string) => void;
}) {
  const [panelBackups, setPanelBackups]         = useState<any[]>([]);
  const [oclawBackups, setOclawBackups]         = useState<any[]>([]);
  const [panelLoading, setPanelLoading]         = useState(false);
  const [oclawLoading, setOclawLoading]         = useState(false);
  const [panelRunning, setPanelRunning]         = useState('');
  const [oclawRunning, setOclawRunning]         = useState(false);
  const [syncRunning, setSyncRunning]           = useState('');
  const [panelResult, setPanelResult]           = useState<{ type: 'ok'|'err'; msg: string }|null>(null);
  const [oclawResult, setOclawResult]           = useState<{ type: 'ok'|'err'; msg: string }|null>(null);
  const [syncResult, setSyncResult]             = useState<{ type: 'ok'|'err'; msg: string }|null>(null);

  const loadPanelBackups = async () => {
    setPanelLoading(true);
    try { const d = await fnCall('backup-manager'); setPanelBackups(d.backups || []); } catch {}
    setPanelLoading(false);
  };

  const loadOclawBackups = async () => {
    setOclawLoading(true);
    try { const d = await fnCall('openclaw-backup', 'GET'); setOclawBackups(d.backups || []); } catch {}
    setOclawLoading(false);
  };

  const triggerPanelBackup = async () => {
    setPanelRunning('backup'); setPanelResult(null);
    try {
      const d = await fnCall('backup-manager', 'POST');
      setPanelResult({ type: 'ok', msg: `Backup creado: ${d.total_rows ?? ''} filas · ${d.size_kb ?? '?'}KB` });
      loadPanelBackups();
    } catch (e: any) { setPanelResult({ type: 'err', msg: e.message }); }
    setPanelRunning('');
  };

  const triggerOclawBackup = async () => {
    setOclawRunning(true); setOclawResult(null);
    try {
      const d = await fnCall('openclaw-backup', 'POST');
      if (d.success) {
        setOclawResult({ type: 'ok', msg: `Backup creado: ${d.backup_id} (${d.size})` });
        loadOclawBackups();
      } else {
        setOclawResult({ type: 'err', msg: d.logs?.join(' · ') || 'Fallo desconocido' });
      }
    } catch (e: any) { setOclawResult({ type: 'err', msg: e.message }); }
    setOclawRunning(false);
  };

  const triggerSync = async (source: 'panel' | 'openclaw') => {
    setSyncRunning(source); setSyncResult(null);
    try {
      const d = await fnCall('backup-sync', 'POST', { source });
      setSyncResult({ type: 'ok', msg: `Sincronizado: ${JSON.stringify(d).slice(0,80)}` });
    } catch (e: any) {
      const msg = e.message || '';
      // surface missing token as a friendly message
      if (msg.includes('DROPBOX_TOKEN') || msg.includes('not configured')) {
        setSyncResult({ type: 'err', msg: 'Token no configurado — revisa DROPBOX_TOKEN / GDRIVE_TOKEN abajo.' });
      } else {
        setSyncResult({ type: 'err', msg: msg });
      }
    }
    setSyncRunning('');
  };

  useEffect(() => { loadPanelBackups(); loadOclawBackups(); }, []);

  const cfgEntries = BACKUP_CFG_KEYS
    .map(k => configs.find(c => c.key === k))
    .filter(Boolean) as ConfigEntry[];

  return (
    <div className="space-y-6">

      {/* ── Panel (Insforge DB) ─────────────────────── */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <span className="text-base">🗄️</span>
          <h3 className="font-semibold text-gray-900 dark:text-white text-sm">Panel · Insforge DB</h3>
          <span className="text-xs text-gray-500">Snapshot de base de datos y funciones</span>
        </div>

        <div className="flex flex-wrap gap-2">
          <button onClick={triggerPanelBackup} disabled={!!panelRunning}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-lg text-sm font-medium transition-colors">
            {panelRunning === 'backup' ? <><Spinner/>Creando...</> : '+ Backup ahora'}
          </button>
          <button onClick={() => triggerSync('panel')} disabled={!!syncRunning}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-40 text-gray-700 dark:text-gray-200 rounded-lg text-sm font-medium transition-colors">
            {syncRunning === 'panel' ? <><Spinner/>Sincronizando...</> : '☁ Copiar a Dropbox/Drive'}
          </button>
        </div>

        {panelResult && (
          <div className={`text-xs px-3 py-2 rounded-lg border ${panelResult.type === 'ok' ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
            {panelResult.msg}
          </div>
        )}

        <div className="space-y-1.5 max-h-52 overflow-y-auto">
          {panelLoading ? (
            <div className="flex items-center gap-2 text-gray-500 text-sm py-2"><Spinner/>Cargando...</div>
          ) : panelBackups.length === 0 ? (
            <div className="text-sm text-gray-500 py-2">Sin backups todavía</div>
          ) : panelBackups.map((b, i) => (
            <div key={b.key || i} className="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-800 rounded-lg text-sm">
              <span className="text-gray-700 dark:text-gray-300 truncate flex-1 font-mono text-xs">{b.key || b.name}</span>
              <span className="text-gray-400 text-xs ml-3 whitespace-nowrap">{fmtDate(b.created_at)}{b.size_bytes ? ` · ${(b.size_bytes/1024).toFixed(0)}KB` : ''}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── OpenClaw (VPS) ─────────────────────────── */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <span className="text-base">🤖</span>
          <h3 className="font-semibold text-gray-900 dark:text-white text-sm">OpenClaw · VPS</h3>
          <span className="text-xs text-gray-500">Agentes, configuración y workspace</span>
        </div>

        <div className="flex flex-wrap gap-2">
          <button onClick={triggerOclawBackup} disabled={oclawRunning}
            className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white rounded-lg text-sm font-medium transition-colors">
            {oclawRunning ? <><Spinner/>Creando... (1–2 min)</> : '+ Backup OpenClaw'}
          </button>
          <button onClick={() => triggerSync('openclaw')} disabled={!!syncRunning}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-40 text-gray-700 dark:text-gray-200 rounded-lg text-sm font-medium transition-colors">
            {syncRunning === 'openclaw' ? <><Spinner/>Sincronizando...</> : '☁ Copiar a Dropbox/Drive'}
          </button>
        </div>

        {oclawResult && (
          <div className={`text-xs px-3 py-2 rounded-lg border ${oclawResult.type === 'ok' ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
            {oclawResult.msg}
          </div>
        )}

        <div className="space-y-1.5 max-h-52 overflow-y-auto">
          {oclawLoading ? (
            <div className="flex items-center gap-2 text-gray-500 text-sm py-2"><Spinner/>Cargando...</div>
          ) : oclawBackups.length === 0 ? (
            <div className="text-sm text-gray-500 py-2">Sin backups en el VPS</div>
          ) : oclawBackups.map((b, i) => (
            <div key={b.id || i} className="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-800 rounded-lg text-sm">
              <span className="text-gray-700 dark:text-gray-300 truncate flex-1 font-mono text-xs">{b.name}</span>
              <span className="text-gray-400 text-xs ml-3 whitespace-nowrap">{fmtDate(b.created_at)}{b.size ? ` · ${b.size}` : ''}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Sync result */}
      {syncResult && (
        <div className={`text-xs px-3 py-2 rounded-lg border ${syncResult.type === 'ok' ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
          {syncResult.type === 'err' && '⚠ '}{syncResult.msg}
        </div>
      )}

      {/* ── Configuración ─────────────────────────── */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 space-y-4">
        <h3 className="font-semibold text-gray-900 dark:text-white text-sm">⚙ Configuración de Backups</h3>
        <div className="space-y-3">
          {cfgEntries.map(c => {
            const meta = CONFIG_META[c.key as keyof typeof CONFIG_META];
            const isPassword = meta?.type === 'password';
            const isBool = meta?.type === 'bool';
            const current = editedValues[c.id] ?? c.value;
            return (
              <div key={c.id} className="grid grid-cols-3 gap-3 items-center text-sm">
                <div>
                  <div className="font-medium text-gray-700 dark:text-gray-200">{meta?.label || c.key}</div>
                  <div className="text-xs text-gray-500">{meta?.desc || ''}</div>
                </div>
                {isBool ? (
                  <div className="col-span-2 flex items-center gap-3">
                    <button
                      onClick={() => { setEditedValue(c.id, current === 'true' ? 'false' : 'true'); }}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${current === 'true' ? 'bg-indigo-600' : 'bg-gray-300 dark:bg-gray-600'}`}
                    >
                      <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${current === 'true' ? 'translate-x-5' : 'translate-x-1'}`}/>
                    </button>
                    <button onClick={() => saveConfig(c.id)} className="text-xs text-indigo-400 hover:text-indigo-300">Guardar</button>
                  </div>
                ) : (
                  <div className="col-span-2 flex gap-2">
                    <input
                      type={isPassword ? 'password' : 'text'}
                      value={current}
                      onChange={e => setEditedValue(c.id, e.target.value)}
                      className="flex-1 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-700 dark:text-gray-200 font-mono"
                    />
                    <button onClick={() => saveConfig(c.id)} className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium transition-colors">
                      Guardar
                    </button>
                  </div>
                )}
              </div>
            );
          })}
          {cfgEntries.length === 0 && (
            <p className="text-sm text-gray-500">No hay configuración de backup guardada en system_config.</p>
          )}
        </div>
      </div>

      {/* ── Programación de backups ─────────────────── */}
      <BackupScheduler />

    </div>
  );
}

// ─── Backup Scheduler ─────────────────────────────────────────────────────────

const CRON_PRESETS = [
  { label: 'Cada hora',          value: '0 * * * *' },
  { label: 'Cada 6 horas',       value: '0 */6 * * *' },
  { label: 'Diario (02:00)',      value: '0 2 * * *' },
  { label: 'Semanal (lunes)',     value: '0 2 * * 1' },
  { label: 'Mensual (día 1)',     value: '0 2 1 * *' },
];

const BACKUP_TYPE_OPTIONS = [
  { value: 'panel',    label: '🗄️ Panel (DB)' },
  { value: 'openclaw', label: '🤖 OpenClaw (VPS)' },
  { value: 'both',     label: '🗄️🤖 Ambos' },
];

function BackupScheduler() {
  const [schedules, setSchedules] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', cron_expression: '0 2 * * *', backup_type: 'both' });
  const [msg, setMsg] = useState('');
  const [toggling, setToggling] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const fmtDate = (d: string) => d ? new Date(d).toLocaleString('es-ES', { day:'2-digit', month:'2-digit', year:'2-digit', hour:'2-digit', minute:'2-digit' }) : '—';

  const load = async () => {
    setLoading(true);
    try {
      const data = await dbGet('schedules', 'select=*&name=like.backup*&order=created_at.desc');
      setSchedules(Array.isArray(data) ? data : []);
    } catch { setSchedules([]); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const addSchedule = async () => {
    if (!form.name || !form.cron_expression) return;
    setSaving(true); setMsg('');
    try {
      await dbPost('schedules', [{
        name: form.name,
        description: `Backup automático: ${BACKUP_TYPE_OPTIONS.find(o => o.value === form.backup_type)?.label}`,
        cron_expression: form.cron_expression,
        task_prompt: `backup:${form.backup_type}`,
        status: 'active',
      }]);
      setShowAdd(false);
      setForm({ name: '', cron_expression: '0 2 * * *', backup_type: 'both' });
      load();
    } catch (e: any) { setMsg(`Error: ${e.message}`); }
    setSaving(false);
  };

  const toggleSchedule = async (id: string, current: string) => {
    setToggling(id);
    try {
      await dbPatch('schedules', `id=eq.${id}`, { status: current === 'active' ? 'paused' : 'active' });
      load();
    } catch {}
    setToggling(null);
  };

  const deleteSchedule = async (id: string) => {
    if (!confirm('¿Eliminar esta programación?')) return;
    setDeleting(id);
    try {
      await dbDelete('schedules', `id=eq.${id}`);
      load();
    } catch {}
    setDeleting(null);
  };

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900 dark:text-white text-sm">🕐 Programación automática</h3>
        <button onClick={() => setShowAdd(v => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium transition-colors">
          + Nueva
        </button>
      </div>

      {showAdd && (
        <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 space-y-3 border border-gray-200 dark:border-gray-700">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs text-gray-500 mb-1">Nombre</label>
              <input value={form.name} onChange={e => setForm({...form, name: e.target.value})}
                placeholder="backup-diario"
                className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-700 dark:text-gray-200 outline-none focus:border-indigo-500" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Qué hacer</label>
              <select value={form.backup_type} onChange={e => setForm({...form, backup_type: e.target.value})}
                className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-700 dark:text-gray-200 outline-none focus:border-indigo-500">
                {BACKUP_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Frecuencia</label>
              <select value={form.cron_expression} onChange={e => setForm({...form, cron_expression: e.target.value})}
                className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-700 dark:text-gray-200 outline-none focus:border-indigo-500">
                {CRON_PRESETS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
          </div>
          <div className="text-xs text-gray-400 font-mono">{form.cron_expression}</div>
          {msg && <div className="text-xs text-red-400">{msg}</div>}
          <div className="flex gap-2">
            <button onClick={() => setShowAdd(false)} className="px-3 py-1.5 bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-lg text-xs font-medium">Cancelar</button>
            <button onClick={addSchedule} disabled={saving || !form.name}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-lg text-xs font-medium flex items-center gap-1.5">
              {saving ? <><Spinner/>Guardando...</> : 'Guardar'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-gray-500 text-sm"><Spinner/>Cargando...</div>
      ) : schedules.length === 0 ? (
        <p className="text-sm text-gray-500">Sin programaciones creadas.</p>
      ) : (
        <div className="space-y-2">
          {schedules.map(s => (
            <div key={s.id} className="flex items-center justify-between px-3 py-2.5 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate">{s.name}</div>
                <div className="text-xs text-gray-500 font-mono">{s.cron_expression}
                  {s.last_run_at ? <span className="ml-2 not-italic font-sans">· último: {fmtDate(s.last_run_at)}</span> : null}
                </div>
              </div>
              <div className="flex items-center gap-2 ml-3">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.status === 'active' ? 'bg-indigo-500/15 text-indigo-400' : 'bg-gray-500/15 text-gray-400'}`}>
                  {s.status === 'active' ? 'Activo' : 'Pausado'}
                </span>
                <button onClick={() => toggleSchedule(s.id, s.status)} disabled={toggling === s.id}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-400 hover:bg-indigo-500/10 transition-colors text-xs">
                  {toggling === s.id ? <Spinner/> : s.status === 'active' ? '⏸' : '▶'}
                </button>
                <button onClick={() => deleteSchedule(s.id)} disabled={deleting === s.id}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors">
                  {deleting === s.id ? <Spinner/> : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SecurityTab() {
  const [currentPass, setCurrentPass] = useState('');
  const [newPass, setNewPass]         = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [passMsg, setPassMsg]         = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [savingPass, setSavingPass]   = useState(false);

  async function handleChangePass(e: React.FormEvent) {
    e.preventDefault();
    if (newPass !== confirmPass) { setPassMsg({ type: 'err', text: 'Las contraseñas nuevas no coinciden' }); return; }
    if (newPass.length < 6)     { setPassMsg({ type: 'err', text: 'La contraseña debe tener al menos 6 caracteres' }); return; }
    setSavingPass(true);
    setPassMsg(null);
    try {
      const currentHash = await sha256(currentPass);
      if (currentHash !== getPassHash()) {
        setPassMsg({ type: 'err', text: 'La contraseña actual es incorrecta' });
        return;
      }
      const newHash = await sha256(newPass);
      localStorage.setItem(PASS_HASH_KEY, newHash);
      setPassMsg({ type: 'ok', text: 'Contraseña actualizada correctamente' });
      setCurrentPass(''); setNewPass(''); setConfirmPass('');
    } catch {
      setPassMsg({ type: 'err', text: 'Error al actualizar la contraseña' });
    } finally {
      setSavingPass(false);
    }
  }

  function handleLogout() {
    clearSession();
    window.location.reload();
  }

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-gray-900 p-5 rounded-xl border border-gray-200 dark:border-gray-800">
        <h3 className="font-bold text-indigo-400 mb-4">Cambiar contraseña de acceso</h3>
        <form onSubmit={handleChangePass} className="space-y-3 max-w-sm">
          {([
            { label: 'Contraseña actual', value: currentPass, setter: setCurrentPass },
            { label: 'Nueva contraseña',  value: newPass,     setter: setNewPass },
            { label: 'Confirmar nueva',   value: confirmPass, setter: setConfirmPass },
          ] as { label: string; value: string; setter: (v: string) => void }[]).map(({ label, value, setter }) => (
            <div key={label}>
              <label className="block text-xs text-gray-500 dark:text-slate-400 mb-1">{label}</label>
              <input
                type="password"
                value={value}
                onChange={e => { setter(e.target.value); setPassMsg(null); }}
                className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:border-indigo-500/50"
              />
            </div>
          ))}
          {passMsg && (
            <p className={`text-xs ${passMsg.type === 'ok' ? 'text-green-500' : 'text-red-400'}`}>{passMsg.text}</p>
          )}
          <button
            type="submit"
            disabled={savingPass || !currentPass || !newPass || !confirmPass}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-sm rounded-lg transition-colors"
          >
            {savingPass ? 'Guardando…' : 'Guardar contraseña'}
          </button>
        </form>
      </div>

      <div className="bg-white dark:bg-gray-900 p-5 rounded-xl border border-gray-200 dark:border-gray-800">
        <h3 className="font-bold text-red-400 mb-1">Cerrar sesión</h3>
        <p className="text-sm text-gray-500 dark:text-slate-500 mb-4">
          Finaliza tu sesión actual. Necesitarás la contraseña para volver a acceder.
        </p>
        <button
          onClick={handleLogout}
          className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-sm rounded-lg border border-red-500/20 transition-colors"
        >
          Cerrar sesión
        </button>
      </div>

      <PageHelp
        summary="Los ajustes centralizan toda la configuración del sistema: conexión a la base de datos, modelos de IA, claves API, funciones de backend, salud del sistema, usuarios, backups y seguridad."
        items={[
          { icon: '🔗', title: 'Conexión', description: 'Verifica el estado de conexión con Insforge y las funciones edge disponibles.' },
          { icon: '🤖', title: 'Agentes', description: 'Configuración global que aplica a todos los agentes: modelo por defecto, temperatura, tokens máximos.' },
          { icon: '⚙️', title: 'Funciones', description: 'Lista de funciones edge desplegadas en el backend con su estado y URL.' },
          { icon: '💾', title: 'Backups', description: 'Genera copias de seguridad de la base de datos y del servidor OpenClaw, con opción de sincronizar a Dropbox o Drive.' },
          { icon: '🔒', title: 'Seguridad', description: 'Gestión de contraseña de acceso al panel y cierre de sesión.' },
        ]}
      />
    </div>
  );
}
