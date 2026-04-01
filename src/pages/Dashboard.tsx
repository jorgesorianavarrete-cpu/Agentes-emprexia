import PageHeader from '../components/PageHeader';
import PageHelp from '../components/PageHelp';
import { useState, useEffect } from 'react';
import { fnCall } from '../lib/insforge';
import { Bot, CheckCircle2, RotateCw, Euro, Zap, Brain, RefreshCw, Play, MessageSquare, TrendingUp, LayoutDashboard} from 'lucide-react';
import StatusBadge from '../components/StatusBadge';

const ICONS: Record<string, React.ElementType> = {
  agents: Bot,
  tasks: CheckCircle2,
  handoffs: RotateCw,
  cost: Euro,
  tokens: Zap,
  knowledge: Brain,
};

function MetricCard({ label, value, icon, color, sub, trend }: {
  label: string; value: string | number; icon: string; color: string; sub?: string; trend?: string;
}) {
  const Icon = ICONS[icon] || Bot;
  return (
    <div className="bg-white dark:bg-[#1a1b23] border border-gray-200 dark:border-white/[0.06] rounded-xl p-4 flex flex-col gap-2.5 hover:border-gray-300 dark:hover:border-white/[0.1] transition-colors">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-slate-500">{label}</span>
        <div className="w-7 h-7 rounded-lg bg-gray-50 dark:bg-white/[0.04] flex items-center justify-center">
          <Icon size={14} className="text-gray-400 dark:text-slate-500" />
        </div>
      </div>
      <div className={`text-2xl font-bold tracking-tight ${color}`}>{value}</div>
      {sub && <div className="text-[11px] text-gray-400 dark:text-slate-500">{sub}</div>}
    </div>
  );
}

