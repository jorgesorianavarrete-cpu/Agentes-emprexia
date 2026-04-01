import {
  TrendingUp, Megaphone, Headphones, Code2, Cpu, DollarSign,
  Scale, Settings2, Users, Target, Shield, Database,
  MessageCircle, Package, Palette, Bot, Star, Zap, Globe,
  Heart, Briefcase, Building2, Flame, Rocket, Leaf,
  Music, Camera, BookOpen, ShoppingCart, Truck, PieChart,
} from 'lucide-react';

interface AreaConfig {
  icon: React.ElementType;
  gradient: string;
}

const AREA_ICONS: Record<string, AreaConfig> = {
  ventas:       { icon: TrendingUp,    gradient: 'from-blue-500 to-cyan-600' },
  marketing:    { icon: Megaphone,     gradient: 'from-purple-500 to-pink-600' },
  soporte:      { icon: Headphones,    gradient: 'from-green-500 to-teal-600' },
  desarrollo:   { icon: Code2,         gradient: 'from-cyan-500 to-blue-600' },
  tecnologia:   { icon: Cpu,           gradient: 'from-sky-500 to-indigo-600' },
  finanzas:     { icon: DollarSign,    gradient: 'from-amber-500 to-orange-600' },
  legal:        { icon: Scale,         gradient: 'from-orange-500 to-red-600' },
  operaciones:  { icon: Settings2,     gradient: 'from-slate-500 to-gray-700' },
  rrhh:         { icon: Users,         gradient: 'from-pink-500 to-rose-600' },
  estrategia:   { icon: Target,        gradient: 'from-indigo-500 to-violet-600' },
  seguridad:    { icon: Shield,        gradient: 'from-red-500 to-orange-600' },
  datos:        { icon: Database,      gradient: 'from-teal-500 to-cyan-600' },
  comunicacion: { icon: MessageCircle, gradient: 'from-violet-500 to-purple-600' },
  producto:     { icon: Package,       gradient: 'from-rose-500 to-pink-600' },
  diseno:       { icon: Palette,       gradient: 'from-fuchsia-500 to-pink-600' },
};

// All available icons for the picker
export const ICON_OPTIONS: { key: string; icon: React.ElementType; label: string }[] = [
  { key: 'Bot',          icon: Bot,          label: 'Bot' },
  { key: 'Star',         icon: Star,         label: 'Estrella' },
  { key: 'Zap',          icon: Zap,          label: 'Rayo' },
  { key: 'Globe',        icon: Globe,        label: 'Globe' },
  { key: 'Rocket',       icon: Rocket,       label: 'Cohete' },
  { key: 'Flame',        icon: Flame,        label: 'Fuego' },
  { key: 'TrendingUp',   icon: TrendingUp,   label: 'Ventas' },
  { key: 'Megaphone',    icon: Megaphone,    label: 'Marketing' },
  { key: 'Headphones',   icon: Headphones,   label: 'Soporte' },
  { key: 'Code2',        icon: Code2,        label: 'Código' },
  { key: 'Cpu',          icon: Cpu,          label: 'Tech' },
  { key: 'DollarSign',   icon: DollarSign,   label: 'Finanzas' },
  { key: 'Scale',        icon: Scale,        label: 'Legal' },
  { key: 'Settings2',    icon: Settings2,    label: 'Ops' },
  { key: 'Users',        icon: Users,        label: 'RRHH' },
  { key: 'Target',       icon: Target,       label: 'Target' },
  { key: 'Shield',       icon: Shield,       label: 'Seguridad' },
  { key: 'Database',     icon: Database,     label: 'Datos' },
  { key: 'MessageCircle',icon: MessageCircle,label: 'Chat' },
  { key: 'Package',      icon: Package,      label: 'Producto' },
  { key: 'Palette',      icon: Palette,      label: 'Diseño' },
  { key: 'Heart',        icon: Heart,        label: 'Heart' },
  { key: 'Briefcase',    icon: Briefcase,    label: 'Briefcase' },
  { key: 'Building2',    icon: Building2,    label: 'Empresa' },
  { key: 'Leaf',         icon: Leaf,         label: 'Eco' },
  { key: 'Music',        icon: Music,        label: 'Música' },
  { key: 'Camera',       icon: Camera,       label: 'Cámara' },
  { key: 'BookOpen',     icon: BookOpen,     label: 'Libro' },
  { key: 'ShoppingCart', icon: ShoppingCart, label: 'Tienda' },
  { key: 'Truck',        icon: Truck,        label: 'Logística' },
  { key: 'PieChart',     icon: PieChart,     label: 'Analytics' },
];

