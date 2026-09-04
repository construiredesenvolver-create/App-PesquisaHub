import React, { useEffect, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Sparkles, RefreshCw, Loader2, ThumbsUp, ThumbsDown, MessageSquareText, AlertCircle, Settings2, Check } from 'lucide-react';
import { SurveyAnalyticsData, SentimentAnalysisResult } from '../../types';
import { ApiService } from '../../services/api';

interface SentimentAnalysisViewProps {
  analyticsData: SurveyAnalyticsData;
}

const OPEN_TEXT_TYPES = ['text', 'long_text', 'short_text'];

export const SentimentAnalysisView: React.FC<SentimentAnalysisViewProps> = ({ analyticsData }) => {
  const { survey, questions, answers } = analyticsData;

  const openTextQuestions = questions.filter((q) => OPEN_TEXT_TYPES.includes(q.tipo));

  if (openTextQuestions.length === 0) {
    return (
      <div className="p-10 text-center bg-white rounded-3xl border border-slate-200">
        <Sparkles className="w-8 h-8 text-slate-300 mx-auto mb-3" />
        <p className="text-sm font-semibold text-slate-600">Nenhuma pergunta de texto livre nesta pesquisa.</p>
        <p className="text-xs text-slate-400 mt-1">
          A análise de sentimento por IA funciona em perguntas do tipo "Texto Livre". Adicione uma para usar este recurso.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-3xl p-6 text-white">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-100">
          <Sparkles className="w-4 h-4" />
          <span>Análise de Sentimento com IA</span>
        </div>
        <p className="text-sm text-indigo-50 mt-2 max-w-2xl">
          A IA lê todas as respostas abertas de cada pergunta e resume os principais elogios e críticas,
          sem que você precise ler resposta por resposta.
        </p>
      </div>

      <ContextoIACard surveyId={survey.id} initialContexto={survey.configuracoes?.contexto_ia || ''} />

      {openTextQuestions.map((q) => {
        const totalAnswersForQuestion = answers.filter((a) => a.question_id === q.id && a.valor?.trim()).length;
        return (
          <QuestionSentimentCard
            key={q.id}
            surveyId={survey.id}
            questionId={q.id}
            questionTitle={q.titulo}
            totalAnswers={totalAnswersForQuestion}
          />
        );
      })}
    </div>
  );
};

const ContextoIACard: React.FC<{ surveyId: string; initialContexto: string }> = ({ surveyId, initialContexto }) => {
  const [expanded, setExpanded] = useState(!!initialContexto);
  const [contexto, setContexto] = useState(initialContexto);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setError(null);
    setSaving(true);
    try {
      await ApiService.updateSurveyContextoIA(surveyId, contexto.trim());
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err: any) {
      setError(err.message || 'Não foi possível salvar o contexto.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between gap-3 text-left"
      >
        <div className="flex items-center gap-2">
          <Settings2 className="w-4 h-4 text-slate-500" />
          <span className="text-sm font-bold text-slate-800">Contexto para a IA (opcional)</span>
        </div>
        <span className="text-[11px] font-semibold text-indigo-600">{expanded ? 'Recolher' : 'Configurar'}</span>
      </button>

      {expanded && (
        <div className="mt-4 space-y-3">
          <p className="text-xs text-slate-500">
            Explique aqui algo que ajude a IA a entender melhor as respostas desta pesquisa — jargões internos,
            a situação da equipe na época da coleta, ou o que conta como elogio/crítica no seu contexto. Isso vale
            para todas as perguntas de texto livre desta pesquisa, em toda análise futura.
          </p>
          <textarea
            value={contexto}
            onChange={(e) => setContexto(e.target.value)}
            rows={3}
            placeholder={'Ex: "Esta pesquisa foi aplicada à equipe de operações durante a reestruturação de Janeiro. O termo \'novo sistema\' se refere ao ERP implantado nesse período."'}
            className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
          />
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-xs font-medium rounded-xl px-3 py-2">
              {error}
            </div>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-2 disabled:opacity-60"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : saved ? <Check className="w-3.5 h-3.5" /> : null}
            <span>{saved ? 'Salvo!' : 'Salvar contexto'}</span>
          </button>
          <p className="text-[10px] text-slate-400">
            Depois de salvar, clique em "Reanalisar" nas perguntas abaixo para que a próxima análise já considere este contexto.
          </p>
        </div>
      )}
    </div>
  );
};

const SENTIMENT_COLORS = { positivo: '#10b981', neutro: '#94a3b8', negativo: '#ef4444' };

const QuestionSentimentCard: React.FC<{
  surveyId: string;
  questionId: string;
  questionTitle: string;
  totalAnswers: number;
}> = ({ surveyId, questionId, questionTitle, totalAnswers }) => {
  const [result, setResult] = useState<SentimentAnalysisResult | null>(null);
  const [loadingCache, setLoadingCache] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoadingCache(true);
    ApiService.getSentimentAnalysis(surveyId, questionId)
      .then((cached) => {
        if (!cancelled) setResult(cached);
      })
      .finally(() => {
        if (!cancelled) setLoadingCache(false);
      });
    return () => {
      cancelled = true;
    };
  }, [surveyId, questionId]);

  const handleAnalyze = async () => {
    setError(null);
    setAnalyzing(true);
    try {
      const fresh = await ApiService.analyzeSentiment(surveyId, questionId);
      setResult(fresh);
    } catch (err: any) {
      setError(err.message || 'Não foi possível concluir a análise.');
    } finally {
      setAnalyzing(false);
    }
  };

  const pieData = result
    ? [
        { name: 'Positivo', value: result.positivo, color: SENTIMENT_COLORS.positivo },
        { name: 'Neutro', value: result.neutro, color: SENTIMENT_COLORS.neutro },
        { name: 'Negativo', value: result.negativo, color: SENTIMENT_COLORS.negativo }
      ]
    : [];

  const isStale = result && result.respostasAnalisadas < totalAnswers;

  return (
    <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            <MessageSquareText className="w-3.5 h-3.5" />
            <span>Pergunta de texto livre</span>
          </div>
          <h3 className="text-base font-bold text-slate-900 mt-1">{questionTitle}</h3>
          <p className="text-xs text-slate-500 mt-0.5">{totalAnswers} resposta(s) com texto preenchido</p>
        </div>

        {totalAnswers > 0 && (
          <button
            onClick={handleAnalyze}
            disabled={analyzing}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-2 disabled:opacity-60 shadow-xs"
          >
            {analyzing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : result ? <RefreshCw className="w-3.5 h-3.5" /> : <Sparkles className="w-3.5 h-3.5" />}
            <span>{analyzing ? 'Analisando...' : result ? 'Reanalisar' : 'Analisar com IA'}</span>
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs font-medium rounded-xl px-4 py-3 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {loadingCache ? (
        <div className="py-6 flex items-center justify-center">
          <Loader2 className="w-5 h-5 text-slate-300 animate-spin" />
        </div>
      ) : totalAnswers === 0 ? (
        <p className="text-xs text-slate-400 italic">Ainda não há respostas de texto para analisar.</p>
      ) : !result ? (
        <p className="text-xs text-slate-400 italic">Ainda não analisado. Clique em "Analisar com IA" para gerar o resumo.</p>
      ) : (
        <div className="space-y-4">
          {isStale && (
            <div className="bg-amber-50 border border-amber-200 text-amber-700 text-[11px] font-medium rounded-xl px-3 py-2">
              Há respostas novas desde a última análise ({result.respostasAnalisadas} de {totalAnswers} foram consideradas). Clique em "Reanalisar" para atualizar.
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="md:col-span-1 flex flex-col items-center justify-center">
              <div className="w-full h-[180px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={3} dataKey="value">
                      {pieData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => `${v}%`} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex items-center gap-3 text-[11px] font-semibold">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: SENTIMENT_COLORS.positivo }} />{result.positivo}%</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: SENTIMENT_COLORS.neutro }} />{result.neutro}%</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: SENTIMENT_COLORS.negativo }} />{result.negativo}%</span>
              </div>
            </div>

            <div className="md:col-span-2 space-y-3">
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                <p className="text-xs text-slate-700 leading-relaxed">{result.resumo}</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3.5">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 uppercase mb-2">
                    <ThumbsUp className="w-3.5 h-3.5" />
                    <span>Pontos Positivos</span>
                  </div>
                  {result.pontosPositivos.length === 0 ? (
                    <p className="text-[11px] text-emerald-700/70 italic">Nada de relevante identificado.</p>
                  ) : (
                    <ul className="space-y-1">
                      {result.pontosPositivos.map((p, i) => (
                        <li key={i} className="text-[11px] text-emerald-900">• {p}</li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="bg-red-50 border border-red-200 rounded-2xl p-3.5">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-red-700 uppercase mb-2">
                    <ThumbsDown className="w-3.5 h-3.5" />
                    <span>Pontos de Atenção</span>
                  </div>
                  {result.pontosNegativos.length === 0 ? (
                    <p className="text-[11px] text-red-700/70 italic">Nada de relevante identificado.</p>
                  ) : (
                    <ul className="space-y-1">
                      {result.pontosNegativos.map((p, i) => (
                        <li key={i} className="text-[11px] text-red-900">• {p}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              <p className="text-[10px] text-slate-400">
                Última análise: {new Date(result.atualizadoEm).toLocaleString('pt-BR')} • {result.respostasAnalisadas} resposta(s) consideradas
                {!!result.respostasIgnoradas && ` • ${result.respostasIgnoradas} ignorada(s) por estarem vazias/sem conteúdo relevante`}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
