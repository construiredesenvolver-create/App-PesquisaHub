import { 
  Survey, 
  Question, 
  Option, 
  Respondent, 
  Answer, 
  QuestionAnalytics, 
  OptionDistribution, 
  ExecutiveSummary, 
  CrossTabulationResult, 
  SurveyAnalyticsData,
  SurveyFilter,
  SatisfactionIndex
} from '../types';

// Paleta harmoniosa e de alto contraste para gráficos
export const CHART_COLORS = [
  '#2563eb', // Blue 600
  '#0d9488', // Teal 600
  '#8b5cf6', // Purple 600
  '#ea580c', // Orange 600
  '#059669', // Emerald 600
  '#d97706', // Amber 600
  '#e11d48', // Rose 600
  '#4f46e5', // Indigo 600
  '#0891b2', // Cyan 600
  '#64748b', // Slate 500
];

/**
 * Motor Estatístico e Analítico de Pesquisas (Analytics Engine)
 * Responsável por interpretar dados brutos, calcular frequências, distribuições,
 * taxas de resposta, índices de satisfação, cruzamentos e resumos executivos.
 */
export class AnalyticsEngine {
  
  /**
   * Executa a análise completa de uma pesquisa com base em seus dados e filtros ativos.
   */
  public static analyzeSurvey(
    survey: Survey,
    questions: Question[],
    options: Option[],
    respondents: Respondent[],
    answers: Answer[],
    filter?: SurveyFilter
  ): SurveyAnalyticsData {
    // 1. Aplicar filtros se existirem
    const filteredData = this.applyFilters(questions, respondents, answers, filter);
    const activeRespondents = filteredData.filteredRespondents;
    const activeAnswers = filteredData.filteredAnswers;

    // 2. Ordenar perguntas pela ordem cadastrada
    const sortedQuestions = [...questions].sort((a, b) => a.ordem - b.ordem);

    // 3. Analisar cada pergunta individualmente
    const questionAnalyticsList: QuestionAnalytics[] = sortedQuestions.map((q) => {
      const qOptions = options
        .filter((opt) => opt.question_id === q.id)
        .sort((a, b) => a.ordem - b.ordem);
      
      const qAnswers = activeAnswers.filter((ans) => ans.question_id === q.id);
      
      return this.analyzeQuestion(q, qOptions, activeRespondents, qAnswers);
    });

    // 4. Gerar resumo executivo e conclusões estatísticas
    const executiveSummary = this.generateExecutiveSummary(
      survey,
      sortedQuestions,
      activeRespondents,
      activeAnswers,
      questionAnalyticsList
    );

    return {
      survey,
      questions: sortedQuestions,
      options,
      respondents: activeRespondents,
      answers: activeAnswers,
      executiveSummary,
      questionAnalytics: questionAnalyticsList
    };
  }

