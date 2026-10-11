import React from 'react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { SurveyAnalyticsData, Question } from '../../types';
import { AnalyticsEngine, CHART_COLORS } from '../../services/analyticsEngine';
import { QuestionChartType, RotulosRosca } from './QuestionAnalyticsCard';
import { detectarEscala, montarMatriz, rotuloCurtoNivel, paletaNiveis } from '../../services/analiseAvancada';

export type ReportMode = 'simples' | 'completo' | 'personalizado';

/** Seções que podem entrar no PDF (a capa sempre entra). */
export interface SecoesRelatorio {
  resumoIA: boolean;
  conclusoes: boolean;
  evolucao: boolean;
  resumo: boolean;
  perguntas: boolean;
  matriz: boolean;
  cruzamento: boolean;
  individuais: boolean;
}

export const SECOES_SIMPLES: SecoesRelatorio = {
  resumoIA: true, conclusoes: true, evolucao: true, resumo: true, perguntas: false, matriz: false, cruzamento: false, individuais: false
};
export const SECOES_COMPLETO: SecoesRelatorio = {
  resumoIA: true, conclusoes: true, evolucao: true, resumo: true, perguntas: true, matriz: true, cruzamento: true, individuais: true
};

interface PrintableReportProps {
  containerId: string;
  analyticsData: SurveyAnalyticsData;
  secoes: SecoesRelatorio;
  rotuloVersao: string;
  // Perguntas que entram na "Análise por Pergunta" (vazio/ausente = todas)
  perguntasSelecionadas?: string[];
  // Resumo executivo gerado por IA (se existir)
  resumoIA?: { resumo: string; achados: string[]; plano: string[]; atualizadoEm: string } | null;
  getChartTypeForQuestion: (questionId: string, recommendedChart: string) => QuestionChartType;
}

// Largura de referência (em px) usada para o conteúdo do relatório impresso (equivale à área útil de uma folha A4)
const PRINT_WIDTH_PX = 760;

const blockStyle: React.CSSProperties = {
  background: '#ffffff',
  padding: '28px',
  fontFamily: "'Plus Jakarta Sans', Arial, sans-serif",
  color: '#0f172a',
  width: `${PRINT_WIDTH_PX}px`
};

