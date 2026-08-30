import React, { useState, useMemo, useEffect } from 'react';
import { 
  X, 
  Search, 
  Download, 
  ArrowLeft, 
  Users, 
  Calendar, 
  Clock, 
  Eye, 
  SlidersHorizontal,
  CheckCircle2,
  FileSpreadsheet,
  Layers,
  Sparkles,
  ChevronRight,
  Hash
} from 'lucide-react';
import { 
  Respondent, 
  Answer, 
  Question, 
  Option, 
  DrillDownTarget 
} from '../../types';
import { AnalyticsEngine } from '../../services/analyticsEngine';

interface DrillDownDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  target: DrillDownTarget | null;
  questions: Question[];
  options: Option[];
  activeRespondents: Respondent[];
  activeAnswers: Answer[];
}

export const DrillDownDrawer: React.FC<DrillDownDrawerProps> = ({
  isOpen,
  onClose,
  target,
  questions,
  options,
  activeRespondents,
  activeAnswers
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'name_asc' | 'name_desc' | 'date_desc' | 'date_asc'>('date_desc');
  const [selectedRespondent, setSelectedRespondent] = useState<Respondent | null>(null);

  // Resetar busca e respondente selecionado quando o alvo mudar
  useEffect(() => {
    setSearchTerm('');
    setSelectedRespondent(null);
  }, [target]);

  // Fechar com tecla Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        if (selectedRespondent) {
          setSelectedRespondent(null);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selectedRespondent, onClose]);

  // Filtrar respondentes conforme o tipo de Drill-Down
  const drillDownResult = useMemo(() => {
    if (!target) return { respondents: [], description: '' };

    if (target.type === 'question_option') {
      const res = AnalyticsEngine.getQuestionOptionDrillDown(
        target.questionId,
        target.optionText,
        activeRespondents,
        activeAnswers
      );
      return {
        respondents: res.respondents,
        description: `Alternativa: "${target.optionText}"`
      };
    }

    if (target.type === 'crosstab_cell' && target.crossTab) {
      const { questionAId, valueA, questionBId, valueB, questionATitle, questionBTitle } = target.crossTab;
      const res = AnalyticsEngine.getCrossTabDrillDown(
        questionAId,
        valueA,
        questionBId,
        valueB,
        activeRespondents,
        activeAnswers
      );
      return {
        respondents: res.respondents,
        description: `Cruzamento: ${questionATitle} ("${valueA}") × ${questionBTitle} ("${valueB}")`
      };
    }

    if (target.type === 'satisfaction_group' && target.satisfactionGroup) {
      const res = AnalyticsEngine.getSatisfactionGroupDrillDown(
        target.questionId,
        target.satisfactionGroup,
        activeRespondents,
        activeAnswers
      );
      const groupLabel = target.satisfactionGroup === 'positive'
        ? 'Avaliação Positiva / Favorável'
        : target.satisfactionGroup === 'neutral'
        ? 'Avaliação Neutra'
        : 'Avaliação Negativa / Insatisfeita';

      return {
        respondents: res.respondents,
        description: `Grupo de Satisfação: ${groupLabel}`
      };
    }

    return { respondents: [], description: '' };
  }, [target, activeRespondents, activeAnswers]);

  // Filtrar e Ordenar a lista interna do Drill-Down
  const filteredAndSortedRespondents = useMemo(() => {
    let list = [...drillDownResult.respondents];

    // Busca textual
    if (searchTerm.trim() !== '') {
      const term = searchTerm.toLowerCase().trim();
      list = list.filter((r) => 
        r.nome.toLowerCase().includes(term) ||
        (r.identificador && r.identificador.toLowerCase().includes(term))
      );
    }

    // Ordenação
    list.sort((a, b) => {
      if (sortBy === 'name_asc') {
        return a.nome.localeCompare(b.nome);
      }
      if (sortBy === 'name_desc') {
        return b.nome.localeCompare(a.nome);
      }
      if (sortBy === 'date_asc') {
        return (a.data_resposta + (a.hora_resposta || '')).localeCompare(b.data_resposta + (b.hora_resposta || ''));
      }
      // date_desc
      return (b.data_resposta + (b.hora_resposta || '')).localeCompare(a.data_resposta + (a.hora_resposta || ''));
    });

    return list;
  }, [drillDownResult.respondents, searchTerm, sortBy]);

  // Exportar apenas este cohort para CSV
  const handleExportDrillDownCSV = () => {
    if (!target) return;
    const csvContent = AnalyticsEngine.exportDrillDownCSV(
      target.surveyTitle,
      drillDownResult.description,
      drillDownResult.respondents,
      activeAnswers,
      questions
    );

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const safeOptionName = (target.optionText || 'drilldown')
      .toLowerCase()
      .replace(/[^a-z0-9]/gi, '_')
      .substring(0, 30);
    link.setAttribute('href', url);
    link.setAttribute('download', `drilldown_${safeOptionName}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!isOpen || !target) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div 
        onClick={onClose}
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
      />

      {/* Drawer Container */}
      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-2xl bg-white shadow-2xl flex flex-col transform transition-transform duration-300 ease-in-out border-l border-slate-200">
          
          {/* Top Header */}
          <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/80 flex items-start justify-between gap-4">
            <div className="space-y-1.5 flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200 flex items-center gap-1">
                  <Layers className="w-3 h-3" />
                  Drill-Down Interativo
                </span>
                <span className="text-slate-300">•</span>
                <span className="text-xs text-slate-500 font-medium truncate">
                  {target.surveyTitle}
                </span>
              </div>

              <h2 className="text-base md:text-lg font-extrabold text-slate-900 leading-snug">
                {target.type === 'crosstab_cell' && target.crossTab
                  ? `Cruzamento de Respostas`
                  : target.questionTitle}
              </h2>

              {/* Informação da alternativa / corte selecionado */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span 
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold text-white shadow-xs"
                  style={{ backgroundColor: target.optionColor || '#2563eb' }}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                  {target.optionText}
                </span>

                <span className="text-xs font-semibold text-slate-600 bg-white px-2.5 py-1 rounded-xl border border-slate-200">
                  <strong>{drillDownResult.respondents.length}</strong> {drillDownResult.respondents.length === 1 ? 'pessoa' : 'pessoas'}
                  {target.percentage !== undefined && (
                    <span className="text-slate-400 ml-1">({target.percentage}% da amostra)</span>
                  )}
                </span>
              </div>
            </div>

            {/* Actions: Close button */}
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors shrink-0"
              title="Fechar painel (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body Content */}
          <div className="flex-1 overflow-y-auto flex flex-col">
            
            {/* View Mode: Deep Dive no Respondente Selecionado */}
            {selectedRespondent ? (
              <div className="p-6 space-y-6 animate-in fade-in slide-in-from-right-4 duration-150">
                
                {/* Back to list button & Respondent Banner */}
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <button
                    onClick={() => setSelectedRespondent(null)}
                    className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1.5 transition-colors group"
                  >
                    <ArrowLeft className="w-4 h-4 transform group-hover:-translate-x-0.5 transition-transform" />
                    <span>Voltar para lista de {drillDownResult.respondents.length} respondentes</span>
                  </button>
                  
                  <span className="text-[11px] text-slate-400 font-mono">
                    ID: {selectedRespondent.id}
                  </span>
                </div>

                {/* Profile Card */}
                <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white font-extrabold flex items-center justify-center text-lg shadow-sm shrink-0">
                    {selectedRespondent.nome.charAt(0).toUpperCase()}
                  </div>
                  <div className="space-y-0.5 flex-1 min-w-0">
                    <h3 className="font-extrabold text-slate-900 text-base truncate">
                      {selectedRespondent.nome}
                    </h3>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                      {selectedRespondent.identificador && (
                        <span className="font-mono text-slate-700">
                          Matrícula/ID: {selectedRespondent.identificador}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        {selectedRespondent.data_resposta}
                      </span>
                      {selectedRespondent.hora_resposta && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          {selectedRespondent.hora_resposta}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* All Answers Breakdown */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">
                      Respostas Completas no Questionário
                    </h4>
                    <span className="text-xs font-semibold text-slate-500">
                      {questions.length} perguntas
                    </span>
                  </div>

                  {questions.map((q, idx) => {
                    const respAnswers = activeAnswers.filter(
                      (a) => a.respondent_id === selectedRespondent.id && a.question_id === q.id
                    );
                    const isOriginQuestion = q.id === target.questionId || (target.crossTab && (q.id === target.crossTab.questionAId || q.id === target.crossTab.questionBId));

                    return (
                      <div
                        key={q.id}
                        className={`p-4 rounded-2xl border transition-all ${
                          isOriginQuestion
                            ? 'bg-blue-50/40 border-blue-300 ring-1 ring-blue-500/20 shadow-xs'
                            : 'bg-white border-slate-200/80'
                        } space-y-2.5`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-xs font-bold text-slate-800 leading-snug">
                            {idx + 1}. {q.titulo}
                          </span>
                          {isOriginQuestion && (
                            <span className="text-[10px] font-bold text-blue-700 bg-blue-100/70 border border-blue-200 px-2 py-0.5 rounded-full shrink-0">
                              Origem do Drill-down
                            </span>
                          )}
                        </div>

                        {respAnswers.length === 0 ? (
                          <p className="text-xs text-slate-400 italic">Não respondida</p>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {respAnswers.map((ans) => {
                              const matchesDrillDownValue = ans.valor === target.optionText || (target.crossTab && (ans.valor === target.crossTab.valueA || ans.valor === target.crossTab.valueB));

                              return (
                                <div
                                  key={ans.id}
                                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs ${
                                    matchesDrillDownValue
                                      ? 'bg-blue-600 text-white shadow-xs'
                                      : 'bg-slate-100 text-slate-800 border border-slate-200'
                                  }`}
                                >
                                  {matchesDrillDownValue && <CheckCircle2 className="w-3.5 h-3.5" />}
                                  <span>{ans.valor}</span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

              </div>
            ) : (
              /* View Mode: Lista de Respondentes do Drill-Down */
              <div className="p-6 space-y-4 flex-1 flex flex-col">
                
                {/* Search & Sort & Export Toolbar */}
                <div className="space-y-3 bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5">
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                    
                    {/* Search Input */}
                    <div className="relative flex-1">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="Buscar nesta lista por nome ou ID..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      />
                    </div>

                    {/* Sort Selector */}
                    <select
                      value={sortBy}
                      onChange={(e: any) => setSortBy(e.target.value)}
                      className="text-xs font-semibold bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
                    >
                      <option value="date_desc">Mais Recentes</option>
                      <option value="date_asc">Mais Antigos</option>
                      <option value="name_asc">Nome (A-Z)</option>
                      <option value="name_desc">Nome (Z-A)</option>
                    </select>

                    {/* Export CSV for this cohort */}
                    <button
                      onClick={handleExportDrillDownCSV}
                      title="Exportar CSV com os respondentes desta alternativa"
                      className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-colors shrink-0"
                    >
                      <Download className="w-3.5 h-3.5 text-blue-600" />
                      <span>Exportar CSV</span>
                    </button>
                  </div>

                  {/* Summary Bar */}
                  <div className="flex items-center justify-between text-[11px] text-slate-500 px-1">
                    <span>
                      Mostrando <strong>{filteredAndSortedRespondents.length}</strong> de <strong>{drillDownResult.respondents.length}</strong> respondentes desta alternativa
                    </span>
                    <span className="text-slate-400">
                      Respeitando filtros ativos da dashboard
                    </span>
                  </div>
                </div>

                {/* Respondents List Cards */}
                <div className="space-y-2.5 flex-1">
                  {filteredAndSortedRespondents.length === 0 ? (
                    <div className="py-16 text-center border-2 border-dashed border-slate-200 rounded-3xl space-y-2">
                      <Users className="w-8 h-8 text-slate-300 mx-auto" />
                      <p className="text-xs font-bold text-slate-600">Nenhum respondente encontrado</p>
                      <p className="text-[11px] text-slate-400">
                        {searchTerm ? 'Tente ajustar os termos da busca.' : 'Não há respostas registradas para este critério nos filtros atuais.'}
                      </p>
                    </div>
                  ) : (
                    filteredAndSortedRespondents.map((resp, index) => {
                      return (
                        <div
                          key={resp.id}
                          className="bg-white hover:bg-slate-50/90 border border-slate-200/90 hover:border-blue-300 rounded-2xl p-3.5 transition-all flex items-center justify-between gap-3 group shadow-2xs"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="text-[10px] font-bold text-slate-400 w-5 text-center">
                              {index + 1}
                            </span>

                            <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 font-extrabold flex items-center justify-center text-xs shrink-0 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                              {resp.nome.charAt(0).toUpperCase()}
                            </div>

                            <div className="min-w-0 space-y-0.5">
                              <div className="flex items-center gap-2">
                                <h4 className="font-extrabold text-slate-900 text-xs truncate">
                                  {resp.nome}
                                </h4>
                                {resp.identificador && (
                                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                                    {resp.identificador}
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-2 text-[11px] text-slate-400">
                                <span className="flex items-center gap-1">
                                  <Calendar className="w-3 h-3 text-slate-300" />
                                  {resp.data_resposta}
                                </span>
                                {resp.hora_resposta && (
                                  <span>às {resp.hora_resposta}</span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Action Button: Deep Dive */}
                          <button
                            onClick={() => setSelectedRespondent(resp)}
                            className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-blue-600 text-slate-700 hover:text-white font-bold text-xs flex items-center gap-1.5 transition-all shrink-0"
                            title="Ver todas as respostas deste respondente"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Ver Respostas</span>
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>

              </div>
            )}

          </div>

          {/* Drawer Footer */}
          <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500 flex items-center gap-1">
              <Users className="w-3.5 h-3.5 text-slate-400" />
              Total no Drill-down: <strong className="text-slate-800">{drillDownResult.respondents.length} pessoas</strong>
            </span>

            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition-colors"
            >
              Fechar Painel
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};