  /**
   * Filtra respondentes e respostas conforme critérios do usuário.
   */
  private static applyFilters(
    questions: Question[],
    respondents: Respondent[],
    answers: Answer[],
    filter?: SurveyFilter
  ): { filteredRespondents: Respondent[]; filteredAnswers: Answer[] } {
    if (!filter) {
      return { filteredRespondents: respondents, filteredAnswers: answers };
    }

    let validRespondentIds = new Set(respondents.map((r) => r.id));

    // Filtro por Data Inicial
    if (filter.dateFrom) {
      const fromDate = new Date(filter.dateFrom).getTime();
      respondents = respondents.filter((r) => {
        const rDate = new Date(r.data_resposta).getTime();
        return isNaN(fromDate) || isNaN(rDate) || rDate >= fromDate;
      });
      validRespondentIds = new Set(respondents.map((r) => r.id));
    }

    // Filtro por Data Final
    if (filter.dateTo) {
      const toDate = new Date(filter.dateTo).getTime();
      respondents = respondents.filter((r) => {
        const rDate = new Date(r.data_resposta).getTime();
        return isNaN(toDate) || isNaN(rDate) || rDate <= toDate;
      });
      validRespondentIds = new Set(respondents.map((r) => r.id));
    }

    // Filtro por Busca de Nome do Respondente
    if (filter.respondentSearch && filter.respondentSearch.trim() !== '') {
      const term = filter.respondentSearch.toLowerCase().trim();
      respondents = respondents.filter((r) => r.nome.toLowerCase().includes(term));
      validRespondentIds = new Set(respondents.map((r) => r.id));
    }

    // Filtros por Pergunta (ex: Setor = 'SAC')
    if (filter.questionFilters && Object.keys(filter.questionFilters).length > 0) {
      for (const [qId, selectedValues] of Object.entries(filter.questionFilters)) {
        if (selectedValues && selectedValues.length > 0) {
          const matchingRespondentIds = new Set<string>();
          for (const ans of answers) {
            if (ans.question_id === qId && selectedValues.includes(ans.valor)) {
              matchingRespondentIds.add(ans.respondent_id);
            }
          }
          // Interseção
          validRespondentIds = new Set(
            [...validRespondentIds].filter((id) => matchingRespondentIds.has(id))
          );
        }
      }
      respondents = respondents.filter((r) => validRespondentIds.has(r.id));
    }

    const filteredAnswers = answers.filter((a) => validRespondentIds.has(a.respondent_id));

    return {
      filteredRespondents: respondents,
      filteredAnswers
    };
  }

  /**
   * Analisa estatisticamente uma única pergunta.
   */
  public static analyzeQuestion(
    question: Question,
    options: Option[],
    respondents: Respondent[],
    answers: Answer[]
  ): QuestionAnalytics {
    const totalRespondents = respondents.length;
    
    // Contagem de respondentes únicos que responderam esta pergunta
    const answeringRespondents = new Set(answers.map((a) => a.respondent_id));
    const totalAnswersCount = answeringRespondents.size;
    const unansweredCount = Math.max(0, totalRespondents - totalAnswersCount);
    const responseRate = totalRespondents > 0 
      ? Number(((totalAnswersCount / totalRespondents) * 100).toFixed(1)) 
      : 0;

    // Contabilizar frequências por alternativa
    const countsMap = new Map<string, number>();
    
    // Inicializar com todas as opções cadastradas (mesmo as com 0 votos)
    options.forEach((opt) => {
      countsMap.set(opt.texto, 0);
    });

    answers.forEach((ans) => {
      const current = countsMap.get(ans.valor) || 0;
      countsMap.set(ans.valor, current + 1);
    });

    const totalSelections = answers.length; // Em múltipla escolha pode ser > totalAnswersCount

    // Montar a distribuição
    const distributionRaw: OptionDistribution[] = [];
    let colorIdx = 0;

    options.forEach((opt) => {
      const count = countsMap.get(opt.texto) || 0;
      // Para escolha única, percentual sobre respondentes da pergunta; para múltipla escolha, % de respondentes que marcaram
      const baseTotal = question.tipo === 'multiple_choice' ? totalAnswersCount : totalSelections;
      const percentage = baseTotal > 0 ? Number(((count / baseTotal) * 100).toFixed(1)) : 0;

      distributionRaw.push({
        optionId: opt.id,
        optionText: opt.texto,
        count,
        percentage,
        rank: 0,
        color: CHART_COLORS[colorIdx % CHART_COLORS.length]
      });
      colorIdx++;
    });

    // Se houver respostas que não estavam no array de opções fixas (ex: opções adicionadas depois)
    countsMap.forEach((count, text) => {
      if (!options.some((o) => o.texto === text)) {
        const baseTotal = question.tipo === 'multiple_choice' ? totalAnswersCount : totalSelections;
        const percentage = baseTotal > 0 ? Number(((count / baseTotal) * 100).toFixed(1)) : 0;
        distributionRaw.push({
          optionId: `custom_${text}`,
          optionText: text,
          count,
          percentage,
          rank: 0,
          color: CHART_COLORS[colorIdx % CHART_COLORS.length]
        });
        colorIdx++;
      }
    });

    // Ordenar para determinar ranking
    const sortedByCount = [...distributionRaw].sort((a, b) => b.count - a.count);
    sortedByCount.forEach((item, index) => {
      item.rank = index + 1;
    });

    const dominantOption = sortedByCount.length > 0 && sortedByCount[0].count > 0 ? sortedByCount[0] : null;
    const leastSelectedOption = sortedByCount.length > 0 ? sortedByCount[sortedByCount.length - 1] : null;

    // Calcular índice de consenso / concentração (0 a 100)
    // Se 1 opção tem 100% -> consenso = 100. Se 4 opções têm 25% cada -> consenso = baixo.
    let consensusScore = 0;
    let isSplit = false;

    if (sortedByCount.length > 1 && totalSelections > 0) {
      const top1Pct = sortedByCount[0].percentage;
      const top2Pct = sortedByCount[1].percentage;

      // Se a 1ª e a 2ª estão a menos de 5% de distância e representam fatias significativas
      if (top1Pct > 15 && Math.abs(top1Pct - top2Pct) <= 6) {
        isSplit = true;
      }

      // Herfindahl-Hirschman Index normalizado (0 a 100)
      const hhi = sortedByCount.reduce((acc, curr) => acc + Math.pow(curr.percentage / 100, 2), 0);
      consensusScore = Number((hhi * 100).toFixed(1));
    } else if (sortedByCount.length === 1 && totalSelections > 0) {
      consensusScore = 100;
    }

    // Verificar se há escala Likert ou de satisfação
    const satisfactionIndex = this.calculateSatisfactionIndex(question, options, answers);

    // Decidir o gráfico mais adequado
    const recommendedChart = this.recommendChartType(question, distributionRaw.length);

    return {
      questionId: question.id,
      questionTitle: question.titulo,
      questionDescription: question.descricao,
      questionType: question.tipo,
      totalAnswers: totalAnswersCount,
      totalRespondents,
      responseRate,
      unansweredCount,
      distribution: distributionRaw,
      dominantOption,
      leastSelectedOption,
      consensusScore,
      isSplit,
      satisfactionIndex,
      recommendedChart
    };
  }

