import React, { useEffect, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import {
  Camera,
  Plus,
  Loader2,
  X,
  ThumbsUp,
  ThumbsDown,
  Minus,
  Trash2,
  ChevronDown,
  ChevronUp,
  ImageOff,
  Sparkles,
  AlertCircle,
  Users,
  MessageSquareText,
  Building2,
  UserRound
} from 'lucide-react';
import { PhotoBatchAnalysis, PhotoBatchGroupStats, PhotoBatchEntry } from '../types';
import { ApiService } from '../services/api';
import { compressImageToBase64 } from '../services/imageUtils';

const SENTIMENT_COLORS = { positivo: '#10b981', neutro: '#94a3b8', negativo: '#ef4444' };

const sentimentBadge = (sentimento: PhotoBatchEntry['sentimento']) => {
  if (sentimento === 'positivo') return { label: 'Positivo', className: 'bg-emerald-50 text-emerald-700', Icon: ThumbsUp };
  if (sentimento === 'negativo') return { label: 'Negativo', className: 'bg-red-50 text-red-700', Icon: ThumbsDown };
  return { label: 'Neutro', className: 'bg-slate-100 text-slate-600', Icon: Minus };
};

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
    <div className="p-4 sm:p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
            <Camera className="w-5 h-5 text-indigo-600" />
            <span>Análise de Fotos</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Monte a lista de colaboradores (nome + setor + foto da resposta em papel) e a IA lê, agrupa por pergunta
            e resume o sentimento — geral, por pergunta, por setor e por colaborador.
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

type DetailTab = 'geral' | 'perguntas' | 'setores' | 'colaboradores';

const PhotoBatchCard: React.FC<{
  batch: PhotoBatchAnalysis;
  expanded: boolean;
  onToggle: () => void;
  onDelete: () => void;
}> = ({ batch, expanded, onToggle, onDelete }) => {
  const [tab, setTab] = useState<DetailTab>('geral');

  const pieData = [
    { name: 'Positivo', value: batch.positivoGeral, color: SENTIMENT_COLORS.positivo },
    { name: 'Neutro', value: batch.neutroGeral, color: SENTIMENT_COLORS.neutro },
    { name: 'Negativo', value: batch.negativoGeral, color: SENTIMENT_COLORS.negativo }
  ];

  const temMultiplasPerguntas = batch.perguntas.length > 1;
  const temMultiplosSetores = batch.setores.length > 1;

  return (
    <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden">
      <div className="p-5 sm:p-6 flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <h3 className="text-base font-bold text-slate-900">{batch.titulo}</h3>
          <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-2 flex-wrap">
            <span>{batch.entradas.length} colaborador(es)</span>
            <span>•</span>
            <span>{new Date(batch.criadoEm).toLocaleString('pt-BR')}</span>
            {temMultiplasPerguntas && (
              <span className="text-indigo-600 font-semibold">• {batch.perguntas.length} perguntas detectadas</span>
            )}
          </p>
          <p className="text-xs text-slate-600 mt-2 line-clamp-2 max-w-2xl">{batch.resumoGeral}</p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-full bg-emerald-50 text-emerald-700">
            {batch.positivoGeral}% <ThumbsUp className="w-3 h-3" />
          </span>
          <span className="flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-full bg-red-50 text-red-700">
            {batch.negativoGeral}% <ThumbsDown className="w-3 h-3" />
          </span>
          <button onClick={onDelete} title="Excluir análise" className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-red-600">
            <Trash2 className="w-4 h-4" />
          </button>
          <button onClick={onToggle} title={expanded ? 'Recolher' : 'Ver detalhes'} className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-slate-100">
          <div className="flex items-center gap-1 px-5 sm:px-6 pt-4 overflow-x-auto">
            <DetailTabButton active={tab === 'geral'} onClick={() => setTab('geral')} icon={<Sparkles className="w-3.5 h-3.5" />} label="Geral" />
            <DetailTabButton active={tab === 'perguntas'} onClick={() => setTab('perguntas')} icon={<MessageSquareText className="w-3.5 h-3.5" />} label={`Por Pergunta (${batch.perguntas.length})`} />
            <DetailTabButton active={tab === 'setores'} onClick={() => setTab('setores')} icon={<Building2 className="w-3.5 h-3.5" />} label={`Por Setor (${batch.setores.length})`} />
            <DetailTabButton active={tab === 'colaboradores'} onClick={() => setTab('colaboradores')} icon={<UserRound className="w-3.5 h-3.5" />} label={`Colaboradores (${batch.entradas.length})`} />
          </div>

          <div className="p-5 sm:p-6">
            {tab === 'geral' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div className="md:col-span-1 flex flex-col items-center">
                  <div className="w-full h-[160px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={68} paddingAngle={3} dataKey="value">
                          {pieData.map((entry, i) => (<Cell key={i} fill={entry.color} />))}
                        </Pie>
                        <Tooltip formatter={(v: number) => `${v}%`} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className="md:col-span-2 space-y-3">
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                    <p className="text-xs text-slate-700 leading-relaxed">{batch.resumoGeral}</p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <PontosBox title="Pontos Positivos" items={batch.pontosPositivosGerais} tone="positivo" />
                    <PontosBox title="Pontos de Atenção" items={batch.pontosNegativosGerais} tone="negativo" />
                  </div>
                </div>
              </div>
            )}

            {tab === 'perguntas' && (
              <div className="space-y-3">
                {!temMultiplasPerguntas && (
                  <p className="text-[11px] text-slate-400 italic mb-1">
                    A IA identificou apenas uma pergunta/tema neste lote — os números abaixo coincidem com a visão Geral.
                  </p>
                )}
                {batch.perguntas.map((grupo, i) => (
                  <GroupStatCard key={i} grupo={grupo} icon={<MessageSquareText className="w-4 h-4 text-indigo-500" />} />
                ))}
              </div>
            )}

            {tab === 'setores' && (
              <div className="space-y-3">
                {!temMultiplosSetores && (
                  <p className="text-[11px] text-slate-400 italic mb-1">
                    {batch.setores[0]?.titulo === 'Sem setor definido'
                      ? 'Nenhum setor foi informado para os colaboradores deste lote.'
                      : 'Todos os colaboradores deste lote pertencem ao mesmo setor.'}
                  </p>
                )}
                {batch.setores.map((grupo, i) => (
                  <GroupStatCard key={i} grupo={grupo} icon={<Building2 className="w-4 h-4 text-purple-500" />} />
                ))}
              </div>
            )}

            {tab === 'colaboradores' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {batch.entradas.map((en, i) => {
                  const badge = sentimentBadge(en.sentimento);
                  return (
                    <div key={i} className="border border-slate-200 rounded-2xl overflow-hidden bg-slate-50">
                      <a href={en.url} target="_blank" rel="noopener noreferrer">
                        <img src={en.url} alt={en.nome} className="w-full aspect-video object-cover hover:opacity-90 transition-opacity" />
                      </a>
                      <div className="p-3 space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-slate-800 truncate">{en.nome}</span>
                          <span className={`flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${badge.className}`}>
                            <badge.Icon className="w-3 h-3" />
                            {badge.label}
                          </span>
                        </div>
                        {en.setor && <p className="text-[10px] text-slate-400">{en.setor}</p>}
                        {temMultiplasPerguntas && <p className="text-[10px] text-indigo-600 font-semibold">{en.perguntaTitulo}</p>}
                        <p className="text-[11px] text-slate-600 leading-snug line-clamp-4">{en.transcricao}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const DetailTabButton: React.FC<{ active: boolean; onClick: () => void; icon: React.ReactNode; label: string }> = ({ active, onClick, icon, label }) => (
  <button
    onClick={onClick}
    className={`px-3.5 py-2 rounded-t-xl text-xs font-bold flex items-center gap-1.5 whitespace-nowrap transition-colors ${
      active ? 'bg-slate-100 text-slate-900' : 'text-slate-400 hover:text-slate-600'
    }`}
  >
    {icon}
    <span>{label}</span>
  </button>
);

const PontosBox: React.FC<{ title: string; items: string[]; tone: 'positivo' | 'negativo' }> = ({ title, items, tone }) => {
  const isPositivo = tone === 'positivo';
  return (
    <div className={`${isPositivo ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'} border rounded-2xl p-3.5`}>
      <div className={`flex items-center gap-1.5 text-[11px] font-bold uppercase mb-2 ${isPositivo ? 'text-emerald-700' : 'text-red-700'}`}>
        {isPositivo ? <ThumbsUp className="w-3.5 h-3.5" /> : <ThumbsDown className="w-3.5 h-3.5" />}
        <span>{title}</span>
      </div>
      {items.length === 0 ? (
        <p className={`text-[11px] italic ${isPositivo ? 'text-emerald-700/70' : 'text-red-700/70'}`}>Nada de relevante identificado.</p>
      ) : (
        <ul className="space-y-1">
          {items.map((p, i) => (
            <li key={i} className={`text-[11px] ${isPositivo ? 'text-emerald-900' : 'text-red-900'}`}>• {p}</li>
          ))}
        </ul>
      )}
    </div>
  );
};

const GroupStatCard: React.FC<{ grupo: PhotoBatchGroupStats; icon: React.ReactNode }> = ({ grupo, icon }) => (
  <div className="border border-slate-200 rounded-2xl p-4">
    <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
      <div className="flex items-center gap-2 min-w-0">
        {icon}
        <h4 className="text-sm font-bold text-slate-900 truncate">{grupo.titulo}</h4>
      </div>
      <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1 shrink-0">
        <Users className="w-3.5 h-3.5" /> {grupo.totalRespostas} resposta(s)
      </span>
    </div>
    <div className="flex items-center gap-4 mb-3">
      <div className="flex-1 h-2.5 rounded-full overflow-hidden bg-slate-100 flex">
        <div style={{ width: `${grupo.positivo}%`, background: SENTIMENT_COLORS.positivo }} />
        <div style={{ width: `${grupo.neutro}%`, background: SENTIMENT_COLORS.neutro }} />
        <div style={{ width: `${grupo.negativo}%`, background: SENTIMENT_COLORS.negativo }} />
      </div>
      <div className="flex items-center gap-2 text-[11px] font-bold shrink-0">
        <span className="text-emerald-600">{grupo.positivo}%</span>
        <span className="text-slate-400">{grupo.neutro}%</span>
        <span className="text-red-600">{grupo.negativo}%</span>
      </div>
    </div>
    <p className="text-[11px] text-slate-500">
      {grupo.colaboradores.join(', ')}
    </p>
  </div>
);

interface PendingEntry {
  nome: string;
  setor: string;
  file: File;
  previewUrl: string;
}

const CreatePhotoBatchModal: React.FC<{
  onClose: () => void;
  onCreated: (batch: PhotoBatchAnalysis) => void;
}> = ({ onClose, onCreated }) => {
  const [titulo, setTitulo] = useState('');
  const [nomeAtual, setNomeAtual] = useState('');
  const [setorAtual, setSetorAtual] = useState('');
  const [fileAtual, setFileAtual] = useState<File | null>(null);
  const [entries, setEntries] = useState<PendingEntry[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [progressLabel, setProgressLabel] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleAddEntry = () => {
    setError(null);
    if (!nomeAtual.trim()) {
      setError('Informe o nome do colaborador.');
      return;
    }
    if (!fileAtual) {
      setError('Selecione a foto da resposta deste colaborador.');
      return;
    }
    setEntries((prev) => [
      ...prev,
      { nome: nomeAtual.trim(), setor: setorAtual.trim(), file: fileAtual, previewUrl: URL.createObjectURL(fileAtual) }
    ]);
    setNomeAtual('');
    setSetorAtual('');
    setFileAtual(null);
  };

  const removeEntry = (index: number) => {
    setEntries((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    setError(null);
    if (!titulo.trim()) {
      setError('Dê um título para esta análise (ex: "Pesquisa de clima — Home Office").');
      return;
    }
    if (entries.length === 0) {
      setError('Adicione pelo menos um colaborador com foto.');
      return;
    }

    setSubmitting(true);
    try {
      const entradas: { nome: string; setor: string; base64: string; mimeType: string }[] = [];
      for (let i = 0; i < entries.length; i++) {
        setProgressLabel(`Preparando foto ${i + 1} de ${entries.length} (${entries[i].nome})...`);
        const { base64, mimeType } = await compressImageToBase64(entries[i].file);
        entradas.push({ nome: entries[i].nome, setor: entries[i].setor, base64, mimeType });
      }

      setProgressLabel('A IA está lendo, agrupando e analisando as fotos (pode levar até 1 minuto)...');
      const batch = await ApiService.createPhotoBatchAnalysis(titulo.trim(), entradas);
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
              <label className="block text-xs font-bold text-slate-700 mb-1">Título desta análise</label>
              <input
                type="text"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder='Ex: "Pesquisa de clima — Setor Vendas"'
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Dica: se as fotos tiverem respostas de mais de uma pergunta diferente, não tem problema — a IA identifica isso sozinha.
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
              <p className="text-xs font-bold text-slate-700">Adicionar colaborador</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="text"
                  value={nomeAtual}
                  onChange={(e) => setNomeAtual(e.target.value)}
                  placeholder="Nome do colaborador"
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
                <input
                  type="text"
                  value={setorAtual}
                  onChange={(e) => setSetorAtual(e.target.value)}
                  placeholder="Setor (opcional)"
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <label className="flex items-center gap-3 border-2 border-dashed border-slate-300 rounded-xl p-3 cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/40 transition-colors">
                <Camera className="w-5 h-5 text-slate-400 shrink-0" />
                <span className="text-xs font-semibold text-slate-500 truncate">
                  {fileAtual ? fileAtual.name : 'Toque para escolher a foto da resposta'}
                </span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => setFileAtual(e.target.files?.[0] || null)}
                />
              </label>

              <button
                onClick={handleAddEntry}
                className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center justify-center gap-2"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Adicionar à lista</span>
              </button>
            </div>

            {entries.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-600 mb-2">{entries.length} colaborador(es) adicionado(s)</p>
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {entries.map((en, i) => (
                    <div key={i} className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl p-2">
                      <img src={en.previewUrl} alt={en.nome} className="w-10 h-10 rounded-lg object-cover shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-slate-800 truncate">{en.nome}</p>
                        {en.setor && <p className="text-[10px] text-slate-400 truncate">{en.setor}</p>}
                      </div>
                      <button onClick={() => removeEntry(i)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-red-600 shrink-0">
                        <X className="w-3.5 h-3.5" />
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
              <span>Analisar com IA ({entries.length})</span>
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
