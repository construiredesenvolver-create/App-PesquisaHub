import { AppUser, AuthSession, UserRole } from '../types';
import { AUTH_STORAGE_KEY } from './config';
import { supabase, mensagemDeErro, chamarFuncao } from './supabaseClient';

/**
 * Serviço de Autenticação do PesquisaHub (Supabase Auth).
 *
 * O login/senha é tratado pelo Supabase Auth. Além da sessão do Supabase, guardamos
 * uma cópia simples do usuário logado em localStorage, para que as telas possam
 * saber "quem está logado" de forma imediata (síncrona), como antes.
 */

const PAPEIS_VALIDOS: UserRole[] = ['admin', 'gestor', 'lider', 'especial'];

function normalizarPapel(role: any): UserRole {
  return PAPEIS_VALIDOS.includes(role) ? role : 'lider';
}

function perfilParaUsuario(p: any, departamentos: string[] = []): AppUser {
  return {
    id: String(p.id),
    nome: String(p.nome || ''),
    email: String(p.email || ''),
    role: normalizarPapel(p.role),
    deve_trocar_senha: Boolean(p.deve_trocar_senha),
    ativo: p.ativo !== false,
    criado_em: p.criado_em || '',
    ultimo_login: p.ultimo_login || '',
    pedido_reset_em: p.pedido_reset_em || '',
    departamentos,
    preferencias: (p.preferencias && typeof p.preferencias === 'object') ? p.preferencias : {}
  };
}

async function departamentosDoUsuario(userId: string): Promise<string[]> {
  const { data, error } = await supabase.from('user_departments').select('department_id').eq('user_id', userId);
  if (error || !data) return [];
  return data.map((r: any) => String(r.department_id));
}

export class AuthService {
  // ==========================================
  // SESSÃO (armazenada no navegador)
  // ==========================================

  public static getSession(): AuthSession | null {
    try {
      const stored = localStorage.getItem(AUTH_STORAGE_KEY);
      if (!stored) return null;
      return JSON.parse(stored) as AuthSession;
    } catch (e) {
      return null;
    }
  }

  public static getToken(): string | null {
    return this.getSession()?.token || null;
  }

  public static getCurrentUser(): AppUser | null {
    return this.getSession()?.user || null;
  }

  public static isAdmin(): boolean {
    return this.getCurrentUser()?.role === 'admin';
  }

  private static saveSession(session: AuthSession) {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
  }

  public static clearSession() {
    localStorage.removeItem(AUTH_STORAGE_KEY);
  }

  /**
   * Confere, ao abrir o app, se a sessão do Supabase ainda é válida e atualiza os
   * dados do usuário (nome, permissão, ativo). Devolve null se for preciso logar de novo.
   * Falhas de rede NÃO derrubam a sessão (o usuário só é deslogado quando o servidor
   * confirma que a sessão não existe ou que o usuário foi desativado).
   */
  public static async validateSession(): Promise<AppUser | null> {
    const local = this.getSession();
    if (!local) return null;

    const { data, error } = await supabase.auth.getSession();
    if (error) return local.user; // problema de rede: mantém como está
    if (!data.session) {
      this.clearSession();
      return null;
    }

    try {
      const { data: perfil, error: perfilErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.session.user.id)
        .maybeSingle();
      if (perfilErr) return local.user;
      if (!perfil || perfil.ativo === false) {
        await this.logout();
        return null;
      }
      const user = perfilParaUsuario(perfil, await departamentosDoUsuario(perfil.id));
      this.saveSession({ token: data.session.access_token, user });
      return user;
    } catch (e) {
      return local.user;
    }
  }

  // ==========================================
  // AÇÕES DE AUTENTICAÇÃO
  // ==========================================

