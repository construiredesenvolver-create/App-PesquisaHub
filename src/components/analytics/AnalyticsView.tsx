import React, { useState, useMemo } from 'react';
import { 
  BarChart3, 
  GitCompare, 
  Users, 
  FileText, 
  Filter, 
  Share2, 
  ExternalLink, 
  Sparkles, 
  Calendar, 
  CheckCircle2, 
  Clock, 
  ArrowLeft,
  X,
  RotateCcw,
  SlidersHorizontal,
  Download
} from 'lucide-react';
import { 
  Survey, 
  Question, 
  Option, 
  Respondent, 
  Answer, 
  SurveyFilter 
} from '../../types';
import { AnalyticsEngine } from '../../services/analyticsEngine';
import { QuestionAnalyticsCard, QuestionChartType } from './QuestionAnalyticsCard';
import { CrossTabulationView } from './CrossTabulationView';
import { IndividualResponsesTable } from './IndividualResponsesTable';
import { ExportReportView } from './ExportReportView';
import { DrillDownDrawer } from './DrillDownDrawer';
import { DrillDownTarget } from '../../types';

interface AnalyticsViewProps {
  survey: Survey;
  questions: Question[];
  options: Option[];
  respondents: Respondent[];
  answers: Answer[];
  onBackToSurveys: () => void;
  onShareSurvey: (survey: Survey) => void;
  onOpenPublicView: (surveyId: string) => void;
  onExportCSV: (surveyId: string) => void;
}

