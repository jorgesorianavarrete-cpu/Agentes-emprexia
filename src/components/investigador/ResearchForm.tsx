// ResearchForm.tsx — Formulario dinámico por tipo de investigación
import React, { useState } from 'react';
import { ResearchType, TYPE_META } from '../../lib/research';

interface Props {
  type: ResearchType;
  onBack: () => void;
  onSubmit: (name: string, inputParams: Record<string, unknown>) => void;
  loading?: boolean;
}

export default function ResearchForm({ type, onBack, onSubmit, loading }: Props) {
  const meta = TYPE_META[type];
  const [name, setName] = useState('');
  const [mode, setMode] = useState<'specific' | 'discovery'>('specific');

  // Dropshipping specific
  const [product, setProduct] = useState('');
  const [markets, setMarkets] = useState<string[]>(['espana']);
  const [priority, setPriority] = useState<'margen' | 'volumen' | 'devolucion'>('margen');
  const [minMargin, setMinMargin] = useState('');
  const [returnRisk, setReturnRisk] = useState('any');
  const [recurrence, setRecurrence] = useState('any');
  const [budget, setBudget] = useState('any');

  // Productos-IA specific
  const [idea, setIdea] = useState('');
  const [aiProductType, setAiProductType] = useState('any');
  const [aiChannel, setAiChannel] = useState('any');

  const toggleMarket = (m: string) => {
    setMarkets(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const params: Record<string, unknown> = { mode };
    if (type === 'dropshipping') {
      if (mode === 'specific') {
        params.product = product;
        params.markets = markets;
        params.priority = priority;
      } else {
        params.min_margin = minMargin;
        params.return_risk = returnRisk;
        params.recurrence = recurrence;
        params.budget = budget;
      }
    } else if (type === 'productos-ia') {
      if (mode === 'specific') params.idea = idea;
      else {
        params.ai_product_type = aiProductType;
        params.ai_channel = aiChannel;
      }
    }
    onSubmit(name, params);
  };

  const accentColor = meta.color;
  const canSubmit = type === 'dropshipping'
    ? (mode === 'specific' ? product.trim().length > 0 : true)
    : (mode === 'specific' ? idea.trim().length > 0 : true);

  const inputCls = "w-full bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-lg px-4 py-2.5 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 text-sm focus:outline-none focus:border-orange-500 transition-colors";
  const selectCls = "w-full bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-gray-900 dark:text-white text-sm focus:outline-none focus:border-orange-500";

  return (
    <form onSubmit={handleSubmit}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button type="button" onClick={onBack} className="text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white transition-colors">
          ← Volver
        </button>
        <span className="text-2xl">{meta.icon}</span>
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">{meta.label}</h2>
          <p className="text-gray-500 dark:text-slate-400 text-xs">Configura los parámetros de la investigación</p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Mode selector */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3">Modo de investigación</label>
          <div className="flex gap-3">
            {[
              { val: 'specific', label: type === 'dropshipping' ? '🎯 Producto o gama específica' : '💡 Idea específica' },
              { val: 'discovery', label: '🔍 Descubrimiento (el sistema busca)' },
            ].map(opt => (
              <button
                key={opt.val}
                type="button"
                onClick={() => setMode(opt.val as 'specific' | 'discovery')}
                className={`flex-1 py-2.5 px-4 rounded-lg border text-sm font-medium transition-all ${
                  mode === opt.val
                    ? 'border-orange-500 bg-orange-500/10 text-orange-600 dark:text-orange-400'
                    : 'border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-500 dark:text-slate-400 hover:border-gray-400 dark:hover:border-slate-500'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Dropshipping — specific */}
        {type === 'dropshipping' && mode === 'specific' && (
          <>
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-2">Producto o categoría *</label>
              <input
                type="text"
                value={product}
                onChange={e => setProduct(e.target.value)}
                placeholder='ej: "snacks naturales para perros", "accesorios camping"'
                className={inputCls}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-2">Mercado objetivo</label>
              <div className="flex gap-2 flex-wrap">
                {[{val:'espana',label:'🇪🇸 España'},{val:'europa',label:'🇪🇺 Europa'},{val:'global',label:'🌍 Global'}].map(m => (
                  <button key={m.val} type="button" onClick={() => toggleMarket(m.val)}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                      markets.includes(m.val) ? 'border-orange-500 bg-orange-500/10 text-orange-600 dark:text-orange-400' : 'border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-500 dark:text-slate-400 hover:border-gray-400'
                    }`}>
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-2">Prioridad en</label>
              <div className="flex gap-2 flex-wrap">
                {[{val:'margen',label:'💰 Margen máximo'},{val:'volumen',label:'📦 Mayor volumen'},{val:'devolucion',label:'🔄 Menor devolución'}].map(p => (
                  <button key={p.val} type="button" onClick={() => setPriority(p.val as typeof priority)}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                      priority === p.val ? 'border-orange-500 bg-orange-500/10 text-orange-600 dark:text-orange-400' : 'border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-500 dark:text-slate-400 hover:border-gray-400'
                    }`}>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Dropshipping — discovery */}
        {type === 'dropshipping' && mode === 'discovery' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-slate-400 mb-1.5">Margen mínimo objetivo</label>
              <div className="flex items-center gap-2">
                <input type="number" value={minMargin} onChange={e => setMinMargin(e.target.value)} placeholder="25"
                  className="w-full bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-gray-900 dark:text-white text-sm focus:outline-none focus:border-orange-500 placeholder-gray-400 dark:placeholder-slate-500" />
                <span className="text-gray-500 dark:text-slate-400 text-sm">%</span>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-slate-400 mb-1.5">Riesgo devolución</label>
              <select value={returnRisk} onChange={e => setReturnRisk(e.target.value)} className={selectCls}>
                <option value="none">Solo sin devolución</option>
                <option value="low">Bajo (&lt;5%)</option>
                <option value="any">Cualquiera</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-slate-400 mb-1.5">Recurrencia</label>
              <select value={recurrence} onChange={e => setRecurrence(e.target.value)} className={selectCls}>
                <option value="high">Alta (consumibles)</option>
                <option value="any">Cualquiera</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-slate-400 mb-1.5">Presupuesto arranque</label>
              <select value={budget} onChange={e => setBudget(e.target.value)} className={selectCls}>
                <option value="low">&lt;€500</option>
                <option value="medium">€500–2000</option>
                <option value="any">Sin límite</option>
              </select>
            </div>
          </div>
        )}

        {/* Productos IA — specific */}
        {type === 'productos-ia' && mode === 'specific' && (
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-2">Describe la idea *</label>
            <textarea
              value={idea}
              onChange={e => setIdea(e.target.value)}
              rows={4}
              placeholder='ej: "Pack de prompts para fotografía de producto en Etsy", "Generador de portadas de libros con IA para Amazon KDP"'
              className="w-full bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-lg px-4 py-2.5 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 text-sm focus:outline-none focus:border-purple-500 transition-colors resize-none"
              required
            />
          </div>
        )}

        {/* Productos IA — discovery */}
        {type === 'productos-ia' && mode === 'discovery' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-slate-400 mb-1.5">Tipo de producto IA</label>
              <select value={aiProductType} onChange={e => setAiProductType(e.target.value)} className={selectCls}>
                <option value="any">Cualquiera</option>
                <option value="images">Imágenes / Arte</option>
                <option value="audio">Audio / Música</option>
                <option value="video">Vídeo</option>
                <option value="text">Texto / Ebooks</option>
                <option value="prompts">Prompts</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-slate-400 mb-1.5">Canal objetivo</label>
              <select value={aiChannel} onChange={e => setAiChannel(e.target.value)} className={selectCls}>
                <option value="any">Cualquiera</option>
                <option value="etsy">Etsy</option>
                <option value="gumroad">Gumroad</option>
                <option value="amazon_kdp">Amazon KDP</option>
                <option value="hotmart">Hotmart</option>
              </select>
            </div>
          </div>
        )}

        {/* Nombre personalizado */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-2">
            Nombre para esta investigación <span className="text-gray-400 dark:text-slate-500 font-normal">(opcional)</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder={`ej: "Investigación snacks perros", "Ideas IA Etsy marzo"`}
            className={inputCls}
          />
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={!canSubmit || loading}
          style={{ background: canSubmit && !loading ? accentColor : undefined }}
          className={`w-full py-3 rounded-xl font-bold text-white text-sm transition-all ${
            canSubmit && !loading ? 'hover:opacity-90 shadow-lg' : 'bg-gray-200 dark:bg-slate-700 text-gray-400 dark:text-slate-500 cursor-not-allowed'
          }`}
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Lanzando investigación...
            </span>
          ) : (
            'Lanzar investigación →'
          )}
        </button>
      </div>
    </form>
  );
}
