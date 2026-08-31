import React, { useEffect, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import {
  Camera,
  Plus,
  Loader2,
  X,
  ThumbsUp,
  ThumbsDown,
  Trash2,
  ChevronDown,
  ChevronUp,
  ImageOff,
  Sparkles,
  AlertCircle
} from 'lucide-react';
import { PhotoBatchAnalysis } from '../types';
import { ApiService } from '../services/api';
import { compressImageToBase64 } from '../services/imageUtils';

const SENTIMENT_COLORS = { positivo: '#10b981', neutro: '#94a3b8', negativo: '#ef4444' };

export const PhotoBatchAnalysisView: React.FC = () => {
  const [batches, setBatches] = useState<PhotoBatchAnalysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadBatches = async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await ApiService.listPhotoBatchAnalyses();
      setBatches(list);
    } catch (err: any) {
      setError(err.message || 'Não foi possível carregar as análises.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBatches();
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir esta análise? As fotos originais continuam salvas no Google Drive.')) return;
    try {
      await ApiService.deletePhotoBatchAnalysis(id);
      setBatches((prev) => prev.filter((b) => b.id !== id));
    } catch (err: any) {
      alert(err.message || 'Não foi possível excluir.');
    }
  };

  return (
    <div className="p-4 sm:p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
            <Camera className="w-5 h-5 text-indigo-600" />
            <span>Análise de Fotos</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Suba fotos de respostas coletadas em papel — a IA lê o texto de cada foto e resume o sentimento geral.
            Não depende de nenhuma pesquisa criada no app.
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl flex items-center gap-2 shadow-md shadow-indigo-500/20"
        >
          <Plus className="w-4 h-4" />
          <span>Nova Análise de Fotos</span>
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs font-medium rounded-xl px-4 py-3">
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-16 flex items-center justify-center">
          <Loader2 className="w-6 h-6 text-slate-300 animate-spin" />
        </div>
      ) : batches.length === 0 ? (
        <div className="bg-white rounded-3xl p-10 text-center border border-slate-200">
          <ImageOff className="w-8 h-8 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-600">Nenhuma análise de fotos ainda.</p>
          <p className="text-xs text-slate-400 mt-1">Clique em "Nova Análise de Fotos" para começar.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {batches.map((batch) => (
            <PhotoBatchCard
              key={batch.id}
              batch={batch}
              expanded={expandedId === batch.id}
              onToggle={() => setExpandedId(expandedId === batch.id ? null : batch.id)}
              onDelete={() => handleDelete(batch.id)}
            />
          ))}
        </div>
      )}

      {showCreateModal && (
        <CreatePhotoBatchModal
          onClose={() => setShowCreateModal(false)}
          onCreated={(batch) => {
            setBatches((prev) => [batch, ...prev]);
            setShowCreateModal(false);
            setExpandedId(batch.id);
          }}
        />
      )}
    </div>
  );
};

