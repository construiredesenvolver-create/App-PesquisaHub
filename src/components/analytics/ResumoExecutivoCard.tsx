import React, { useEffect, useState } from 'react';
import { Sparkles, Loader2, Lightbulb, ListChecks, RefreshCw } from 'lucide-react';
import { SurveyAnalyticsData } from '../../types';
import { ApiService } from '../../services/api';
import { detectarEscala, montarMatriz } from '../../services/analiseAvancada';

interface ResumoExecutivoCardProps {
  analyticsData: SurveyAnalyticsData;
  podeGerar: boolean;
}

type Resumo = { resumo: string; achados: string[]; plano: string[]; atualizadoEm: string; respostas: number };

const TIPOS_TEXTO = ['text', 'short_text', 'long_text'];

/** Monta um resumo compacto dos resultados para enviar à IA (nada de dados pessoais além do necessário). */
function montarDados(analyticsData: SurveyAnalyticsData) {
  const { survey, questionAnalytics, questions, options, respondents, answers } = analyticsData;

  const perguntas = questionAnalytics
    .filter((qa) => !TIPOS_TEXTO.includes(qa.questionType))
    .map((qa) => ({
      pergunta: qa.questionTitle,
      respostas: qa.totalAnswers,
      distribuicao: qa.distribution.slice(0, 11).map((d) => `${d.optionText}: ${d.percentage}%`)
    }));

  const textos = questions
    .filter((q) => TIPOS_TEXTO.includes(q.tipo))
    .map((q) => ({
      pergunta: q.titulo,
      amostra: answers
        .filter((a) => a.question_id === q.id && a.valor && a.valor.trim())
        .slice(0, 40)
        .map((a) => a.valor.trim().slice(0, 240))
    }))
    .filter((t) => t.amostra.length > 0);

  const escala = detectarEscala(questions, options);
  let matriz: any = null;
  if (escala) {
    const m = montarMatriz(escala, options, respondents, answers);
    const comMedia = escala.questoes.map((q) => ({ capacidade: q.titulo, media: Number((m.mediaPorQuestao[q.id] || 0).toFixed(2)) })).filter((x) => x.media > 0);
    matriz = {
      escala: escala.niveis.map((n, i) => `${i + 1}=${n.split(':')[0]}`),
      media_geral: Number(m.mediaGeral.toFixed(2)),
      maiores_lacunas: [...comMedia].sort((a, b) => a.media - b.media).slice(0, 6),
      pontos_fortes: [...comMedia].sort((a, b) => b.media - a.media).slice(0, 6)
    };
  }

  return { pesquisa: survey.titulo, descricao: survey.descricao, total_respostas: respondents.length, perguntas, matriz, respostas_abertas: textos };
}

/**
 * Resumo executivo da pesquisa inteira gerado por IA: leitura geral, achados e plano de ação.
 * O resultado fica guardado e também pode entrar no PDF.
 */
export const ResumoExecutivoCard: React.FC<ResumoExecutivoCardProps> = ({ analyticsData, podeGerar }) => {
  const surveyId = analyticsData.survey.id;
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    ApiService.getResumoExecutivo(surveyId)
      .then((r) => { if (ativo) setResumo(r); })
      .finally(() => { if (ativo) setCarregando(false); });
    return () => { ativo = false; };
  }, [surveyId]);

  const gerar = async () => {
    setGerando(true);
    setErro(null);
    try {
      setResumo(await ApiService.gerarResumoExecutivo(surveyId, montarDados(analyticsData)));
    } catch (err: any) {
      setErro(err.message || 'Não foi possível gerar o resumo.');
    } finally {
      setGerando(false);
    }
  };

  const total = analyticsData.respondents.length;
  const desatualizado = resumo && resumo.respostas > 0 && resumo.respostas !== total;

  return (
    <div className="bg-gradient-to-br from-indigo-50 to-white rounded-3xl border border-indigo-100 p-5 sm:p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-600" /> Resumo executivo da pesquisa
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Leitura geral de todas as respostas, principais achados e um plano de ação sugerido. Use o resultado como apoio à
            decisão — confira sempre com os números das outras abas.
          </p>
        </div>
        {podeGerar && (
          <button
            onClick={gerar}
            disabled={gerando || total === 0}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-2 disabled:opacity-60 shrink-0"
          >
            {gerando ? <Loader2 className="w-4 h-4 animate-spin" /> : resumo ? <RefreshCw className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
            <span>{gerando ? 'Gerando...' : resumo ? 'Gerar novamente' : 'Gerar resumo'}</span>
          </button>
        )}
      </div>

      {erro && <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl px-3 py-2">{erro}</div>}

      {carregando ? (
        <div className="py-4 flex justify-center"><Loader2 className="w-5 h-5 text-indigo-600 animate-spin" /></div>
      ) : !resumo ? (
        <p className="text-xs text-slate-500 italic">
          {podeGerar ? 'Ainda não gerado. Clique em "Gerar resumo".' : 'O responsável pela pesquisa ainda não gerou o resumo.'}
        </p>
      ) : (
        <div className="space-y-4">
          {desatualizado && (
            <div className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
              Este resumo foi gerado com {resumo.respostas} respostas; hoje a pesquisa tem {total}. Gere novamente para atualizar.
            </div>
          )}
          <p className="text-sm text-slate-700 leading-relaxed">{resumo.resumo}</p>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-4">
              <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5 mb-2"><Lightbulb className="w-4 h-4 text-amber-500" /> Principais achados</h4>
              <ul className="space-y-1.5">
                {resumo.achados.map((a, i) => <li key={i} className="text-xs text-slate-700">• {a}</li>)}
              </ul>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 p-4">
              <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5 mb-2"><ListChecks className="w-4 h-4 text-emerald-600" /> Plano de ação sugerido</h4>
              <ol className="space-y-1.5 list-decimal list-inside">
                {resumo.plano.map((a, i) => <li key={i} className="text-xs text-slate-700">{a}</li>)}
              </ol>
            </div>
          </div>
          <p className="text-[10px] text-slate-400">
            Gerado em {new Date(resumo.atualizadoEm).toLocaleString('pt-BR')} · entra no PDF em "Relatório & Exportação".
          </p>
        </div>
      )}
    </div>
  );
};
