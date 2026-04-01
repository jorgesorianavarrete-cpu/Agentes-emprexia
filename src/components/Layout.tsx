import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Bot, Users, MessageSquare, CheckCircle2, Play, RotateCw,
  Brain, Scale, Activity, HardDrive, Settings, Zap, Moon, Sun,
  GitBranch, BookOpen, Menu, X, Clock, User, Search, PlusCircle, Network
} from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { useTheme } from '../lib/ThemeContext';

type NavItem = { to: string; label: string; icon: React.ElementType };
type Section = { title: string; items: NavItem[] };

const NAV_SECTIONS: Section[] = [
  {
    title: 'Principal',
    items: [
      { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    ],
  },
  {
    title: 'Chat',
    items: [
      { to: '/chat', label: 'Chat', icon: MessageSquare },
    ],
  },
  {
    title: 'Organización',
    items: [
      { to: '/agents',      label: 'Dirección',    icon: Bot },
      { to: '/managers',    label: 'Managers',     icon: Zap },
      { to: '/specialists', label: 'Especialistas', icon: Users },
      { to: '/subagents',   label: 'Subagentes',   icon: Network },
    ],
  },
  {
    title: 'Operaciones',
    items: [
      { to: '/tasks',     label: 'Tareas',          icon: CheckCircle2 },
      { to: '/schedules', label: 'Programaciones', icon: Clock },
      { to: '/approvals', label: 'Aprobaciones',   icon: GitBranch },
      { to: '/runs',      label: 'Ejecuciones',    icon: Play },
      { to: '/handoffs',  label: 'Delegaciones',   icon: RotateCw },
    ],
  },
  {
    title: 'Inteligencia',
    items: [
      { to: '/knowledge', label: 'Conocimiento', icon: BookOpen },
      { to: '/council',   label: 'Model Council', icon: Scale },
      { to: '/memory',    label: 'Memoria',       icon: Brain },
    ],
  },
  {
    title: 'Investigador',
    items: [
      { to: '/investigador',       label: 'Investigaciones', icon: Search },
      { to: '/investigador/nuevo', label: 'Nueva investigación', icon: PlusCircle },
    ],
  },
  {
    title: 'Sistema',
    items: [
      { to: '/activity', label: 'Actividad', icon: Activity },
      { to: '/backups',  label: 'Backups',   icon: HardDrive },
      { to: '/settings', label: 'Ajustes',   icon: Settings },
    ],
  },
];

// Static user info — update if auth adds profile data
const USER_NAME = 'Jorge';
const USER_EMAIL = 'info@jorgesoria.es';

function SidebarContent({ onClose }: { onClose?: () => void }) {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-4 pt-5 pb-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center flex-shrink-0 shadow-lg shadow-indigo-500/20">
            <Bot size={16} className="text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900 dark:text-white leading-none">Emprexia</p>
            <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-0.5 font-medium uppercase tracking-wider">Agentes IA</p>
          </div>
        </div>
        {/* Close button on mobile */}
        {onClose && (
          <button onClick={onClose} className="lg:hidden p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/[0.06]">
            <X size={18} />
          </button>
        )}
      </div>
      <div className="mx-4 border-t border-gray-100 dark:border-white/[0.05]" />
      {/* Navigation */}
      <nav className="flex-1 px-3 py-3 overflow-y-auto space-y-4">
        {NAV_SECTIONS.map((section) => (
          <div key={section.title}>
            <p className="px-2 mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-slate-600 select-none">
              {section.title}
            </p>
            <div className="space-y-0.5">
              {section.items.map(({ to, label, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={to === '/investigador'}
                  onClick={onClose}
                  className={({ isActive }) =>
                    `group relative flex items-center gap-2.5 px-2.5 py-2.5 rounded-lg text-[13.5px] transition-all duration-150 ${
                      isActive
                        ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 font-medium'
                        : 'text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200 hover:bg-gray-50 dark:hover:bg-white/[0.04]'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      {isActive && (
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-indigo-600 dark:bg-indigo-500 rounded-full" />
                      )}
                      <Icon
                        size={16}
                        className={`flex-shrink-0 transition-colors ${
                          isActive
                            ? 'text-indigo-600 dark:text-indigo-400'
                            : 'text-gray-400 dark:text-slate-500 group-hover:text-gray-600 dark:group-hover:text-slate-300'
                        }`}
                      />
                      <span className="truncate">{label}</span>
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>
      {/* Footer — user profile */}
      <div className="px-3 pb-4 pt-3 border-t border-gray-100 dark:border-white/[0.05]">
        <button
          onClick={() => { navigate('/settings'); onClose?.(); }}
          className="flex items-center gap-2.5 w-full px-2.5 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-white/[0.04] transition-all group"
        >
          <div className="w-7 h-7 rounded-full bg-indigo-500/20 flex items-center justify-center flex-shrink-0">
            <User size={14} className="text-indigo-400" />
          </div>
          <div className="min-w-0 text-left">
            <p className="text-[13px] font-medium text-gray-700 dark:text-slate-300 leading-none truncate">{USER_NAME}</p>
            <p className="text-[11px] text-gray-400 dark:text-slate-500 mt-0.5 truncate">{USER_EMAIL}</p>
          </div>
        </button>
      </div>
    </div>
  );
}

function TopBar() {
  const { theme, toggle } = useTheme();
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const check = () => setOnline(navigator.onLine);
    window.addEventListener('online', check);
    window.addEventListener('offline', check);
    check();
    return () => {
      window.removeEventListener('online', check);
      window.removeEventListener('offline', check);
    };
  }, []);

  return (
    <div className="hidden lg:flex items-center justify-end gap-2 px-4 py-2 bg-white dark:bg-[#13141a] border-b border-gray-200 dark:border-white/[0.06] flex-shrink-0">
      {/* Online indicator */}
      <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[12px] ${
        online ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400 dark:text-slate-500'
      }`}>
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${online ? 'bg-emerald-500 animate-pulse' : 'bg-gray-400'}`} />
        {online ? 'Conectado' : 'Sin conexión'}
      </div>
      {/* Theme toggle */}
      <button
        onClick={toggle}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[13px] text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 hover:bg-gray-50 dark:hover:bg-white/[0.06] transition-all"
      >
        {theme === 'dark'
          ? <Sun size={14} className="text-amber-400 flex-shrink-0" />
          : <Moon size={14} className="text-indigo-400 flex-shrink-0" />
        }
        <span>{theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}</span>
      </button>
    </div>
  );
}

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  // Close on resize to desktop
  useEffect(() => {
    const onResize = () => { if (window.innerWidth >= 1024) setSidebarOpen(false); };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const close = useCallback(() => setSidebarOpen(false), []);

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-[#0e0f14] text-gray-900 dark:text-slate-100 overflow-hidden">
      {/* === DESKTOP SIDEBAR === */}
      <aside className="hidden lg:flex w-56 flex-shrink-0 flex-col bg-white dark:bg-[#13141a] border-r border-gray-200 dark:border-white/[0.06]">
        <SidebarContent />
      </aside>

      {/* === MOBILE SIDEBAR OVERLAY === */}
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          onClick={close}
        />
      )}

      {/* === MOBILE SIDEBAR DRAWER === */}
      <aside className={`lg:hidden fixed inset-y-0 left-0 z-50 w-64 flex flex-col bg-white dark:bg-[#13141a] border-r border-gray-200 dark:border-white/[0.06] transform transition-transform duration-250 ease-in-out ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <SidebarContent onClose={close} />
      </aside>

      {/* === MAIN AREA === */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Desktop top bar (theme toggle + status, top right) */}
        <TopBar />

        {/* Mobile topbar */}
        <header className="lg:hidden flex items-center gap-3 px-4 py-3 bg-white dark:bg-[#13141a] border-b border-gray-200 dark:border-white/[0.06] flex-shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-lg text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-white/[0.06] transition-colors"
          >
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-2 flex-1">
            <div className="w-6 h-6 bg-indigo-600 rounded-md flex items-center justify-center">
              <Bot size={13} className="text-white" />
            </div>
            <span className="text-sm font-semibold text-gray-900 dark:text-white">Emprexia</span>
          </div>
          {/* Mobile: theme toggle on right */}
          <MobileThemeToggle />
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto bg-gray-50 dark:bg-[#0e0f14]">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function MobileThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <button
      onClick={toggle}
      className="p-2 rounded-lg text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-white/[0.06] transition-colors"
    >
      {theme === 'dark' ? <Sun size={16} className="text-amber-400" /> : <Moon size={16} className="text-indigo-400" />}
    </button>
  );
}
