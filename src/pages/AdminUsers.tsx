import { useState, useEffect } from 'react';
import { useUser } from '@insforge/react';
import { insforge } from '../lib/insforge';
import { useAccess } from '../App';
import { Shield, UserPlus, Trash2, Crown, Eye, Pencil } from 'lucide-react';

interface AllowedUser {
  id: string;
  email: string;
  role: 'admin' | 'editor' | 'viewer';
  created_at: string;
}

const ROLE_LABELS: Record<string, { label: string; color: string; icon: typeof Crown }> = {
  admin:  { label: 'Admin',  color: 'bg-red-600/20 text-red-400 border-red-800/50',    icon: Crown },
  editor: { label: 'Editor', color: 'bg-amber-600/20 text-amber-400 border-amber-800/50', icon: Pencil },
  viewer: { label: 'Viewer', color: 'bg-slate-600/20 text-slate-400 border-slate-700/50',  icon: Eye },
};

export default function AdminUsers() {
  const { user } = useUser();
  const { isAdmin } = useAccess();
  const [users, setUsers] = useState<AllowedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'viewer' | 'editor' | 'admin'>('viewer');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data } = await insforge.database
      .from('allowed_users')
      .select('*')
      .order('created_at', { ascending: true });
    setUsers(data ?? []);
    setLoading(false);
  }

  async function addUser(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setError('');
    setSaving(true);
    const { error: err } = await insforge.database
      .from('allowed_users')
      .insert([{ email: email.trim().toLowerCase(), role, created_by: user?.id }]);
    setSaving(false);
    if (err) {
      setError(err.message?.includes('duplicate') ? 'Este email ya tiene acceso.' : err.message ?? 'Error al agregar usuario.');
    } else {
      setEmail('');
      setRole('viewer');
      load();
    }
  }

  async function removeUser(id: string, userEmail: string) {
    if (userEmail === user?.email) return;
    if (!confirm('Eliminar acceso para ' + userEmail + '?')) return;
    await insforge.database.from('allowed_users').delete().eq('id', id);
    load();
  }

  async function changeRole(id: string, newRole: string) {
    await insforge.database.from('allowed_users').update({ role: newRole }).eq('id', id);
    load();
  }

  if (!isAdmin) {
    return (
      <div className="p-6">
        <div className="bg-red-900/20 border border-red-800/50 rounded-xl p-6 text-center">
          <Shield size={32} className="text-red-400 mx-auto mb-2" />
          <p className="text-red-400 font-medium">Solo administradores pueden gestionar usuarios.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <Shield size={22} className="text-indigo-400" />
        <h1 className="text-lg font-bold text-white">Gestion de acceso</h1>
      </div>

      <form onSubmit={addUser} className="bg-slate-900 border border-slate-800 rounded-xl p-4 mb-6">
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <label className="block text-xs text-slate-400 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="usuario@ejemplo.com"
              required
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>
          <div className="w-32">
            <label className="block text-xs text-slate-400 mb-1">Rol</label>
            <select
              value={role}
              onChange={e => setRole(e.target.value as 'viewer' | 'editor' | 'admin')}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
            >
              <option value="viewer">Viewer</option>
              <option value="editor">Editor</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <UserPlus size={15} />
            {saving ? 'Agregando...' : 'Agregar'}
          </button>
        </div>
        {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
      </form>

      {loading ? (
        <p className="text-slate-500 text-sm">Cargando...</p>
      ) : (
        <div className="space-y-2">
          {users.map(u => {
            const r = ROLE_LABELS[u.role] ?? ROLE_LABELS.viewer;
            const Icon = r.icon;
            const isMe = u.email === user?.email;
            return (
              <div key={u.id} className="flex items-center justify-between bg-slate-900 border border-slate-800 rounded-xl px-4 py-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={"flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-xs " + r.color}>
                    <Icon size={12} />
                    {r.label}
                  </div>
                  <span className="text-sm text-white truncate">{u.email}</span>
                  {isMe && <span className="text-xs text-slate-500">(tu)</span>}
                </div>
                <div className="flex items-center gap-2">
                  {!isMe && (
                    <>
                      <select
                        value={u.role}
                        onChange={e => changeRole(u.id, e.target.value)}
                        className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white"
                      >
                        <option value="viewer">Viewer</option>
                        <option value="editor">Editor</option>
                        <option value="admin">Admin</option>
                      </select>
                      <button
                        onClick={() => removeUser(u.id, u.email)}
                        className="text-red-400 hover:text-red-300 p-1 rounded-lg hover:bg-red-900/20 transition-colors"
                        title="Eliminar acceso"
                      >
                        <Trash2 size={15} />
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
  );
}
