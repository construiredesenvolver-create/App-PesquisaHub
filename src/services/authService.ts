import { AppUser, AuthSession } from '../types';
import { AUTH_STORAGE_KEY } from './config';
import { supabase, mensagemDeErro, chamarFuncao } from './supabaseClient';

/**
 * Serviço de Autenticação do PesquisaHub (Supabase Auth).
 *
 * O login/senha é tratado pelo Supabase Auth. Além da sessão do Supabase, guardamos
 * uma cópia simples do usuário logado em localStorage, para que as telas possam
 * saber "quem está logado" de forma imediata (síncrona), como antes.
 */

function perfilParaUsuario(p: any): AppUser {
  return {
    id: String(p.id),
    nome: String(p.nome || ''),
    email: String(p.email || ''),
    role: p.role === 'admin' ? 'admin' : 'user',
    deve_trocar_senha: Boolean(p.deve_trocar_senha),
    ativo: p.ativo !== false,
    criado_em: p.criado_em || '',
    ultimo_login: p.ultimo_login || '',
    pedido_reset_em: p.pedido_reset_em || ''
  };
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
      const user = perfilParaUsuario(perfil);
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

    const session: AuthSession = { token: data.session.access_token, user: perfilParaUsuario(perfil) };
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

  public static async listUsers(): Promise<AppUser[]> {
    const { data, error } = await supabase.from('profiles').select('*').order('criado_em', { ascending: true });
    if (error) throw new Error(mensagemDeErro(error, 'Erro ao carregar usuários.'));
    return (data || []).map(perfilParaUsuario);
  }

  public static async createUser(nome: string, email: string, role: 'admin' | 'user'): Promise<{ tempPassword: string; message: string }> {
    const result = await chamarFuncao('admin-usuarios', { acao: 'criar', nome, email, role });
    return { tempPassword: result.tempPassword, message: result.message };
  }

  public static async resetPassword(userId: string): Promise<{ tempPassword: string; message: string }> {
    const result = await chamarFuncao('admin-usuarios', { acao: 'redefinir', userId });
    return { tempPassword: result.tempPassword, message: result.message };
  }

  public static async toggleUserActive(userId: string, ativo: boolean): Promise<void> {
    await chamarFuncao('admin-usuarios', { acao: 'ativar', userId, ativo });
  }
}
