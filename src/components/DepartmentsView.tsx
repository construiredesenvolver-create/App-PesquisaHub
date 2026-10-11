import React, { useEffect, useState } from 'react';
import { Building2, Plus, Loader2, Pencil, Check, X, Power, Users as UsersIcon, FileText } from 'lucide-react';
import { ApiService } from '../services/api';
import { AuthService } from '../services/authService';
import { Department, Survey, AppUser } from '../types';

interface DepartmentsViewProps {
  surveys: Survey[];
  onDepartmentsChanged: () => void;
}

/**
 * Tela de Departamentos (somente Administrador): criar, renomear e ativar/desativar.
 * Um departamento desativado não aparece mais para criar pesquisas, mas suas
 * pesquisas e respostas continuam guardadas e visíveis para quem já tem acesso.
 */
export const DepartmentsView: React.FC<DepartmentsViewProps> = ({ surveys, onDepartmentsChanged }) => {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [novoNome, setNovoNome] = useState('');
  const [novaDescricao, setNovaDescricao] = useState('');
  const [creating, setCreating] = useState(false);

  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [editNome, setEditNome] = useState('');
  const [editDescricao, setEditDescricao] = useState('');
  const [salvandoId, setSalvandoId] = useState<string | null>(null);

  const carregar = async () => {
    setLoading(true);
    setError(null);
    try {
      const [deps, lista] = await Promise.all([ApiService.fetchDepartments(), AuthService.listUsers()]);
      setDepartments(deps);
      setUsers(lista);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar departamentos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregar();
  }, []);

  const handleCriar = async () => {
    if (!novoNome.trim()) {
      setError('Informe o nome do departamento.');
      return;
    }
    setCreating(true);
    setError(null);
    try {
      await ApiService.createDepartment(novoNome, novaDescricao);
      setNovoNome('');
      setNovaDescricao('');
      await carregar();
      onDepartmentsChanged();
    } catch (err: any) {
      setError(err.message || 'Erro ao criar departamento.');
    } finally {
      setCreating(false);
    }
  };

  const iniciarEdicao = (d: Department) => {
    setEditandoId(d.id);
    setEditNome(d.nome);
    setEditDescricao(d.descricao);
  };

  const salvarEdicao = async (d: Department) => {
    if (!editNome.trim()) {
      setError('O nome do departamento não pode ficar vazio.');
      return;
    }
    setSalvandoId(d.id);
    setError(null);
    try {
      await ApiService.updateDepartment(d.id, { nome: editNome.trim(), descricao: editDescricao.trim() });
      setEditandoId(null);
      await carregar();
      onDepartmentsChanged();
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar departamento.');
    } finally {
      setSalvandoId(null);
    }
  };

  const alternarAtivo = async (d: Department) => {
    const acao = d.ativo ? 'desativar' : 'reativar';
    if (!confirm(`Deseja ${acao} o departamento "${d.nome}"?${d.ativo ? '\n\nAs pesquisas e respostas dele continuam guardadas; ele só deixa de aparecer para novas pesquisas.' : ''}`)) return;
    setSalvandoId(d.id);
    setError(null);
    try {
      await ApiService.updateDepartment(d.id, { ativo: !d.ativo });
      await carregar();
      onDepartmentsChanged();
    } catch (err: any) {
      setError(err.message || 'Erro ao atualizar departamento.');
    } finally {
      setSalvandoId(null);
    }
  };

  const contarUsuarios = (depId: string) => users.filter((u) => (u.departamentos || []).includes(depId)).length;
  const contarPesquisas = (depId: string) => surveys.filter((s) => s.department_id === depId).length;

  return (
    <div className="p-4 sm:p-8 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-extrabold text-slate-900">Departamentos</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Cada pesquisa pertence a um departamento. Gestores e Líderes enxergam as pesquisas dos departamentos aos
          quais estão vinculados (o vínculo é feito na tela de Usuários).
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs font-medium rounded-xl px-4 py-3">
          {error}
        </div>
      )}

      {/* Novo departamento */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
        <h2 className="text-sm font-bold text-slate-800">Novo departamento</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <input
            type="text"
            value={novoNome}
            onChange={(e) => setNovoNome(e.target.value)}
            placeholder="Nome (ex.: Comercial)"
            className="px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          />
          <input
            type="text"
            value={novaDescricao}
            onChange={(e) => setNovaDescricao(e.target.value)}
            placeholder="Descrição (opcional)"
            className="sm:col-span-2 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          />
        </div>
        <button
          onClick={handleCriar}
          disabled={creating}
          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl flex items-center gap-2 disabled:opacity-60"
        >
          {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          <span>Criar departamento</span>
        </button>
      </div>

      {/* Lista */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-10 flex items-center justify-center">
            <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
          </div>
        ) : departments.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">Nenhum departamento cadastrado.</div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {departments.map((d) => (
              <li key={d.id} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
                  <Building2 className="w-5 h-5 text-blue-600" />
                </div>

                <div className="flex-1 min-w-0">
                  {editandoId === d.id ? (
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={editNome}
                        onChange={(e) => setEditNome(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      />
                      <input
                        type="text"
                        value={editDescricao}
                        onChange={(e) => setEditDescricao(e.target.value)}
                        placeholder="Descrição (opcional)"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      />
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-slate-900 text-sm">{d.nome}</span>
                        {!d.ativo && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200">
                            Desativado
                          </span>
                        )}
                      </div>
                      {d.descricao && <p className="text-xs text-slate-500 mt-0.5">{d.descricao}</p>}
                    </>
                  )}
                  <div className="flex items-center gap-4 mt-1.5 text-[11px] text-slate-500">
                    <span className="flex items-center gap-1">
                      <UsersIcon className="w-3.5 h-3.5" /> {contarUsuarios(d.id)} usuário(s)
                    </span>
                    <span className="flex items-center gap-1">
                      <FileText className="w-3.5 h-3.5" /> {contarPesquisas(d.id)} pesquisa(s)
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {editandoId === d.id ? (
                    <>
                      <button
                        onClick={() => salvarEdicao(d)}
                        disabled={salvandoId === d.id}
                        title="Salvar"
                        className="p-2 rounded-lg text-emerald-600 hover:bg-emerald-50 disabled:opacity-50"
                      >
                        {salvandoId === d.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => setEditandoId(null)}
                        title="Cancelar"
                        className="p-2 rounded-lg text-slate-500 hover:bg-slate-100"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => iniciarEdicao(d)}
                        title="Renomear"
                        className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-blue-600"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => alternarAtivo(d)}
                        disabled={salvandoId === d.id}
                        title={d.ativo ? 'Desativar' : 'Reativar'}
                        className={`p-2 rounded-lg hover:bg-slate-100 disabled:opacity-50 ${d.ativo ? 'text-slate-500 hover:text-red-600' : 'text-emerald-600'}`}
                      >
                        <Power className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};
