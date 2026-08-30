import { AppUser, AuthSession } from '../types';
import { AUTH_STORAGE_KEY, DEFAULT_GAS_WEB_APP_URL, GAS_STORAGE_KEY } from './config';

/**
 * Serviço de Autenticação do PesquisaHub.
 *
 * Fala diretamente com o Google Apps Script (mesmas ações de login, troca de senha
 * e gestão de usuários que foram adicionadas ao Code.gs) e mantém a sessão atual
 * (token + usuário logado) salva no navegador, em localStorage.
 */
export class AuthService {
  // Lê a URL do Apps Script diretamente da mesma chave usada pelo ApiService,
  // sem depender do ApiService (evita import circular) e sempre com um valor padrão.
  private static getWebAppUrl(): string {
    try {
      const stored = localStorage.getItem(GAS_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && parsed.webAppUrl) return parsed.webAppUrl;
      }
    } catch (e) {
      // ignora e usa o padrão
    }
    return DEFAULT_GAS_WEB_APP_URL;
  }

  private static async callGas(action: string, payload?: Record<string, any>): Promise<any> {
    const url = this.getWebAppUrl();
    if (!url) throw new Error('Google Apps Script não configurado.');

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, ...payload })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ao comunicar com o Google Apps Script.`);
    }

    const result = await response.json();
    if (result.status !== 'ok' && result.success !== true) {
      throw new Error(result.message || 'Erro ao processar a solicitação.');
    }
    return result;
  }

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

  // ==========================================
  // AÇÕES DE AUTENTICAÇÃO
  // ==========================================

  public static async login(email: string, senha: string): Promise<AuthSession> {
    const result = await this.callGas('login', { email, senha });
    const session: AuthSession = { token: result.data.token, user: result.data.user };
    this.saveSession(session);
    return session;
  }

  public static async logout(): Promise<void> {
    const token = this.getToken();
    this.clearSession();
    if (token) {
      try {
        await this.callGas('logout', { token });
      } catch (e) {
        // Sessão local já foi limpa; falha ao avisar o servidor não é crítica.
      }
    }
  }

  public static async changePassword(novaSenha: string): Promise<void> {
    const token = this.getToken();
    if (!token) throw new Error('Você não está logado.');
    await this.callGas('changePassword', { token, novaSenha });

    // Atualizar a sessão local para refletir que a senha não precisa mais ser trocada
    const session = this.getSession();
    if (session) {
      session.user.deve_trocar_senha = false;
      this.saveSession(session);
    }
  }

  public static async requestPasswordReset(email: string): Promise<string> {
    const result = await this.callGas('requestPasswordReset', { email });
    return result.message as string;
  }

  // ==========================================
  // GESTÃO DE USUÁRIOS (apenas ADM)
  // ==========================================

  public static async listUsers(): Promise<AppUser[]> {
    const token = this.getToken();
    if (!token) throw new Error('Você não está logado.');
    const result = await this.callGas('listUsers', { token });
    return (result.users || result.data || []) as AppUser[];
  }

  public static async createUser(nome: string, email: string, role: 'admin' | 'user'): Promise<{ tempPassword: string; message: string }> {
    const token = this.getToken();
    if (!token) throw new Error('Você não está logado.');
    const result = await this.callGas('createUser', { token, usuario: { nome, email, role } });
    return { tempPassword: result.data.tempPassword, message: result.message };
  }

  public static async resetPassword(userId: string): Promise<{ tempPassword: string; message: string }> {
    const token = this.getToken();
    if (!token) throw new Error('Você não está logado.');
    const result = await this.callGas('resetPassword', { token, userId });
    return { tempPassword: result.data.tempPassword, message: result.message };
  }

  public static async toggleUserActive(userId: string, ativo: boolean): Promise<void> {
    const token = this.getToken();
    if (!token) throw new Error('Você não está logado.');
    await this.callGas('toggleUserActive', { token, userId, ativo });
  }
}
