import React, { useState } from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  Legend 
} from 'recharts';
import { 
  QuestionAnalytics, 
  OptionDistribution,
  DrillDownTarget
} from '../../types';
import { CHART_COLORS } from '../../services/analyticsEngine';
import { PALETA_CORES, chaveCor } from '../../services/analiseAvancada';
import { 
  BarChart3, 
  PieChart as PieIcon, 
  Award, 
  TrendingUp, 
  CheckCircle2, 
  AlertTriangle,
  Smile,
  Meh,
  Frown,
  Users,
  Layers,
  ChevronRight,
  Palette,
  X,
  Loader2
} from 'lucide-react';

export type QuestionChartType = 'horizontal_bar' | 'donut' | 'ranking';

/**
 * Percentuais escritos por cima de cada fatia da rosca (fatias abaixo de 5% ficam só na legenda).
 * Desenhado como uma camada por cima do gráfico, o que funciona igual na tela e no PDF.
 * Segue a geometria padrão do gráfico de rosca: começa às 3 horas e gira no sentido anti-horário.
 */
export const RotulosRosca: React.FC<{ dados: Array<{ count: number; percentage: number }>; raio: number }> = ({ dados, raio }) => {
  const total = dados.reduce((s, d) => s + (d.count || 0), 0);
  if (!total) return null;
  let acumulado = 0;
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      {dados.map((d, i) => {
        const inicio = acumulado;
        acumulado += d.count || 0;
        const pct = Number(d.percentage) || 0;
        if (!d.count || pct < 5) return null;
        const meio = ((inicio + (d.count || 0) / 2) / total) * 2 * Math.PI;
        const x = raio * Math.cos(meio);
        const y = raio * Math.sin(meio);
        return (
          <span
            key={i}
            style={{
              position: 'absolute',
              left: `calc(50% + ${x.toFixed(1)}px)`,
              top: `calc(50% - ${y.toFixed(1)}px)`,
              transform: 'translate(-50%, -50%)',
              color: '#ffffff',
              fontSize: 11,
              fontWeight: 800,
              lineHeight: 1,
              textShadow: '0 1px 2px rgba(15,23,42,0.55)',
              whiteSpace: 'nowrap'
            }}
          >
            {String(pct).replace('.', ',')}%
          </span>
        );
      })}
    </div>
  );
};

interface QuestionAnalyticsCardProps {
  analytics: QuestionAnalytics;
  questionIndex: number;
  surveyTitle: string;
  onDrillDown: (target: DrillDownTarget) => void;
  chartType: QuestionChartType;
  onChartTypeChange: (questionId: string, chartType: QuestionChartType) => void;
  // Escolher as cores das alternativas (quem pode editar a pesquisa)
  podeEditarCores?: boolean;
  onSalvarCores?: (mudancas: Record<string, string>) => Promise<void>;
}

