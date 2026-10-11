import React, { useMemo, useState } from 'react';
import { UsersRound, UserX, UserCheck, HelpCircle, Copy, Check, Pencil, Loader2, AlertTriangle } from 'lucide-react';
import { Respondent } from '../../types';
import { calcularAdesao, detectarDuplicadas } from '../../services/analiseAvancada';

interface AdesaoViewProps {
  respondents: Respondent[];
  publicoEsperado: string[];
  podeEditar: boolean;
  onSalvarPublico: (lista: string[]) => Promise<void>;
}

/**
 * Adesão: compara quem respondeu com a lista de pessoas esperadas (colada pelo
 * responsável) e mostra quem ainda falta responder.
 */
export const AdesaoView: React.FC<AdesaoViewProps> = ({ respondents, publicoEsperado, podeEditar, onSalvarPublico }) => {
  const [editando, setEditando] = useState(publicoEsperado.length === 0);
  const [texto, setTexto] = useState(publicoEsperado.join('\n'));
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  const resultado = useMemo(() => calcularAdesao(publicoEsperado, respondents), [publicoEsperado, respondents]);
  const duplicadas = useMemo(() => detectarDuplicadas(respondents), [respondents]);

  const handleSalvar = async () => {
    const lista = Array.from(new Set(texto.split('\n').map((l) => l.trim()).filter(Boolean)));
    setSalvando(true);
    setErro(null);
    try {
      await onSalvarPublico(lista);
      setEditando(false);
    } catch (err: any) {
      setErro(err.message || 'Não foi possível salvar a lista.');
    } finally {
      setSalvando(false);
    }
  };

  const copiarFaltantes = () => {
    navigator.clipboard.writeText(resultado.faltam.join('\n'));
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  const cor = resultado.percentual >= 80 ? 'bg-emerald-500' : resultado.percentual >= 50 ? 'bg-amber-500' : 'bg-rose-500';

  return (
    <div className="space-y-5">
      {duplicadas.size > 0 && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <span>
            <strong>{duplicadas.size} respostas</strong> parecem ser da mesma pessoa (mesmo nome ou identificador). Confira na aba
            "Respostas Individuais", onde elas aparecem marcadas como possível duplicada.
          </span>
        </div>
      )}

      {editando ? (
        <div className="bg-white rounded-3xl border border-slate-200 p-5 space-y-3">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <UsersRound className="w-4 h-4 text-blue-600" /> Público esperado
          </h3>
          {podeEditar ? (
            <>
              <p className="text-xs text-slate-500">
                Cole os nomes de quem deve responder, <strong>um por linha</strong>. O app compara com os nomes informados nas
                respostas (ignorando acentos e maiúsculas, e aceitando nome incompleto, como "Josiel" × "Josiel Rodrigues").
              </p>
              <textarea
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                rows={10}
                placeholder={'Ex.:\nJosiel Rodrigues\nElessandra Daniela Zidek Backes\nCamila Sidegum'}
                className="w-full text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
              {erro && <div className="bg-red-50 border border-red-200 text-red-700 text-xs font-medium rounded-xl px-3 py-2">{erro}</div>}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSalvar}
                  disabled={salvando}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-2 disabled:opacity-60"
                >
                  {salvando && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Salvar lista ({texto.split('\n').filter((l) => l.trim()).length} nomes)</span>
                </button>
                {publicoEsperado.length > 0 && (
                  <button onClick={() => setEditando(false)} className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-semibold hover:bg-slate-50">
                    Cancelar
                  </button>
                )}
              </div>
            </>
          ) : (
            <p className="text-xs text-slate-500">O responsável pela pesquisa ainda não informou a lista de pessoas esperadas.</p>
          )}
        </div>
      ) : (
        <>
          <div className="bg-white rounded-3xl border border-slate-200 p-5 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Adesão</span>
                <div className="text-3xl font-extrabold text-slate-900">{resultado.percentual}%</div>
                <span className="text-xs text-slate-500">
                  {resultado.responderam.length} de {resultado.esperados.length} pessoas esperadas responderam
                </span>
              </div>
              {podeEditar && (
                <button
                  onClick={() => setEditando(true)}
                  className="px-3 py-2 rounded-xl border border-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1.5 hover:bg-slate-50"
                >
                  <Pencil className="w-3.5 h-3.5" /> Editar lista
                </button>
              )}
            </div>
            <div className="h-3 rounded-full bg-slate-100 overflow-hidden">
              <div className={`h-full ${cor} transition-all`} style={{ width: `${resultado.percentual}%` }} />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="bg-white rounded-3xl border border-slate-200 p-5 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <UserX className="w-4 h-4 text-rose-600" /> Faltam responder ({resultado.faltam.length})
                </h3>
                {resultado.faltam.length > 0 && (
                  <button onClick={copiarFaltantes} title="Copiar nomes" className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100">
                    {copiado ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                  </button>
                )}
              </div>
              {resultado.faltam.length === 0 ? (
                <p className="text-xs text-emerald-700 font-semibold">Todos responderam. 🎉</p>
              ) : (
                <ul className="space-y-1">
                  {resultado.faltam.map((n) => <li key={n} className="text-xs text-slate-700">{n}</li>)}
                </ul>
              )}
            </div>

            <div className="bg-white rounded-3xl border border-slate-200 p-5 space-y-2">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-emerald-600" /> Responderam ({resultado.responderam.length})
              </h3>
              <ul className="space-y-1">
                {resultado.responderam.map((r) => (
                  <li key={r.respondente.id} className="text-xs text-slate-700">
                    {r.esperado}
                    {r.esperado.trim().toLowerCase() !== r.respondente.nome.trim().toLowerCase() && (
                      <span className="text-slate-400"> (respondeu como "{r.respondente.nome}")</span>
                    )}
                    <span className="text-slate-400"> · {r.respondente.data_resposta}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-white rounded-3xl border border-slate-200 p-5 space-y-2">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-amber-600" /> Fora da lista ({resultado.semCorrespondencia.length})
              </h3>
              <p className="text-[11px] text-slate-500">Responderam, mas o nome não bate com ninguém da lista (nome digitado diferente, teste ou pessoa não prevista).</p>
              <ul className="space-y-1">
                {resultado.semCorrespondencia.map((r) => (
                  <li key={r.id} className="text-xs text-slate-700">{r.nome} <span className="text-slate-400">· {r.data_resposta}</span></li>
                ))}
              </ul>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
