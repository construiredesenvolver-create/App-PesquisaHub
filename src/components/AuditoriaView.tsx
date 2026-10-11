import React, { useEffect, useMemo, useState } from 'react';
import { History, Loader2, Search, RefreshCw } from 'lucide-react';
import { ApiService, AuditEntry } from '../services/api';
import { AuthService } from '../services/authService';
import { AppUser, Department, Survey, ROLE_LABELS, UserRole } from '../types';

interface AuditoriaViewProps {
  surveys: Survey[];
}

const TAMANHO_PAGINA = 100;

const FILTROS: Array<{ valor: string; rotulo: string }> = [
  { valor: '', rotulo: 'Tudo' },
  { valor: 'surveys', rotulo: 'Pesquisas' },
  { valor: 'respondents', rotulo: 'Respostas excluídas' },
  { valor: 'survey_access', rotulo: 'Acessos especiais' },
  { valor: 'profiles', rotulo: 'Usuários' },
  { valor: 'user_departments', rotulo: 'Vínculos de departamento' },
  { valor: 'departments', rotulo: 'Departamentos' }
];

const NOMES_CAMPO: Record<string, string> = {
  status: 'status',
  titulo: 'título',
  descricao: 'descrição',
  visibilidade: 'visibilidade',
  department_id: 'departamento',
  data_fim: 'data de encerramento',
  data_inicio: 'data de início',
  role: 'papel',
  ativo: 'ativo',
  nome: 'nome',
  link_publico: 'link público',
  pode_exportar: 'pode exportar'
};

