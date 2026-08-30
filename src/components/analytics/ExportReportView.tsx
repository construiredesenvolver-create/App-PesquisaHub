import React from 'react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  CartesianGrid 
} from 'recharts';
import { 
  SurveyAnalyticsData 
} from '../../types';
import { 
  Printer, 
  Download, 
  CheckCircle2, 
  AlertTriangle, 
  TrendingUp, 
  FileText, 
  Calendar, 
  Users,
  Award,
  Sparkles
} from 'lucide-react';

interface ExportReportViewProps {
  analyticsData: SurveyAnalyticsData;
  onExportCSV: () => void;
}

export const ExportReportView: React.FC<ExportReportViewProps> = ({
  analyticsData,
  onExportCSV
}) => {
  const { survey, executiveSummary, questionAnalytics } = analyticsData;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 print:p-0 print:space-y-4">
      
      {/* Top Action Controls (Hidden during print) */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-xs flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <h3 className="font-bold text-slate-800 text-sm">Relatório Executivo & Exportações</h3>
          <p className="text-xs text-slate-500">Gere versões prontas para impressão ou exporte os dados tabulares brutos.</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs flex items-center gap-1.5 shadow-xs transition-colors"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Imprimir Relatório</span>
          </button>

          <button
            onClick={onExportCSV}
            className="px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs flex items-center gap-1.5 shadow-xs transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Baixar Planilha CSV</span>
          </button>
        </div>
      </div>

      {/* Relatório Executivo Formal */}
      <div className="bg-white rounded-3xl p-6 md:p-10 border border-slate-200/90 shadow-xs space-y-8 print:border-none print:shadow-none">
        
        {/* Report Header */}
        <div className="border-b border-slate-200 pb-6 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-bold uppercase tracking-wider text-blue-600">
              PesquisaHub • Relatório de Inteligência de Respostas
            </span>
            <span>Emissão: {new Date().toLocaleDateString('pt-BR')}</span>
          </div>

          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
            {survey.titulo}
          </h1>

          {survey.descricao && (
            <p className="text-xs md:text-sm text-slate-600 leading-relaxed">
              {survey.descricao}
            </p>
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 text-xs">
            <div>
              <span className="text-slate-400 block font-medium">Período de Coleta</span>
              <strong className="text-slate-800">
                {executiveSummary.firstResponseDate || 'Início'} até {executiveSummary.lastResponseDate || 'Atual'}
              </strong>
            </div>
            <div>
              <span className="text-slate-400 block font-medium">Amostra Coletada</span>
              <strong className="text-slate-800">{executiveSummary.totalResponses} respondentes</strong>
            </div>
            <div>
              <span className="text-slate-400 block font-medium">Taxa de Conclusão</span>
              <strong className="text-emerald-700">{executiveSummary.completionRate}%</strong>
            </div>
            <div>
              <span className="text-slate-400 block font-medium">Total de Perguntas</span>
              <strong className="text-slate-800">{executiveSummary.totalQuestions} questões</strong>
            </div>
          </div>
        </div>

        {/* Principais Conclusões Estatísticas */}
        <div className="space-y-4">
          <h2 className="text-base font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-blue-600" />
            <span>Principais Conclusões e Padrões Identificados</span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Alto Consenso */}
            <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-2xl p-5 space-y-3">
              <div className="flex items-center gap-2 text-emerald-900 font-bold text-xs uppercase tracking-wider">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Pontos de Maior Consenso (&gt;55%)</span>
              </div>

              {executiveSummary.highConsensusQuestions.length === 0 ? (
                <p className="text-xs text-slate-500 italic">Nenhuma pergunta com concentração superior a 55%.</p>
              ) : (
                <ul className="space-y-2">
                  {executiveSummary.highConsensusQuestions.map((hc, idx) => (
                    <li key={idx} className="text-xs text-slate-800 leading-snug">
                      <strong>{hc.questionTitle}:</strong> {hc.dominantOption} concentrou <strong>{hc.percentage}%</strong> das preferências.
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Divergência / Divisão */}
            <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-5 space-y-3">
              <div className="flex items-center gap-2 text-amber-900 font-bold text-xs uppercase tracking-wider">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span>Pontos de Maior Divergência</span>
              </div>

              {executiveSummary.divergentQuestions.length === 0 ? (
                <p className="text-xs text-slate-500 italic">As preferências não apresentaram empates técnicos críticos.</p>
              ) : (
                <ul className="space-y-2">
                  {executiveSummary.divergentQuestions.map((dq, idx) => (
                    <li key={idx} className="text-xs text-slate-800 leading-snug">
                      <strong>{dq.questionTitle}:</strong> {dq.explanation}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Lista de Fatos Estatísticos Observados */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-5 space-y-2.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
              Síntese Numérica das Questões
            </h3>
            <ul className="space-y-1.5">
              {executiveSummary.keyFindings.map((finding, fIdx) => (
                <li key={fIdx} className="text-xs text-slate-700 flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-600 mt-1.5 shrink-0" />
                  <span>{finding}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Linha do Tempo de Respostas (Gráfico) */}
        {executiveSummary.responsesOverTime.length > 1 && (
          <div className="space-y-3 pt-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
              Evolução Temporal do Volume de Respostas
            </h3>
            <div className="h-56 w-full bg-slate-50/50 rounded-2xl p-4 border border-slate-100">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={executiveSummary.responsesOverTime}>
                  <defs>
                    <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563eb" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748b' }} />
                  <YAxis tick={{ fontSize: 10, fill: '#64748b' }} />
                  <Tooltip contentStyle={{ fontSize: '11px', borderRadius: '8px' }} />
                  <Area type="monotone" dataKey="accumulated" stroke="#2563eb" strokeWidth={2} fillOpacity={1} fill="url(#colorCount)" name="Acumulado" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Tabela Resumo com Todas as Questões e Percentuais */}
        <div className="space-y-3 pt-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
            Tabela Analítica Completa por Pergunta
          </h3>
          <div className="overflow-x-auto border border-slate-200 rounded-2xl">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                  <th className="p-3">#</th>
                  <th className="p-3">Enunciado</th>
                  <th className="p-3">Total Votos</th>
                  <th className="p-3">Opção Predominante</th>
                  <th className="p-3">Percentual</th>
                  <th className="p-3 text-right">Consenso</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {questionAnalytics.map((qa, idx) => (
                  <tr key={qa.questionId} className="hover:bg-slate-50">
                    <td className="p-3 font-bold text-slate-500">{idx + 1}</td>
                    <td className="p-3 font-medium text-slate-900 max-w-xs">{qa.questionTitle}</td>
                    <td className="p-3 font-mono">{qa.totalAnswers}</td>
                    <td className="p-3 font-semibold text-blue-700">
                      {qa.dominantOption?.optionText || '—'}
                    </td>
                    <td className="p-3 font-mono font-bold">
                      {qa.dominantOption ? `${qa.dominantOption.percentage}%` : '—'}
                    </td>
                    <td className="p-3 text-right font-mono">
                      {qa.consensusScore}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>

    </div>
  );
};
