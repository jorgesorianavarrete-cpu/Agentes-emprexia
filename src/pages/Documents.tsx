import { useState, useEffect } from 'react';
import { useUser } from '@insforge/react';
import { insforge } from '../lib/insforge';
import type { Document as DocType } from '../lib/types';
import { FileText, Plus, Trash2, Search, ExternalLink } from 'lucide-react';
import { Modal } from '../components/Modal';

export default function Documents() {
  const { user } = useUser();
  const [docs, setDocs] = useState<DocType[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ title: '', content: '', category: '' });
  const [saving, setSaving] = useState(false);

  async function load() {
    const { data } = await insforge.database.from('knowledge_chunks').select('*').order('created_at', { ascending: false }).limit(200);
    setDocs((data || []) as DocType[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function createDoc(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) return;
    setSaving(true);
    await insforge.database.from('knowledge_chunks').insert([{
      title: form.title, content: form.content || null,
      category: form.category || null, tags: [],
      user_id: user?.id,
    }]);
    setSaving(false); setShowCreate(false);
    setForm({ title: '', content: '', category: '' });
    load();
  }

  async function deleteDoc(id: string) {
    if (!confirm('¿Eliminar este documento?')) return;
    await insforge.database.from('knowledge_chunks').delete().eq('id', id);
    load();
  }

  const filtered = docs.filter(d =>
    !search || d.title.toLowerCase().includes(search.toLowerCase()) ||
    (d.content || '').toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[60vh]">
        <div className="text-gray-400 dark:text-slate-500 text-sm">Cargando documentos...</div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Documentos</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">Base de conocimiento</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          <Plus size={16} /> Nuevo
        </button>
      </div>

      <div className="relative mb-6">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500" />
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Buscar documentos..."
          className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg pl-10 pr-4 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:border-indigo-500"
        />
      </div>

      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-12 text-center">
            <FileText size={40} className="mx-auto mb-3 text-gray-300 dark:text-slate-600" />
            <p className="text-gray-500 dark:text-slate-400">Sin documentos</p>
          </div>
        ) : (
          filtered.map(doc => (
            <div key={doc.id} className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-4 hover:shadow-sm transition-shadow">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-medium text-gray-900 dark:text-white text-sm">{doc.title}</p>
                  {doc.category && <span className="text-xs text-indigo-600 dark:text-indigo-400">{doc.category}</span>}
                  {doc.content && <p className="text-xs text-gray-500 dark:text-slate-400 mt-1 line-clamp-2">{doc.content}</p>}
                  <p className="text-xs text-gray-400 dark:text-slate-500 mt-2">{new Date(doc.created_at).toLocaleString('es-ES')}</p>
                </div>
                <button onClick={() => deleteDoc(doc.id)} className="text-gray-400 dark:text-slate-600 hover:text-red-500 dark:hover:text-red-400 p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 flex-shrink-0">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {showCreate && (
        <Modal title="Nuevo documento" onClose={() => setShowCreate(false)} size="lg">
          <form onSubmit={createDoc} className="space-y-4">
            <div>
              <label className="text-xs text-gray-500 dark:text-slate-400 mb-1 block">Título *</label>
              <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-indigo-500" />
            </div>
            <div>
              <label className="text-xs text-gray-500 dark:text-slate-400 mb-1 block">Categoría</label>
              <input value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-indigo-500" placeholder="ej. SEO, Marketing..." />
            </div>
            <div>
              <label className="text-xs text-gray-500 dark:text-slate-400 mb-1 block">Contenido</label>
              <textarea value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} rows={8} className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-indigo-500 resize-none" />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm text-gray-500 dark:text-slate-400">Cancelar</button>
              <button type="submit" disabled={saving || !form.title.trim()} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg">{saving ? 'Guardando...' : 'Guardar'}</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
