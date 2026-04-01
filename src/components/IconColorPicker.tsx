import { ICON_OPTIONS, COLOR_OPTIONS } from './AreaBadge';

interface IconColorPickerProps {
  icon: string | null | undefined;
  color: string | null | undefined;
  area: string;
  onChangeIcon: (icon: string) => void;
  onChangeColor: (color: string) => void;
}

export default function IconColorPicker({ icon, color, area, onChangeIcon, onChangeColor }: IconColorPickerProps) {
  // Derive current gradient for the preview dot
  const currentColor = COLOR_OPTIONS.find(c => c.key === color);
  const currentIcon = ICON_OPTIONS.find(i => i.key === icon);

  return (
    <div className="space-y-3">
      {/* Icon grid */}
      <div>
        <p className="text-xs text-gray-500 mb-2 font-medium">Icono</p>
        <div className="grid grid-cols-8 gap-1.5">
          {ICON_OPTIONS.map(opt => {
            const isActive = icon ? icon === opt.key : false;
            const Icon = opt.icon;
            return (
              <button
                key={opt.key}
                type="button"
                title={opt.label}
                onClick={() => onChangeIcon(opt.key)}
                className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                  isActive
                    ? 'bg-indigo-500 text-white ring-2 ring-indigo-400 ring-offset-1 dark:ring-offset-gray-900'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 hover:text-indigo-500'
                }`}
              >
                <Icon size={14} strokeWidth={1.8} />
              </button>
            );
          })}
        </div>
      </div>

      {/* Color grid */}
      <div>
        <p className="text-xs text-gray-500 mb-2 font-medium">Color</p>
        <div className="grid grid-cols-9 gap-1.5">
          {COLOR_OPTIONS.map(opt => {
            const isActive = color === opt.key;
            return (
              <button
                key={opt.key}
                type="button"
                title={opt.label}
                onClick={() => onChangeColor(opt.key)}
                className={`w-7 h-7 rounded-full bg-gradient-to-br ${opt.gradient} transition-all ${
                  isActive
                    ? 'ring-2 ring-offset-2 ring-gray-400 dark:ring-gray-300 dark:ring-offset-gray-900 scale-110'
                    : 'hover:scale-110 opacity-80 hover:opacity-100'
                }`}
              />
            );
          })}
        </div>
      </div>

      {/* Preview */}
      {(currentIcon || currentColor) && (
        <div className="flex items-center gap-2 pt-1">
          <span className="text-xs text-gray-500">Vista previa:</span>
          <div className={`w-8 h-8 rounded-xl bg-gradient-to-br ${currentColor?.gradient || 'from-indigo-500 to-violet-600'} flex items-center justify-center shadow-sm`}>
            {currentIcon
              ? <currentIcon.icon size={14} className="text-white" strokeWidth={1.8} />
              : <span className="text-white text-xs">{area?.[0]?.toUpperCase()}</span>
            }
          </div>
        </div>
      )}
    </div>
  );
}
