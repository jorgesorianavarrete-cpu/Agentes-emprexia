import { useState } from 'react';
import { Lock, Bot, Eye, EyeOff } from 'lucide-react';

// SHA-256 de "emprexia" — contraseña por defecto
export const DEFAULT_PASS_HASH = '94d8e59ff98f1f979c2981dad055b759de4382261257e66c5c51d7880175b5bb';
export const PASS_HASH_KEY    = 'emprexia_pass_hash';
export const SESSION_KEY      = 'emprexia_session';

export async function sha256(msg: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(msg));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export function getPassHash(): string {
  return localStorage.getItem(PASS_HASH_KEY) || DEFAULT_PASS_HASH;
}

export function setSession(): void {
  const token = crypto.randomUUID();
  localStorage.setItem(SESSION_KEY, token);
  const exp = new Date();
  exp.setDate(exp.getDate() + 30);
  document.cookie = `${SESSION_KEY}=${token}; expires=${exp.toUTCString()}; path=/; SameSite=Strict`;
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY);
  document.cookie = `${SESSION_KEY}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
}

export function hasSession(): boolean {
  return !!localStorage.getItem(SESSION_KEY);
}

interface Props {
  onLogin: () => void;
}

export default function LoginScreen({ onLogin }: Props) {
  const [password, setPassword] = useState('');
  const [showPass, setShowPass]  = useState(false);
  const [error, setError]        = useState('');
  const [loading, setLoading]    = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!password) return;
    setLoading(true);
    setError('');
    try {
      const hash = await sha256(password);
      if (hash === getPassHash()) {
        setSession();
        onLogin();
      } else {
        setError('Contraseña incorrecta');
      }
    } catch {
      setError('Error al verificar la contraseña');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0e0f14] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/25 mb-4">
            <Bot size={32} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Emprexia</h1>
          <p className="text-slate-500 text-sm mt-1">Panel de Agentes</p>
        </div>

        {/* Card */}
        <div className="bg-[#1a1b23] border border-white/[0.08] rounded-2xl p-6 shadow-2xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 flex items-center justify-center flex-shrink-0">
              <Lock size={16} className="text-indigo-400" />
            </div>
            <div>
              <div className="text-sm font-semibold text-white">Acceso restringido</div>
              <div className="text-xs text-slate-500">Introduce tu contraseña para continuar</div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <input
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={e => { setPassword(e.target.value); setError(''); }}
                placeholder="Contraseña"
                autoFocus
                autoComplete="current-password"
                className="w-full bg-[#0e0f14] border border-white/[0.08] rounded-xl px-4 py-3 pr-11 text-white placeholder-slate-600 text-sm focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPass(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors p-1"
                tabIndex={-1}
              >
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            {error && (
              <p className="text-xs text-red-400 text-center">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading || !password}
              className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors shadow-lg shadow-indigo-500/20"
            >
              {loading ? 'Verificando…' : 'Acceder'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-slate-600 mt-5">
          Contraseña por defecto: <span className="text-slate-500 font-mono">emprexia</span>
        </p>
      </div>
    </div>
  );
}
