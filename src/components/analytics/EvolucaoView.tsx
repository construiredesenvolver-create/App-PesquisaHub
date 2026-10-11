import React, { useEffect, useMemo, useState } from 'react';
import { TrendingUp, Loader2, ArrowUpRight, ArrowDownRight, Minus, Users } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { Survey, Question, Option, Respondent, Answer } from '../../types';
import { ApiService } from '../../services/api';
import { detectarEscala, montarMatriz, normalizarNome, rotuloCurtoNivel } from '../../services/analiseAvancada';

interface EvolucaoViewProps {
  survey: Survey;
}

interface Aplicacao {
  survey: Survey;
  rotulo: string;
  questions: Question[];
  options: Option[];
  respondents: Respondent[];
  answers: Answer[];
}

const fmt = (v: number | undefined) => (v && v > 0 ? v.toFixed(1).replace('.', ',') : '—');

function rotuloData(s: Survey): string {
  const d = s.data_inicio || s.data_criacao || '';
  const [ano, mes] = d.split('-');
  return ano && mes ? `${mes}/${ano}` : s.titulo;
}

const Delta: React.FC<{ v: number | null }> = ({ v }) => {
  if (v === null || isNaN(v)) return <span className="text-slate-300">—</span>;
  if (Math.abs(v) < 0.05) return <span className="inline-flex items-center gap-0.5 text-slate-500"><Minus className="w-3 h-3" />0</span>;
  const sobe = v > 0;
  return (
    <span className={`inline-flex items-center gap-0.5 font-bold ${sobe ? 'text-emerald-700' : 'text-rose-700'}`}>
      {sobe ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
      {(sobe ? '+' : '') + v.toFixed(1).replace('.', ',')}
    </span>
  );
};

/**
 * Evolução entre aplicações da mesma pesquisa (a original e suas reaplicações).
 * Com escala de níveis (ex.: Autoavaliação): média por capacidade e por pessoa ao longo do tempo.
 * Sem escala: opção mais escolhida de cada pergunta em cada aplicação.
 */
export const EvolucaoView: React.FC<EvolucaoViewProps> = ({ survey }) => {
  const [aplicacoes, setAplicacoes] = useState<Aplicacao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    (async () => {
      setCarregando(true);
      setErro(null);
      try {
        const serie = ApiService.getSerie(survey);
        const lista: Aplicacao[] = [];
        for (const s of serie) {
          await ApiService.fetchSurveyDetail(s.id);
          const dados = ApiService.getSurvey(s.id);
          const resp = ApiService.getSurveyResponses(s.id);
          if (dados) {
            lista.push({ survey: s, rotulo: rotuloData(s), questions: dados.questions, options: dados.options, respondents: resp.respondents, answers: resp.answers });
          }
        }
        if (ativo) setAplicacoes(lista);
      } catch (err: any) {
        if (ativo) setErro(err.message || 'Não foi possível carregar as aplicações.');
      } finally {
        if (ativo) setCarregando(false);
      }
    })();
    return () => { ativo = false; };
  }, [survey.id]);

  const analise = useMemo(() => {
    if (aplicacoes.length < 2) return null;
    const comEscala = aplicacoes.map((a) => ({ a, escala: detectarEscala(a.questions, a.options) }));

    if (comEscala.every((x) => x.escala)) {
      const matrizes = comEscala.map(({ a, escala }) => ({ a, m: montarMatriz(escala!, a.options, a.respondents, a.answers) }));
      const ultima = matrizes[matrizes.length - 1];
      const capacidades = ultima.m.escala.questoes.map((q, idx) => {
        const chave = normalizarNome(q.titulo);
        const medias = matrizes.map(({ m }) => {
          const qq = m.escala.questoes.find((x) => normalizarNome(x.titulo) === chave);
          return qq ? m.mediaPorQuestao[qq.id] || 0 : 0;
        });
        const validas = medias.filter((v) => v > 0);
        const delta = validas.length >= 2 ? medias[medias.length - 1] - medias.find((v) => v > 0)! : null;
        return { codigo: `C${idx + 1}`, titulo: q.titulo, medias, delta };
      });

      // Pessoas presentes em 2+ aplicações
      const porPessoa = new Map<string, { nome: string; medias: (number | undefined)[] }>();
      matrizes.forEach(({ m }, i) => {
        m.pessoas.forEach((p) => {
          const chave = normalizarNome(p.nome);
          const item = porPessoa.get(chave) || { nome: p.nome, medias: new Array(matrizes.length).fill(undefined) };
          item.medias[i] = m.mediaPorPessoa[p.id] || undefined;
          item.nome = p.nome;
          porPessoa.set(chave, item);
        });
      });
      const pessoas = [...porPessoa.values()]
        .filter((p) => p.medias.filter((v) => v && v > 0).length >= 2)
        .map((p) => {
          const vals = p.medias.filter((v): v is number => !!v && v > 0);
          return { ...p, delta: vals[vals.length - 1] - vals[0] };
        })
        .sort((x, y) => y.delta - x.delta);

      return {
        tipo: 'escala' as const,
        niveis: ultima.m.escala.niveis.map(rotuloCurtoNivel),
        // Aplicação ainda sem respostas fica sem ponto no gráfico (em vez de cair para zero)
        geral: matrizes.map(({ a, m }, i) => ({
          aplicacao: `${i + 1}ª · ${a.rotulo}`,
          media: m.mediaGeral > 0 ? Number(m.mediaGeral.toFixed(2)) : null,
          pessoas: m.pessoas.length
        })),
        capacidades,
        pessoas
      };
    }

    // Sem escala: opção mais escolhida por pergunta em cada aplicação
    const base = aplicacoes[aplicacoes.length - 1];
    const perguntas = base.questions
      .filter((q) => q.tipo === 'single_choice' || q.tipo === 'multiple_choice' || q.tipo === 'scale' || q.tipo === 'rating')
      .map((q) => {
        const chave = normalizarNome(q.titulo);
        const porAplicacao = aplicacoes.map((a) => {
          const qq = a.questions.find((x) => normalizarNome(x.titulo) === chave);
          if (!qq) return null;
          const respostas = a.answers.filter((ans) => ans.question_id === qq.id);
          const total = new Set(respostas.map((r) => r.respondent_id)).size;
          if (!total) return null;
          const contagem = new Map<string, number>();
          respostas.forEach((r) => contagem.set(r.valor, (contagem.get(r.valor) || 0) + 1));
          const [texto, qtd] = [...contagem.entries()].sort((x, y) => y[1] - x[1])[0];
          return { texto, pct: Math.round((qtd / total) * 100) };
        });
        return { titulo: q.titulo, porAplicacao };
      });
    return { tipo: 'geral' as const, perguntas };
  }, [aplicacoes]);

  if (carregando) {
    return <div className="bg-white rounded-3xl border border-slate-200 p-10 flex justify-center"><Loader2 className="w-6 h-6 text-blue-600 animate-spin" /></div>;
  }
  if (erro) return <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl px-4 py-3">{erro}</div>;
  if (!analise) {
    return (
      <div className="bg-white rounded-3xl border border-slate-200 p-8 text-center text-sm text-slate-500">
        Ainda não há outra aplicação desta pesquisa para comparar. Use "Reaplicar pesquisa" no menu ⋮ da lista.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Aplicações */}
      <div className="bg-white rounded-3xl border border-slate-200 p-5">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-3">
          <TrendingUp className="w-4 h-4 text-blue-600" /> Aplicações comparadas
        </h3>
        <div className="flex flex-wrap gap-2">
          {aplicacoes.map((a, i) => (
            <div key={a.survey.id} className={`px-3 py-2 rounded-xl border text-xs ${a.survey.id === survey.id ? 'border-blue-400 bg-blue-50' : 'border-slate-200'}`}>
              <div className="font-bold text-slate-800">{i + 1}ª aplicação · {a.rotulo}</div>
              <div className="text-[11px] text-slate-500">{a.respondents.length} respostas · {a.survey.status}</div>
            </div>
          ))}
        </div>
      </div>

      {analise.tipo === 'escala' ? (
        <>
          <div className="bg-white rounded-3xl border border-slate-200 p-5">
            <h3 className="text-sm font-bold text-slate-900 mb-3">Média geral da equipe por aplicação</h3>
            <div style={{ width: '100%', height: 220 }}>
              <ResponsiveContainer>
                <LineChart data={analise.geral}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="aplicacao" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, analise.niveis.length]} tickCount={analise.niveis.length + 1} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: any) => [v === null ? 'sem respostas' : String(v).replace('.', ','), 'Média']} />
                  <Line type="monotone" dataKey="media" stroke="#2563eb" strokeWidth={3} dot={{ r: 5 }} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden">
            <div className="p-5 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">Evolução por capacidade</h3>
              <p className="text-[11px] text-slate-500">Média da equipe em cada aplicação e a variação entre a primeira e a última.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="text-left px-4 py-2 text-slate-500">Capacidade</th>
                    {aplicacoes.map((a, i) => <th key={a.survey.id} className="px-3 py-2 text-slate-500 whitespace-nowrap">{i + 1}ª · {a.rotulo}</th>)}
                    <th className="px-3 py-2 text-slate-700">Variação</th>
                  </tr>
                </thead>
                <tbody>
                  {[...analise.capacidades].sort((x, y) => (y.delta ?? -99) - (x.delta ?? -99)).map((c) => (
                    <tr key={c.codigo} className="border-t border-slate-100">
                      <td className="px-4 py-2 text-slate-700"><strong>{c.codigo}</strong> · {c.titulo}</td>
                      {c.medias.map((m, i) => <td key={i} className="px-3 py-2 text-center font-semibold text-slate-800">{fmt(m)}</td>)}
                      <td className="px-3 py-2 text-center"><Delta v={c.delta} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden">
            <div className="p-5 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2"><Users className="w-4 h-4 text-indigo-600" /> Evolução por pessoa</h3>
              <p className="text-[11px] text-slate-500">Quem respondeu em mais de uma aplicação (o nome é comparado sem acentos e maiúsculas).</p>
            </div>
            {analise.pessoas.length === 0 ? (
              <p className="p-5 text-xs text-slate-500">Ninguém respondeu em mais de uma aplicação ainda.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="text-left px-4 py-2 text-slate-500">Pessoa</th>
                      {aplicacoes.map((a, i) => <th key={a.survey.id} className="px-3 py-2 text-slate-500 whitespace-nowrap">{i + 1}ª · {a.rotulo}</th>)}
                      <th className="px-3 py-2 text-slate-700">Variação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analise.pessoas.map((p) => (
                      <tr key={p.nome} className="border-t border-slate-100">
                        <td className="px-4 py-2 font-semibold text-slate-800">{p.nome}</td>
                        {p.medias.map((m, i) => <td key={i} className="px-3 py-2 text-center text-slate-800">{fmt(m)}</td>)}
                        <td className="px-3 py-2 text-center"><Delta v={p.delta} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden">
          <div className="p-5 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-900">Opção mais escolhida em cada aplicação</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left px-4 py-2 text-slate-500">Pergunta</th>
                  {aplicacoes.map((a, i) => <th key={a.survey.id} className="px-3 py-2 text-slate-500 whitespace-nowrap">{i + 1}ª · {a.rotulo}</th>)}
                </tr>
              </thead>
              <tbody>
                {analise.perguntas.map((p) => (
                  <tr key={p.titulo} className="border-t border-slate-100 align-top">
                    <td className="px-4 py-2 text-slate-700">{p.titulo}</td>
                    {p.porAplicacao.map((r, i) => (
                      <td key={i} className="px-3 py-2 text-slate-800">
                        {r ? <><span className="font-semibold">{r.texto}</span> <span className="text-slate-500">({r.pct}%)</span></> : <span className="text-slate-300">—</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