  /**
   * Detecta se a pergunta é uma escala ordenada (ex: Muito satisfeito a Muito insatisfeito)
   * e calcula médias e proporções favoráveis/neutras/desfavoráveis.
   */
  private static calculateSatisfactionIndex(
    question: Question,
    options: Option[],
    answers: Answer[]
  ): SatisfactionIndex | undefined {
    if (answers.length === 0) return undefined;

    const optTexts = options.map((o) => o.texto.toLowerCase().trim());
    
    // Detecção de escala clássica de satisfação
    const isSatisfactionScale = optTexts.some((t) => 
      t.includes('satisfeito') || t.includes('ótimo') || t.includes('excelente') || t.includes('bom') || t.includes('concordo')
    );

    if (!isSatisfactionScale && question.tipo !== 'scale' && question.tipo !== 'rating') {
      return undefined;
    }

    let positiveCount = 0;
    let neutralCount = 0;
    let negativeCount = 0;
    let totalScore = 0;
    let scoredItems = 0;

    answers.forEach((ans) => {
      const val = ans.valor.toLowerCase().trim();
      if (val.includes('muito satisfeito') || val.includes('excelente') || val.includes('ótimo') || val.includes('concordo totalmente') || val === '5' || val === '10') {
        positiveCount++;
        totalScore += 5;
        scoredItems++;
      } else if (val.includes('satisfeito') || val.includes('bom') || val.includes('concordo') || val === '4' || val === '8' || val === '9') {
        positiveCount++;
        totalScore += 4;
        scoredItems++;
      } else if (val.includes('neutro') || val.includes('regular') || val.includes('indiferente') || val === '3' || val === '7') {
        neutralCount++;
        totalScore += 3;
        scoredItems++;
      } else if (val.includes('muito insatisfeito') || val.includes('péssimo') || val.includes('discordo totalmente') || val === '1') {
        negativeCount++;
        totalScore += 1;
        scoredItems++;
      } else if (val.includes('insatisfeito') || val.includes('ruim') || val.includes('discordo') || val === '2') {
        negativeCount++;
        totalScore += 2;
        scoredItems++;
      }
    });

    if (scoredItems === 0) return undefined;

    const total = answers.length;
    const positivePct = Number(((positiveCount / total) * 100).toFixed(1));
    const neutralPct = Number(((neutralCount / total) * 100).toFixed(1));
    const negativePct = Number(((negativeCount / total) * 100).toFixed(1));
    const averageScore = Number((totalScore / scoredItems).toFixed(2));

    return {
      averageScore,
      maxScore: 5.0,
      positiveCount,
      positivePct,
      neutralCount,
      neutralPct,
      negativeCount,
      negativePct,
      label: `${positivePct}% de Avaliação Positiva`
    };
  }

