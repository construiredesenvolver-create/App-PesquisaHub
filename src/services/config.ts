/**
 * Configuração fixa do PesquisaHub (backend Supabase).
 *
 * A URL e a chave "publishable" abaixo são PÚBLICAS por natureza — elas podem
 * ficar no código do navegador. Quem protege os dados são as regras de segurança
 * (RLS) criadas no banco pelo arquivo 01_schema.sql.
 *
 * NUNCA coloque aqui a chave "secret" (sb_secret_...) nem a "service_role".
 */
export const SUPABASE_URL = 'https://rooodkapcmolmnbcngws.supabase.co';
export const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_Rv4o9w3bnGLi2s0URee_oA_eMLgsPkF';

// Mantido por compatibilidade com telas antigas que exibem "URL da API".
export const DEFAULT_GAS_WEB_APP_URL = SUPABASE_URL;

// Chave do localStorage para preferências de conexão (hoje: só a URL pública do app)
export const GAS_STORAGE_KEY = 'pesquisahub_gas_config_v1';

// Chave do localStorage para a sessão de login. Mudou para v2 na migração ao
// Supabase: isso faz todo mundo entrar de novo uma única vez, descartando os
// tokens antigos do Apps Script.
export const AUTH_STORAGE_KEY = 'pesquisahub_auth_session_v2';