const PhotoBatchCard: React.FC<{
  batch: PhotoBatchAnalysis;
  expanded: boolean;
  onToggle: () => void;
  onDelete: () => void;
}> = ({ batch, expanded, onToggle, onDelete }) => {
  const pieData = [
    { name: 'Positivo', value: batch.positivo, color: SENTIMENT_COLORS.positivo },
    { name: 'Neutro', value: batch.neutro, color: SENTIMENT_COLORS.neutro },
    { name: 'Negativo', value: batch.negativo, color: SENTIMENT_COLORS.negativo }
  ];

  return (
    <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden">
      <div className="p-5 sm:p-6 flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <h3 className="text-base font-bold text-slate-900">{batch.titulo}</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {batch.fotos.length} foto(s) • {new Date(batch.criadoEm).toLocaleString('pt-BR')}
          </p>
          <p className="text-xs text-slate-600 mt-2 line-clamp-2 max-w-2xl">{batch.resumo}</p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-full bg-emerald-50 text-emerald-700">
            {batch.positivo}% <ThumbsUp className="w-3 h-3" />
          </span>
          <span className="flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-full bg-red-50 text-red-700">
            {batch.negativo}% <ThumbsDown className="w-3 h-3" />
          </span>
          <button
            onClick={onDelete}
            title="Excluir análise"
            className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-red-600"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <button
            onClick={onToggle}
            title={expanded ? 'Recolher' : 'Ver detalhes'}
            className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-slate-100 p-5 sm:p-6 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="md:col-span-1 flex flex-col items-center">
              <div className="w-full h-[160px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={68} paddingAngle={3} dataKey="value">
                      {pieData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => `${v}%`} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="md:col-span-2 space-y-3">
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                <p className="text-xs text-slate-700 leading-relaxed">{batch.resumo}</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3.5">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 uppercase mb-2">
                    <ThumbsUp className="w-3.5 h-3.5" />
                    <span>Pontos Positivos</span>
                  </div>
                  <ul className="space-y-1">
                    {batch.pontosPositivos.map((p, i) => (
                      <li key={i} className="text-[11px] text-emerald-900">• {p}</li>
                    ))}
                  </ul>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-2xl p-3.5">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-red-700 uppercase mb-2">
                    <ThumbsDown className="w-3.5 h-3.5" />
                    <span>Pontos de Atenção</span>
                  </div>
                  <ul className="space-y-1">
                    {batch.pontosNegativos.map((p, i) => (
                      <li key={i} className="text-[11px] text-red-900">• {p}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>

          <div>
            <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-3">
              Conferir cada foto ({batch.fotos.length})
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {batch.fotos.map((url, i) => (
                <div key={i} className="border border-slate-200 rounded-2xl overflow-hidden bg-slate-50">
                  <a href={url} target="_blank" rel="noopener noreferrer">
                    <img src={url} alt={`Foto ${i + 1}`} className="w-full aspect-square object-cover hover:opacity-90 transition-opacity" />
                  </a>
                  <p className="text-[10px] text-slate-600 p-2 leading-snug line-clamp-4">
                    {batch.transcricoes[i] || '—'}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

interface PendingPhoto {
  file: File;
  previewUrl: string;
}

const CreatePhotoBatchModal: React.FC<{
  onClose: () => void;
  onCreated: (batch: PhotoBatchAnalysis) => void;
}> = ({ onClose, onCreated }) => {
  const [titulo, setTitulo] = useState('');
  const [pending, setPending] = useState<PendingPhoto[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [progressLabel, setProgressLabel] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleFilesSelected = (files: FileList | null) => {
    if (!files) return;
    const newOnes: PendingPhoto[] = Array.from(files)
      .filter((f) => f.type.startsWith('image/'))
      .map((file) => ({ file, previewUrl: URL.createObjectURL(file) }));
    setPending((prev) => [...prev, ...newOnes]);
  };

  const removePending = (index: number) => {
    setPending((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    setError(null);
    if (!titulo.trim()) {
      setError('Dê um título para esta análise (ex: "Pesquisa de clima — Home Office").');
      return;
    }
    if (pending.length === 0) {
      setError('Selecione pelo menos uma foto.');
      return;
    }

    setSubmitting(true);
    try {
      const fotos: { base64: string; mimeType: string }[] = [];
      for (let i = 0; i < pending.length; i++) {
        setProgressLabel(`Preparando foto ${i + 1} de ${pending.length}...`);
        const { base64, mimeType } = await compressImageToBase64(pending[i].file);
        fotos.push({ base64, mimeType });
      }

      setProgressLabel('A IA está lendo e analisando as fotos (pode levar até 1 minuto)...');
      const batch = await ApiService.createPhotoBatchAnalysis(titulo.trim(), fotos);
      onCreated(batch);
    } catch (err: any) {
      setError(err.message || 'Não foi possível concluir a análise.');
    } finally {
      setSubmitting(false);
      setProgressLabel('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">Nova Análise de Fotos</h2>
          {!submitting && (
            <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700">
              <X className="w-4.5 h-4.5" />
            </button>
          )}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-xs font-medium rounded-xl px-4 py-3 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {!submitting ? (
          <>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Título / Pergunta desta análise
              </label>
              <input
                type="text"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder='Ex: "O que você acha de trabalhar em Home Office?"'
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-slate-300 rounded-2xl p-8 cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/40 transition-colors">
                <Camera className="w-6 h-6 text-slate-400" />
                <span className="text-xs font-semibold text-slate-500">
                  Toque para selecionar as fotos (pode escolher várias de uma vez)
                </span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => handleFilesSelected(e.target.files)}
                />
              </label>
            </div>

            {pending.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-600 mb-2">{pending.length} foto(s) selecionada(s)</p>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                  {pending.map((p, i) => (
                    <div key={i} className="relative aspect-square rounded-xl overflow-hidden border border-slate-200">
                      <img src={p.previewUrl} alt={`Prévia ${i + 1}`} className="w-full h-full object-cover" />
                      <button
                        onClick={() => removePending(i)}
                        className="absolute top-1 right-1 bg-white/90 hover:bg-white rounded-full p-1 shadow-sm"
                      >
                        <X className="w-3 h-3 text-slate-600" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={handleSubmit}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              <span>Analisar com IA</span>
            </button>
          </>
        ) : (
          <div className="py-10 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
            <p className="text-xs font-semibold text-slate-600 text-center">{progressLabel}</p>
          </div>
        )}
      </div>
    </div>
  );
};