  /**
   * Decide de forma autônoma o melhor formato de gráfico para a pergunta.
   */
  private static recommendChartType(
    question: Question,
    optionCount: number
  ): 'horizontal_bar' | 'donut' | 'vertical_bar' | 'ranking_list' {
    if (question.tipo === 'multiple_choice') {
      return 'horizontal_bar';
    }
    if (optionCount <= 4) {
      return 'donut';
    }
    if (optionCount > 7) {
      return 'horizontal_bar';
    }
    return 'horizontal_bar';
  }

  /**
   * Gera cruzamento estatístico entre duas perguntas selecionadas (Cross-Tabulation).
   * Exemplo: Pergunta A (Setor) × Pergunta B (Disponibilidade para domingos).
   */
  public static crossTabulate(
    questionA: Question,
    questionB: Question,
    optionsA: Option[],
    optionsB: Option[],
    respondents: Respondent[],
    answers: Answer[]
  ): CrossTabulationResult {
    // Obter todas as alternativas conhecidas
    const rows = optionsA.length > 0 
      ? optionsA.map((o) => o.texto) 
      : Array.from(new Set(answers.filter((a) => a.question_id === questionA.id).map((a) => a.valor)));
      
    const columns = optionsB.length > 0 
      ? optionsB.map((o) => o.texto) 
      : Array.from(new Set(answers.filter((a) => a.question_id === questionB.id).map((a) => a.valor)));

    // Estruturar matriz de contagens
    const matrix: { [row: string]: { [col: string]: number } } = {};
    const percentageMatrix: { [row: string]: { [col: string]: number } } = {};
    const rowTotals: { [row: string]: number } = {};
    const colTotals: { [col: string]: number } = {};

    rows.forEach((r) => {
      matrix[r] = {};
      percentageMatrix[r] = {};
      rowTotals[r] = 0;
      columns.forEach((c) => {
        matrix[r][c] = 0;
        percentageMatrix[r][c] = 0;
      });
    });

    columns.forEach((c) => {
      colTotals[c] = 0;
    });

    let grandTotal = 0;

    // Para cada respondente, verificar o par de respostas (A, B)
    respondents.forEach((resp) => {
      const ansA = answers.find((a) => a.respondent_id === resp.id && a.question_id === questionA.id);
      const ansB = answers.find((a) => a.respondent_id === resp.id && a.question_id === questionB.id);

      if (ansA && ansB) {
        const valA = ansA.valor;
        const valB = ansB.valor;

        if (matrix[valA] && matrix[valA][valB] !== undefined) {
          matrix[valA][valB]++;
          rowTotals[valA]++;
          colTotals[valB] = (colTotals[valB] || 0) + 1;
          grandTotal++;
        }
      }
    });

    // Calcular matriz percentual (por linha)
    rows.forEach((r) => {
      const rTotal = rowTotals[r];
      columns.forEach((c) => {
        percentageMatrix[r][c] = rTotal > 0 
          ? Number(((matrix[r][c] / rTotal) * 100).toFixed(1)) 
          : 0;
      });
    });

    // Gerar observações factuais automáticas baseadas em regras estatísticas (Sem IA)
    const keyInsights: string[] = [];

    rows.forEach((r) => {
      const rTotal = rowTotals[r];
      if (rTotal >= 3) {
        let maxCol = '';
        let maxCount = -1;
        columns.forEach((c) => {
          if (matrix[r][c] > maxCount) {
            maxCount = matrix[r][c];
            maxCol = c;
          }
        });

        if (maxCol && maxCount > 0) {
          const pct = percentageMatrix[r][maxCol];
          if (pct >= 40) {
            keyInsights.push(
              `"${r}" apresenta maior concentração na opção "${maxCol}", representando ${pct}% das respostas desse grupo (${maxCount} de ${rTotal}).`
            );
          }
        }
      }
    });

    if (keyInsights.length === 0 && grandTotal > 0) {
      keyInsights.push(
        `Foram cruzadas ${grandTotal} respostas entre "${questionA.titulo}" e "${questionB.titulo}". As preferências estão distribuídas de forma homogênea entre os grupos.`
      );
    }

    return {
      questionA: { id: questionA.id, title: questionA.titulo },
      questionB: { id: questionB.id, title: questionB.titulo },
      rows,
      columns,
      matrix,
      percentageMatrix,
      rowTotals,
      colTotals,
      grandTotal,
      keyInsights
    };
  }