  public static async login(email: string, senha: string): Promise<AuthSession> {
    if (!email || !senha) throw new Error('Informe e-mail e senha.');

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password: senha
    });
    if (error || !data.session) {
      throw new Error(mensagemDeErro(error, 'E-mail ou senha inválidos.'));
    }

    const { data: perfil, error: perfilErr } = await supabase.rpc('registrar_login');
    if (perfilErr || !perfil) {
      await supabase.auth.signOut();
      throw new Error(mensagemDeErro(perfilErr, 'Não foi possível carregar seu perfil.'));
    }
    if (perfil.ativo === false) {
      await supabase.auth.signOut();
      throw new Error('Este usuário está desativado. Fale com o administrador.');
    }

    const departamentos = await departamentosDoUsuario(perfil.id);
    const session: AuthSession = { token: data.session.access_token, user: perfilParaUsuario(perfil, departamentos) };
    this.saveSession(session);
    return session;
  }

  public static async logout(): Promise<void> {
    this.clearSession();
    try {
      await supabase.auth.signOut();
    } catch (e) {
      // Sessão local já foi limpa; falha ao avisar o servidor não é crítica.
    }
  }

  public static async changePassword(novaSenha: string): Promise<void> {
    if (!this.getSession()) throw new Error('Você não está logado.');
    if (!novaSenha || novaSenha.length < 6) {
      throw new Error('A nova senha deve ter pelo menos 6 caracteres.');
    }

    const { error } = await supabase.auth.updateUser({ password: novaSenha });
    if (error) throw new Error(mensagemDeErro(error, 'Não foi possível trocar a senha.'));

    await supabase.rpc('marcar_senha_trocada');

    const session = this.getSession();
    if (session) {
      session.user.deve_trocar_senha = false;
      this.saveSession(session);
    }
  }

  public static async requestPasswordReset(email: string): Promise<string> {
    if (!email) throw new Error('Informe seu e-mail.');
    await supabase.rpc('solicitar_reset_senha', { p_email: email.trim() });
    return 'Pedido registrado. Se o e-mail existir em nossa base, o administrador verá sua solicitação e enviará uma senha temporária.';
  }

  // ==========================================
  // GESTÃO DE USUÁRIOS (apenas ADM)
  // ==========================================

  /**
   * Lista os usuários que a pessoa logada pode ver (admin: todos; gestor: os dos
   * seus departamentos), já com os departamentos de cada um.
   */
  public static async listUsers(): Promise<AppUser[]> {
    const [{ data, error }, { data: vinculos }] = await Promise.all([
      supabase.from('profiles').select('*').order('criado_em', { ascending: true }),
      supabase.from('user_departments').select('user_id, department_id')
    ]);
    if (error) throw new Error(mensagemDeErro(error, 'Erro ao carregar usuários.'));

    const porUsuario: Record<string, string[]> = {};
    (vinculos || []).forEach((v: any) => {
      (porUsuario[v.user_id] = porUsuario[v.user_id] || []).push(String(v.department_id));
    });
    return (data || []).map((p: any) => perfilParaUsuario(p, porUsuario[p.id] || []));
  }

  public static async createUser(
    nome: string,
    email: string,
    role: UserRole,
    departamentos: string[] = []
  ): Promise<{ tempPassword: string; message: string }> {
    const result = await chamarFuncao('admin-usuarios', { acao: 'criar', nome, email, role, departamentos });
    return { tempPassword: result.tempPassword, message: result.message };
  }

  /**
   * Admin: define o papel e os departamentos de um usuário.
   */
  public static async updateUserAccess(userId: string, role: UserRole, departamentos: string[]): Promise<void> {
    const atual = this.getCurrentUser();
    if (atual && atual.id === userId && atual.role === 'admin' && role !== 'admin') {
      throw new Error('Você não pode remover o seu próprio perfil de Administrador.');
    }

    const { error: pErr } = await supabase.from('profiles').update({ role }).eq('id', userId);
    if (pErr) throw new Error(mensagemDeErro(pErr, 'Não foi possível alterar o papel.'));

    const { data: existentes, error: lErr } = await supabase
      .from('user_departments')
      .select('department_id')
      .eq('user_id', userId);
    if (lErr) throw new Error(mensagemDeErro(lErr, 'Não foi possível ler os departamentos do usuário.'));

    const atuais = (existentes || []).map((r: any) => String(r.department_id));
    const remover = atuais.filter((d) => !departamentos.includes(d));
    const adicionar = departamentos.filter((d) => !atuais.includes(d));

    if (remover.length > 0) {
      const { error } = await supabase.from('user_departments').delete().eq('user_id', userId).in('department_id', remover);
      if (error) throw new Error(mensagemDeErro(error, 'Não foi possível remover departamentos.'));
    }
    if (adicionar.length > 0) {
      const { error } = await supabase
        .from('user_departments')
        .insert(adicionar.map((department_id) => ({ user_id: userId, department_id })));
      if (error) throw new Error(mensagemDeErro(error, 'Não foi possível adicionar departamentos.'));
    }

    // Se mexeu no próprio usuário, atualiza a sessão local
    if (atual && atual.id === userId) {
      const session = this.getSession();
      if (session) {
        session.user.role = role;
        session.user.departamentos = departamentos;
        this.saveSession(session);
      }
    }
  }

  /**
   * Salva preferências pessoais (ex.: departamentos que deseja acompanhar no painel).
   */
  public static async savePreferences(preferencias: Record<string, any>): Promise<void> {
    const { error } = await supabase.rpc('salvar_preferencias', { p_preferencias: preferencias });
    if (error) throw new Error(mensagemDeErro(error, 'Não foi possível salvar a preferência.'));
    const session = this.getSession();
    if (session) {
      session.user.preferencias = { ...(session.user.preferencias || {}), ...preferencias };
      this.saveSession(session);
    }
  }

  public static async resetPassword(userId: string): Promise<{ tempPassword: string; message: string }> {
    const result = await chamarFuncao('admin-usuarios', { acao: 'redefinir', userId });
    return { tempPassword: result.tempPassword, message: result.message };
  }

  public static async toggleUserActive(userId: string, ativo: boolean): Promise<void> {
    await chamarFuncao('admin-usuarios', { acao: 'ativar', userId, ativo });
  }
}
