import { AppUser, Survey } from '../types';

/**
 * Regras de permissão no navegador — servem só para mostrar ou esconder botões.
 * Quem realmente garante a segurança é o banco (RLS): mesmo que um botão apareça
 * por engano, o banco recusa a operação. As regras aqui espelham as do banco.
 */

function noDepartamento(user: AppUser, survey: Survey): boolean {
  return !!survey.department_id && (user.departamentos || []).includes(survey.department_id);
}

export function podeCriarPesquisa(user: AppUser | null): boolean {
  return !!user && (user.role === 'admin' || user.role === 'gestor' || user.role === 'lider');
}

export function podeEditarPesquisa(user: AppUser | null, survey: Survey): boolean {
  if (!user) return false;
  if (user.role === 'admin') return true;
  if (!noDepartamento(user, survey)) return false;
  if (user.role === 'gestor') return true;
  return user.role === 'lider' && survey.criado_por === user.id;
}

export function podeExcluirPesquisa(user: AppUser | null, survey: Survey): boolean {
  if (!user) return false;
  if (user.role === 'admin') return true;
  return user.role === 'gestor' && noDepartamento(user, survey);
}

export function podeLiberarAcesso(user: AppUser | null, survey: Survey): boolean {
  return podeExcluirPesquisa(user, survey);
}

/** Exportar CSV/PDF: todos que gerenciam; acesso especial só se liberado com exportação. */
export function podeExportarPesquisa(user: AppUser | null, survey: Survey, acessosComExportacao: Set<string>): boolean {
  if (!user) return false;
  if (user.role === 'especial') return acessosComExportacao.has(survey.id);
  return true;
}

/** Departamentos onde a pessoa pode criar pesquisas (admin: todos os ativos). */
export function departamentosParaCriar<T extends { id: string; ativo: boolean }>(user: AppUser | null, todos: T[]): T[] {
  if (!user) return [];
  const ativos = todos.filter((d) => d.ativo);
  if (user.role === 'admin') return ativos;
  if (user.role === 'gestor' || user.role === 'lider') {
    return ativos.filter((d) => (user.departamentos || []).includes(d.id));
  }
  return [];
}
