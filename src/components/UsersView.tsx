import React, { useEffect, useState } from 'react';
import { UserPlus, RotateCcw, ShieldCheck, User as UserIcon, Loader2, Copy, Check, Power } from 'lucide-react';
import { AuthService } from '../services/authService';
import { AppUser } from '../types';

export const UsersView: React.FC = () => {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [novoNome, setNovoNome] = useState('');
  const [novoEmail, setNovoEmail] = useState('');
  const [novoRole, setNovoRole] = useState<'admin' | 'user'>('user');
  const [creating, setCreating] = useState(false);

  const [tempPasswordInfo, setTempPasswordInfo] = useState<{ email: string; tempPassword: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const loadUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await AuthService.listUsers();
      setUsers(list);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar usuários.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      const result = await AuthService.createUser(novoNome.trim(), novoEmail.trim(), novoRole);
      setTempPasswordInfo({ email: novoEmail.trim(), tempPassword: result.tempPassword });
      setShowCreateModal(false);
      setNovoNome('');
      setNovoEmail('');
      setNovoRole('user');
      await loadUsers();
    } catch (err: any) {
      setError(err.message || 'Erro ao criar usuário.');
    } finally {
      setCreating(false);
    }
  };

  const handleResetPassword = async (user: AppUser) => {
    if (!confirm(`Forçar redefinição de senha para ${user.email}?`)) return;
    try {
      const result = await AuthService.resetPassword(user.id);
      setTempPasswordInfo({ email: user.email, tempPassword: result.tempPassword });
      await loadUsers();
    } catch (err: any) {
      setError(err.message || 'Erro ao redefinir senha.');
    }
  };

  const handleToggleActive = async (user: AppUser) => {
    const acao = user.ativo ? 'desativar' : 'reativar';
    if (!confirm(`Deseja ${acao} o acesso de ${user.email}?`)) return;
    try {
      await AuthService.toggleUserActive(user.id, !user.ativo);
      await loadUsers();
    } catch (err: any) {
      setError(err.message || 'Erro ao atualizar usuário.');
    }
  };

  const handleCopyTemp = () => {
    if (!tempPasswordInfo) return;
    navigator.clipboard.writeText(tempPasswordInfo.tempPassword);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="p-4 sm:p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900">Usuários</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Cadastre novos usuários. Cada um enxerga apenas as próprias pesquisas.
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
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

      {tempPasswordInfo && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-2">
          <p className="text-xs font-bold text-amber-800">
            Senha temporária para {tempPasswordInfo.email}
          </p>
          <p className="text-[11px] text-amber-700">
            Também enviamos essa senha por e-mail. Se preferir, copie e repasse manualmente. O usuário precisará trocá-la no próximo acesso.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-white border border-amber-300 rounded-lg px-3 py-2 text-sm font-mono text-amber-900">
              {tempPasswordInfo.tempPassword}
            </code>
            <button
              onClick={handleCopyTemp}
              className="px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copiado' : 'Copiar'}</span>
            </button>
          </div>
          <button
            onClick={() => setTempPasswordInfo(null)}
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
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 text-[11px] font-bold text-slate-500 uppercase">Usuário</th>
                <th className="text-left px-4 py-3 text-[11px] font-bold text-slate-500 uppercase">Perfil</th>
                <th className="text-left px-4 py-3 text-[11px] font-bold text-slate-500 uppercase">Status</th>
                <th className="text-right px-4 py-3 text-[11px] font-bold text-slate-500 uppercase">Ações</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-slate-800">{u.nome}</div>
                    <div className="text-xs text-slate-500">{u.email}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-full ${
                      u.role === 'admin' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {u.role === 'admin' ? <ShieldCheck className="w-3 h-3" /> : <UserIcon className="w-3 h-3" />}
                      {u.role === 'admin' ? 'Administrador' : 'Usuário'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-[11px] font-bold px-2 py-1 rounded-full ${
                      u.ativo ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {u.ativo ? 'Ativo' : 'Desativado'}
                    </span>
                    {u.deve_trocar_senha && (
                      <span className="ml-2 text-[11px] font-semibold text-amber-600">Aguardando 1º acesso</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleResetPassword(u)}
                        title="Forçar redefinição de senha"
                        className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-blue-600"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleToggleActive(u)}
                        title={u.ativo ? 'Desativar usuário' : 'Reativar usuário'}
                        className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-red-600"
                      >
                        <Power className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-lg font-bold text-slate-900">Novo Usuário</h2>
            <form onSubmit={handleCreateUser} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Nome</label>
                <input
                  required
                  value={novoNome}
                  onChange={(e) => setNovoNome(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">E-mail</label>
                <input
                  type="email"
                  required
                  value={novoEmail}
                  onChange={(e) => setNovoEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Perfil</label>
                <select
                  value={novoRole}
                  onChange={(e) => setNovoRole(e.target.value as 'admin' | 'user')}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                >
                  <option value="user">Usuário (vê só as próprias pesquisas)</option>
                  <option value="admin">Administrador (vê tudo)</option>
                </select>
              </div>
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  <span>Criar</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
