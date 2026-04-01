// pages/investigador/nuevo.tsx — /investigador/nuevo — Nueva Investigación
import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { researchApi, ResearchType } from '../../lib/research';
import TypeSelector from '../../components/investigador/TypeSelector';
import ResearchForm from '../../components/investigador/ResearchForm';

export default function NuevoInvestigador() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialType = searchParams.get('type') as ResearchType | null;
  const [step, setStep] = useState<'type' | 'form'>(initialType ? 'form' : 'type');
  const [selectedType, setSelectedType] = useState<ResearchType | null>(initialType);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleTypeSelect = (type: ResearchType) => {
    setSelectedType(type);
    setStep('form');
  };

  const handleSubmit = async (name: string, inputParams: Record<string, unknown>) => {
    if (!selectedType) return;
    setLoading(true);
    setError(null);
    const { data, error: err } = await researchApi.start({ type: selectedType, name: name || undefined, input_params: inputParams });
    setLoading(false);
    if (err) {
      setError(err);
      return;
    }
    if (data?.investigation_id) {
      navigate(`/investigador/${data.investigation_id}`);
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-slate-400 mb-6">
        <a href="/investigador" className="hover:text-gray-900 dark:hover:text-white transition-colors">🔍 Investigador</a>
        <span>›</span>
        <span className="text-gray-700 dark:text-slate-300">Nueva investigación</span>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-3 mb-8">
        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
          step === 'type' ? 'bg-orange-500 text-white' : 'bg-green-600 text-white'
        }`}>
          {step === 'type' ? '1' : '✓'}
        </div>
        <div className="text-sm font-medium text-gray-700 dark:text-slate-300">Tipo de negocio</div>
        <div className="flex-1 h-px bg-gray-200 dark:bg-slate-700" />
        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
          step === 'form' ? 'bg-orange-500 text-white' : 'bg-gray-200 dark:bg-slate-700 text-gray-400 dark:text-slate-500'
        }`}>
          2
        </div>
        <div className={`text-sm font-medium ${step === 'form' ? 'text-gray-700 dark:text-slate-300' : 'text-gray-400 dark:text-slate-500'}`}>Parámetros</div>
      </div>

      {/* Content */}
      <div className="bg-white dark:bg-slate-800/60 border border-gray-200 dark:border-slate-700 rounded-2xl p-6">
        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700/40 rounded-xl text-red-600 dark:text-red-400 text-sm">
            ⚠️ {error}
          </div>
        )}
        {step === 'type' ? (
          <TypeSelector onSelect={handleTypeSelect} />
        ) : selectedType ? (
          <ResearchForm
            type={selectedType}
            onBack={() => setStep('type')}
            onSubmit={handleSubmit}
            loading={loading}
          />
        ) : null}
      </div>
    </div>
  );
}