  /**
   * Constrói o Resumo Executivo da pesquisa com base em regras matemáticas rigorosas.
   */
  private static generateExecutiveSummary(
    survey: Survey,
    questions: Question[],
    respondents: Respondent[],
    answers: Answer[],
    questionAnalytics: QuestionAnalytics[]
  ): ExecutiveSummary {
    const totalResponses = respondents.length;
    const totalQuestions = questions.length;
    
    // Taxa de preenchimento completo (respondentes que responderam todas as perguntas obrigatórias)
    const mandatoryQuestions = questions.filter((q) => q.obrigatoria);
    let fullyCompletedCount = 0;

    respondents.forEach((resp) => {
      const respAnswers = answers.filter((a) => a.respondent_id === resp.id);
      const answeredQIds = new Set(respAnswers.map((a) => a.question_id));
      const hasAllMandatory = mandatoryQuestions.every((mq) => answeredQIds.has(mq.id));
      if (hasAllMandatory) {
        fullyCompletedCount++;
      }
    });

    const completionRate = totalResponses > 0 
      ? Number(((fullyCompletedCount / totalResponses) * 100).toFixed(1)) 
      : 0;

    // Datas inicial e final
    const dates = respondents
      .map((r) => r.data_resposta)
      .filter(Boolean)
      .sort();
    const firstResponseDate = dates.length > 0 ? dates[0] : undefined;
    const lastResponseDate = dates.length > 0 ? dates[dates.length - 1] : undefined;

    // Identificar perguntas de alto consenso (> 55% em uma única alternativa)
    const highConsensusQuestions: Array<{
      questionTitle: string;
      dominantOption: string;
      percentage: number;
    }> = [];

    // Identificar perguntas divididas / divergentes
    const divergentQuestions: Array<{
      questionTitle: string;
      explanation: string;
    }> = [];

    const keyFindings: string[] = [];

    questionAnalytics.forEach((qa) => {
      if (qa.totalAnswers === 0) return;

      if (qa.dominantOption && qa.dominantOption.percentage >= 55) {
        highConsensusQuestions.push({
          questionTitle: qa.questionTitle,
          dominantOption: qa.dominantOption.optionText,
          percentage: qa.dominantOption.percentage
        });
        keyFindings.push(
          `Na pergunta "${qa.questionTitle}", a alternativa "${qa.dominantOption.optionText}" foi a mais selecionada, concentrando ${qa.dominantOption.percentage}% das respostas.`
        );
      } else if (qa.isSplit && qa.distribution.length >= 2) {
        const top1 = qa.distribution[0];
        const top2 = qa.distribution[1];
        divergentQuestions.push({
          questionTitle: qa.questionTitle,
          explanation: `Respostas divididas entre "${top1.optionText}" (${top1.percentage}%) e "${top2.optionText}" (${top2.percentage}%).`
        });
        keyFindings.push(
          `A pergunta "${qa.questionTitle}" apresenta alta divergência, com empate técnico entre "${top1.optionText}" (${top1.percentage}%) e "${top2.optionText}" (${top2.percentage}%).`
        );
      } else if (qa.dominantOption && qa.dominantOption.percentage > 0) {
        keyFindings.push(
          `Em "${qa.questionTitle}", a opção com maior frequência foi "${qa.dominantOption.optionText}" com ${qa.dominantOption.percentage}% (${qa.dominantOption.count} votos).`
        );
      }
    });

    // Se houver índices de satisfação
    const satisfactionQuestions = questionAnalytics.filter((qa) => qa.satisfactionIndex !== undefined);
    if (satisfactionQuestions.length > 0) {
      const avgPos = satisfactionQuestions.reduce(
        (acc, curr) => acc + (curr.satisfactionIndex?.positivePct || 0), 0
      ) / satisfactionQuestions.length;
      keyFindings.unshift(
        `Índice médio favorável identificado em ${avgPos.toFixed(1)}% nas perguntas de avaliação avaliativas.`
      );
    }

    // Linha do tempo de respostas
    const dateCounts: Record<string, number> = {};
    respondents.forEach((r) => {
      const d = r.data_resposta || 'Sem data';
      dateCounts[d] = (dateCounts[d] || 0) + 1;
    });

    const sortedDates = Object.keys(dateCounts).sort();
    let runningAccumulated = 0;
    const responsesOverTime = sortedDates.map((date) => {
      const count = dateCounts[date];
      runningAccumulated += count;
      return {
        date,
        count,
        accumulated: runningAccumulated
      };
    });

    return {
      totalResponses,
      totalQuestions,
      completionRate,
      firstResponseDate,
      lastResponseDate,
      keyFindings: keyFindings.slice(0, 6),
      highConsensusQuestions,
      divergentQuestions,
      responsesOverTime
    };
  }

