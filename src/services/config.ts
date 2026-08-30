/**
 * Configuração fixa do PesquisaHub.
 *
 * A URL abaixo é a URL de implantação (/exec) do seu Google Apps Script.
 * Ela fica gravada diretamente no código para que o app já abra conectado,
 * sem precisar colar a URL novamente em "Configurações" a cada novo acesso
 * ou a cada pessoa que abrir o app pela primeira vez.
 *
 * Se um dia você reimplantar o Apps Script e receber uma URL nova, basta
 * atualizar o valor abaixo (e opcionalmente também em "Configurações" no app).
 */
export const DEFAULT_GAS_WEB_APP_URL =
  'https://script.google.com/macros/s/AKfycby80u_FuwYdIioRY-POs4XRenb26TRE_Z_dXb-L8vwBkaRdCrBSSFashAIsMwGScU-I/exec';

// Chave usada no localStorage do navegador para a configuração de conexão com o Google Sheets
export const GAS_STORAGE_KEY = 'pesquisahub_gas_config_v1';

// Chave usada no localStorage do navegador para a sessão de login (token + usuário atual)
export const AUTH_STORAGE_KEY = 'pesquisahub_auth_session_v1';
