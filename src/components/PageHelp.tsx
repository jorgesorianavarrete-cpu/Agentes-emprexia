import { HelpCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';

interface PageHelpItem {
  icon?: string;
  title: string;
  description: string;
}

interface PageHelpProps {
  title?: string;
  summary: string;
  items?: PageHelpItem[];
}

export default function PageHelp({ title = '¿Para qué sirve esta sección?', summary, items }: PageHelpProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-8 border-t border-gray-100 dark:border-white/[0.05] pt-6">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 transition-colors group w-full text-left"
      >
        <HelpCircle size={14} className="flex-shrink-0" />
        <span className="text-xs font-medium">{title}</span>
        <span className="ml-auto">
          {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </span>
      </button>

      {open && (
        <div className="mt-3 bg-gray-50 dark:bg-white/[0.02] border border-gray-100 dark:border-white/[0.05] rounded-xl p-4 space-y-3 text-sm text-gray-500 dark:text-slate-400">
          <p className="leading-relaxed">{summary}</p>
          {items && items.length > 0 && (
            <ul className="space-y-2 pt-1 border-t border-gray-100 dark:border-white/[0.04]">
              {items.map((item, i) => (
                <li key={i} className="flex items-start gap-2">
                  {item.icon && <span className="flex-shrink-0 mt-0.5">{item.icon}</span>}
                  <span>
                    <span className="font-medium text-gray-600 dark:text-slate-300">{item.title}:</span>{' '}
                    {item.description}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