export const QuestionAnalyticsCard: React.FC<QuestionAnalyticsCardProps> = ({
  analytics,
  questionIndex,
  surveyTitle,
  onDrillDown,
  chartType,
  onChartTypeChange,
  podeEditarCores = false,
  onSalvarCores
}) => {
  const [editandoCores, setEditandoCores] = useState(false);
  const [rascunhoCores, setRascunhoCores] = useState<Record<string, string>>({});
  const [salvandoCores, setSalvandoCores] = useState(false);
  const [erroCores, setErroCores] = useState<string | null>(null);

  const abrirCores = () => {
    const atual: Record<string, string> = {};
    analytics.distribution.forEach((d) => { atual[d.optionText] = d.color || '#2563eb'; });
    setRascunhoCores(atual);
    setErroCores(null);
    setEditandoCores(true);
  };

  const salvarCores = async (restaurar = false) => {
    if (!onSalvarCores) return;
    setSalvandoCores(true);
    setErroCores(null);
    try {
      const mudancas: Record<string, string> = {};
      analytics.distribution.forEach((d) => {
        mudancas[chaveCor(d.optionText)] = restaurar ? '' : (rascunhoCores[d.optionText] || '');
      });
      await onSalvarCores(mudancas);
      setEditandoCores(false);
    } catch (err: any) {
      setErroCores(err.message || 'Não foi possível salvar as cores.');
    } finally {
      setSalvandoCores(false);
    }
  };

  const setChartType = (type: QuestionChartType) => onChartTypeChange(analytics.questionId, type);

  const {
    questionId,
    questionTitle,
    questionDescription,
    questionType,
    totalAnswers,
    totalRespondents,
    responseRate,
    distribution,
    dominantOption,
    isSplit,
    consensusScore,
    satisfactionIndex
  } = analytics;

  // Formatar dados para recharts
  const chartData = distribution.map((item) => ({
    name: item.optionText,
    count: item.count,
    percentage: item.percentage,
    color: item.color || '#2563eb'
  }));

  const handleOptionClick = (item: OptionDistribution) => {
    onDrillDown({
      type: 'question_option',
      surveyTitle,
      questionId,
      questionTitle,
      optionText: item.optionText,
      optionColor: item.color,
      percentage: item.percentage,
      totalCount: item.count
    });
  };

  const handleSatisfactionClick = (group: 'positive' | 'neutral' | 'negative', pct: number, label: string) => {
    onDrillDown({
      type: 'satisfaction_group',
      surveyTitle,
      questionId,
      questionTitle,
      optionText: label,
      percentage: pct,
      satisfactionGroup: group,
      optionColor: group === 'positive' ? '#059669' : group === 'neutral' ? '#d97706' : '#e11d48'
    });
  };

  return (
    <div className="bg-white rounded-3xl p-6 md:p-7 border border-slate-200/90 shadow-xs space-y-6">
      
      {/* Header da Pergunta */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 border-b border-slate-100 pb-4">
        <div className="space-y-1.5 flex-1">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-blue-50 text-blue-700 font-bold text-xs flex items-center justify-center border border-blue-100">
              {questionIndex + 1}
            </span>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              {questionType === 'single_choice'
                ? 'Escolha Única'
                : questionType === 'multiple_choice'
                ? 'Múltipla Escolha'
                : questionType === 'scale'
                ? 'Escala / Avaliação'
                : 'Texto'}
            </span>

            {/* Badges Estatísticos */}
            {dominantOption && dominantOption.percentage >= 50 && (
              <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                Alto Consenso
              </span>
            )}

            {isSplit && (
              <span className="text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                Respostas Divididas
              </span>
            )}
          </div>

          <h3 className="text-base md:text-lg font-bold text-slate-900 leading-snug">
            {questionTitle}
          </h3>

          {questionDescription && (
            <p className="text-xs text-slate-500">{questionDescription}</p>
          )}

          {/* Dica de Drill-Down Interativo */}
          <div className="pt-1 flex items-center gap-1.5 text-[11px] text-blue-700 font-medium">
            <Layers className="w-3.5 h-3.5 text-blue-600" />
            <span>Gráficos com Drill-Down ativo: clique em qualquer barra, fatia ou alternativa para ver a lista de respondentes.</span>
          </div>
        </div>

        {/* Chart View Toggle Controls */}
        <div className="flex items-center gap-2 self-start">
        {podeEditarCores && onSalvarCores && distribution.length > 0 && (
          <button
            onClick={abrirCores}
            title="Escolher as cores das alternativas"
            className="p-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-xs font-semibold flex items-center gap-1"
          >
            <Palette className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Cores</span>
          </button>
        )}
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => setChartType('horizontal_bar')}
            title="Gráfico de Barras"
            className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors ${
              chartType === 'horizontal_bar'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Barras</span>
          </button>

          <button
            onClick={() => setChartType('donut')}
            title="Gráfico de Rosca"
            className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors ${
              chartType === 'donut'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <PieIcon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Rosca</span>
          </button>

          <button
            onClick={() => setChartType('ranking')}
            title="Ranking de Alternativas"
            className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors ${
              chartType === 'ranking'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Award className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Ranking</span>
          </button>
        </div>
        </div>
      </div>

      {/* Editor de cores das alternativas */}
      {editandoCores && (
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5"><Palette className="w-4 h-4 text-blue-600" /> Cores das alternativas</h4>
              <p className="text-[11px] text-slate-500 mt-0.5">
                A cor vale para todas as perguntas desta pesquisa que tenham a mesma alternativa — ex.: escolher a cor de
                "Aplicado" aqui muda nas 27 capacidades de uma vez. Também aparece no PDF.
              </p>
            </div>
            <button onClick={() => setEditandoCores(false)} className="p-1 rounded-lg text-slate-400 hover:bg-slate-200" aria-label="Fechar">
              <X className="w-4 h-4" />
            </button>
          </div>
          {erroCores && <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl px-3 py-2">{erroCores}</div>}
          <div className="space-y-2.5">
            {distribution.map((item) => {
              const cor = rascunhoCores[item.optionText] || item.color || '#2563eb';
              return (
                <div key={item.optionId} className="flex flex-col lg:flex-row lg:items-center gap-2">
                  <div className="flex items-center gap-2 min-w-0 lg:w-80">
                    <span className="w-4 h-4 rounded-full shrink-0 border border-white shadow" style={{ backgroundColor: cor }} />
                    <span className="text-xs font-medium text-slate-700 truncate" title={item.optionText}>{item.optionText}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {PALETA_CORES.map((c) => (
                      <button
                        key={c}
                        onClick={() => setRascunhoCores((prev) => ({ ...prev, [item.optionText]: c }))}
                        title={c}
                        className={`w-5 h-5 rounded-full border-2 transition-transform hover:scale-110 ${cor.toLowerCase() === c ? 'border-slate-900' : 'border-white shadow-xs'}`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                    <label className="w-5 h-5 rounded-full border border-dashed border-slate-400 overflow-hidden cursor-pointer relative" title="Outra cor">
                      <input
                        type="color"
                        value={cor}
                        onChange={(e) => setRascunhoCores((prev) => ({ ...prev, [item.optionText]: e.target.value }))}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                      />
                      <span className="absolute inset-0 flex items-center justify-center text-[10px] text-slate-500">+</span>
                    </label>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              onClick={() => salvarCores(false)}
              disabled={salvandoCores}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 disabled:opacity-60"
            >
              {salvandoCores && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Salvar cores
            </button>
            <button
              onClick={() => salvarCores(true)}
              disabled={salvandoCores}
              className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-600 text-xs font-semibold hover:bg-slate-50 disabled:opacity-60"
              title="Volta às cores automáticas (pelos emojis do texto ou pela paleta padrão)"
            >
              Restaurar automáticas
            </button>
          </div>
        </div>
      )}

      {/* KPI Cards Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-slate-50 border border-slate-100 rounded-2xl p-3.5 space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Total Respostas
          </span>
          <p className="text-xl font-extrabold text-slate-900">
            {totalAnswers}
            <span className="text-xs font-normal text-slate-400 ml-1">/ {totalRespondents}</span>
          </p>
          <span className="text-[10px] text-slate-500 block">
            {responseRate}% de adesão
          </span>
        </div>

        <div 
          onClick={() => dominantOption && handleOptionClick(dominantOption)}
          className={`bg-slate-50 border border-slate-100 rounded-2xl p-3.5 space-y-1 transition-all ${
            dominantOption ? 'cursor-pointer hover:bg-blue-50/70 hover:border-blue-200' : ''
          }`}
          title={dominantOption ? "Clique para ver quem escolheu a opção predominante" : undefined}
        >
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Opção Predominante {dominantOption && '↗'}
          </span>
          <p className="text-sm font-bold text-blue-700 truncate" title={dominantOption?.optionText || 'N/A'}>
            {dominantOption ? dominantOption.optionText : 'Nenhum'}
          </p>
          <span className="text-[10px] font-semibold text-slate-600 block">
            {dominantOption ? `${dominantOption.percentage}% das escolhas` : '—'}
          </span>
        </div>

        <div className="bg-slate-50 border border-slate-100 rounded-2xl p-3.5 space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Índice de Consenso
          </span>
          <p className="text-xl font-extrabold text-slate-900">
            {consensusScore}%
          </p>
          <span className="text-[10px] text-slate-500 block">
            {consensusScore >= 40 ? 'Concentrado' : 'Diversificado'}
          </span>
        </div>

        <div className="bg-slate-50 border border-slate-100 rounded-2xl p-3.5 space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Alternativas
          </span>
          <p className="text-xl font-extrabold text-slate-900">
            {distribution.length}
          </p>
          <span className="text-[10px] text-slate-500 block">
            opções disponíveis
          </span>
        </div>
      </div>

      {/* Seção de Índice de Satisfação (Se aplicável à pergunta) */}
      {satisfactionIndex && (
        <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200/80 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-900 uppercase tracking-wider flex items-center gap-1.5">
              <Smile className="w-4 h-4 text-emerald-600" />
              Métrica de Satisfação
            </span>
            <span className="text-xs font-extrabold text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full">
              Nota Média: {satisfactionIndex.averageScore} / 5.0
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div 
              onClick={() => handleSatisfactionClick('positive', satisfactionIndex.positivePct, 'Favoráveis / Satisfeitos')}
              className="bg-white/80 hover:bg-emerald-100/60 rounded-xl p-2.5 border border-emerald-200 cursor-pointer transition-all active:scale-95 group shadow-2xs"
              title="Clique para ver os respondentes satisfeitos"
            >
              <div className="flex items-center justify-center gap-1">
                <span className="text-emerald-700 font-extrabold text-base block">
                  {satisfactionIndex.positivePct}%
                </span>
                <span className="text-[10px] text-emerald-600 opacity-0 group-hover:opacity-100 transition-opacity">↗</span>
              </div>
              <span className="text-[11px] text-slate-600 font-medium">Favoráveis / Satisfeitos</span>
            </div>

            <div 
              onClick={() => handleSatisfactionClick('neutral', satisfactionIndex.neutralPct, 'Neutros / Indiferentes')}
              className="bg-white/80 hover:bg-amber-100/60 rounded-xl p-2.5 border border-amber-200 cursor-pointer transition-all active:scale-95 group shadow-2xs"
              title="Clique para ver os respondentes neutros"
            >
              <div className="flex items-center justify-center gap-1">
                <span className="text-amber-700 font-extrabold text-base block">
                  {satisfactionIndex.neutralPct}%
                </span>
                <span className="text-[10px] text-amber-600 opacity-0 group-hover:opacity-100 transition-opacity">↗</span>
              </div>
              <span className="text-[11px] text-slate-600 font-medium">Neutros / Indiferentes</span>
            </div>

            <div 
              onClick={() => handleSatisfactionClick('negative', satisfactionIndex.negativePct, 'Desfavoráveis / Insatisfeitos')}
              className="bg-white/80 hover:bg-rose-100/60 rounded-xl p-2.5 border border-rose-200 cursor-pointer transition-all active:scale-95 group shadow-2xs"
              title="Clique para ver os respondentes insatisfeitos"
            >
              <div className="flex items-center justify-center gap-1">
                <span className="text-rose-700 font-extrabold text-base block">
                  {satisfactionIndex.negativePct}%
                </span>
                <span className="text-[10px] text-rose-600 opacity-0 group-hover:opacity-100 transition-opacity">↗</span>
              </div>
              <span className="text-[11px] text-slate-600 font-medium">Desfavoráveis / Insatisfeitos</span>
            </div>
          </div>
        </div>
      )}

      {/* Visualização de Gráficos e Distribuição */}
      <div className="pt-2">
        {totalAnswers === 0 ? (
          <div className="py-12 text-center text-xs text-slate-400">
            Ainda não há respostas registradas para esta pergunta.
          </div>
        ) : chartType === 'horizontal_bar' ? (
          <div className="space-y-3">
            {distribution.map((item, idx) => {
              const isDominant = dominantOption?.optionId === item.optionId && item.count > 0;
              return (
                <div 
                  key={item.optionId} 
                  onClick={() => handleOptionClick(item)}
                  title={`Clique para ver as ${item.count} pessoas que responderam "${item.optionText}"`}
                  className="space-y-1.5 p-2.5 -mx-2.5 rounded-2xl hover:bg-blue-50/70 border border-transparent hover:border-blue-200 cursor-pointer transition-all group"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-800 flex items-center gap-2 group-hover:text-blue-900 transition-colors">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: item.color || CHART_COLORS[idx % CHART_COLORS.length] }}
                      />
                      <span className="group-hover:underline underline-offset-2">{item.optionText}</span>
                      {isDominant && (
                        <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.2 rounded-full border border-blue-100">
                          Mais escolhida
                        </span>
                      )}
                    </span>
                    <div className="flex items-center gap-2 font-mono">
                      <span className="font-bold text-slate-900 group-hover:text-blue-900">{item.percentage}%</span>
                      <span className="text-slate-400 text-[11px]">({item.count} {item.count === 1 ? 'voto' : 'votos'})</span>
                      <span className="text-xs text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity font-bold font-sans">
                        Ver pessoas →
                      </span>
                    </div>
                  </div>

                  {/* Barra de Progresso Estilizada */}
                  <div className="h-4 w-full bg-slate-100 group-hover:bg-blue-100/50 rounded-full overflow-hidden p-0.5 transition-colors">
                    <div
                      className="h-full rounded-full transition-all duration-500 ease-out group-hover:brightness-110 shadow-xs"
                      style={{
                        width: `${Math.max(item.percentage, item.count > 0 ? 3 : 0)}%`,
                        backgroundColor: item.color || CHART_COLORS[idx % CHART_COLORS.length]
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        ) : chartType === 'donut' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            <div className="h-64 w-full relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={3}
                    dataKey="count"
                    cursor="pointer"
                    onClick={(entry) => {
                      const match = distribution.find((d) => d.optionText === entry.name);
                      if (match) handleOptionClick(match);
                    }}
                  >
                    {chartData.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={entry.color} 
                        className="hover:opacity-80 transition-opacity cursor-pointer"
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(val: any, name: any, item: any) => [
                      `${val} votos (${item.payload.percentage}%) • Clique para ver pessoas`,
                      name
                    ]}
                  />
                </PieChart>
              </ResponsiveContainer>
              <RotulosRosca dados={chartData} raio={70} />
            </div>

            {/* Legenda Lateral Interativa */}
            <div className="space-y-2">
              {distribution.map((item, idx) => (
                <div 
                  key={item.optionId} 
                  onClick={() => handleOptionClick(item)}
                  title={`Clique para ver as ${item.count} pessoas que responderam "${item.optionText}"`}
                  className="flex items-center justify-between text-xs p-2.5 rounded-xl bg-slate-50 hover:bg-blue-50 border border-slate-100 hover:border-blue-200 cursor-pointer transition-all group"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: item.color || CHART_COLORS[idx % CHART_COLORS.length] }}
                    />
                    <span className="font-semibold text-slate-800 group-hover:text-blue-900 truncate group-hover:underline">
                      {item.optionText}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 font-mono shrink-0">
                    <span className="font-bold text-slate-900 group-hover:text-blue-900">{item.percentage}%</span>
                    <span className="text-slate-400 text-[11px]">({item.count})</span>
                    <span className="text-[11px] text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity font-bold font-sans">
                      →
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* Ranking List View Interativo */
          <div className="space-y-2">
            {[...distribution].sort((a, b) => b.count - a.count).map((item, rIdx) => (
              <div
                key={item.optionId}
                onClick={() => handleOptionClick(item)}
                title={`Clique para ver as ${item.count} pessoas que responderam "${item.optionText}"`}
                className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 hover:bg-blue-50/70 border border-slate-100 hover:border-blue-300 text-xs cursor-pointer transition-all group shadow-2xs"
              >
                <div className="flex items-center gap-3">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs ${
                    rIdx === 0
                      ? 'bg-amber-100 text-amber-800 border border-amber-300'
                      : rIdx === 1
                      ? 'bg-slate-200 text-slate-700'
                      : rIdx === 2
                      ? 'bg-amber-50 text-amber-700'
                      : 'bg-white text-slate-500 border border-slate-200'
                  }`}>
                    {rIdx + 1}º
                  </span>
                  <span className="font-bold text-slate-800 group-hover:text-blue-900 group-hover:underline">
                    {item.optionText}
                  </span>
                </div>
                <div className="flex items-center gap-3 font-mono">
                  <span className="font-bold text-slate-900 group-hover:text-blue-900 text-sm">{item.percentage}%</span>
                  <span className="text-slate-400 text-xs">({item.count} {item.count === 1 ? 'voto' : 'votos'})</span>
                  <span className="text-xs text-blue-600 font-bold font-sans opacity-0 group-hover:opacity-100 transition-opacity">
                    Ver respondentes →
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
};
