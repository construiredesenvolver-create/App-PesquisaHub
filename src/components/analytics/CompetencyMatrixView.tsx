import React, { useMemo, useState } from 'react';
import { Grid3x3, TrendingDown, TrendingUp, Award, UserRound, X } from 'lucide-react';
import {
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Legend,
  Tooltip
} from 'recharts';
import { Question, Option, Respondent, Answer } from '../../types';
import { EscalaDetectada, montarMatriz, rotuloCurtoNivel, paletaNiveis } from '../../services/analiseAvancada';

interface CompetencyMatrixViewProps {
  escala: EscalaDetectada;
  options: Option[];
  respondents: Respondent[];
  answers: Answer[];
}

const fmt = (v: number) => (v > 0 ? v.toFixed(1).replace('.', ',') : '—');

/**
 * Matriz de Competências: mapa de calor pessoas × capacidades, lacunas da equipe,
 * pontos fortes, referências (quem pode ensinar) e radar individual.
 */
export const CompetencyMatrixView: React.FC<CompetencyMatrixViewProps> = ({ escala, options, respondents, answers }) => {
  const [ordenacao, setOrdenacao] = useState<'nome' | 'media'>('media');
  const [pessoaSelecionada, setPessoaSelecionada] = useState<Respondent | null>(null);

  const matriz = useMemo(
    () => montarMatriz(escala, options, respondents, answers),
    [escala, options, respondents, answers]
  );

  const N = escala.niveis.length;
  const cores = paletaNiveis(N);
  const rotulos = escala.niveis.map(rotuloCurtoNivel);
  const codigo = (idx: number) => `C${idx + 1}`;

  const pessoasOrdenadas = [...matriz.pessoas].sort((a, b) =>
    ordenacao === 'nome'
      ? a.nome.localeCompare(b.nome)
      : (matriz.mediaPorPessoa[b.id] || 0) - (matriz.mediaPorPessoa[a.id] || 0)
  );

  const questoesComMedia = escala.questoes
    .map((q, idx) => ({ q, idx, media: matriz.mediaPorQuestao[q.id] || 0 }))
    .filter((x) => x.media > 0);
  const lacunas = [...questoesComMedia].sort((a, b) => a.media - b.media).slice(0, 5);
  const fortes = [...questoesComMedia].sort((a, b) => b.media - a.media).slice(0, 5);

  // Referências: quem marcou o nível máximo nas capacidades com maior lacuna
  const referenciasNasLacunas = lacunas.map((l) => ({
    ...l,
    pessoas: matriz.pessoas.filter((p) => matriz.nivel[p.id][l.q.id] === N)
  }));

  const dadosRadar = pessoaSelecionada
    ? escala.questoes.map((q, idx) => ({
        capacidade: codigo(idx),
        titulo: q.titulo,
        Equipe: Number((matriz.mediaPorQuestao[q.id] || 0).toFixed(2)),
        [pessoaSelecionada.nome]: matriz.nivel[pessoaSelecionada.id][q.id] || 0
      }))
    : [];

  if (respondents.length === 0) {
    return (
      <div className="bg-white rounded-3xl border border-slate-200 p-10 text-center text-sm text-slate-500">
        Ainda não há respostas para montar a matriz.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Resumo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-slate-200/90">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Média da equipe</span>
          <div className="text-2xl font-extrabold text-slate-900">{fmt(matriz.mediaGeral)}<span className="text-sm text-slate-400 font-bold"> / {N}</span></div>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-slate-200/90">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Pessoas</span>
          <div className="text-2xl font-extrabold text-slate-900">{matriz.pessoas.length}</div>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-slate-200/90">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Capacidades</span>
          <div className="text-2xl font-extrabold text-slate-900">{escala.questoes.length}</div>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-slate-200/90">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Escala</span>
          <div className="flex flex-wrap gap-1 mt-1.5">
            {rotulos.map((r, i) => (
              <span key={i} className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: cores[i].fundo, color: cores[i].texto }}>
                {i + 1} {r}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Lacunas e pontos fortes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-3xl border border-slate-200 p-5 space-y-3">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <TrendingDown className="w-4 h-4 text-rose-600" /> Maiores lacunas — prioridade de treinamento
          </h3>
          <ul className="space-y-2.5">
            {referenciasNasLacunas.map((l) => {
              const dist = matriz.distribuicaoPorQuestao[l.q.id];
              const total = dist.reduce((s, v) => s + v, 0) || 1;
              return (
                <li key={l.q.id} className="space-y-1">
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-xs text-slate-700"><strong className="text-slate-900">{codigo(l.idx)}</strong> · {l.q.titulo}</span>
                    <span className="text-xs font-extrabold text-rose-700 shrink-0">{fmt(l.media)}</span>
                  </div>
                  <div className="flex h-2 rounded-full overflow-hidden bg-slate-100">
                    {dist.map((v, i) => (
                      <div key={i} style={{ width: `${(v / total) * 100}%`, background: cores[i].fundo }} title={`${rotulos[i]}: ${v}`} />
                    ))}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {l.pessoas.length > 0 ? (
                      <>Pode ensinar: <strong className="text-slate-700">{l.pessoas.map((p) => p.nome.split(' ')[0]).join(', ')}</strong></>
                    ) : (
                      <>Ninguém se declarou {rotulos[N - 1]} — avaliar treinamento externo.</>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="bg-white rounded-3xl border border-slate-200 p-5 space-y-3">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-600" /> Pontos fortes da equipe
          </h3>
          <ul className="space-y-2.5">
            {fortes.map((f) => {
              const dist = matriz.distribuicaoPorQuestao[f.q.id];
              const total = dist.reduce((s, v) => s + v, 0) || 1;
              return (
                <li key={f.q.id} className="space-y-1">
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-xs text-slate-700"><strong className="text-slate-900">{codigo(f.idx)}</strong> · {f.q.titulo}</span>
                    <span className="text-xs font-extrabold text-emerald-700 shrink-0">{fmt(f.media)}</span>
                  </div>
                  <div className="flex h-2 rounded-full overflow-hidden bg-slate-100">
                    {dist.map((v, i) => (
                      <div key={i} style={{ width: `${(v / total) * 100}%`, background: cores[i].fundo }} title={`${rotulos[i]}: ${v}`} />
                    ))}
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="text-[11px] text-slate-400 flex items-center gap-1.5 pt-1">
            <Award className="w-3.5 h-3.5" /> Clique no nome de alguém na matriz para ver o radar individual (bom para PDI).
          </p>
        </div>
      </div>

      {/* Radar individual */}
      {pessoaSelecionada && (
        <div className="bg-white rounded-3xl border border-slate-200 p-5 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <UserRound className="w-4 h-4 text-indigo-600" /> {pessoaSelecionada.nome} × média da equipe
              <span className="text-xs font-semibold text-slate-500">
                (média {fmt(matriz.mediaPorPessoa[pessoaSelecionada.id] || 0)})
              </span>
            </h3>
            <button onClick={() => setPessoaSelecionada(null)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100" aria-label="Fechar">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div style={{ width: '100%', height: 420 }}>
            <ResponsiveContainer>
              <RadarChart data={dadosRadar} outerRadius="75%">
                <PolarGrid />
                <PolarAngleAxis dataKey="capacidade" tick={{ fontSize: 10 }} />
                <PolarRadiusAxis domain={[0, N]} tickCount={N + 1} tick={{ fontSize: 9 }} />
                <Radar name="Equipe" dataKey="Equipe" stroke="#94a3b8" fill="#94a3b8" fillOpacity={0.25} />
                <Radar name={pessoaSelecionada.nome} dataKey={pessoaSelecionada.nome} stroke="#4f46e5" fill="#4f46e5" fillOpacity={0.3} />
                <Tooltip
                  formatter={(v: any, nome: any) => [String(v).replace('.', ','), nome]}
                  labelFormatter={(rotulo: any) => {
                    const item = dadosRadar.find((d) => d.capacidade === rotulo);
                    return item ? `${rotulo} · ${item.titulo}` : rotulo;
                  }}
                />
                <Legend />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Mapa de calor */}
      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden">
        <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Grid3x3 className="w-4 h-4 text-blue-600" /> Mapa de calor — pessoas × capacidades
          </h3>
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-slate-500 mr-1">Ordenar por</span>
            {(['media', 'nome'] as const).map((o) => (
              <button
                key={o}
                onClick={() => setOrdenacao(o)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold ${ordenacao === o ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              >
                {o === 'media' ? 'Média' : 'Nome'}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="text-[11px] border-collapse">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 bg-slate-50 text-left px-3 py-2 font-bold text-slate-500 border-b border-slate-200 min-w-[180px]">Pessoa</th>
                {escala.questoes.map((q, idx) => (
                  <th key={q.id} title={q.titulo} className="px-1 py-2 font-bold text-slate-500 border-b border-slate-200 bg-slate-50 min-w-[34px] cursor-help">
                    {codigo(idx)}
                  </th>
                ))}
                <th className="px-3 py-2 font-bold text-slate-700 border-b border-slate-200 bg-slate-100">Média</th>
              </tr>
            </thead>
            <tbody>
              {pessoasOrdenadas.map((p) => (
                <tr key={p.id} className={pessoaSelecionada?.id === p.id ? 'outline outline-2 outline-indigo-400' : ''}>
                  <td className="sticky left-0 z-10 bg-white px-3 py-1.5 border-b border-slate-100 whitespace-nowrap">
                    <button onClick={() => setPessoaSelecionada(p)} className="font-semibold text-slate-800 hover:text-indigo-600 text-left">
                      {p.nome}
                    </button>
                  </td>
                  {escala.questoes.map((q) => {
                    const v = matriz.nivel[p.id][q.id] || 0;
                    return (
                      <td
                        key={q.id}
                        title={v ? `${q.titulo}\n${v} — ${rotulos[v - 1]}` : `${q.titulo}\nSem resposta`}
                        className="text-center font-bold border border-white"
                        style={v ? { background: cores[v - 1].fundo, color: cores[v - 1].texto } : { background: '#f8fafc', color: '#cbd5e1' }}
                      >
                        {v || '·'}
                      </td>
                    );
                  })}
                  <td className="px-3 py-1.5 text-center font-extrabold text-slate-800 bg-slate-50 border-b border-slate-100">
                    {fmt(matriz.mediaPorPessoa[p.id] || 0)}
                  </td>
                </tr>
              ))}
              <tr>
                <td className="sticky left-0 z-10 bg-slate-100 px-3 py-2 font-extrabold text-slate-700">Média da capacidade</td>
                {escala.questoes.map((q) => (
                  <td key={q.id} className="text-center font-extrabold text-slate-700 bg-slate-100 px-1 py-2">
                    {fmt(matriz.mediaPorQuestao[q.id] || 0)}
                  </td>
                ))}
                <td className="text-center font-extrabold text-slate-900 bg-slate-200 px-3 py-2">{fmt(matriz.mediaGeral)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Legenda das capacidades */}
        <details className="border-t border-slate-100">
          <summary className="px-5 py-3 text-xs font-semibold text-slate-600 cursor-pointer hover:bg-slate-50">
            Ver legenda das capacidades (C1 a {codigo(escala.questoes.length - 1)})
          </summary>
          <ol className="px-5 pb-4 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1">
            {escala.questoes.map((q, idx) => (
              <li key={q.id} className="text-[11px] text-slate-600">
                <strong className="text-slate-800">{codigo(idx)}</strong> · {q.titulo}
              </li>
            ))}
          </ol>
        </details>
      </div>
    </div>
  );
};
