import React, { useMemo } from 'react';
import { Building2, AlertTriangle, Clock, CopyCheck, UserX, CheckCircle2 } from 'lucide-react';
import { Survey, Respondent, Department } from '../types';
import { calcularAdesao, detectarDuplicadas } from '../services/analiseAvancada';

interface PainelDepartamentosProps {
  surveys: Survey[];
  respondents: Respondent[];
  departments: Department[];
  onAbrirPesquisa: (surveyId: string) => void;
}

type Alerta = { tipo: 'adesao' | 'prazo' | 'duplicadas' | 'sem_respostas'; survey: Survey; texto: string };

function diasDesde(data?: string): number {
  if (!data) return 0;
  const d = new Date(data + 'T00:00:00');
  return Math.floor((Date.now() - d.getTime()) / 86400000);
}

function diasAte(data?: string): number {
  if (!data) return Infinity;
  const d = new Date(data + 'T23:59:59');
  return Math.ceil((d.getTime() - Date.now()) / 86400000);
}

/**
 * Painel por departamento: pesquisas abertas, respostas e adesão média de cada
 * departamento, mais alertas do que precisa de atenção.
 */
export const PainelDepartamentos: React.FC<PainelDepartamentosProps> = ({ surveys, respondents, departments, onAbrirPesquisa }) => {
  const { porDepartamento, alertas } = useMemo(() => {
    const respPorPesquisa = new Map<string, Respondent[]>();
    respondents.forEach((r) => respPorPesquisa.set(r.survey_id, [...(respPorPesquisa.get(r.survey_id) || []), r]));

    const adesaoDe = (s: Survey): number | null => {
      const lista = s.configuracoes?.publico_esperado || [];
      if (lista.length === 0) return null;
      return calcularAdesao(lista, respPorPesquisa.get(s.id) || []).percentual;
    };

    const alertas: Alerta[] = [];
    surveys
      .filter((s) => s.status === 'Publicada')
      .forEach((s) => {
        const resp = respPorPesquisa.get(s.id) || [];
        const adesao = adesaoDe(s);
        const aberta = diasDesde(s.data_inicio || s.data_criacao);
        const faltam = diasAte(s.data_fim);
        if (adesao !== null && adesao < 50 && aberta >= 3) {
          alertas.push({ tipo: 'adesao', survey: s, texto: `Adesão de ${adesao}% depois de ${aberta} dias aberta` });
        }
        if (faltam <= 2 && (adesao === null || adesao < 100)) {
          alertas.push({ tipo: 'prazo', survey: s, texto: faltam <= 0 ? 'Encerra hoje' : `Encerra em ${faltam} dia(s)${adesao !== null ? ` — adesão ${adesao}%` : ''}` });
        }
        if (resp.length === 0 && aberta >= 3) {
          alertas.push({ tipo: 'sem_respostas', survey: s, texto: `Publicada há ${aberta} dias e ainda sem respostas` });
        }
        const dup = detectarDuplicadas(resp).size;
        if (dup > 0) {
          alertas.push({ tipo: 'duplicadas', survey: s, texto: `${dup} respostas parecem duplicadas` });
        }
      });

    const porDepartamento = departments
      .map((d) => {
        const doDep = surveys.filter((s) => s.department_id === d.id);
        const publicadas = doDep.filter((s) => s.status === 'Publicada');
        const adesoes = publicadas.map(adesaoDe).filter((v): v is number => v !== null);
        return {
          d,
          total: doDep.length,
          publicadas: publicadas.length,
          respostas: doDep.reduce((soma, s) => soma + (respPorPesquisa.get(s.id)?.length || 0), 0),
          adesaoMedia: adesoes.length ? Math.round(adesoes.reduce((a, b) => a + b, 0) / adesoes.length) : null,
          alertas: alertas.filter((a) => a.survey.department_id === d.id).length
        };
      })
      .filter((x) => x.total > 0);

    return { porDepartamento, alertas };
  }, [surveys, respondents, departments]);

  if (porDepartamento.length === 0) return null;

  const icone = (t: Alerta['tipo']) =>
    t === 'adesao' ? <UserX className="w-4 h-4 text-rose-600" />
      : t === 'prazo' ? <Clock className="w-4 h-4 text-amber-600" />
      : t === 'duplicadas' ? <CopyCheck className="w-4 h-4 text-amber-600" />
      : <AlertTriangle className="w-4 h-4 text-slate-500" />;

  return (
    <div className="px-4 md:px-8 pt-4 max-w-7xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-blue-600" />
            <h3 className="text-sm font-bold text-slate-900">Por departamento</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="text-left px-5 py-2">Departamento</th>
                  <th className="px-3 py-2">Pesquisas</th>
                  <th className="px-3 py-2">Abertas</th>
                  <th className="px-3 py-2">Respostas</th>
                  <th className="px-3 py-2">Adesão média</th>
                  <th className="px-3 py-2">Alertas</th>
                </tr>
              </thead>
              <tbody>
                {porDepartamento.map((x) => (
                  <tr key={x.d.id} className="border-t border-slate-100">
                    <td className="px-5 py-2 font-semibold text-slate-800">{x.d.nome}</td>
                    <td className="px-3 py-2 text-center">{x.total}</td>
                    <td className="px-3 py-2 text-center">{x.publicadas}</td>
                    <td className="px-3 py-2 text-center">{x.respostas}</td>
                    <td className="px-3 py-2 text-center">
                      {x.adesaoMedia === null ? (
                        <span className="text-slate-400" title="Informe a lista de pessoas esperadas na aba Adesão das pesquisas">—</span>
                      ) : (
                        <span className={`font-bold ${x.adesaoMedia >= 80 ? 'text-emerald-700' : x.adesaoMedia >= 50 ? 'text-amber-700' : 'text-rose-700'}`}>
                          {x.adesaoMedia}%
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {x.alertas > 0 ? <span className="font-bold text-amber-700">{x.alertas}</span> : <span className="text-slate-400">0</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <h3 className="text-sm font-bold text-slate-900">Precisa de atenção ({alertas.length})</h3>
          </div>
          {alertas.length === 0 ? (
            <div className="p-5 text-xs text-emerald-700 font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" /> Nada pendente nas pesquisas abertas.
            </div>
          ) : (
            <ul className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
              {alertas.map((a, i) => (
                <li key={i}>
                  <button onClick={() => onAbrirPesquisa(a.survey.id)} className="w-full text-left px-5 py-2.5 hover:bg-slate-50 flex items-start gap-2.5">
                    {icone(a.tipo)}
                    <span className="min-w-0">
                      <span className="block text-xs font-semibold text-slate-800 truncate">{a.survey.titulo}</span>
                      <span className="block text-[11px] text-slate-500">{a.texto}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};
