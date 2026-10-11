import React, { useEffect, useMemo, useState } from 'react';
import { X, FileText, FileStack, SlidersHorizontal, Loader2, Download, ChevronDown, ChevronUp } from 'lucide-react';
import { SurveyAnalyticsData } from '../../types';
import { PrintableReport, ReportMode, SecoesRelatorio, SECOES_SIMPLES, SECOES_COMPLETO } from './PrintableReport';
import { exportPrintableReportToPdf } from '../../services/pdfExportService';
import { QuestionChartType } from './QuestionAnalyticsCard';
import { detectarEscala } from '../../services/analiseAvancada';
import { ApiService } from '../../services/api';

interface PdfExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  analyticsData: SurveyAnalyticsData;
  getChartTypeForQuestion: (questionId: string, recommendedChart: string) => QuestionChartType;
}

const PDF_CONTAINER_ID = 'pesquisahub-printable-report';

const ROTULO_VERSAO: Record<ReportMode, string> = {
  simples: 'Simplificada',
  completo: 'Completa',
  personalizado: 'Personalizada'
};

export const PdfExportModal: React.FC<PdfExportModalProps> = ({
  isOpen,
  onClose,
  analyticsData,
  getChartTypeForQuestion
}) => {
  const { questions, options, questionAnalytics, executiveSummary } = analyticsData;

  // O que esta pesquisa permite incluir
  const temMatriz = useMemo(() => !!detectarEscala(questions, options), [questions, options]);
  const temEvolucao = executiveSummary.responsesOverTime.length > 1;
  const perguntasDeEscolha = questions.filter((q) => q.tipo === 'single_choice' || q.tipo === 'multiple_choice');
  const temCruzamento = perguntasDeEscolha.length >= 2;

  const ajustarAoDisponivel = (s: SecoesRelatorio): SecoesRelatorio => ({
    ...s,
    matriz: s.matriz && temMatriz,
    evolucao: s.evolucao && temEvolucao,
    cruzamento: s.cruzamento && temCruzamento
  });

  const [modo, setModo] = useState<ReportMode>('simples');
  const [secoes, setSecoes] = useState<SecoesRelatorio>(() => ajustarAoDisponivel(SECOES_SIMPLES));
  const [perguntasSelecionadas, setPerguntasSelecionadas] = useState<string[]>(() => questionAnalytics.map((q) => q.questionId));
  const [mostrarPerguntas, setMostrarPerguntas] = useState(false);

  const [resumoIA, setResumoIA] = useState<{ resumo: string; achados: string[]; plano: string[]; atualizadoEm: string } | null>(null);
  useEffect(() => {
    if (isOpen) ApiService.getResumoExecutivo(analyticsData.survey.id).then(setResumoIA).catch(() => setResumoIA(null));
  }, [isOpen, analyticsData.survey.id]);

  const [isGenerating, setIsGenerating] = useState(false);
  const [progressLabel, setProgressLabel] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const escolherModo = (m: ReportMode) => {
    setModo(m);
    if (m === 'simples') setSecoes(ajustarAoDisponivel(SECOES_SIMPLES));
    if (m === 'completo') {
      setSecoes(ajustarAoDisponivel(SECOES_COMPLETO));
      setPerguntasSelecionadas(questionAnalytics.map((q) => q.questionId));
    }
  };

  const alternarSecao = (chave: keyof SecoesRelatorio) => {
    setModo('personalizado');
    setSecoes((prev) => ({ ...prev, [chave]: !prev[chave] }));
  };

  const alternarPergunta = (id: string) => {
    setModo('personalizado');
    setPerguntasSelecionadas((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const secoesEfetivas: SecoesRelatorio = { ...secoes, resumoIA: secoes.resumoIA && !!resumoIA };
  const nenhumaSecaoAlemDaCapa = !Object.values(secoesEfetivas).some(Boolean);
  const perguntasSemSelecao = secoes.perguntas && perguntasSelecionadas.length === 0;

  const handleGenerate = async () => {
    if (perguntasSemSelecao) {
      setError('Selecione pelo menos uma pergunta para a "Análise por Pergunta", ou desmarque essa seção.');
      return;
    }
    setError(null);
    setIsGenerating(true);
    try {
      // Pequena espera para garantir que o relatório fora da tela (com os gráficos) já renderizou
      await new Promise((resolve) => setTimeout(resolve, 400));

      const safeTitle = analyticsData.survey.titulo
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')
        .toLowerCase();
      const fileName = `relatorio-${safeTitle || 'pesquisa'}-${modo}.pdf`;

      await exportPrintableReportToPdf(PDF_CONTAINER_ID, fileName, (etapa, atual, total) => {
        setProgressLabel(`${etapa} (${atual}/${total})`);
      });

      onClose();
    } catch (err: any) {
      setError(err.message || 'Não foi possível gerar o PDF. Tente novamente.');
    } finally {
      setIsGenerating(false);
      setProgressLabel('');
    }
  };

  const itens: Array<{ chave: keyof SecoesRelatorio; titulo: string; descricao: string; disponivel: boolean; motivo?: string }> = [
    { chave: 'resumoIA', titulo: 'Resumo executivo (IA)', descricao: 'Leitura geral, achados e plano de ação gerados na aba Resumo & IA.', disponivel: !!resumoIA, motivo: 'gere o resumo na aba "Resumo & IA"' },
    { chave: 'conclusoes', titulo: 'Principais conclusões', descricao: 'Pontos de consenso, divisões e síntese numérica.', disponivel: true },
    { chave: 'evolucao', titulo: 'Evolução das respostas', descricao: 'Gráfico do volume de respostas ao longo dos dias.', disponivel: temEvolucao, motivo: 'precisa de respostas em mais de um dia' },
    { chave: 'resumo', titulo: 'Tabela-resumo por pergunta', descricao: 'Opção predominante, % e consenso de cada pergunta.', disponivel: true },
    { chave: 'matriz', titulo: 'Matriz de Competências', descricao: 'Lacunas, pontos fortes, quem pode ensinar e o mapa de calor.', disponivel: temMatriz, motivo: 'esta pesquisa não tem uma escala comum entre perguntas' },
    { chave: 'perguntas', titulo: 'Análise por pergunta (gráficos)', descricao: 'Um gráfico por pergunta, igual ao da tela.', disponivel: true },
    { chave: 'cruzamento', titulo: 'Cruzamento de respostas', descricao: 'Tabela e gráfico cruzando duas perguntas.', disponivel: temCruzamento, motivo: 'precisa de duas perguntas de escolha' },
    { chave: 'individuais', titulo: 'Respostas individuais', descricao: 'Todas as respostas de cada pessoa.', disponivel: true }
  ];

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-xl p-6 space-y-5 shadow-2xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">Extrair Relatório em PDF</h2>
          {!isGenerating && (
            <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700">
              <X className="w-4.5 h-4.5" />
            </button>
          )}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-xs font-medium rounded-xl px-4 py-3">
            {error}
          </div>
        )}

        {!isGenerating ? (
          <>
            <div className="grid grid-cols-3 gap-2">
              {([
                { m: 'simples' as ReportMode, icone: FileText, titulo: 'Simplificada', sub: 'Resumo para envio rápido' },
                { m: 'completo' as ReportMode, icone: FileStack, titulo: 'Completa', sub: 'Tudo o que a pesquisa tem' },
                { m: 'personalizado' as ReportMode, icone: SlidersHorizontal, titulo: 'Personalizada', sub: 'Você escolhe as seções' }
              ]).map(({ m, icone: Icone, titulo, sub }) => (
                <button
                  key={m}
                  onClick={() => escolherModo(m)}
                  className={`text-left p-3 rounded-2xl border-2 transition-all ${
                    modo === m ? 'border-blue-500 bg-blue-50/60' : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <Icone className={`w-4 h-4 mb-1.5 ${modo === m ? 'text-blue-600' : 'text-slate-400'}`} />
                  <div className="font-bold text-xs text-slate-900">{titulo}</div>
                  <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">{sub}</p>
                </button>
              ))}
            </div>

            <div className="space-y-1.5">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Seções do relatório <span className="normal-case font-medium text-slate-400">(a capa com os indicadores sempre entra)</span>
              </div>
              {itens.map((item) => (
                <div key={item.chave}>
                  <label
                    className={`flex items-start gap-3 p-3 rounded-xl border transition-colors ${
                      !item.disponivel
                        ? 'border-slate-100 bg-slate-50 opacity-60 cursor-not-allowed'
                        : secoes[item.chave]
                        ? 'border-blue-300 bg-blue-50/50 cursor-pointer'
                        : 'border-slate-200 hover:bg-slate-50 cursor-pointer'
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      disabled={!item.disponivel}
                      checked={item.disponivel && secoes[item.chave]}
                      onChange={() => alternarSecao(item.chave)}
                    />
                    <span className="flex-1">
                      <span className="block text-xs font-bold text-slate-800">{item.titulo}</span>
                      <span className="block text-[11px] text-slate-500">
                        {item.disponivel ? item.descricao : `Indisponível: ${item.motivo}.`}
                      </span>
                    </span>
                    {item.chave === 'perguntas' && secoes.perguntas && (
                      <button
                        type="button"
                        onClick={(e) => { e.preventDefault(); setMostrarPerguntas((v) => !v); }}
                        className="text-[11px] font-semibold text-blue-700 flex items-center gap-0.5 shrink-0"
                      >
                        {perguntasSelecionadas.length} de {questionAnalytics.length}
                        {mostrarPerguntas ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>
                    )}
                  </label>

                  {item.chave === 'perguntas' && secoes.perguntas && mostrarPerguntas && (
                    <div className="ml-7 mt-1.5 p-3 rounded-xl border border-slate-200 bg-white space-y-1.5">
                      <div className="flex items-center gap-3 pb-1.5 border-b border-slate-100">
                        <button
                          type="button"
                          onClick={() => { setModo('personalizado'); setPerguntasSelecionadas(questionAnalytics.map((q) => q.questionId)); }}
                          className="text-[11px] font-semibold text-blue-700"
                        >
                          Marcar todas
                        </button>
                        <button
                          type="button"
                          onClick={() => { setModo('personalizado'); setPerguntasSelecionadas([]); }}
                          className="text-[11px] font-semibold text-slate-500"
                        >
                          Desmarcar todas
                        </button>
                      </div>
                      <div className="max-h-56 overflow-y-auto space-y-1">
                        {questionAnalytics.map((qa, idx) => (
                          <label key={qa.questionId} className="flex items-start gap-2 text-[11px] text-slate-700 cursor-pointer">
                            <input
                              type="checkbox"
                              className="mt-0.5"
                              checked={perguntasSelecionadas.includes(qa.questionId)}
                              onChange={() => alternarPergunta(qa.questionId)}
                            />
                            <span><strong>{idx + 1}.</strong> {qa.questionTitle}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <button
              onClick={handleGenerate}
              disabled={perguntasSemSelecao}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              <span>{nenhumaSecaoAlemDaCapa ? 'Gerar PDF só com a capa' : `Gerar PDF — versão ${ROTULO_VERSAO[modo]}`}</span>
            </button>
          </>
        ) : (
          <div className="py-10 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
            <p className="text-xs font-semibold text-slate-600">{progressLabel || 'Gerando relatório...'}</p>
            <p className="text-[11px] text-slate-400">Isso pode levar alguns segundos em pesquisas com muitas perguntas.</p>
          </div>
        )}
      </div>

      {/* Relatório fora da tela usado apenas para capturar as imagens do PDF */}
      <PrintableReport
        containerId={PDF_CONTAINER_ID}
        analyticsData={analyticsData}
        secoes={secoesEfetivas}
        rotuloVersao={ROTULO_VERSAO[modo]}
        resumoIA={resumoIA}
        perguntasSelecionadas={perguntasSelecionadas}
        getChartTypeForQuestion={getChartTypeForQuestion}
      />
    </div>
  );
};
