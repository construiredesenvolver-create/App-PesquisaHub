import React, { useEffect, useState } from 'react';
import { X, KeyRound, Loader2, Trash2, Plus, Download } from 'lucide-react';
import { ApiService } from '../services/api';
import { AuthService } from '../services/authService';
import { AppUser, Survey, SurveyAccessGrant, ROLE_LABELS } from '../types';

interface AcessoEspecialModalProps {
  survey: Survey;
  onClose: () => void;
}

/**
 * Libera os resultados de UMA pesquisa para pessoas específicas (normalmente
 * Colaboradores com acesso especial). A pessoa passa a ver só esta pesquisa,
 * em modo somente leitura; a exportação (CSV/PDF) é opcional.
 */
export const AcessoEspecialModal: React.FC<AcessoEspecialModalProps> = ({ survey, onClose }) => {
  const [acessos, setAcessos] = useState<SurveyAccessGrant[]>([]);
  const [usuarios, setUsuarios] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selecionado, setSelecionado] = useState('');
  const [podeExportar, setPodeExportar] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const usuarioLogado = AuthService.getCurrentUser();

  const carregar = async () => {
    setLoading(true);
    setError(null);
    try {
      const [lista, users] = await Promise.all([ApiService.listSurveyAccess(survey.id), AuthService.listUsers()]);
      setAcessos(lista);
      setUsuarios(users.filter((u) => u.ativo && u.id !== usuarioLogado?.id));
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar acessos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregar();
  }, [survey.id]);

  const jaLiberados = new Set(acessos.map((a) => a.user_id));
  // Admins e Gestores já enxergam por conta do papel: a lista prioriza quem precisa de liberação
  const candidatos = usuarios
    .filter((u) => !jaLiberados.has(u.id) && u.role !== 'admin')
    .sort((a, b) => (a.role === 'especial' ? -1 : 1) - (b.role === 'especial' ? -1 : 1) || a.nome.localeCompare(b.nome));

  const handleLiberar = async () => {
    if (!selecionado) return;
    setSalvando(true);
    setError(null);
    try {
      await ApiService.grantSurveyAccess(survey.id, selecionado, podeExportar);
      setSelecionado('');
      setPodeExportar(false);
      await carregar();
    } catch (err: any) {
      setError(err.message || 'Erro ao liberar acesso.');
    } finally {
      setSalvando(false);
    }
  };

  const handleAlternarExportar = async (a: SurveyAccessGrant) => {
    setError(null);
    try {
      await ApiService.grantSurveyAccess(survey.id, a.user_id, !a.pode_exportar);
      await carregar();
    } catch (err: any) {
      setError(err.message || 'Erro ao atualizar acesso.');
    }
  };

  const handleRemover = async (a: SurveyAccessGrant) => {
    const u = usuarios.find((x) => x.id === a.user_id);
    if (!confirm(`Remover o acesso de ${u?.nome || 'esta pessoa'} a esta pesquisa?`)) return;
    setError(null);
    try {
      await ApiService.revokeSurveyAccess(survey.id, a.user_id);
      await carregar();
    } catch (err: any) {
      setError(err.message || 'Erro ao remover acesso.');
    }
  };

  const descreverUsuario = (id: string) => {
    const u = usuarios.find((x) => x.id === id);
    return u ? { nome: u.nome, detalhe: `${u.email} · ${ROLE_LABELS[u.role]}` } : { nome: 'Usuário', detalhe: 'fora da sua lista de usuários' };
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-amber-600" /> Acessos especiais
            </h2>
            <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{survey.titulo}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100" aria-label="Fechar">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-[11px] text-slate-500 leading-relaxed">
          Quem receber o acesso verá apenas os resultados desta pesquisa, sem poder editar. Administradores e Gestores
          do departamento já enxergam a pesquisa pelo próprio papel.
        </p>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-xs font-medium rounded-xl px-3 py-2">{error}</div>
        )}

        {loading ? (
          <div className="py-8 flex justify-center">
            <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
          </div>
        ) : (
          <>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
              <label className="block text-xs font-bold text-slate-700">Liberar para</label>
              {candidatos.length === 0 ? (
                <p className="text-[11px] text-slate-500">
                  Não há mais pessoas disponíveis. Para liberar a alguém novo, cadastre-o em Usuários (papel "Acesso
                  especial"){usuarioLogado?.role === 'gestor' ? ' e peça ao administrador para vinculá-lo ao seu departamento' : ''}.
                </p>
              ) : (
                <>
                  <select
                    value={selecionado}
                    onChange={(e) => setSelecionado(e.target.value)}
                    className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  >
                    <option value="">Selecione uma pessoa…</option>
                    {candidatos.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.nome} — {ROLE_LABELS[u.role]}
                      </option>
                    ))}
                  </select>
                  <label className="flex items-center gap-2 text-xs text-slate-700">
                    <input type="checkbox" checked={podeExportar} onChange={(e) => setPodeExportar(e.target.checked)} />
                    Pode exportar (CSV e PDF)
                  </label>
                  <button
                    onClick={handleLiberar}
                    disabled={!selecionado || salvando}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl flex items-center gap-2 disabled:opacity-50"
                  >
                    {salvando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                    <span>Liberar acesso</span>
                  </button>
                </>
              )}
            </div>

            <div>
              <h3 className="text-xs font-bold text-slate-700 mb-2">Com acesso ({acessos.length})</h3>
              {acessos.length === 0 ? (
                <p className="text-[11px] text-slate-400 italic">Ninguém recebeu acesso especial a esta pesquisa.</p>
              ) : (
                <ul className="space-y-1.5">
                  {acessos.map((a) => {
                    const info = descreverUsuario(a.user_id);
                    return (
                      <li key={a.user_id} className="flex items-center gap-3 p-2.5 rounded-xl border border-slate-200">
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-bold text-slate-800 truncate">{info.nome}</div>
                          <div className="text-[11px] text-slate-500 truncate">{info.detalhe}</div>
                        </div>
                        <button
                          onClick={() => handleAlternarExportar(a)}
                          title={a.pode_exportar ? 'Pode exportar (clique para bloquear)' : 'Não pode exportar (clique para permitir)'}
                          className={`px-2 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 border ${
                            a.pode_exportar ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-slate-50 border-slate-200 text-slate-500'
                          }`}
                        >
                          <Download className="w-3 h-3" />
                          {a.pode_exportar ? 'Exporta' : 'Só vê'}
                        </button>
                        <button
                          onClick={() => handleRemover(a)}
                          title="Remover acesso"
                          className="p-1.5 rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
