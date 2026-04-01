export interface Agent {
  id: string;
  name: string;
  role: string;
  status: string;
  area: string;
  level: number;
  parent_agent_id: string | null;
  model: string;
  system_prompt: string;
  client_name: string | null;
  cost_used_today_eur: number;
  tokens_used_today: number;
  daily_cost_limit_action: string;
  tools_enabled: string[];
  requires_approval_actions: string[];
  created_at: string;
  updated_at: string;
  icon?: string | null;
  color?: string | null;
}

export interface Task {
  id: string;
  agent_id: string;
  title: string;
  description: string;
  status: string;
  priority: number;
  due_date: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Handoff {
  id: string;
  from_agent_id: string;
  to_agent_id: string;
  task_id: string | null;
  state: string;
  payload: any;
  result: any;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  agent_id: string;
  role: string;
  content: string;
  tokens_used: number;
  cost_eur: number;
  model: string;
  created_at: string;
}

export interface KnowledgeChunk {
  id: string;
  chatbot_id: string;
  tenant_id: string;
  content: string;
  source_type: string;
  source_name: string;
  token_count: number;
  created_at: string;
}

export interface Approval {
  id: string;
  agent_id: string;
  action_type: string;
  action_payload: any;
  status: string;
  decided_by: string | null;
  decided_at: string | null;
  created_at: string;
}

export interface AgentRun {
  id: string;
  agent_id: string;
  trigger: string;
  input_summary: string;
  result: string;
  output_summary: string;
  tokens_used: number;
  cost_eur: number;
  latency_ms: number;
  model: string;
  created_at: string;
}

export interface ActivityLogEntry {
  id: string;
  agent_id: string | null;
  event_type: string;
  summary: string;
  details: any;
  tags: string[];
  tokens_used: number;
  cost_estimate: number;
  timestamp: string;
}

export interface AgentMemory {
  id: string;
  agent_id: string;
  content: string;
  memory_type: string;
  importance: number;
  created_at: string;
}

export interface SystemConfig {
  id: string;
  key: string;
  value: string;
  created_at: string;
  updated_at: string;
}

export interface ModelCouncilSession {
  id: string;
  query: string;
  context: string | null;
  synthesis: any;
  created_at: string;
}

export interface Backup {
  name: string;
  size: number;
  created_at: string;
}

export interface Schedule {
  id: string;
  name: string;
  description: string | null;
  agent_id: string | null;
  cron_expression: string;
  task_prompt: string;
  status: 'active' | 'paused' | 'disabled';
  last_run_at: string | null;
  next_run_at: string | null;
  last_run_status: string | null;
  last_run_result: string | null;
  run_count: number;
  error_count: number;
  created_at: string;
  updated_at: string;
}
