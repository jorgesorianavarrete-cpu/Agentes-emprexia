import { HardDrive, Database, RefreshCw } from 'lucide-react';
import { useState, useEffect } from 'react';
import { fnCall } from '../lib/insforge';
import PageHeader from '../components/PageHeader';

function fmt(d: string) {
  return d ? new Date(d).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';
}

function fmtSize(s: string | number | undefined) {
  if (!s) return '';
  return typeof s === 'string' ? s : `${(Number(s) / 1024 / 1024).toFixed(1)} MB`;
}

// ─── Panel (Insforge DB) Backups ──────────────────────────────────────────────

function PanelBackups() {
  const [backups, setBackups] = useState<any[]>([]);
  const [syncStatus, setSyncStatus] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState('');
  const [result, setResult] = useState<any>(null);

  const loadBackups = async () => {
    setLoading(true);
    try {
      const data = await fnCall('backup-manager');
      setBackups(data.backups || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const loadSyncStatus = async () => {
    try {
      const data = await fnCall('backup-sync');
      setSyncStatus(data);
    } catch (e) { console.error(e); }
  };

  const triggerBackup = async () => {
    setRunning('backup');
    setResult(null);
    try {
      const data = await fnCall('backup-manager', 'POST');
      setResult({ type: 'success', msg: `Backup creado: ${data.total_rows ?? ''} filas (${data.size_kb ?? ''}KB)` });
      loadBackups();
    } catch (e: any) { setResult({ type: 'error', msg: `Error: ${e.message}` }); }
    setRunning('');
  };

  const triggerSync = async () => {
    setRunning('sync');
    setResult(null);
    try {
      const data = await fnCall('backup-sync', 'POST');
      setResult({ type: 'success', msg: 'Sincronización iniciada', data });
      loadSyncStatus();
    } catch (e: any) { setResult({ type: 'error', msg: `Error: ${e.message}` }); }
    setRunning('');
  };

  const triggerRestore = async (backupKey: string) => {
    if (!confirm('¿Confirmas la restauración? Esta acción puede sobrescribir datos.')) return;
    setRunning('restore');
    setResult(null);
    try {
      const data = await fnCall('backup-restore', 'POST', { backup_id: backupKey });
      setResult({ type: 'success', msg: 'Restauración completada', data });
    } catch (e: any) { setResult({ type: 'error', msg: `Error: ${e.message}` }); }
    setRunning('');
  };

  useEffect(() => { loadBackups(); loadSyncStatus(); }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <Database size={15} className="text-indigo-400" />
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Panel · Insforge DB</h2>
        <span className="text-xs text-gray-500">Base de datos y funciones</span>
      </div>

      {/* Action cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 space-y-3">
          <div>
            <div className="font-medium text-gray-900 dark:text-white text-sm">Backup manual</div>
            <div className="text-xs text-gray-500">Snapshot completo de DB + funciones</div>
          </div>
          <button onClick={triggerBackup} disabled={!!running}
            className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2">
            {running === 'backup' ? (
              <><svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Creando...</>
            ) : 'Crear backup ahora'}
          </button>
        </div>

        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 space-y-3">
          <div>
            <div className="font-medium text-gray-900 dark:text-white text-sm">Sincronización</div>
            <div className="text-xs text-gray-500">
              {syncStatus?.last_sync ? `Último sync: ${fmt(syncStatus.last_sync)}` : 'Estado desconocido'}
            </div>
          </div>
          <button onClick={triggerSync} disabled={!!running}
            className="w-full py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-40 text-gray-700 dark:text-gray-200 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2">
            {running === 'sync' ? (
              <><svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Sincronizando...</>
            ) : 'Sincronizar ahora'}
          </button>
        </div>
      </div>

      {result && (
        <div className={`border rounded-xl px-4 py-3 text-sm ${result.type === 'success' ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
          {result.msg}
        </div>
      )}

      <div>
        <div className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-2">Historial</div>
        {loading ? (
          <div className="flex items-center gap-3 text-gray-500 py-4">
            <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
            <span className="text-sm">Cargando...</span>
          </div>
        ) : (
          <div className="space-y-1.5">
            {backups.map((b, i) => (
              <div key={b.key || i} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-medium text-gray-700 dark:text-gray-200">{b.key || b.name || `Backup ${i + 1}`}</div>
                  <div className="text-xs text-gray-500">{fmt(b.created_at)} {b.size_bytes ? `· ${(b.size_bytes / 1024).toFixed(0)} KB` : ''}</div>
                </div>
                <button onClick={() => triggerRestore(b.key || b.id)} disabled={!!running}
                  className="px-3 py-1.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-40 text-gray-600 dark:text-gray-300 rounded-lg text-xs font-medium transition-colors">
                  {running === 'restore' ? '...' : 'Restaurar'}
                </button>
              </div>
            ))}
            {backups.length === 0 && <div className="py-6 text-center text-gray-500 text-sm">No hay backups disponibles</div>}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── OpenClaw (VPS) Backups ───────────────────────────────────────────────────

function OpenClawBackups() {
  const [backups, setBackups] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<any>(null);

  const loadBackups = async () => {
    setLoading(true);
    try {
      const data = await fnCall('openclaw-backup', 'GET');
      setBackups(data.backups || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const triggerBackup = async () => {
    setRunning(true);
    setResult(null);
    try {
      const data = await fnCall('openclaw-backup', 'POST');
      if (data.success) {
        setResult({ type: 'success', msg: `Backup creado: ${data.backup_id} (${data.size})` });
        loadBackups();
      } else {
        setResult({ type: 'error', msg: `Error: ${data.logs?.join(' · ') || 'Fallo desconocido'}` });
      }
    } catch (e: any) { setResult({ type: 'error', msg: `Error: ${e.message}` }); }
    setRunning(false);
  };

  useEffect(() => { loadBackups(); }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <HardDrive size={15} className="text-amber-400" />
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white">OpenClaw · VPS</h2>
        <span className="text-xs text-gray-500">Agentes, configuración y workspace</span>
      </div>

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 space-y-3">
        <div>
          <div className="font-medium text-gray-900 dark:text-white text-sm">Backup OpenClaw</div>
          <div className="text-xs text-gray-500">Para el gateway, detiene el servicio momentáneamente y archiva <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">~/.openclaw</code>, configuración y workspace</div>
        </div>
        <button onClick={triggerBackup} disabled={running || loading}
          className="w-full py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2">
          {running ? (
            <><svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Creando backup... (puede tardar 1–2 min)</>
          ) : 'Crear backup OpenClaw'}
        </button>
      </div>

      {result && (
        <div className={`border rounded-xl px-4 py-3 text-sm ${result.type === 'success' ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
          {result.msg}
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs text-gray-500 font-medium uppercase tracking-wider">Historial VPS</div>
          <button onClick={loadBackups} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
            <RefreshCw size={11} />
            Actualizar
          </button>
        </div>
        {loading ? (
          <div className="flex items-center gap-3 text-gray-500 py-4">
            <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
            <span className="text-sm">Cargando...</span>
          </div>
        ) : (
          <div className="space-y-1.5">
            {backups.map((b, i) => (
              <div key={b.id || i} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-medium text-gray-700 dark:text-gray-200">{b.name}</div>
                  <div className="text-xs text-gray-500">{fmt(b.created_at)}{b.size ? ` · ${fmtSize(b.size)}` : ''}</div>
                </div>
                <span className="text-xs text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded-md">VPS</span>
              </div>
            ))}
            {backups.length === 0 && <div className="py-6 text-center text-gray-500 text-sm">No hay backups en el VPS</div>}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Backups() {
  return (
    <div className="p-4 sm:p-6 space-y-8">
      <PageHeader
        title="Backups"
        icon={HardDrive}
        subtitle="copias de seguridad del sistema"
      />
      <PanelBackups />
      <div className="border-t border-gray-200 dark:border-gray-800" />
      <OpenClawBackups />
    </div>
  );
}