const ICON_MAP: Record<string, React.ElementType> = Object.fromEntries(
  ICON_OPTIONS.map(o => [o.key, o.icon])
);

// Available gradient colors for the picker
export const COLOR_OPTIONS: { key: string; gradient: string; label: string }[] = [
  { key: 'indigo',   gradient: 'from-indigo-500 to-violet-600',  label: 'Índigo' },
  { key: 'blue',     gradient: 'from-blue-500 to-cyan-600',      label: 'Azul' },
  { key: 'sky',      gradient: 'from-sky-500 to-indigo-600',     label: 'Cielo' },
  { key: 'cyan',     gradient: 'from-cyan-500 to-blue-600',      label: 'Cian' },
  { key: 'teal',     gradient: 'from-teal-500 to-cyan-600',      label: 'Verde agua' },
  { key: 'green',    gradient: 'from-green-500 to-teal-600',     label: 'Verde' },
  { key: 'emerald',  gradient: 'from-emerald-500 to-green-600',  label: 'Esmeralda' },
  { key: 'lime',     gradient: 'from-lime-500 to-green-600',     label: 'Lima' },
  { key: 'yellow',   gradient: 'from-yellow-500 to-amber-600',   label: 'Amarillo' },
  { key: 'amber',    gradient: 'from-amber-500 to-orange-600',   label: 'Ámbar' },
  { key: 'orange',   gradient: 'from-orange-500 to-red-600',     label: 'Naranja' },
  { key: 'red',      gradient: 'from-red-500 to-orange-600',     label: 'Rojo' },
  { key: 'rose',     gradient: 'from-rose-500 to-pink-600',      label: 'Rosa' },
  { key: 'pink',     gradient: 'from-pink-500 to-rose-600',      label: 'Rosa fuerte' },
  { key: 'fuchsia',  gradient: 'from-fuchsia-500 to-pink-600',   label: 'Fucsia' },
  { key: 'purple',   gradient: 'from-purple-500 to-pink-600',    label: 'Morado' },
  { key: 'violet',   gradient: 'from-violet-500 to-purple-600',  label: 'Violeta' },
  { key: 'slate',    gradient: 'from-slate-500 to-gray-700',     label: 'Gris' },
];

const COLOR_MAP: Record<string, string> = Object.fromEntries(
  COLOR_OPTIONS.map(c => [c.key, c.gradient])
);

function getAreaConfig(area: string): AreaConfig {
  const key = area?.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') || '';
  return AREA_ICONS[key] || { icon: Bot, gradient: 'from-indigo-500 to-violet-600' };
}

interface AreaBadgeProps {
  area: string;
  size?: 'sm' | 'md' | 'lg';
  icon?: string | null;
  color?: string | null;
}

export default function AreaBadge({ area, size = 'md', icon, color }: AreaBadgeProps) {
  const areaConfig = getAreaConfig(area);
  const Icon = (icon && ICON_MAP[icon]) ? ICON_MAP[icon] : areaConfig.icon;
  const gradient = (color && COLOR_MAP[color]) ? COLOR_MAP[color] : areaConfig.gradient;
  const sizeClass = size === 'sm' ? 'w-7 h-7' : size === 'lg' ? 'w-12 h-12' : 'w-9 h-9';
  const iconSize = size === 'sm' ? 12 : size === 'lg' ? 20 : 16;
  return (
    <div className={`${sizeClass} bg-gradient-to-br ${gradient} rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm`}>
      <Icon size={iconSize} className="text-white" strokeWidth={1.8} />
    </div>
  );
}
