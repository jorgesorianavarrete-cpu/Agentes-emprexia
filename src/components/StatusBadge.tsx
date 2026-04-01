const colors: Record<string, string> = {
  // Agent status
  active: 'bg-indigo-500/20 text-indigo-400',
  idle: 'bg-gray-500/20 text-gray-400',
  paused: 'bg-yellow-500/20 text-yellow-400',
  error: 'bg-red-500/20 text-red-400',
  archived: 'bg-gray-600/20 text-gray-500',
  // Task status
  inbox: 'bg-blue-500/20 text-blue-400',
  up_next: 'bg-cyan-500/20 text-cyan-400',
  in_progress: 'bg-amber-500/20 text-amber-400',
  in_review: 'bg-purple-500/20 text-purple-400',
  done: 'bg-indigo-500/20 text-indigo-400',
  blocked: 'bg-red-500/20 text-red-400',
  failed: 'bg-red-600/20 text-red-500',
  cancelled: 'bg-gray-500/20 text-gray-500',
  // Handoff state
  pending: 'bg-yellow-500/20 text-yellow-400',
  accepted: 'bg-blue-500/20 text-blue-400',
  running: 'bg-amber-500/20 text-amber-400',
  completed: 'bg-indigo-500/20 text-indigo-400',
  rejected: 'bg-red-500/20 text-red-400',
  escalated: 'bg-orange-500/20 text-orange-400',
  // Approval
  approved: 'bg-indigo-500/20 text-indigo-400',
  denied: 'bg-red-500/20 text-red-400',
  // Run result
  success: 'bg-indigo-500/20 text-indigo-400',
  // Generic
  enabled: 'bg-indigo-500/20 text-indigo-400',
  disabled: 'bg-gray-500/20 text-gray-400',
  configured: 'bg-indigo-500/20 text-indigo-400',
  not_configured: 'bg-red-500/20 text-red-400',
};

const labels: Record<string, string> = {
  // Agent
  active: 'Activo',
  idle: 'Inactivo',
  paused: 'Pausado',
  error: 'Error',
  archived: 'Archivado',
  // Task
  inbox: 'Bandeja',
  up_next: 'A continuación',
  in_progress: 'En progreso',
  in_review: 'En revisión',
  done: 'Completada',
  blocked: 'Bloqueada',
  failed: 'Fallida',
  cancelled: 'Cancelada',
  // Handoff
  pending: 'Pendiente',
  accepted: 'Aceptada',
  running: 'Ejecutando',
  completed: 'Completada',
  rejected: 'Rechazada',
  escalated: 'Escalada',
  // Approval
  approved: 'Aprobada',
  denied: 'Denegada',
  // Run
  success: 'Correcto',
  // Generic
  enabled: 'Activo',
  disabled: 'Inactivo',
  configured: 'Configurado',
  not_configured: 'Sin configurar',
};

export default function StatusBadge({ status }: { status?: string }) {
  const s = status ?? '—';
  const cls = colors[s] || 'bg-gray-500/20 text-gray-400';
  const label = labels[s] || s.replace(/_/g, ' ');
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {label}
    </span>
  );
}
