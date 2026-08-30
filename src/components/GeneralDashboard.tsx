import React from 'react';
import { 
  BarChart3, 
  Users, 
  FileText, 
  CheckCircle2, 
  Clock, 
  ArrowRight, 
  Plus, 
  Share2, 
  ExternalLink,
  Sparkles,
  Activity,
  Layers,
  Database,
  Inbox
} from 'lucide-react';
import { Survey, Respondent } from '../types';

interface GeneralDashboardProps {
  surveys: Survey[];
  totalResponsesCount: number;
  respondents: Respondent[];
  onAnalyzeSurvey: (surveyId: string) => void;
  onOpenNewSurvey: () => void;
  onOpenPublicView: (surveyId: string) => void;
  onShareSurvey: (survey: Survey) => void;
  onViewAllSurveys: () => void;
  onOpenSettings: () => void;
  onRefreshData?: () => void;
}

export const GeneralDashboard: React.FC<GeneralDashboardProps> = ({
  surveys,
  totalResponsesCount,
  respondents,
  onAnalyzeSurvey,
  onOpenNewSurvey,
  onOpenPublicView,
  onShareSurvey,
  onViewAllSurveys,
  onOpenSettings,
  onRefreshData
}) => {
  const publishedSurveys = surveys.filter((s) => s.status === 'Publicada');
  const draftSurveys = surveys.filter((s) => s.status === 'Rascunho');
  const closedSurveys = surveys.filter((s) => s.status === 'Encerrada');

  // Mapear total de respostas por pesquisa
  const surveyResponseCounts = surveys.map((s) => {
    const count = respondents.filter((r) => r.survey_id === s.id).length;
    return { ...s, responseCount: count };
  });

  // Mais respondidas primeiro
  const topSurveys = [...surveyResponseCounts].sort((a, b) => b.responseCount - a.responseCount);

  // Respostas recentes (últimos respondentes)
  const recentRespondents = [...respondents]
    .sort((a, b) => new Date(`${b.data_resposta} ${b.hora_resposta || '00:00'}`).getTime() - new Date(`${a.data_resposta} ${a.hora_resposta || '00:00'}`).getTime())
    .slice(0, 6);

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-200">
      
      {/* Welcome Hero Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 md:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 max-w-2xl space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-300 text-xs font-semibold">
            <Database className="w-3.5 h-3.5" />
            <span>Conexão Direta Google Sheets</span>
          </div>
          <h1 className="text-2xl md:text-4xl font-extrabold tracking-tight font-display">
            Transforme respostas em decisões estratégicas.
          </h1>
          <p className="text-slate-300 text-sm md:text-base leading-relaxed">
            Crie questionários com links públicos anônimos, colete respostas no Google Sheets e acesse painéis estatísticos com drill-down individual por resposta.
          </p>
          <div className="pt-2 flex flex-wrap items-center gap-3">
            <button
              onClick={onOpenNewSurvey}
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs md:text-sm flex items-center gap-2 shadow-lg shadow-blue-600/30 transition-transform active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Criar Nova Pesquisa</span>
            </button>
            <button
              onClick={onOpenSettings}
              className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-slate-200 border border-white/20 font-medium text-xs md:text-sm flex items-center gap-2 transition-colors"
            >
              <Database className="w-4 h-4 text-emerald-300" />
              <span>Status da Conexão Sheets</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Stats Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Total de Respostas</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
            {totalResponsesCount}
          </div>
          <p className="text-xs text-slate-500 flex items-center gap-1">
            <Activity className="w-3.5 h-3.5 text-emerald-600" />
            <span>Processadas pelo motor</span>
          </p>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Pesquisas Ativas</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
            {publishedSurveys.length}
          </div>
          <p className="text-xs text-slate-500">
            Recebendo respostas online
          </p>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Rascunhos</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
            {draftSurveys.length}
          </div>
          <p className="text-xs text-slate-500">
            Em construção ou edição
          </p>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Pesquisas</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
            {surveys.length}
          </div>
          <p className="text-xs text-slate-500">
            {closedSurveys.length} encerradas
          </p>
        </div>
      </div>

      {/* Main Content Grid: Top Surveys & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left 2 Cols: Pesquisas Recentes & Destaques */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-blue-600" />
              <h2 className="font-bold text-slate-800 text-lg">Pesquisas no Google Sheets</h2>
            </div>
            {surveys.length > 0 && (
              <button
                onClick={onViewAllSurveys}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                Ver todas ({surveys.length})
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {surveys.length === 0 ? (
            <div className="bg-white rounded-3xl p-8 md:p-12 border border-slate-200/80 text-center space-y-4 shadow-xs">
              <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto text-blue-600">
                <Inbox className="w-8 h-8" />
              </div>
              <div className="space-y-1 max-w-md mx-auto">
                <h3 className="text-base font-bold text-slate-800">Nenhuma pesquisa cadastrada</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Crie sua primeira pesquisa para gerar o link público e começar a receber respostas reais na sua planilha.
                </p>
              </div>
              <button
                onClick={onOpenNewSurvey}
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs inline-flex items-center gap-2 shadow-md shadow-blue-600/20"
              >
                <Plus className="w-4 h-4" />
                <span>Criar Minha Primeira Pesquisa</span>
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {topSurveys.slice(0, 4).map((survey) => {
                const isPublished = survey.status === 'Publicada';
                return (
                  <div
                    key={survey.id}
                    className="bg-white rounded-2xl p-5 border border-slate-200/90 hover:border-slate-300 shadow-xs hover:shadow-md transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex items-center gap-2.5">
                        <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                          isPublished
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : survey.status === 'Rascunho'
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : 'bg-slate-100 text-slate-600 border-slate-200'
                        }`}>
                          {survey.status}
                        </span>
                        {survey.configuracoes.categoria && (
                          <span className="text-[11px] text-slate-500 font-medium">
                            • {survey.configuracoes.categoria}
                          </span>
                        )}
                      </div>

                      <h3 className="font-bold text-slate-900 text-base truncate">
                        {survey.titulo}
                      </h3>
                      <p className="text-xs text-slate-500 line-clamp-1">
                        {survey.descricao}
                      </p>

                      <div className="flex items-center gap-4 text-xs text-slate-500 pt-1">
                        <span className="font-semibold text-slate-700">
                          {survey.responseCount} {survey.responseCount === 1 ? 'resposta' : 'respostas'}
                        </span>
                        <span>•</span>
                        <span>Criado em {survey.data_criacao}</span>
                      </div>
                    </div>

                    {/* Actions Grid */}
                    <div className="flex items-center gap-2 pt-2 md:pt-0 shrink-0">
                      <button
                        onClick={() => onShareSurvey(survey)}
                        title="Compartilhar link da pesquisa"
                        className="p-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                      >
                        <Share2 className="w-4 h-4" />
                      </button>

                      {isPublished && (
                        <button
                          onClick={() => onOpenPublicView(survey.id)}
                          title="Abrir formulário público para responder"
                          className="p-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </button>
                      )}

                      {/* BOTÃO ANALISAR */}
                      <button
                        onClick={() => onAnalyzeSurvey(survey.id)}
                        className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold text-xs flex items-center gap-2 shadow-md shadow-blue-600/20 transition-all"
                      >
                        <BarChart3 className="w-4 h-4" />
                        <span>ANALISAR</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right 1 Col: Feed de Respostas Recentes & Google Sheets Info */}
        <div className="space-y-6">
          
          {/* Feed de Respostas */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-indigo-600" />
                <h3 className="font-bold text-slate-800 text-sm">Respostas Recentes</h3>
              </div>
              <span className="text-[11px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                Google Sheets
              </span>
            </div>

            {recentRespondents.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400 space-y-2">
                <Clock className="w-8 h-8 mx-auto text-slate-300" />
                <p>Nenhuma resposta registrada ainda.</p>
                <p className="text-[10px] text-slate-400">As respostas enviadas pelo formulário público aparecerão aqui em tempo real.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentRespondents.map((resp) => {
                  const s = surveys.find((survey) => survey.id === resp.survey_id);
                  return (
                    <div
                      key={resp.id}
                      className="flex items-start justify-between gap-3 text-xs p-2.5 rounded-xl hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100"
                    >
                      <div className="space-y-0.5 min-w-0">
                        <p className="font-bold text-slate-800 truncate">{resp.nome}</p>
                        <p className="text-[11px] text-slate-500 truncate">{s?.titulo || 'Pesquisa'}</p>
                      </div>
                      <div className="text-right shrink-0 text-[10px] text-slate-400">
                        <span>{resp.data_resposta}</span>
                        {resp.hora_resposta && <p>{resp.hora_resposta}</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Card Conexão Google Sheets */}
          <div className="bg-slate-900 text-slate-100 rounded-2xl p-5 border border-slate-800 shadow-md space-y-3 relative overflow-hidden">
            <div className="flex items-center gap-2 text-emerald-400">
              <Database className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-wider">Banco de Dados Oficial</span>
            </div>
            <h4 className="font-bold text-white text-sm">Google Sheets & Apps Script</h4>
            <p className="text-xs text-slate-300 leading-relaxed">
              Armazenamento relacional direto em abas (Surveys, Questions, Options, Respondents e Answers).
            </p>
            <button
              onClick={onOpenSettings}
              className="w-full py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 shadow-sm"
            >
              <span>Configurações & Diagnóstico</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

        </div>

      </div>

    </div>
  );
};