export const PrintableReport: React.FC<PrintableReportProps> = ({
  containerId,
  analyticsData,
  secoes,
  rotuloVersao,
  perguntasSelecionadas,
  resumoIA,
  getChartTypeForQuestion
}) => {
  const { survey, executiveSummary, questionAnalytics, questions, options, respondents, answers } = analyticsData;

  const analisesPorPergunta = perguntasSelecionadas && perguntasSelecionadas.length > 0
    ? questionAnalytics.filter((qa) => perguntasSelecionadas.includes(qa.questionId))
    : questionAnalytics;

  // Matriz de Competências (só existe quando há uma escala comum entre várias perguntas)
  const escala = secoes.matriz ? detectarEscala(questions, options) : null;
  const matriz = escala ? montarMatriz(escala, options, respondents, answers) : null;

  const choiceQuestions = questions.filter(
    (q) => q.tipo === 'single_choice' || q.tipo === 'multiple_choice'
  );

  const questionA: Question | undefined = choiceQuestions.length > 1 ? choiceQuestions[1] : choiceQuestions[0];
  const questionB: Question | undefined = choiceQuestions.length > 2 ? choiceQuestions[2] : choiceQuestions[1];

  const crossTab = (secoes.cruzamento && questionA && questionB && questionA.id !== questionB.id)
    ? AnalyticsEngine.crossTabulate(
        questionA,
        questionB,
        options.filter((o) => o.question_id === questionA.id),
        options.filter((o) => o.question_id === questionB.id),
        respondents,
        answers
      )
    : null;

  const crossTabChartData = crossTab
    ? crossTab.rows.map((row) => {
        const item: any = { group: row };
        crossTab.columns.forEach((col) => {
          item[col] = crossTab.matrix[row][col] || 0;
        });
        return item;
      })
    : [];

  // Dividir respondentes em blocos menores para a seção "Respostas Individuais" (uma tabela por bloco)
  const RESPONDENTS_PER_BLOCK = 12;
  const respondentBlocks: typeof respondents[] = [];
  if (secoes.individuais) {
    for (let i = 0; i < respondents.length; i += RESPONDENTS_PER_BLOCK) {
      respondentBlocks.push(respondents.slice(i, i + RESPONDENTS_PER_BLOCK));
    }
  }

  return (
    <div id={containerId} style={{ position: 'fixed', top: 0, left: '-99999px', zIndex: -1 }}>
      {/* BLOCO 1 — Capa / Cabeçalho + KPIs */}
      <div className="pdf-block" style={{ ...blockStyle, borderBottom: '3px solid #2563eb' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#2563eb', fontWeight: 700, textTransform: 'uppercase', marginBottom: 10 }}>
          <span>PesquisaHub • Relatório Executivo</span>
          <span style={{ color: '#94a3b8', fontWeight: 500 }}>Emissão: {new Date().toLocaleDateString('pt-BR')}</span>
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 800, margin: '4px 0' }}>{survey.titulo}</h1>
        {survey.descricao && <p style={{ fontSize: 13, color: '#475569', marginTop: 4 }}>{survey.descricao}</p>}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginTop: 20 }}>
          <KpiBox label="Período de Coleta" value={`${executiveSummary.firstResponseDate || 'Início'} — ${executiveSummary.lastResponseDate || 'Atual'}`} />
          <KpiBox label="Amostra Coletada" value={`${executiveSummary.totalResponses} respondentes`} />
          <KpiBox label="Taxa de Conclusão" value={`${executiveSummary.completionRate}%`} color="#047857" />
          <KpiBox label="Total de Perguntas" value={`${executiveSummary.totalQuestions} questões`} />
        </div>
        <div style={{ marginTop: 16, fontSize: 10, fontWeight: 700, color: '#7c3aed', textTransform: 'uppercase' }}>
          Versão {rotuloVersao}
        </div>
      </div>

      {/* Resumo executivo (IA) */}
      {secoes.resumoIA && resumoIA && (
        <div className="pdf-block" style={blockStyle}>
          <SectionTitle>Resumo Executivo</SectionTitle>
          <p style={{ fontSize: 12, color: '#334155', lineHeight: 1.55, marginTop: 8 }}>{resumoIA.resumo}</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 12 }}>
            <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 14, padding: 14 }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: '#92400e', textTransform: 'uppercase', marginBottom: 6 }}>Principais achados</div>
              {resumoIA.achados.map((a, i) => <p key={i} style={{ fontSize: 10.5, marginBottom: 5, lineHeight: 1.4 }}>• {a}</p>)}
            </div>
            <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 14, padding: 14 }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: '#065f46', textTransform: 'uppercase', marginBottom: 6 }}>Plano de ação sugerido</div>
              {resumoIA.plano.map((a, i) => <p key={i} style={{ fontSize: 10.5, marginBottom: 5, lineHeight: 1.4 }}>{i + 1}. {a}</p>)}
            </div>
          </div>
          <p style={{ fontSize: 9, color: '#94a3b8', marginTop: 8 }}>
            Gerado com apoio de IA em {new Date(resumoIA.atualizadoEm).toLocaleDateString('pt-BR')} a partir dos resultados desta pesquisa.
          </p>
        </div>
      )}

      {/* BLOCO 2 — Principais conclusões */}
      {secoes.conclusoes && (
      <div className="pdf-block" style={blockStyle}>
        <SectionTitle>Principais Conclusões e Padrões Identificados</SectionTitle>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 12 }}>
          <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 14, padding: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#065f46', textTransform: 'uppercase', marginBottom: 8 }}>
              Pontos de Maior Consenso (&gt;55%)
            </div>
            {executiveSummary.highConsensusQuestions.length === 0 ? (
              <p style={{ fontSize: 11, color: '#64748b', fontStyle: 'italic' }}>Nenhuma pergunta com concentração superior a 55%.</p>
            ) : (
              executiveSummary.highConsensusQuestions.map((hc, idx) => (
                <p key={idx} style={{ fontSize: 11, marginBottom: 6, lineHeight: 1.4 }}>
                  <strong>{hc.questionTitle}:</strong> {hc.dominantOption} concentrou <strong>{hc.percentage}%</strong> das preferências.
                </p>
              ))
            )}
          </div>
          <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 14, padding: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#92400e', textTransform: 'uppercase', marginBottom: 8 }}>
              Pontos de Maior Divergência
            </div>
            {executiveSummary.divergentQuestions.length === 0 ? (
              <p style={{ fontSize: 11, color: '#64748b', fontStyle: 'italic' }}>As preferências não apresentaram empates técnicos críticos.</p>
            ) : (
              executiveSummary.divergentQuestions.map((dq, idx) => (
                <p key={idx} style={{ fontSize: 11, marginBottom: 6, lineHeight: 1.4 }}>
                  <strong>{dq.questionTitle}:</strong> {dq.explanation}
                </p>
              ))
            )}
          </div>
        </div>

        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 14, padding: 16, marginTop: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#475569', textTransform: 'uppercase', marginBottom: 8 }}>
            Síntese Numérica das Questões
          </div>
          {executiveSummary.keyFindings.map((finding, idx) => (
            <p key={idx} style={{ fontSize: 11, marginBottom: 4 }}>• {finding}</p>
          ))}
        </div>
      </div>

      )}

      {/* BLOCO 3 — Evolução temporal (se houver dados suficientes) */}
      {secoes.evolucao && executiveSummary.responsesOverTime.length > 1 && (
        <div className="pdf-block" style={blockStyle}>
          <SectionTitle>Evolução Temporal do Volume de Respostas</SectionTitle>
          <div style={{ height: 220, marginTop: 10 }}>
            <ResponsiveContainer width={PRINT_WIDTH_PX - 56} height={220}>
              <AreaChart data={executiveSummary.responsesOverTime}>
                <defs>
                  <linearGradient id="pdfColorCount" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748b' }} />
                <YAxis tick={{ fontSize: 10, fill: '#64748b' }} />
                <Tooltip />
                <Area type="monotone" dataKey="accumulated" stroke="#2563eb" strokeWidth={2} fillOpacity={1} fill="url(#pdfColorCount)" name="Acumulado" isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* BLOCO 4 — Tabela resumo por pergunta */}
      {secoes.resumo && (
      <div className="pdf-block" style={blockStyle}>
        <SectionTitle>Tabela Analítica Resumo por Pergunta</SectionTitle>
        <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse', marginTop: 10 }}>
          <thead>
            <tr style={{ background: '#f1f5f9', textAlign: 'left' }}>
              <th style={cellStyle}>#</th>
              <th style={cellStyle}>Enunciado</th>
              <th style={cellStyle}>Total</th>
              <th style={cellStyle}>Opção Predominante</th>
              <th style={cellStyle}>%</th>
              <th style={cellStyle}>Consenso</th>
            </tr>
          </thead>
          <tbody>
            {questionAnalytics.map((qa, idx) => (
              <tr key={qa.questionId} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={cellStyle}>{idx + 1}</td>
                <td style={cellStyle}>{qa.questionTitle}</td>
                <td style={cellStyle}>{qa.totalAnswers}</td>
                <td style={{ ...cellStyle, color: '#1d4ed8', fontWeight: 700 }}>{qa.dominantOption?.optionText || '—'}</td>
                <td style={cellStyle}>{qa.dominantOption ? `${qa.dominantOption.percentage}%` : '—'}</td>
                <td style={cellStyle}>{qa.consensusScore}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      )}

      {/* Matriz de Competências — lacunas, pontos fortes e mapa de calor */}
      {matriz && escala && <MatrizPdf matriz={matriz} />}

      {/* Seções detalhadas (escolhidas no modal de exportação) */}
      {(secoes.perguntas || secoes.cruzamento || secoes.individuais) && (
        <>
          {/* Análise por Pergunta — um bloco por pergunta, com o MESMO gráfico selecionado na tela */}
          {secoes.perguntas && analisesPorPergunta.map((qa, idx) => {
            const chartType = getChartTypeForQuestion(qa.questionId, qa.recommendedChart);
            const chartData = qa.distribution.map((item, i) => ({
              name: item.optionText,
              count: item.count,
              percentage: item.percentage,
              color: item.color || CHART_COLORS[i % CHART_COLORS.length]
            }));

            return (
              <div key={qa.questionId} className="pdf-block" style={blockStyle}>
                <div style={{ fontSize: 10, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 4 }}>
                  Análise por Pergunta • {idx + 1} de {analisesPorPergunta.length}
                </div>
                <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 12 }}>{qa.questionTitle}</h3>

                {qa.totalAnswers === 0 ? (
                  <p style={{ fontSize: 11, color: '#94a3b8' }}>Ainda não há respostas registradas para esta pergunta.</p>
                ) : chartType === 'horizontal_bar' ? (
                  <div>
                    {chartData.map((item) => (
                      <div key={item.name} style={{ marginBottom: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 3 }}>
                          <span style={{ fontWeight: 600 }}>{item.name}</span>
                          <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{item.percentage}% ({item.count})</span>
                        </div>
                        <div style={{ height: 10, background: '#f1f5f9', borderRadius: 999, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${Math.max(item.percentage, item.count > 0 ? 3 : 0)}%`, background: item.color, borderRadius: 999 }} />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : chartType === 'donut' ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
                    <div style={{ width: 260, height: 220, position: 'relative' }}>
                      <ResponsiveContainer width={260} height={220}>
                        <PieChart>
                          <Pie data={chartData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="count" isAnimationActive={false}>
                            {chartData.map((entry, i) => (
                              <Cell key={i} fill={entry.color} />
                            ))}
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                      <RotulosRosca dados={chartData} raio={65} />
                    </div>
                    <div style={{ flex: 1 }}>
                      {chartData.map((item) => (
                        <div key={item.name} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, padding: '6px 0', borderBottom: '1px solid #f1f5f9' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ width: 9, height: 9, borderRadius: 999, background: item.color, display: 'inline-block' }} />
                            {item.name}
                          </span>
                          <strong>{item.percentage}% ({item.count})</strong>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div>
                    {[...chartData].sort((a, b) => b.count - a.count).map((item, rIdx) => (
                      <div key={item.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: '#f8fafc', borderRadius: 10, marginBottom: 6, fontSize: 11 }}>
                        <span><strong>{rIdx + 1}º</strong> &nbsp; {item.name}</span>
                        <strong>{item.percentage}% ({item.count})</strong>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {/* Cruzar Respostas */}
          {crossTab && (
            <div className="pdf-block" style={blockStyle}>
              <SectionTitle>Cruzamento de Respostas</SectionTitle>
              <p style={{ fontSize: 11, color: '#475569', marginTop: 4 }}>
                <strong>{crossTab.questionA.title}</strong> × <strong>{crossTab.questionB.title}</strong>
              </p>

              <div style={{ height: 240, marginTop: 12 }}>
                <ResponsiveContainer width={PRINT_WIDTH_PX - 56} height={240}>
                  <BarChart data={crossTabChartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="group" tick={{ fontSize: 9, fill: '#64748b' }} />
                    <YAxis tick={{ fontSize: 10, fill: '#64748b' }} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    {crossTab.columns.map((col, i) => (
                      <Bar key={col} dataKey={col} fill={CHART_COLORS[i % CHART_COLORS.length]} isAnimationActive={false} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {crossTab.keyInsights.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  {crossTab.keyInsights.map((insight, i) => (
                    <p key={i} style={{ fontSize: 11, marginBottom: 4 }}>• {insight}</p>
                  ))}
                </div>
              )}

              <table style={{ width: '100%', fontSize: 10, borderCollapse: 'collapse', marginTop: 14 }}>
                <thead>
                  <tr style={{ background: '#f1f5f9' }}>
                    <th style={cellStyle}>{crossTab.questionA.title} \ {crossTab.questionB.title}</th>
                    {crossTab.columns.map((col) => (
                      <th key={col} style={cellStyle}>{col}</th>
                    ))}
                    <th style={cellStyle}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {crossTab.rows.map((row) => (
                    <tr key={row} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ ...cellStyle, fontWeight: 700 }}>{row}</td>
                      {crossTab.columns.map((col) => (
                        <td key={col} style={cellStyle}>{crossTab.matrix[row][col] || 0}</td>
                      ))}
                      <td style={{ ...cellStyle, fontWeight: 700 }}>{crossTab.rowTotals[row]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Respostas Individuais — em blocos menores para não quebrar a tabela ao meio */}
          {respondentBlocks.map((group, blockIdx) => (
            <div key={blockIdx} className="pdf-block" style={blockStyle}>
              {blockIdx === 0 && <SectionTitle>Respostas Individuais ({respondents.length} respondentes)</SectionTitle>}
              <table style={{ width: '100%', fontSize: 10, borderCollapse: 'collapse', marginTop: blockIdx === 0 ? 10 : 0 }}>
                <thead>
                  <tr style={{ background: '#f1f5f9', textAlign: 'left' }}>
                    <th style={cellStyle}>Respondente</th>
                    <th style={cellStyle}>Identificador</th>
                    <th style={cellStyle}>Data</th>
                    <th style={cellStyle}>Respostas</th>
                  </tr>
                </thead>
                <tbody>
                  {group.map((resp) => {
                    const respAnswers = answers.filter((a) => a.respondent_id === resp.id);
                    return (
                      <tr key={resp.id} style={{ borderBottom: '1px solid #f1f5f9', verticalAlign: 'top' }}>
                        <td style={cellStyle}>{resp.nome}</td>
                        <td style={cellStyle}>{resp.identificador || '—'}</td>
                        <td style={cellStyle}>{resp.data_resposta}</td>
                        <td style={cellStyle}>
                          {respAnswers.map((a) => {
                            const q = questions.find((qq) => qq.id === a.question_id);
                            return (
                              <div key={a.id} style={{ marginBottom: 2 }}>
                                <strong>{q?.titulo || 'Pergunta'}:</strong> {a.valor}
                              </div>
                            );
                          })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))}
        </>
      )}
    </div>
  );
};

// ------------------------------------------------------------------------
// MATRIZ DE COMPETÊNCIAS NO PDF
// ------------------------------------------------------------------------
const PESSOAS_POR_BLOCO_MATRIZ = 22;

const MatrizPdf: React.FC<{ matriz: ReturnType<typeof montarMatriz> }> = ({ matriz }) => {
  const { escala } = matriz;
  const N = escala.niveis.length;
  const cores = paletaNiveis(N);
  const rotulos = escala.niveis.map(rotuloCurtoNivel);
  const fmt = (v: number) => (v > 0 ? v.toFixed(1).replace('.', ',') : '—');
  const codigo = (idx: number) => `C${idx + 1}`;

  const comMedia = escala.questoes
    .map((q, idx) => ({ q, idx, media: matriz.mediaPorQuestao[q.id] || 0 }))
    .filter((x) => x.media > 0);
  const lacunas = [...comMedia].sort((a, b) => a.media - b.media).slice(0, 5);
  const fortes = [...comMedia].sort((a, b) => b.media - a.media).slice(0, 5);

  const pessoas = [...matriz.pessoas].sort(
    (a, b) => (matriz.mediaPorPessoa[b.id] || 0) - (matriz.mediaPorPessoa[a.id] || 0)
  );
  const blocosPessoas: typeof pessoas[] = [];
  for (let i = 0; i < pessoas.length; i += PESSOAS_POR_BLOCO_MATRIZ) {
    blocosPessoas.push(pessoas.slice(i, i + PESSOAS_POR_BLOCO_MATRIZ));
  }

  // Largura das colunas para caber na página A4
  const larguraNome = 150;
  const larguraMedia = 38;
  const larguraCelula = Math.max(14, Math.floor((PRINT_WIDTH_PX - 56 - larguraNome - larguraMedia) / escala.questoes.length));

  const Legenda = () => (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
      {rotulos.map((r, i) => (
        <span key={i} style={{ fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: cores[i].fundo, color: cores[i].texto }}>
          {i + 1} — {r}
        </span>
      ))}
    </div>
  );

  const ListaCapacidades: React.FC<{ itens: typeof lacunas; cor: string; mostrarQuemEnsina?: boolean }> = ({ itens, cor, mostrarQuemEnsina }) => (
    <div>
      {itens.map((l) => {
        const dist = matriz.distribuicaoPorQuestao[l.q.id];
        const total = dist.reduce((s, v) => s + v, 0) || 1;
        const referencias = matriz.pessoas.filter((p) => matriz.nivel[p.id][l.q.id] === N);
        return (
          <div key={l.q.id} style={{ marginBottom: 9 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 10 }}>
              <span><strong>{codigo(l.idx)}</strong> · {l.q.titulo}</span>
              <strong style={{ color: cor }}>{fmt(l.media)}</strong>
            </div>
            <div style={{ display: 'flex', height: 6, borderRadius: 4, overflow: 'hidden', background: '#f1f5f9', marginTop: 3 }}>
              {dist.map((v, i) => (
                <div key={i} style={{ width: `${(v / total) * 100}%`, background: cores[i].fundo }} />
              ))}
            </div>
            {mostrarQuemEnsina && (
              <div style={{ fontSize: 9, color: '#64748b', marginTop: 2 }}>
                {referencias.length > 0
                  ? <>Pode ensinar: <strong style={{ color: '#334155' }}>{referencias.map((p) => p.nome.split(' ')[0]).join(', ')}</strong></>
                  : <>Ninguém se declarou {rotulos[N - 1]} — avaliar treinamento externo.</>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  return (
    <>
      <div className="pdf-block" style={blockStyle}>
        <SectionTitle>Matriz de Competências</SectionTitle>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginTop: 12 }}>
          <KpiBox label="Média da equipe" value={`${fmt(matriz.mediaGeral)} de ${N}`} />
          <KpiBox label="Pessoas avaliadas" value={`${matriz.pessoas.length}`} />
          <KpiBox label="Capacidades" value={`${escala.questoes.length}`} />
        </div>
        <Legenda />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
          <div style={{ background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: 14, padding: 14 }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: '#9f1239', textTransform: 'uppercase', marginBottom: 8 }}>
              Maiores lacunas — prioridade de treinamento
            </div>
            <ListaCapacidades itens={lacunas} cor="#be123c" mostrarQuemEnsina />
          </div>
          <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 14, padding: 14 }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: '#065f46', textTransform: 'uppercase', marginBottom: 8 }}>
              Pontos fortes da equipe
            </div>
            <ListaCapacidades itens={fortes} cor="#047857" />
          </div>
        </div>
      </div>

      {blocosPessoas.map((grupo, bIdx) => (
        <div key={bIdx} className="pdf-block" style={blockStyle}>
          {bIdx === 0 && <SectionTitle>Mapa de Calor — Pessoas × Capacidades</SectionTitle>}
          {bIdx === 0 && <Legenda />}
          <table style={{ borderCollapse: 'collapse', marginTop: 10, fontSize: 9, tableLayout: 'fixed' }}>
            <thead>
              <tr>
                <th style={{ width: larguraNome, textAlign: 'left', padding: '4px 6px', background: '#f1f5f9', color: '#475569' }}>Pessoa</th>
                {escala.questoes.map((q, idx) => (
                  <th key={q.id} style={{ width: larguraCelula, padding: '4px 0', background: '#f1f5f9', color: '#475569', fontSize: 8 }}>
                    {codigo(idx)}
                  </th>
                ))}
                <th style={{ width: larguraMedia, padding: '4px 2px', background: '#e2e8f0', color: '#334155' }}>Média</th>
              </tr>
            </thead>
            <tbody>
              {grupo.map((p) => (
                <tr key={p.id}>
                  <td style={{ padding: '3px 6px', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', borderBottom: '1px solid #f1f5f9' }}>
                    {p.nome.length > 26 ? p.nome.slice(0, 25) + '…' : p.nome}
                  </td>
                  {escala.questoes.map((q) => {
                    const v = matriz.nivel[p.id][q.id] || 0;
                    return (
                      <td
                        key={q.id}
                        style={{
                          textAlign: 'center',
                          fontWeight: 800,
                          border: '1px solid #ffffff',
                          padding: '3px 0',
                          background: v ? cores[v - 1].fundo : '#f8fafc',
                          color: v ? cores[v - 1].texto : '#cbd5e1'
                        }}
                      >
                        {v || '·'}
                      </td>
                    );
                  })}
                  <td style={{ textAlign: 'center', fontWeight: 800, background: '#f8fafc' }}>{fmt(matriz.mediaPorPessoa[p.id] || 0)}</td>
                </tr>
              ))}
              {bIdx === blocosPessoas.length - 1 && (
                <tr>
                  <td style={{ padding: '4px 6px', fontWeight: 800, background: '#f1f5f9' }}>Média</td>
                  {escala.questoes.map((q) => (
                    <td key={q.id} style={{ textAlign: 'center', fontWeight: 800, background: '#f1f5f9', fontSize: 8, padding: '4px 0' }}>
                      {fmt(matriz.mediaPorQuestao[q.id] || 0)}
                    </td>
                  ))}
                  <td style={{ textAlign: 'center', fontWeight: 800, background: '#e2e8f0' }}>{fmt(matriz.mediaGeral)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ))}

      <div className="pdf-block" style={blockStyle}>
        <SectionTitle>Legenda das Capacidades</SectionTitle>
        <div style={{ columnCount: 2, columnGap: 20, marginTop: 10 }}>
          {escala.questoes.map((q, idx) => (
            <p key={q.id} style={{ fontSize: 9, marginBottom: 4, breakInside: 'avoid' }}>
              <strong>{codigo(idx)}</strong> · {q.titulo}
            </p>
          ))}
        </div>
      </div>
    </>
  );
};

const SectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h2 style={{ fontSize: 13, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.4, color: '#0f172a' }}>
    {children}
  </h2>
);

const KpiBox: React.FC<{ label: string; value: string; color?: string }> = ({ label, value, color }) => (
  <div>
    <div style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>{label}</div>
    <div style={{ fontSize: 13, fontWeight: 800, color: color || '#0f172a', marginTop: 2 }}>{value}</div>
  </div>
);

const cellStyle: React.CSSProperties = {
  padding: '7px 8px',
  textAlign: 'left'
};
