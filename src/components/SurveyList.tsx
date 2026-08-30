import React, { useState } from 'react';
import { 
  BarChart3, 
  Search, 
  Plus, 
  Share2, 
  ExternalLink, 
  Edit3, 
  Copy, 
  Archive, 
  Trash2, 
  CheckCircle, 
  XCircle, 
  Filter, 
  MoreVertical,
  Layers,
  Sparkles,
  Loader2,
  AlertTriangle,
  RefreshCw,
  Clock,
  Eye
} from 'lucide-react';
import { Survey, SurveyStatus, Respondent, Question } from '../types';

interface SurveyListProps {
  surveys: Survey[];
  questions: Question[];
  respondents: Respondent[];
  isLoading?: boolean;
  apiError?: string | null;
  onRefreshData?: () => void;
  onAnalyzeSurvey: (surveyId: string) => void;
  onEditSurvey: (survey: Survey) => void;
  onDuplicateSurvey: (surveyId: string) => void;
  onToggleStatus: (surveyId: string, newStatus: SurveyStatus) => void;
  onDeleteSurvey: (surveyId: string) => void;
  onShareSurvey: (survey: Survey) => void;
  onOpenPublicView: (surveyId: string) => void;
  onOpenNewSurvey: () => void;
}

export const SurveyList: React.FC<SurveyListProps> = ({
  surveys,
  questions,
  respondents,
  isLoading = false,
  apiError = null,
  onRefreshData,
  onAnalyzeSurvey,
  onEditSurvey,
  onDuplicateSurvey,
  onToggleStatus,
  onDeleteSurvey,
  onShareSurvey,
  onOpenPublicView,
  onOpenNewSurvey
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('Todos');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  // Normalização de status para comparação robusta
  const normalizeStatus = (status: string): string => {
    const s = (status || '').toLowerCase();
    if (s === 'publicada' || s === 'published') return 'Publicada';
    if (s === 'rascunho' || s === 'draft') return 'Rascunho';
    if (s === 'encerrada' || s === 'closed') return 'Encerrada';
    if (s === 'arquivada' || s === 'archived') return 'Arquivada';
    return status;
  };

  // Filtragem
  const filteredSurveys = surveys.filter((survey) => {
    const sTitle = (survey.titulo || '').toLowerCase();
    const sDesc = (survey.descricao || '').toLowerCase();
    const sCat = (survey.configuracoes?.categoria || '').toLowerCase();
    const sTerm = searchTerm.toLowerCase().trim();

    const matchesSearch = !sTerm || sTitle.includes(sTerm) || sDesc.includes(sTerm) || sCat.includes(sTerm);
    
    const surveyNormalizedStatus = normalizeStatus(survey.status);
    const matchesStatus = statusFilter === 'Todos' || surveyNormalizedStatus === statusFilter;

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-200">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight font-display">
              Todas as Pesquisas
            </h1>
            <span className="px-2.5 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-bold">
              {surveys.length}
            </span>
          </div>
          <p className="text-xs md:text-sm text-slate-500 mt-1">
            Gerencie questionários, publique formulários e visualize dados sincronizados com o Google Sheets.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {onRefreshData && (
            <button
              onClick={onRefreshData}
              disabled={isLoading}
              title="Recarregar dados do Google Sheets"
              className="p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-blue-600' : 'text-slate-600'}`} />
            </button>
          )}

          <button
            onClick={onOpenNewSurvey}
            className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold text-xs md:text-sm flex items-center justify-center gap-2 shadow-md shadow-blue-600/20 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Criar Pesquisa</span>
          </button>
        </div>
      </div>

      {/* Alerta de Erro de Conexão com a API */}
      {apiError && (
        <div className="bg-rose-50 border border-rose-200 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-rose-900 text-xs">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
            <div>
              <p className="font-bold">Não foi possível carregar as pesquisas do Google Sheets</p>
              <p className="text-rose-700">{apiError}</p>
            </div>
          </div>
          {onRefreshData && (
            <button
              onClick={onRefreshData}
              className="px-3.5 py-1.5 rounded-xl bg-rose-600 text-white font-semibold text-xs hover:bg-rose-700 transition-colors self-start sm:self-auto shrink-0"
            >
              Tentar Novamente
            </button>
          )}
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        
        {/* Search input */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por título, descrição ou categoria..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
          />
        </div>

        {/* Status Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          {['Todos', 'Publicada', 'Rascunho', 'Encerrada', 'Arquivada'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                statusFilter === st
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Conteúdo Principal: Loading, Vazio ou Lista */}
      {isLoading ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-200/80 space-y-3">
          <Loader2 className="w-8 h-8 mx-auto text-blue-600 animate-spin" />
          <h3 className="font-bold text-slate-800 text-sm">Carregando pesquisas do Google Sheets...</h3>
          <p className="text-xs text-slate-500">Buscando questionários e respostas atualizadas diretamente da planilha.</p>
        </div>
      ) : surveys.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-200/80 space-y-3">
          <Layers className="w-12 h-12 mx-auto text-slate-300" />
          <h3 className="font-bold text-slate-800 text-base">Nenhuma pesquisa criada ainda</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Sua planilha do Google Sheets está pronta. Crie seu primeiro formulário para gerar links públicos e coletar dados em tempo real.
          </p>
          <button
            onClick={onOpenNewSurvey}
            className="mt-2 px-5 py-2.5 rounded-xl bg-blue-600 text-white font-semibold text-xs inline-flex items-center gap-2 hover:bg-blue-700 shadow-md shadow-blue-600/20 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Criar Primeira Pesquisa</span>
          </button>
        </div>
      ) : filteredSurveys.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-200/80 space-y-3">
          <Filter className="w-10 h-10 mx-auto text-slate-300" />
          <h3 className="font-bold text-slate-700 text-base">Nenhuma pesquisa encontrada para este filtro</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Não há pesquisas com o status <strong>"{statusFilter}"</strong>{searchTerm ? ` e o termo "${searchTerm}"` : ''}.
          </p>
          <button
            onClick={() => {
              setStatusFilter('Todos');
              setSearchTerm('');
            }}
            className="mt-2 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs inline-flex items-center gap-2 transition-colors"
          >
            Limpar Filtros (Mostrar Todas: {surveys.length})
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredSurveys.map((survey) => {
            const surveyQuestions = questions.filter((q) => q.survey_id === survey.id);
            const surveyRespondents = respondents.filter((r) => r.survey_id === survey.id);
            const normalized = normalizeStatus(survey.status);
            const isPublished = normalized === 'Publicada';
            const isClosed = normalized === 'Encerrada';
            const isDraft = normalized === 'Rascunho';

            return (
              <div
                key={survey.id}
                className="bg-white rounded-2xl p-5 md:p-6 border border-slate-200/90 hover:border-slate-300 shadow-xs hover:shadow-md transition-all flex flex-col md:flex-row md:items-center justify-between gap-5 relative"
              >
                {/* Left Meta Info */}
                <div className="space-y-2 flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Status Badge */}
                    <span
                      className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                        isPublished
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : isClosed
                          ? 'bg-slate-100 text-slate-600 border-slate-200'
                          : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}
                    >
                      {survey.status}
                    </span>

                    {/* Categoria */}
                    {survey.configuracoes?.categoria && (
                      <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                        {survey.configuracoes.categoria}
                      </span>
                    )}

                    <span className="text-xs text-slate-400">
                      Criada em {survey.data_criacao || 'Data não registrada'}
                    </span>
                  </div>

                  {/* Title & Description */}
                  <div>
                    <h3 
                      onClick={() => onAnalyzeSurvey(survey.id)}
                      className="font-bold text-slate-900 text-base md:text-lg hover:text-blue-600 transition-colors cursor-pointer"
                    >
                      {survey.titulo}
                    </h3>
                    {survey.descricao && (
                      <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">
                        {survey.descricao}
                      </p>
                    )}
                  </div>

                  {/* Summary Metrics */}
                  <div className="flex items-center gap-4 text-xs text-slate-500 pt-1">
                    <span className="flex items-center gap-1 font-medium">
                      <strong className="text-slate-900">{surveyQuestions.length}</strong> {surveyQuestions.length === 1 ? 'pergunta' : 'perguntas'}
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1 font-medium">
                      <strong className="text-slate-900">{surveyRespondents.length}</strong> {surveyRespondents.length === 1 ? 'resposta' : 'respostas'}
                    </span>
                    {survey.link_publico && (
                      <>
                        <span>•</span>
                        <span className="font-mono text-[11px] text-slate-400 truncate max-w-[150px]">
                          ID: {survey.id}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Right Action Buttons */}
                <div className="flex flex-wrap items-center gap-2 border-t md:border-t-0 pt-3 md:pt-0 border-slate-100">
                  
                  {/* Botão Ver Analytics / Respostas */}
                  <button
                    onClick={() => onAnalyzeSurvey(survey.id)}
                    className="px-3.5 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs flex items-center gap-1.5 transition-colors border border-blue-200/80"
                  >
                    <BarChart3 className="w-3.5 h-3.5" />
                    <span>Analisar ({surveyRespondents.length})</span>
                  </button>

                  {/* Botão Publicar / Pausar / Rascunho Rápido */}
                  {isDraft && (
                    <button
                      onClick={() => onToggleStatus(survey.id, 'Publicada')}
                      className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 transition-colors shadow-xs"
                      title="Publicar esta pesquisa para receber respostas"
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                      <span>Publicar</span>
                    </button>
                  )}

                  {isPublished && (
                    <button
                      onClick={() => onToggleStatus(survey.id, 'Encerrada')}
                      className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs flex items-center gap-1.5 transition-colors"
                      title="Encerrar recebimento de respostas"
                    >
                      <XCircle className="w-3.5 h-3.5 text-slate-500" />
                      <span>Encerrar</span>
                    </button>
                  )}

                  {isClosed && (
                    <button
                      onClick={() => onToggleStatus(survey.id, 'Publicada')}
                      className="px-3 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 font-semibold text-xs flex items-center gap-1.5 transition-colors"
                      title="Reabrir pesquisa para respostas"
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                      <span>Reabrir</span>
                    </button>
                  )}

                  {/* Compartilhar / Link Público */}
                  <button
                    onClick={() => onShareSurvey(survey)}
                    className="px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs flex items-center gap-1.5 shadow-xs transition-colors"
                    title="Compartilhar link de resposta anônima"
                  >
                    <Share2 className="w-3.5 h-3.5 text-slate-500" />
                    <span>Compartilhar</span>
                  </button>

                  {/* Menu Dropdown de Mais Ações */}
                  <div className="relative">
                    <button
                      onClick={() => setOpenMenuId(openMenuId === survey.id ? null : survey.id)}
                      className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-colors"
                      aria-label="Mais opções"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>

                    {openMenuId === survey.id && (
                      <div className="absolute right-0 top-full mt-1.5 w-48 bg-white rounded-2xl shadow-xl border border-slate-200 p-1.5 z-20 space-y-0.5 animate-in fade-in zoom-in-95 duration-100">
                        <button
                          onClick={() => {
                            setOpenMenuId(null);
                            onOpenPublicView(survey.id);
                          }}
                          className="w-full text-left px-3 py-2 rounded-xl text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                        >
                          <Eye className="w-3.5 h-3.5 text-slate-500" />
                          <span>Abrir Formulário</span>
                        </button>

                        <button
                          onClick={() => {
                            setOpenMenuId(null);
                            onEditSurvey(survey);
                          }}
                          className="w-full text-left px-3 py-2 rounded-xl text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-slate-500" />
                          <span>Editar Perguntas</span>
                        </button>

                        <button
                          onClick={() => {
                            setOpenMenuId(null);
                            onDuplicateSurvey(survey.id);
                          }}
                          className="w-full text-left px-3 py-2 rounded-xl text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                        >
                          <Copy className="w-3.5 h-3.5 text-slate-500" />
                          <span>Duplicar Pesquisa</span>
                        </button>

                        {survey.status !== 'Arquivada' ? (
                          <button
                            onClick={() => {
                              setOpenMenuId(null);
                              onToggleStatus(survey.id, 'Arquivada');
                            }}
                            className="w-full text-left px-3 py-2 rounded-xl text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                          >
                            <Archive className="w-3.5 h-3.5 text-slate-500" />
                            <span>Arquivar</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              setOpenMenuId(null);
                              onToggleStatus(survey.id, 'Rascunho');
                            }}
                            className="w-full text-left px-3 py-2 rounded-xl text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                          >
                            <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
                            <span>Desarquivar</span>
                          </button>
                        )}

                        <div className="h-px bg-slate-100 my-1" />

                        <button
                          onClick={() => {
                            setOpenMenuId(null);
                            if (window.confirm(`Tem certeza que deseja excluir a pesquisa "${survey.titulo}" e todas as suas respostas do Google Sheets? Esta ação não pode ser desfeita.`)) {
                              onDeleteSurvey(survey.id);
                            }
                          }}
                          className="w-full text-left px-3 py-2 rounded-xl text-xs font-medium text-rose-600 hover:bg-rose-50 flex items-center gap-2"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                          <span>Excluir do Sheets</span>
                        </button>
                      </div>
                    )}
                  </div>

                </div>
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
};