  /**
   * Obtém a lista de respondentes que selecionaram uma alternativa específica de uma pergunta.
   */
  public static getQuestionOptionDrillDown(
    questionId: string,
    optionValue: string,
    respondents: Respondent[],
    answers: Answer[]
  ): { respondents: Respondent[]; matchingAnswers: Answer[] } {
    const matchingAnswers = answers.filter(
      (a) => a.question_id === questionId && a.valor === optionValue
    );
    const matchingRespondentIds = new Set(matchingAnswers.map((a) => a.respondent_id));
    const matchingRespondents = respondents.filter((r) => matchingRespondentIds.has(r.id));

    return {
      respondents: matchingRespondents,
      matchingAnswers
    };
  }

  /**
   * Obtém a lista de respondentes que correspondem a um par de respostas de cruzamento (CrossTab).
   */
  public static getCrossTabDrillDown(
    questionAId: string,
    valueA: string,
    questionBId: string,
    valueB: string,
    respondents: Respondent[],
    answers: Answer[]
  ): { respondents: Respondent[]; matchingAnswersA: Answer[]; matchingAnswersB: Answer[] } {
    const answersA = answers.filter((a) => a.question_id === questionAId && a.valor === valueA);
    const answersB = answers.filter((a) => a.question_id === questionBId && a.valor === valueB);

    const respondentsA = new Set(answersA.map((a) => a.respondent_id));
    const respondentsB = new Set(answersB.map((a) => a.respondent_id));

    const intersectionIds = new Set([...respondentsA].filter((id) => respondentsB.has(id)));
    const matchingRespondents = respondents.filter((r) => intersectionIds.has(r.id));

    return {
      respondents: matchingRespondents,
      matchingAnswersA: answersA.filter((a) => intersectionIds.has(a.respondent_id)),
      matchingAnswersB: answersB.filter((a) => intersectionIds.has(a.respondent_id))
    };
  }