function BarRow({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-[13px]">
        <span className="text-gray-600 dark:text-slate-300 capitalize">{label}</span>
        <span className="font-mono text-gray-400 dark:text-slate-500 text-xs">{value}</span>
      </div>
      <div className="h-1 bg-gray-100 dark:bg-white/[0.05] rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function SectionCard({ title, icon: Icon, children }: { title: string; icon?: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-[#1a1b23] border border-gray-200 dark:border-white/[0.06] rounded-xl overflow-hidden">
      <div className="px-5 py-3.5 border-b border-gray-100 dark:border-white/[0.04] flex items-center gap-2">
        {Icon && <Icon size={14} className="text-gray-400 dark:text-slate-500" />}
        <h2 className="text-[12px] font-semibold uppercase tracking-wider text-gray-400 dark:text-slate-500">{title}</h2>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const data = await fnCall('dashboard-stats');
      setStats(data);
      setError('');
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  if (loading) return (
    <div className="flex items-center gap-3 p-8 text-gray-400 dark:text-slate-500">
      <RefreshCw size={16} className="animate-spin" />
      <span className="text-sm">Cargando dashboard...</span>
    </div>
  );

  if (error) return (
    <div className="p-8">
      <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl p-4 text-red-600 dark:text-red-400 text-sm">{error}</div>
    </div>
  );

  if (!stats) return null;

  const metrics = [
    { label: 'Agentes activos',   value: stats.agents?.by_status?.active || 0,                        icon: 'agents',   color: 'text-indigo-600 dark:text-indigo-400', sub: `de ${stats.agents?.total || 0} totales` },
    { label: 'Tareas en progreso',value: stats.tasks?.by_status?.in_progress || 0,                    icon: 'tasks',    color: 'text-amber-600 dark:text-amber-400',   sub: `${stats.tasks?.by_status?.pending || 0} pendientes` },
    { label: 'Delegaciones pendientes',value: stats.handoffs?.by_state?.pending || 0,                  icon: 'handoffs', color: 'text-orange-600 dark:text-orange-400', sub: `${stats.handoffs?.by_state?.completed || 0} completadas` },
    { label: 'Coste hoy',         value: `${(stats.agents?.total_cost_today || 0).toFixed(2)}€`,      icon: 'cost',     color: 'text-cyan-600 dark:text-cyan-400',     sub: 'EUR acumulado' },
    { label: 'Tokens hoy',        value: (stats.agents?.total_tokens_today || 0).toLocaleString(),    icon: 'tokens',   color: 'text-purple-600 dark:text-purple-400', sub: 'tokens consumidos' },
    { label: 'Fragmentos conocimiento', value: stats.knowledge?.total || 0,                            icon: 'knowledge',color: 'text-blue-600 dark:text-blue-400',     sub: 'fragmentos indexados' },
  ];

  const areaEntries = stats.agents?.by_area ? Object.entries(stats.agents.by_area) : [];
  const maxArea = areaEntries.reduce((m, [, v]) => Math.max(m, v as number), 0);
  const taskEntries = stats.tasks?.by_status ? Object.entries(stats.tasks.by_status) : [];
  const handoffEntries = stats.handoffs?.by_state ? Object.entries(stats.handoffs.by_state) : [];

  const runStats = [
    { label: 'Total ejecuciones', value: stats.runs?.total || 0,                             color: 'text-gray-900 dark:text-white', Icon: Play },
    { label: 'Coste total',      value: `${(stats.runs?.total_cost || 0).toFixed(2)}€`,      color: 'text-indigo-600 dark:text-indigo-400', Icon: Euro },
    { label: 'Latencia media',   value: `${(stats.runs?.avg_latency || 0).toFixed(0)}ms`,    color: 'text-cyan-600 dark:text-cyan-400', Icon: TrendingUp },
    { label: 'Mensajes totales', value: (stats.messages?.total || 0).toLocaleString(),       color: 'text-purple-600 dark:text-purple-400', Icon: MessageSquare },
  ];

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-[1400px]">
      <PageHeader
        title="Dashboard"
        subtitle="Visión general del sistema de agentes"
        icon={LayoutDashboard}
        actions={
          <button onClick={load} className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-gray-500 dark:text-slate-400 bg-white dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] hover:border-gray-300 dark:hover:border-white/[0.12] transition-all">
            <RefreshCw size={14} />
            Actualizar
          </button>
        }
      />

      {/* Metric cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
        {metrics.map(m => <MetricCard key={m.label} {...m} />)}
      </div>

      {/* Middle section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <SectionCard title="Agentes por área" icon={Bot}>
          <div className="space-y-3.5">
            {areaEntries.map(([area, count]) => (
              <BarRow key={area} label={area} value={count as number} max={maxArea} color="bg-indigo-500" />
            ))}
            {areaEntries.length === 0 && <p className="text-gray-400 dark:text-slate-600 text-sm text-center py-4">Sin datos</p>}
          </div>
        </SectionCard>

        <SectionCard title="Tareas por estado" icon={CheckCircle2}>
          <div className="space-y-1">
            {taskEntries.map(([status, count]) => (
              <div key={status} className="flex items-center justify-between py-2 border-b border-gray-50 dark:border-white/[0.03] last:border-0">
                <StatusBadge status={status} />
                <span className="text-sm font-mono text-gray-500 dark:text-slate-400">{count as number}</span>
              </div>
            ))}
            {taskEntries.length === 0 && <p className="text-gray-400 dark:text-slate-600 text-sm text-center py-4">Sin datos</p>}
          </div>
        </SectionCard>

        <SectionCard title="Delegaciones por estado" icon={RotateCw}>
          <div className="space-y-1">
            {handoffEntries.map(([state, count]) => (
              <div key={state} className="flex items-center justify-between py-2 border-b border-gray-50 dark:border-white/[0.03] last:border-0">
                <StatusBadge status={state} />
                <span className="text-sm font-mono text-gray-500 dark:text-slate-400">{count as number}</span>
              </div>
            ))}
            {handoffEntries.length === 0 && <p className="text-gray-400 dark:text-slate-600 text-sm text-center py-4">Sin datos</p>}
          </div>
        </SectionCard>
      </div>

      <PageHelp
        summary="El dashboard ofrece una visión general en tiempo real del sistema de agentes: cuántos están activos, tareas en curso, delegaciones pendientes y el consumo de tokens y coste acumulado del día."
        items={[
          { icon: '🤖', title: 'Agentes activos', description: 'Número de agentes que están operativos ahora mismo frente al total configurado.' },
          { icon: '📋', title: 'Tareas y delegaciones', description: 'Muestra tareas en progreso y delegaciones pendientes de resolución entre agentes.' },
          { icon: '💶', title: 'Coste y tokens', description: 'Acumulado del día en euros y número de tokens consumidos por todos los agentes.' },
          { icon: '📊', title: 'Gráficos de distribución', description: 'Distribución de agentes por área, tareas por estado y delegaciones por estado.' },
        ]}
      />

      {/* Runs stats */}
      <SectionCard title="Ejecuciones" icon={Play}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
          {runStats.map(({ label, value, color, Icon }) => (
            <div key={label} className="space-y-1">
              <div className={`text-2xl font-bold tracking-tight ${color}`}>{value}</div>
              <div className="text-[11px] text-gray-400 dark:text-slate-500 flex items-center gap-1.5">
                <Icon size={11} />
                {label}
              </div>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