export type AnalyticsTab = 'questions' | 'crosstab' | 'respondents' | 'report';

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({
  survey,
  questions,
  options,
  respondents,
  answers,
  onBackToSurveys,
  onShareSurvey,
  onOpenPublicView,
  onExportCSV
}) => {
  const [activeTab, setActiveTab] = useState<AnalyticsTab>('questions');
  const [showFilters, setShowFilters] = useState(false);

  // Tipo de gráfico escolhido por pergunta (compartilhado com a exportação em PDF,
  // que replica exatamente o gráfico que está sendo visualizado na tela)
  const [chartTypeByQuestion, setChartTypeByQuestion] = useState<Record<string, QuestionChartType>>({});

  const handleChartTypeChange = (questionId: string, chartType: QuestionChartType) => {
    setChartTypeByQuestion((prev) => ({ ...prev, [questionId]: chartType }));
  };

  const getChartTypeForQuestion = (questionId: string, recommendedChart: string): QuestionChartType => {
    if (chartTypeByQuestion[questionId]) return chartTypeByQuestion[questionId];
    return recommendedChart === 'donut' ? 'donut' : 'horizontal_bar';
  };


  // Estados de Drill-Down Interativo
  const [drillDownTarget, setDrillDownTarget] = useState<DrillDownTarget | null>(null);
  const [isDrillDownOpen, setIsDrillDownOpen] = useState(false);

  const handleOpenDrillDown = (target: DrillDownTarget) => {
    setDrillDownTarget(target);
    setIsDrillDownOpen(true);
  };

  const handleCloseDrillDown = () => {
    setIsDrillDownOpen(false);
  };

  // Estados de Filtro
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [filterRespondent, setFilterRespondent] = useState('');
  const [questionFilters, setQuestionFilters] = useState<Record<string, string[]>>({});

  // Perguntas candidatas para filtro de segmentação (ex: Setor, Cargo, etc.)
  const segmentationQuestions = useMemo(() => {
    return questions.filter((q) => q.tipo === 'single_choice' || q.tipo === 'multiple_choice');
  }, [questions]);

  // Contar filtros ativos
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filterDateFrom) count++;
    if (filterDateTo) count++;
    if (filterRespondent) count++;
    Object.values(questionFilters).forEach((arr: string[]) => {
      if (arr && arr.length > 0) count++;
    });
    return count;
  }, [filterDateFrom, filterDateTo, filterRespondent, questionFilters]);

  // Resetar filtros
  const handleClearFilters = () => {
    setFilterDateFrom('');
    setFilterDateTo('');
    setFilterRespondent('');
    setQuestionFilters({});
  };

  // Manipular filtro por alternativa de uma pergunta
  const handleToggleQuestionFilter = (questionId: string, optionValue: string) => {
    setQuestionFilters((prev) => {
      const current = prev[questionId] || [];
      const updated = current.includes(optionValue)
        ? current.filter((v) => v !== optionValue)
        : [...current, optionValue];

      const next = { ...prev };
      if (updated.length > 0) {
        next[questionId] = updated;
      } else {
        delete next[questionId];
      }
      return next;
    });
  };

  // Executar o Motor Analítico com filtros ativos
  const analyticsData = useMemo(() => {
    const filter: SurveyFilter = {
      dateFrom: filterDateFrom || undefined,
      dateTo: filterDateTo || undefined,
      respondentSearch: filterRespondent || undefined,
      questionFilters
    };

    return AnalyticsEngine.analyzeSurvey(
      survey,
      questions,
      options,
      respondents,
      answers,
      filter
    );
  }, [survey, questions, options, respondents, answers, filterDateFrom, filterDateTo, filterRespondent, questionFilters]);

  const { executiveSummary, questionAnalytics } = analyticsData;

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-200">
      
      {/* Top Header Navigation */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <button
              onClick={onBackToSurveys}
              className="text-xs font-semibold text-slate-500 hover:text-slate-800 flex items-center gap-1 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Voltar para Pesquisas</span>
            </button>
            <span className="text-slate-300">•</span>
            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${
              survey.status === 'Publicada'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-slate-100 text-slate-600 border-slate-200'
            }`}>
              {survey.status}
            </span>
          </div>

          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight font-display">
            {survey.titulo}
          </h1>

          <p className="text-xs text-slate-500 line-clamp-1">
            {survey.descricao}
          </p>
        </div>

        {/* Header Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
          <button
            onClick={() => onShareSurvey(survey)}
            className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs flex items-center gap-1.5 shadow-xs transition-colors"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>Compartilhar</span>
          </button>

          {survey.status === 'Publicada' && (
            <button
              onClick={() => onOpenPublicView(survey.id)}
              className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs flex items-center gap-1.5 shadow-xs transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Abrir Formulário</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Highlights Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-xs space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Total de Respostas
          </span>
          <div className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
            {executiveSummary.totalResponses}
          </div>
          <span className="text-[11px] text-slate-500">
            {activeFiltersCount > 0 ? 'Filtros aplicados' : 'Base total coletada'}
          </span>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-xs space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Taxa de Conclusão
          </span>
          <div className="text-2xl md:text-3xl font-extrabold text-emerald-600 tracking-tight">
            {executiveSummary.completionRate}%
          </div>
          <span className="text-[11px] text-slate-500">
            Todas obrigatórias respondidas
          </span>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-xs space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Perguntas
          </span>
          <div className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
            {executiveSummary.totalQuestions}
          </div>
          <span className="text-[11px] text-slate-500">
            Questões estruturadas
          </span>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-xs space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Última Resposta
          </span>
          <div className="text-sm md:text-base font-bold text-slate-800 pt-1 truncate">
            {executiveSummary.lastResponseDate || 'Sem respostas'}
          </div>
          <span className="text-[11px] text-slate-500">
            Registro mais recente
          </span>
        </div>
      </div>

      {/* Tabs Switcher & Filter Toggle Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-2">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          <button
            onClick={() => setActiveTab('questions')}
            className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all whitespace-nowrap ${
              activeTab === 'questions'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Análise por Pergunta</span>
          </button>

          <button
            onClick={() => setActiveTab('crosstab')}
            className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all whitespace-nowrap ${
              activeTab === 'crosstab'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <GitCompare className="w-4 h-4" />
            <span>Cruzar Respostas</span>
          </button>

          <button
            onClick={() => setActiveTab('respondents')}
            className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all whitespace-nowrap ${
              activeTab === 'respondents'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Respostas Individuais</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200 text-slate-700">
              {analyticsData.respondents.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('report')}
            className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all whitespace-nowrap ${
              activeTab === 'report'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Relatório & Exportação</span>
          </button>
        </div>

        {/* Filter Toggle Button */}
        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-3 py-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              activeFiltersCount > 0 || showFilters
                ? 'bg-blue-50 border-blue-300 text-blue-700'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Filtros</span>
            {activeFiltersCount > 0 && (
              <span className="w-4 h-4 rounded-full bg-blue-600 text-white text-[10px] flex items-center justify-center font-bold">
                {activeFiltersCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Filter Drawer / Panel (Section 17) */}
      {showFilters && (
        <div className="bg-white rounded-3xl p-5 md:p-6 border border-blue-200/90 shadow-md space-y-4 animate-in slide-in-from-top-2 duration-150">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2 text-slate-900 font-bold text-xs uppercase tracking-wider">
              <Filter className="w-4 h-4 text-blue-600" />
              <span>Filtrar e Segmentar Dados da Dashboard</span>
            </div>
            {activeFiltersCount > 0 && (
              <button
                onClick={handleClearFilters}
                className="text-xs font-semibold text-rose-600 hover:text-rose-700 flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" />
                Limpar filtros ({activeFiltersCount})
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-600 mb-1">
                Data Inicial
              </label>
              <input
                type="date"
                value={filterDateFrom}
                onChange={(e) => setFilterDateFrom(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-600 mb-1">
                Data Final
              </label>
              <input
                type="date"
                value={filterDateTo}
                onChange={(e) => setFilterDateTo(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-600 mb-1">
                Buscar por Respondente
              </label>
              <input
                type="text"
                value={filterRespondent}
                onChange={(e) => setFilterRespondent(e.target.value)}
                placeholder="Ex: João Silva"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800"
              />
            </div>
          </div>

          {/* Segmentação por Respostas de Perguntas (ex: Setor = SAC) */}
          {segmentationQuestions.length > 0 && (
            <div className="pt-3 border-t border-slate-100 space-y-2">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                Segmentar por Resposta de Pergunta
              </span>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {segmentationQuestions.map((q) => {
                  const qOpts = options.filter((o) => o.question_id === q.id);
                  const activeSelected = questionFilters[q.id] || [];

                  return (
                    <div key={q.id} className="bg-slate-50 p-3 rounded-2xl border border-slate-200/80 space-y-2">
                      <p className="text-xs font-bold text-slate-800 line-clamp-1">{q.titulo}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {qOpts.map((opt) => {
                          const isSelected = activeSelected.includes(opt.texto);
                          return (
                            <button
                              key={opt.id}
                              onClick={() => handleToggleQuestionFilter(q.id, opt.texto)}
                              className={`text-[11px] px-2.5 py-1 rounded-lg font-medium transition-all ${
                                isSelected
                                  ? 'bg-blue-600 text-white shadow-xs'
                                  : 'bg-white hover:bg-slate-200/70 border border-slate-200 text-slate-700'
                              }`}
                            >
                              {opt.texto}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab Content Display */}
      {activeTab === 'questions' && (
        <div className="space-y-6">
          {questionAnalytics.map((qa, index) => (
            <QuestionAnalyticsCard
              key={qa.questionId}
              analytics={qa}
              questionIndex={index}
              surveyTitle={survey.titulo}
              onDrillDown={handleOpenDrillDown}
              chartType={getChartTypeForQuestion(qa.questionId, qa.recommendedChart)}
              onChartTypeChange={handleChartTypeChange}
            />
          ))}
        </div>
      )}

      {activeTab === 'crosstab' && (
        <CrossTabulationView
          surveyTitle={survey.titulo}
          questions={questions}
          options={options}
          respondents={analyticsData.respondents}
          answers={analyticsData.answers}
          onDrillDown={handleOpenDrillDown}
        />
      )}

      {activeTab === 'respondents' && (
        <IndividualResponsesTable
          surveyTitle={survey.titulo}
          questions={questions}
          options={options}
          respondents={analyticsData.respondents}
          answers={analyticsData.answers}
          onExportCSV={() => onExportCSV(survey.id)}
        />
      )}

      {activeTab === 'report' && (
        <ExportReportView
          analyticsData={analyticsData}
          onExportCSV={() => onExportCSV(survey.id)}
          getChartTypeForQuestion={getChartTypeForQuestion}
        />
      )}

      {/* Drawer Lateral de Drill-Down Interativo */}
      <DrillDownDrawer
        isOpen={isDrillDownOpen}
        onClose={handleCloseDrillDown}
        target={drillDownTarget}
        questions={questions}
        options={options}
        activeRespondents={analyticsData.respondents}
        activeAnswers={analyticsData.answers}
      />

    </div>
  );
};
