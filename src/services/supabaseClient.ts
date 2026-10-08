import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from './config';

/**
 * Cliente único do Supabase usado por todo o app.
 * A sessão de login (com renovação automática do token) é guardada pelo próprio
 * Supabase no navegador.
 */
export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    storageKey: 'pesquisahub_supabase_auth'
  }
});

/**
 * Converte qualquer erro do Supabase em uma mensagem em português legível.
 */
export function mensagemDeErro(err: any, padrao = 'Ocorreu um erro inesperado.'): string {
  if (!err) return padrao;
  const msg = String(err.message || err.error_description || err.error || err || '');
  if (/invalid login credentials/i.test(msg)) return 'E-mail ou senha inválidos.';
  if (/email not confirmed/i.test(msg)) return 'E-mail ainda não confirmado. Fale com o administrador.';
  if (/user is banned/i.test(msg)) return 'Este usuário está desativado. Fale com o administrador.';
  if (/failed to fetch|network/i.test(msg)) return 'Sem conexão com o servidor. Verifique sua internet e tente novamente.';
  if (/jwt expired|invalid jwt|refresh token/i.test(msg)) return 'Sua sessão expirou. Faça login novamente.';
  if (/password should be at least/i.test(msg)) return 'A nova senha deve ter pelo menos 6 caracteres.';
  if (/same.*password|different from the old/i.test(msg)) return 'A nova senha precisa ser diferente da atual.';
  return msg || padrao;
}

/**
 * Chama uma Edge Function do Supabase e devolve o JSON de resposta.
 * Se a função responder com erro, lança um Error com a mensagem dela.
 */
export async function chamarFuncao<T = any>(nome: string, corpo: Record<string, any>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(nome, { body: corpo });
  if (error) {
    let msg = error.message || 'Falha ao chamar o servidor.';
    try {
      const ctx: any = (error as any).context;
      if (ctx && typeof ctx.json === 'function') {
        const body = await ctx.json();
        msg = body?.message || body?.error || msg;
      }
    } catch (e) {
      // mantém a mensagem padrão
    }
    if (/Failed to send a request|Function not found|404/i.test(msg)) {
      msg = `A função "${nome}" ainda não foi publicada no Supabase (Edge Functions).`;
    }
    throw new Error(msg);
  }
  if (data && data.success === false) {
    throw new Error(data.message || 'O servidor recusou a operação.');
  }
  return data as T;
}
