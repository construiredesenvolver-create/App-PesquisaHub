import React, { useState } from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  Legend, 
  ResponsiveContainer, 
  CartesianGrid 
} from 'recharts';
import { Question, Option, Respondent, Answer, DrillDownTarget } from '../../types';
import { AnalyticsEngine, CHART_COLORS } from '../../services/analyticsEngine';
import { 
  GitCompare, 
  Table as TableIcon, 
  BarChart3, 
  Lightbulb, 
  Sparkles,
  Info,
  Layers
} from 'lucide-react';

interface CrossTabulationViewProps {
  surveyTitle: string;
  questions: Question[];
  options: Option[];
  respondents: Respondent[];
  answers: Answer[];
  onDrillDown: (target: DrillDownTarget) => void;
}

export const CrossTabulationView: React.FC<CrossTabulationViewProps> = ({
  surveyTitle,
  questions,
  options,
  respondents,
  answers,
  onDrillDown
}) => {
  // Filtrar apenas perguntas de escolha única ou múltipla escolha
  const choiceQuestions = questions.filter(
    (q) => q.tipo === 'single_choice' || q.tipo === 'multiple_choice'
  );

  const [questionAId, setQuestionAId] = useState<string>(
    choiceQuestions.length > 1 ? choiceQuestions[1].id : choiceQuestions[0]?.id || ''
  );
  const [questionBId, setQuestionBId] = useState<string>(
    choiceQuestions.length > 2 ? choiceQuestions[2].id : choiceQuestions[0]?.id || ''
  );

  const questionA = questions.find((q) => q.id === questionAId);
  const questionB = questions.find((q) => q.id === questionBId);

  if (!questionA || !questionB || choiceQuestions.length < 2) {
    return (
      <div className="bg-white rounded-3xl p-12 text-center border border-slate-200/90 space-y-3">
        <GitCompare className="w-12 h-12 mx-auto text-slate-300" />
        <h3 className="font-bold text-slate-700 text-base">Perguntas insuficientes para cruzamento</h3>
        <p className="text-xs text-slate-500 max-w-sm mx-auto">
          Esta pesquisa precisa ter pelo menos 2 perguntas de seleção para realizar o cruzamento de respostas.
        </p>
      </div>
    );
  }

  const optionsA = options.filter((o) => o.question_id === questionA.id);
  const optionsB = options.filter((o) => o.question_id === questionB.id);

  // Executar motor de cruzamento
  const result = AnalyticsEngine.crossTabulate(
    questionA,
    questionB,
    optionsA,
    optionsB,
    respondents,
    answers
  );

  // Formatar dados para o gráfico de barras empilhadas/agrupadas Recharts
  const chartData = result.rows.map((row) => {
    const item: any = { group: row };
    result.columns.forEach((col) => {
      item[col] = result.matrix[row][col] || 0;
    });
    return item;
  });

  const handleCellClick = (row: string, col: string) => {
    const count = result.matrix[row]?.[col] || 0;
    const pct = result.percentageMatrix[row]?.[col] || 0;
    onDrillDown({
      type: 'crosstab_cell',
      surveyTitle,
      questionId: questionA.id,
      questionTitle: `${questionA.titulo} × ${questionB.titulo}`,
      optionText: `"${row}" e "${col}"`,
      optionColor: '#4f46e5',
      percentage: pct,
      totalCount: count,
      crossTab: {
        questionAId: questionA.id,
        questionATitle: questionA.titulo,
        valueA: row,
        questionBId: questionB.id,
        questionBTitle: questionB.titulo,
        valueB: col
      }
    });
  };

  return (
    <div className="space-y-6">
      
      {/* Selector Box */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-xs space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-slate-800">
            <GitCompare className="w-5 h-5 text-blue-600" />
            <h2 className="font-bold text-base md:text-lg">Cruzar Respostas (Tabela de Contingência)</h2>
          </div>
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-blue-700 bg-blue-50 border border-blue-200 px-3 py-1 rounded-xl font-medium">
            <Layers className="w-3.5 h-3.5" />
            <span>Drill-down ativo nas células e barras</span>
          </div>
        </div>

        <p className="text-xs text-slate-500">
          Selecione duas perguntas para cruzar suas alternativas e clique em qualquer número para ver a lista de respondentes daquele par de respostas.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <span className="w-4 h-4 rounded bg-blue-100 text-blue-700 font-bold text-[10px] flex items-center justify-center">A</span>
              Pergunta Linha (Segmentação)
            </label>
            <select
              value={questionAId}
              onChange={(e) => setQuestionAId(e.target.value)}
              className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            >
              {choiceQuestions.map((q) => (
                <option key={q.id} value={q.id} disabled={q.id === questionBId}>
                  {q.titulo}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <span className="w-4 h-4 rounded bg-indigo-100 text-indigo-700 font-bold text-[10px] flex items-center justify-center">B</span>
              Pergunta Coluna (Resultado)
            </label>
            <select
              value={questionBId}
              onChange={(e) => setQuestionBId(e.target.value)}
              className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            >
              {choiceQuestions.map((q) => (
                <option key={q.id} value={q.id} disabled={q.id === questionAId}>
                  {q.titulo}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Insights Automáticos Gerados por Regras Estatísticas */}
      {result.keyInsights.length > 0 && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200/80 rounded-3xl p-5 md:p-6 space-y-3">
          <div className="flex items-center gap-2 text-blue-900 font-bold text-xs uppercase tracking-wider">
            <Lightbulb className="w-4 h-4 text-blue-600" />
            <span>Conclusões Estatísticas do Cruzamento</span>
          </div>
          <ul className="space-y-2">
            {result.keyInsights.map((insight, idx) => (
              <li key={idx} className="text-xs md:text-sm text-slate-800 flex items-start gap-2.5">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-600 mt-2 shrink-0" />
                <span className="leading-relaxed">{insight}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Tabela de Cruzamento Interativa com Drill-Down */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <TableIcon className="w-4 h-4 text-slate-600" />
            <h3 className="font-bold text-slate-900 text-sm md:text-base">
              {questionA.titulo} × {questionB.titulo}
            </h3>
          </div>
          <span className="text-xs text-slate-500 font-mono">
            {result.grandTotal} respostas cruzadas
          </span>
        </div>

        <p className="text-xs text-slate-400">
          💡 Clique em qualquer célula com respostas para abrir o drill-down e ver os nomes dos respondentes.
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                <th className="p-3 font-bold uppercase tracking-wider text-slate-500">
                  {questionA.titulo}
                </th>
                {result.columns.map((col) => (
                  <th key={col} className="p-3 font-bold text-center text-slate-700">
                    {col}
                  </th>
                ))}
                <th className="p-3 font-bold text-right text-slate-900 bg-slate-100">
                  Total
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {result.rows.map((row) => {
                const rTotal = result.rowTotals[row] || 0;
                return (
                  <tr key={row} className="hover:bg-slate-50/50 transition-colors">
                    <td className="p-3 font-bold text-slate-900 bg-slate-50/50">
                      {row}
                    </td>
                    {result.columns.map((col) => {
                      const count = result.matrix[row][col] || 0;
                      const pct = result.percentageMatrix[row][col] || 0;
                      
                      // Heatmap color intensity
                      const bgIntensity = pct >= 50 
                        ? 'bg-blue-100/80 text-blue-900 font-extrabold hover:bg-blue-200' 
                        : pct >= 25 
                        ? 'bg-blue-50/70 text-blue-800 font-semibold hover:bg-blue-100' 
                        : 'text-slate-700 hover:bg-slate-100';

                      return (
                        <td 
                          key={col} 
                          onClick={() => count > 0 && handleCellClick(row, col)}
                          title={count > 0 ? `Clique para ver as ${count} pessoas de "${row}" que responderam "${col}"` : 'Nenhuma resposta'}
                          className={`p-3 text-center transition-all ${bgIntensity} ${
                            count > 0 ? 'cursor-pointer hover:ring-2 hover:ring-blue-500 rounded-lg' : ''
                          }`}
                        >
                          <div className="font-mono flex items-center justify-center gap-1">
                            <span>{count}</span>
                            {count > 0 && (
                              <span className="text-[10px] text-blue-600 opacity-60 font-sans">↗</span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-400 font-normal">({pct}%)</div>
                        </td>
                      );
                    })}
                    <td className="p-3 text-right font-bold font-mono text-slate-900 bg-slate-100/50">
                      {rTotal}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-200 bg-slate-100/80 font-bold text-slate-900">
                <td className="p-3">Total Geral</td>
                {result.columns.map((col) => (
                  <td key={col} className="p-3 text-center font-mono">
                    {result.colTotals[col] || 0}
                  </td>
                ))}
                <td className="p-3 text-right font-mono text-blue-700">
                  {result.grandTotal}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Gráfico Visual Comparativo com Suporte a Drill-Down */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-blue-600" />
            <h3 className="font-bold text-slate-900 text-sm md:text-base">
              Distribuição Gráfica por Segmento
            </h3>
          </div>
          <span className="text-xs text-slate-400">
            Clique nas barras para abrir o drill-down
          </span>
        </div>

        <div className="h-80 w-full pt-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="group" tick={{ fontSize: 11, fill: '#475569' }} />
              <YAxis tick={{ fontSize: 11, fill: '#475569' }} />
              <Tooltip
                contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                formatter={(val: any, name: any) => [`${val} respostas • Clique para ver pessoas`, name]}
              />
              <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
              {result.columns.map((col, idx) => (
                <Bar
                  key={col}
                  dataKey={col}
                  fill={CHART_COLORS[idx % CHART_COLORS.length]}
                  radius={[4, 4, 0, 0]}
                  cursor="pointer"
                  onClick={(data) => {
                    if (data && data.group) {
                      handleCellClick(data.group, col);
                    }
                  }}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

    </div>
  );
};
