import React, { useEffect, useState } from 'react';
import {
  UserPlus,
  RotateCcw,
  ShieldCheck,
  User as UserIcon,
  Loader2,
  Copy,
  Check,
  Power,
  Pencil,
  Building2,
  MessageSquareText
} from 'lucide-react';
import { AuthService } from '../services/authService';
import { ApiService } from '../services/api';
import { AppUser, Department, UserRole, ROLE_LABELS } from '../types';

const DESCRICAO_PAPEL: Record<UserRole, string> = {
  admin: 'Vê e gerencia tudo, cria departamentos e usuários',
  gestor: 'Gerencia todas as pesquisas dos seus departamentos, inclusive as restritas',
  lider: 'Cria pesquisas e vê os resultados não restritos dos seus departamentos',
  especial: 'Vê somente as pesquisas liberadas para ele, sem editar'
};

const COR_PAPEL: Record<UserRole, string> = {
  admin: 'bg-indigo-100 text-indigo-700',
  gestor: 'bg-blue-100 text-blue-700',
  lider: 'bg-emerald-100 text-emerald-700',
  especial: 'bg-amber-100 text-amber-700'
};

const PAPEIS: UserRole[] = ['admin', 'gestor', 'lider', 'especial'];

function montarConvite(nome: string, email: string, senha: string, reset: boolean): string {
  const link = typeof window !== 'undefined' ? window.location.origin : '';
  const primeiroNome = (nome || '').split(' ')[0] || '';
  return [
    `Olá${primeiroNome ? ', ' + primeiroNome : ''}!`,
    reset ? 'Sua senha do PesquisaHub foi redefinida.' : 'Seu acesso ao PesquisaHub foi criado.',
    '',
    `Acesse: ${link}`,
    `E-mail: ${email}`,
    `Senha temporária: ${senha}`,
    '',
    'No primeiro acesso você vai cadastrar a sua senha definitiva.'
  ].join('\n');
}

/**
 * Tela de Usuários (somente Administrador): criar usuários, definir papel e
 * departamentos, redefinir senha, ativar/desativar e copiar o convite de acesso.
 */