function formatarQuando(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/**
 * Tela de Auditoria (somente Administrador): quem fez o quê e quando.
 * Os registros são gravados automaticamente pelo banco; aqui apenas consultamos.
 */
export const AuditoriaView: React.FC<AuditoriaViewProps> = ({ surveys }) => {
  const [registros, setRegistros] = useState<AuditEntry[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [carregandoMais, setCarregandoMais] = useState(false);
  const [temMais, setTemMais] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filtro, setFiltro] = useState('');
  const [busca, setBusca] = useState('');

  const carregar = async (entidade: string) => {
    setLoading(true);
    setError(null);
    try {
      const [lista, us, deps] = await Promise.all([
        ApiService.listAuditLog(0, TAMANHO_PAGINA, entidade),
        AuthService.listUsers(),
        ApiService.fetchDepartments()
      ]);
      setRegistros(lista);
      setTemMais(lista.length === TAMANHO_PAGINA);
      setUsers(us);
      setDepartments(deps);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar a auditoria.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregar(filtro);
  }, [filtro]);

  const carregarMais = async () => {
    setCarregandoMais(true);
    try {
      const mais = await ApiService.listAuditLog(registros.length, TAMANHO_PAGINA, filtro);
      setRegistros((prev) => [...prev, ...mais]);
      setTemMais(mais.length === TAMANHO_PAGINA);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar mais registros.');
    } finally {
      setCarregandoMais(false);
    }
  };

  const nomeUsuario = (id?: string) => users.find((u) => u.id === id)?.nome || 'usuário';
  const nomePesquisa = (id?: string) => surveys.find((s) => s.id === id)?.titulo || `pesquisa ${id || ''}`.trim();
  const nomeDepartamento = (id?: string) => departments.find((d) => d.id === id)?.nome || 'departamento';

  const valorLegivel = (campo: string, valor: any): string => {
    if (valor === null || valor === undefined || valor === '') return '(vazio)';
    if (campo === 'role') return ROLE_LABELS[valor as UserRole] || String(valor);
    if (campo === 'department_id') return nomeDepartamento(String(valor));
    if (campo === 'ativo' || campo === 'pode_exportar') return valor === true || valor === 'true' ? 'sim' : 'não';
    if (campo === 'visibilidade') return valor === 'restrita' ? 'Restrita' : 'Departamento';
    return String(valor);
  };

  const descrever = (r: AuditEntry): string => {
    const d: any = r.detalhes || {};
    const mudancas = () =>
      Object.keys(d)
        .map((campo) => {
          const m = d[campo];
          if (m && typeof m === 'object' && 'para' in m) {
            return `${NOMES_CAMPO[campo] || campo}: ${valorLegivel(campo, m.de)} → ${valorLegivel(campo, m.para)}`;
          }
          return null;
        })
        .filter(Boolean)
        .join('; ');

    switch (r.entidade) {
      case 'surveys':
        if (r.acao === 'insert') return `Criou a pesquisa "${d.titulo || nomePesquisa(r.entidade_id)}"`;
        if (r.acao === 'delete') return `Excluiu a pesquisa "${d.titulo || r.entidade_id}"`;
        return `Alterou a pesquisa "${nomePesquisa(r.entidade_id)}" — ${mudancas()}`;
      case 'respondents':
        return `Excluiu a resposta de "${d.nome || 'respondente'}" (${d.data_resposta || ''}) na pesquisa "${nomePesquisa(d.survey_id)}"`;
      case 'survey_access':
        if (r.acao === 'insert') return `Liberou a pesquisa "${nomePesquisa(d.survey_id)}" para ${nomeUsuario(d.user_id)}${d.pode_exportar ? ' (com exportação)' : ''}`;
        if (r.acao === 'delete') return `Removeu o acesso de ${nomeUsuario(d.user_id)} à pesquisa "${nomePesquisa(d.survey_id)}"`;
        return `Alterou o acesso especial à pesquisa "${nomePesquisa(r.entidade_id.split(' / ')[0])}" — ${mudancas()}`;
      case 'profiles':
        return `Alterou o usuário ${nomeUsuario(r.entidade_id)} — ${mudancas()}`;
      case 'user_departments':
        return r.acao === 'insert'
          ? `Vinculou ${nomeUsuario(d.user_id)} ao departamento ${nomeDepartamento(d.department_id)}`
          : `Removeu ${nomeUsuario(d.user_id)} do departamento ${nomeDepartamento(d.department_id)}`;
      case 'departments':
        if (r.acao === 'insert') return `Criou o departamento "${d.nome}"`;
        if (r.acao === 'delete') return `Excluiu o departamento "${d.nome}"`;
        return `Alterou o departamento "${nomeDepartamento(r.entidade_id)}" — ${mudancas()}`;
      default:
        return `${r.acao} em ${r.entidade}`;
    }
  };

  const linhas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return registros
      .map((r) => ({ r, texto: descrever(r) }))
      .filter(({ r, texto }) => !termo || texto.toLowerCase().includes(termo) || r.usuario_email.toLowerCase().includes(termo));
  }, [registros, busca, users, departments, surveys]);

  const corAcao = (acao: string) =>
    acao === 'delete' ? 'bg-rose-100 text-rose-700' : acao === 'insert' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700';
  const rotuloAcao = (acao: string) => (acao === 'delete' ? 'Exclusão' : acao === 'insert' ? 'Criação' : 'Alteração');

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
            <History className="w-5 h-5 text-slate-600" /> Auditoria
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Registro automático de quem criou, alterou ou excluiu pesquisas, respostas, acessos, usuários e departamentos.
            "Sistema" indica ações automáticas (ex.: encerramento na data de término) ou feitas direto no banco.
          </p>
        </div>
        <button
          onClick={() => carregar(filtro)}
          className="px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Atualizar
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-col md:flex-row gap-3 md:items-center">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por pessoa, pesquisa ou e-mail de quem fez…"
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {FILTROS.map((f) => (
            <button
              key={f.valor}
              onClick={() => setFiltro(f.valor)}
              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold ${filtro === f.valor ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              {f.rotulo}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-xs font-medium rounded-xl px-4 py-3">{error}</div>}

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-10 flex justify-center"><Loader2 className="w-6 h-6 text-blue-600 animate-spin" /></div>
        ) : linhas.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">Nenhum registro encontrado.</div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {linhas.map(({ r, texto }) => (
              <li key={r.id} className="p-4 flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-4">
                <div className="sm:w-36 shrink-0 text-[11px] text-slate-500 font-mono">{formatarQuando(r.quando)}</div>
                <span className={`self-start text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${corAcao(r.acao)}`}>{rotuloAcao(r.acao)}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-slate-800">{texto}</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">por {r.usuario_email === 'sistema' ? 'Sistema' : r.usuario_email}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
        {temMais && !loading && (
          <div className="p-3 border-t border-slate-100 text-center">
            <button
              onClick={carregarMais}
              disabled={carregandoMais}
              className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 disabled:opacity-60 inline-flex items-center gap-1.5"
            >
              {carregandoMais && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Carregar mais
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