  /**
   * Obtém os respondentes que caem em um grupo específico de satisfação (Positivo, Neutro ou Negativo).
   */
  public static getSatisfactionGroupDrillDown(
    questionId: string,
    group: 'positive' | 'neutral' | 'negative',
    respondents: Respondent[],
    answers: Answer[]
  ): { respondents: Respondent[]; matchingAnswers: Answer[] } {
    const matchingAnswers = answers.filter((a) => {
      if (a.question_id !== questionId) return false;
      const val = a.valor.toLowerCase().trim();

      if (group === 'positive') {
        return (
          val.includes('muito satisfeito') ||
          val.includes('excelente') ||
          val.includes('ótimo') ||
          val.includes('concordo totalmente') ||
          val === '5' ||
          val === '10' ||
          val.includes('satisfeito') ||
          val.includes('bom') ||
          val.includes('concordo') ||
          val === '4' ||
          val === '8' ||
          val === '9'
        );
      } else if (group === 'neutral') {
        return (
          val.includes('neutro') ||
          val.includes('regular') ||
          val.includes('indiferente') ||
          val === '3' ||
          val === '7'
        );
      } else if (group === 'negative') {
        return (
          val.includes('muito insatisfeito') ||
          val.includes('péssimo') ||
          val.includes('discordo totalmente') ||
          val === '1' ||
          val.includes('insatisfeito') ||
          val.includes('ruim') ||
          val.includes('discordo') ||
          val === '2'
        );
      }
      return false;
    });

    const matchingRespondentIds = new Set(matchingAnswers.map((a) => a.respondent_id));
    const matchingRespondents = respondents.filter((r) => matchingRespondentIds.has(r.id));

    return {
      respondents: matchingRespondents,
      matchingAnswers
    };
  }

  /**
   * Exporta a lista de respondentes do Drill-Down em formato CSV.
   */
  public static exportDrillDownCSV(
    surveyTitle: string,
    filterDescription: string,
    respondents: Respondent[],
    answers: Answer[],
    questions: Question[]
  ): string {
    const headers = [
      'ID Respondente',
      'Nome',
      'Identificador',
      'Data Resposta',
      'Hora Resposta',
      ...questions.map((q) => `"${q.titulo.replace(/"/g, '""')}"`)
    ];

    const rows = respondents.map((resp) => {
      const respAnswers = answers.filter((a) => a.respondent_id === resp.id);
      const questionCols = questions.map((q) => {
        const qAnswers = respAnswers
          .filter((a) => a.question_id === q.id)
          .map((a) => a.valor);
        return `"${qAnswers.join('; ').replace(/"/g, '""')}"`;
      });

      return [
        resp.id,
        `"${resp.nome.replace(/"/g, '""')}"`,
        resp.identificador || '',
        resp.data_resposta,
        resp.hora_resposta || '',
        ...questionCols
      ].join(',');
    });

    return [
      `# Relatório Drill-Down: ${surveyTitle}`,
      `# Filtro / Recorte: ${filterDescription}`,
      `# Total de Registros: ${respondents.length}`,
      `# Exportado em: ${new Date().toLocaleString('pt-BR')}`,
      headers.join(','),
      ...rows
    ].join('\n');
  }
}