export const UsersView: React.FC = () => {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal de criar / editar
  const [modo, setModo] = useState<'criar' | 'editar' | null>(null);
  const [editandoUser, setEditandoUser] = useState<AppUser | null>(null);
  const [formNome, setFormNome] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formRole, setFormRole] = useState<UserRole>('lider');
  const [formDeps, setFormDeps] = useState<string[]>([]);
  const [salvando, setSalvando] = useState(false);

  // Senha temporária / convite gerado
  const [convite, setConvite] = useState<{ nome: string; email: string; tempPassword: string; reset: boolean } | null>(null);
  const [copiado, setCopiado] = useState<'senha' | 'convite' | null>(null);

  const usuarioLogado = AuthService.getCurrentUser();

  const carregar = async () => {
    setLoading(true);
    setError(null);
    try {
      const [lista, deps] = await Promise.all([AuthService.listUsers(), ApiService.fetchDepartments()]);
      setUsers(lista);
      setDepartments(deps);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar usuários.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregar();
  }, []);

  const abrirCriar = () => {
    setModo('criar');
    setEditandoUser(null);
    setFormNome('');
    setFormEmail('');
    setFormRole('lider');
    setFormDeps(departments.filter((d) => d.ativo).length === 1 ? [departments.filter((d) => d.ativo)[0].id] : []);
  };

  const abrirEditar = (u: AppUser) => {
    setModo('editar');
    setEditandoUser(u);
    setFormNome(u.nome);
    setFormEmail(u.email);
    setFormRole(u.role);
    setFormDeps(u.departamentos || []);
  };

  const fecharModal = () => {
    setModo(null);
    setEditandoUser(null);
  };

  const alternarDep = (id: string) => {
    setFormDeps((prev) => (prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]));
  };

  const handleSalvar = async () => {
    setError(null);
    if (modo === 'criar' && (!formNome.trim() || !formEmail.trim())) {
      setError('Nome e e-mail são obrigatórios.');
      return;
    }
    if ((formRole === 'gestor' || formRole === 'lider') && formDeps.length === 0) {
      setError('Gestores e Líderes precisam de pelo menos um departamento.');
      return;
    }

    setSalvando(true);
    try {
      if (modo === 'criar') {
        const result = await AuthService.createUser(formNome.trim(), formEmail.trim(), formRole, formDeps);
        setConvite({ nome: formNome.trim(), email: formEmail.trim().toLowerCase(), tempPassword: result.tempPassword, reset: false });
      } else if (modo === 'editar' && editandoUser) {
        await AuthService.updateUserAccess(editandoUser.id, formRole, formDeps);
      }
      fecharModal();
      await carregar();
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar usuário.');
    } finally {
      setSalvando(false);
    }
  };

  const handleResetPassword = async (user: AppUser) => {
    if (!confirm(`Gerar uma nova senha temporária para ${user.email}?`)) return;
    try {
      const result = await AuthService.resetPassword(user.id);
      setConvite({ nome: user.nome, email: user.email, tempPassword: result.tempPassword, reset: true });
      await carregar();
    } catch (err: any) {
      setError(err.message || 'Erro ao redefinir senha.');
    }
  };

  const handleToggleActive = async (user: AppUser) => {
    const acao = user.ativo ? 'desativar' : 'reativar';
    if (!confirm(`Deseja ${acao} o acesso de ${user.email}?`)) return;
    try {
      await AuthService.toggleUserActive(user.id, !user.ativo);
      await carregar();
    } catch (err: any) {
      setError(err.message || 'Erro ao atualizar usuário.');
    }
  };

  const copiar = (tipo: 'senha' | 'convite') => {
    if (!convite) return;
    const texto = tipo === 'senha'
      ? convite.tempPassword
      : montarConvite(convite.nome, convite.email, convite.tempPassword, convite.reset);
    navigator.clipboard.writeText(texto);
    setCopiado(tipo);
    setTimeout(() => setCopiado(null), 2000);
  };

  const nomeDep = (id: string) => departments.find((d) => d.id === id)?.nome || 'Departamento removido';

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900">Usuários</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Defina o papel e os departamentos de cada pessoa. O acesso especial a uma pesquisa específica é liberado
            dentro da própria pesquisa (menu ⋮ → Acessos especiais).
          </p>
        </div>
        <button
          onClick={abrirCriar}
          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl flex items-center gap-2 shadow-md shadow-blue-500/20"
        >
          <UserPlus className="w-4 h-4" />
          <span>Novo Usuário</span>
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs font-medium rounded-xl px-4 py-3">
          {error}
        </div>
      )}

      {convite && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-3">
          <p className="text-xs font-bold text-amber-800">
            {convite.reset ? 'Nova senha temporária' : 'Acesso criado'} para {convite.email}
          </p>
          <p className="text-[11px] text-amber-700">
            Repasse a senha (ou o convite completo, pronto para WhatsApp). No primeiro acesso a pessoa cadastra a
            senha definitiva.
          </p>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <code className="flex-1 bg-white border border-amber-300 rounded-lg px-3 py-2 text-sm font-mono text-amber-900">
              {convite.tempPassword}
            </code>
            <button
              onClick={() => copiar('senha')}
              className="px-3 py-2 bg-white border border-amber-300 hover:bg-amber-100 text-amber-800 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5"
            >
              {copiado === 'senha' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiado === 'senha' ? 'Copiada' : 'Copiar senha'}</span>
            </button>
            <button
              onClick={() => copiar('convite')}
              className="px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5"
            >
              {copiado === 'convite' ? <Check className="w-3.5 h-3.5" /> : <MessageSquareText className="w-3.5 h-3.5" />}
              <span>{copiado === 'convite' ? 'Convite copiado' : 'Copiar convite'}</span>
            </button>
          </div>
          <button
            onClick={() => setConvite(null)}
            className="text-[11px] font-semibold text-amber-700 hover:text-amber-900"
          >
            Fechar
          </button>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-10 flex items-center justify-center">
            <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[720px]">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 text-[11px] font-bold text-slate-500 uppercase">Usuário</th>
                  <th className="text-left px-4 py-3 text-[11px] font-bold text-slate-500 uppercase">Papel</th>
                  <th className="text-left px-4 py-3 text-[11px] font-bold text-slate-500 uppercase">Departamentos</th>
                  <th className="text-left px-4 py-3 text-[11px] font-bold text-slate-500 uppercase">Status</th>
                  <th className="text-right px-4 py-3 text-[11px] font-bold text-slate-500 uppercase">Ações</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-slate-100 last:border-0 align-top">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-800">{u.nome}</div>
                      <div className="text-xs text-slate-500">{u.email}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-full whitespace-nowrap ${COR_PAPEL[u.role]}`}>
                        {u.role === 'admin' ? <ShieldCheck className="w-3 h-3" /> : <UserIcon className="w-3 h-3" />}
                        {ROLE_LABELS[u.role]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {(u.departamentos || []).length === 0 ? (
                        <span className="text-[11px] text-slate-400 italic">
                          {u.role === 'admin' ? 'Todos (administrador)' : 'Nenhum'}
                        </span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {(u.departamentos || []).map((id) => (
                            <span key={id} className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                              {nomeDep(id)}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[11px] font-bold px-2 py-1 rounded-full ${
                        u.ativo ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {u.ativo ? 'Ativo' : 'Desativado'}
                      </span>
                      {u.deve_trocar_senha && (
                        <div className="mt-1 text-[11px] font-semibold text-amber-600">Aguardando 1º acesso</div>
                      )}
                      {u.pedido_reset_em && (
                        <div
                          className="mt-1 text-[11px] font-semibold text-rose-600"
                          title="Clique no botão de redefinir senha para gerar uma senha temporária"
                        >
                          Pediu nova senha
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => abrirEditar(u)}
                          title="Editar papel e departamentos"
                          className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-blue-600"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleResetPassword(u)}
                          title="Gerar nova senha temporária"
                          className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-blue-600"
                        >
                          <RotateCcw className="w-4 h-4" />
                        </button>
                        {usuarioLogado?.id !== u.id && (
                          <button
                            onClick={() => handleToggleActive(u)}
                            title={u.ativo ? 'Desativar usuário' : 'Reativar usuário'}
                            className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-red-600"
                          >
                            <Power className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modo && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-slate-900">
              {modo === 'criar' ? 'Novo Usuário' : `Editar acesso — ${editandoUser?.nome}`}
            </h2>

            {modo === 'criar' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Nome</label>
                  <input
                    value={formNome}
                    onChange={(e) => setFormNome(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">E-mail</label>
                  <input
                    type="email"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Papel</label>
              <div className="space-y-1.5">
                {PAPEIS.map((p) => (
                  <label
                    key={p}
                    className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                      formRole === p ? 'border-blue-400 bg-blue-50/60' : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="papel"
                      checked={formRole === p}
                      onChange={() => setFormRole(p)}
                      disabled={modo === 'editar' && editandoUser?.id === usuarioLogado?.id && p !== 'admin'}
                      className="mt-0.5"
                    />
                    <span>
                      <span className="block text-xs font-bold text-slate-800">{ROLE_LABELS[p]}</span>
                      <span className="block text-[11px] text-slate-500">{DESCRICAO_PAPEL[p]}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5" /> Departamentos
              </label>
              <p className="text-[11px] text-slate-500 mb-2">
                {formRole === 'admin'
                  ? 'O administrador enxerga todos os departamentos. Os marcados aqui são onde ele cria pesquisas por padrão.'
                  : formRole === 'especial'
                  ? 'Opcional. Vincular ao departamento permite que o Gestor desse departamento libere pesquisas para esta pessoa.'
                  : 'A pessoa verá as pesquisas destes departamentos.'}
              </p>
              {departments.length === 0 ? (
                <p className="text-xs text-slate-400 italic">Nenhum departamento cadastrado.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {departments.map((d) => (
                    <label
                      key={d.id}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs cursor-pointer ${
                        formDeps.includes(d.id) ? 'border-blue-400 bg-blue-50/60 font-semibold text-slate-800' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      } ${!d.ativo ? 'opacity-60' : ''}`}
                    >
                      <input type="checkbox" checked={formDeps.includes(d.id)} onChange={() => alternarDep(d.id)} />
                      <span>{d.nome}{!d.ativo ? ' (desativado)' : ''}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={fecharModal}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSalvar}
                disabled={salvando}
                className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                <span>{modo === 'criar' ? 'Criar' : 'Salvar'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
