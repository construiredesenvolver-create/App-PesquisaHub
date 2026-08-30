import { 
  Survey, 
  Question, 
  Option, 
  Respondent, 
  Answer, 
  SurveyStatus,
  GoogleAppsScriptConfig,
  SentimentAnalysisResult,
  AppSettings
} from '../types';
import { DEFAULT_GAS_WEB_APP_URL, GAS_STORAGE_KEY } from './config';
import { AuthService } from './authService';

/**
 * Configuração Central do PesquisaHub
 * Separação estrita entre API (Google Apps Script) e Aplicação Pública (Frontend Web)
 */
export const APP_CONFIG = {
  get API_URL(): string {
    return ApiService.getGasConfig().webAppUrl || '';
  },
  get PUBLIC_APP_URL(): string {
    const config = ApiService.getGasConfig();
    let custom = config.publicAppUrl?.trim();
    if (custom) {
      if (custom.includes('ais-dev-')) {
        custom = custom.replace(/ais-dev-/g, 'ais-pre-');
      }
      return custom.replace(/\/+$/, '');
    }
    
    // Se estiver no navegador, derivar da origem pública correta
    if (typeof window !== 'undefined' && window.location) {
      let origin = window.location.origin;
      // No Google AI Studio, URLs iniciadas em 'ais-dev-' são exclusivas para o criador logado (retornam Erro 403 do Google Cloud para terceiros).
      // A URL pública de compartilhamento aberta para respondentes sem login é 'ais-pre-' (Shared Preview URL).
      if (origin.includes('ais-dev-')) {
        origin = origin.replace(/ais-dev-/g, 'ais-pre-');
      }
      const pathname = window.location.pathname.replace(/\/+$/, '');
      return `${origin}${pathname}`;
    }
    return 'https://ais-pre-cakpu56x3okk7cpqsrii2g-681232956538.us-west2.run.app';
  }
};

/**
 * Extrai o slug/ID limpo da pesquisa caso seja fornecida uma URL inteira ou caminho
 */
export function extractCleanSurveySlug(surveyIdOrSlugOrUrl: string): string {
  if (!surveyIdOrSlugOrUrl) return '';
  let str = String(surveyIdOrSlugOrUrl).trim();

  // Se for uma URL completa ou rota com /responder/
  if (str.includes('/responder/')) {
    const parts = str.split('/responder/');
    str = parts[parts.length - 1];
  } else if (str.includes('#responder-')) {
    str = str.replace('#responder-', '');
  } else if (str.includes('#/responder-')) {
    str = str.replace('#/responder-', '');
  }

  // Limpar query params ou hashes extras
  str = str.split('?')[0].split('#')[0].replace(/^\/+|\/+$/g, '').trim();
  return str || 'pesquisa';
}

/**
 * Função central e única para gerar o Link Público Exclusivo da pesquisa
 */
export function generatePublicSurveyUrl(surveyIdOrSlug: string): string {
  const baseUrl = APP_CONFIG.PUBLIC_APP_URL;
  const cleanId = extractCleanSurveySlug(surveyIdOrSlug);
  const publicUrl = `${baseUrl}/#/responder/${encodeURIComponent(cleanId)}`;
  
  // Registro explícito no console para rastreabilidade
  console.log('[PesquisaHub Architecture] Public Survey URL (Sem 403):', publicUrl);
  console.log('[PesquisaHub Architecture] API URL (Backend):', APP_CONFIG.API_URL || '(Não configurada)');
  
  return publicUrl;
}

/**
 * Gera o Link Direto do Google Apps Script (100% Autônomo e sem precisar hospedar)
 */
export function generateGasDirectFormUrl(surveyIdOrSlug: string): string {
  const config = ApiService.getGasConfig();
  const webAppUrl = config.webAppUrl?.trim();
  if (!webAppUrl) return '';
  const cleanId = extractCleanSurveySlug(surveyIdOrSlug);
  return webAppUrl.includes('?') 
    ? `${webAppUrl}&survey=${encodeURIComponent(cleanId)}`
    : `${webAppUrl}?survey=${encodeURIComponent(cleanId)}`;
}

/**
 * Gerador centralizado e seguro de IDs únicos (UUID simplificado com timestamp e entropia)
 * Garante que nenhuma pergunta ou opção compartilhe o mesmo ID.
 */
export function generateId(prefix: 'srv' | 'q' | 'opt' | 'resp' | 'ans' | string): string {
  const timestamp = Date.now().toString(36);
  const randomEntropy = Math.random().toString(36).substring(2, 8);
  return `${prefix}_${timestamp}_${randomEntropy}`;
}

export class ApiService {
  private static isInitialized = false;

  // Estado em memória (alimentado em tempo real pelo Google Sheets)
  private static surveys: Survey[] = [];
  private static questions: Question[] = [];
  private static options: Option[] = [];
  private static respondents: Respondent[] = [];
  private static answers: Answer[] = [];

  private static lastError: string | null = null;
  private static connectionStatusText = 'Não verificado';

  public static init(): void {
    if (this.isInitialized) return;
    this.isInitialized = true;
  }

  public static getLastError(): string | null {
    return this.lastError;
  }

  // ==========================================
  // CONFIGURAÇÃO DO GOOGLE APPS SCRIPT
  // ==========================================

  public static getGasConfig(): GoogleAppsScriptConfig {
    try {
      const stored = localStorage.getItem(GAS_STORAGE_KEY);
      if (stored) {
        const parsed: GoogleAppsScriptConfig = JSON.parse(stored);
        if (parsed.publicAppUrl && parsed.publicAppUrl.includes('ais-dev-')) {
          parsed.publicAppUrl = parsed.publicAppUrl.replace(/ais-dev-/g, 'ais-pre-');
          try {
            localStorage.setItem(GAS_STORAGE_KEY, JSON.stringify(parsed));
          } catch (e) {
            // ignore
          }
        }
        return parsed;
      }
    } catch (e) {
      console.warn('Erro ao ler configuração do Google Apps Script:', e);
    }

    return {
      webAppUrl: DEFAULT_GAS_WEB_APP_URL,
      isConnected: false,
      autoSync: true
    };
  }

  public static saveGasConfig(config: Partial<GoogleAppsScriptConfig>): GoogleAppsScriptConfig {
    const current = this.getGasConfig();
    let sanitizedPublic = config.publicAppUrl ? String(config.publicAppUrl).trim() : current.publicAppUrl;
    if (sanitizedPublic && sanitizedPublic.includes('ais-dev-')) {
      sanitizedPublic = sanitizedPublic.replace(/ais-dev-/g, 'ais-pre-');
    }

    const updated: GoogleAppsScriptConfig = {
      ...current,
      ...config,
      ...(sanitizedPublic !== undefined ? { publicAppUrl: sanitizedPublic } : {})
    };
    try {
      localStorage.setItem(GAS_STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.warn('Erro ao salvar configuração do Google Apps Script:', e);
    }
    return updated;
  }

  // ==========================================
  // TESTES DE DIAGNÓSTICO E CONEXÃO
  // ==========================================

  /**
   * Testa a conectividade com o Google Apps Script (Ping)
   */
  public static async testGasConnection(url: string): Promise<{ 
    success: boolean; 
    message: string; 
    latencyMs?: number;
    timestamp?: string;
    version?: string;
  }> {
    const startTime = performance.now();
    try {
      const pingUrl = url.includes('?') 
        ? `${url}&action=ping&_t=${Date.now()}` 
        : `${url}?action=ping&_t=${Date.now()}`;

      console.log('[API] Testando conectividade com Google Apps Script:', pingUrl);

      const response = await fetch(pingUrl, {
        method: 'GET',
        mode: 'cors',
        headers: { 'Accept': 'application/json' }
      });

      const latency = Math.round(performance.now() - startTime);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('[API] Resposta do teste de conexão:', data);

      if (data.status === 'ok' || data.success) {
        this.connectionStatusText = `Conectado (${latency}ms)`;
        this.saveGasConfig({ webAppUrl: url, isConnected: true, lastSync: new Date().toISOString() });
        this.lastError = null;

        return {
          success: true,
          latencyMs: latency,
          timestamp: data.timestamp || new Date().toISOString(),
          version: data.version || '1.2.0',
          message: 'Google Apps Script conectado com sucesso ao Google Sheets!'
        };
      } else {
        this.connectionStatusText = `Erro na API (${latency}ms)`;
        this.saveGasConfig({ isConnected: false });
        this.lastError = data.message || 'A API retornou uma mensagem de erro.';

        return { 
          success: false, 
          latencyMs: latency,
          message: data.message || 'A API retornou uma mensagem de erro.' 
        };
      }
    } catch (err: any) {
      const latency = Math.round(performance.now() - startTime);
      this.connectionStatusText = `Falha na conexão (${latency}ms)`;
      this.saveGasConfig({ isConnected: false });
      this.lastError = err.message || 'Erro de conexão';
      
      return {
        success: false,
        latencyMs: latency,
        message: `Não foi possível conectar ao Google Apps Script: ${err.message || err}. Certifique-se de que a implantação foi realizada com "Quem pode acessar: Qualquer pessoa" (Anyone).`
      };
    }
  }

  /**
   * Testa isoladamente a consulta de pesquisas (action=getAllData ou fallback para action=getSurveys)
   */
  public static async testFetchSurveysDirectly(customUrl?: string): Promise<{
    success: boolean;
    httpStatus: number;
    surveysCount: number;
    rawResponse: any;
    message: string;
    latencyMs: number;
  }> {
    const config = this.getGasConfig();
    const targetUrl = customUrl || config.webAppUrl;
    
    if (!targetUrl) {
      return {
        success: false,
        httpStatus: 0,
        surveysCount: 0,
        rawResponse: null,
        message: 'Nenhuma URL de Google Apps Script configurada.',
        latencyMs: 0
      };
    }

    const startTime = performance.now();
    try {
      // 1. Tentar action=getAllData
      const url = targetUrl.includes('?') 
        ? `${targetUrl}&action=getAllData&_t=${Date.now()}` 
        : `${targetUrl}?action=getAllData&_t=${Date.now()}`;

      console.log('[API] Teste isolado - Buscando pesquisas via getAllData:', url);

      let response = await fetch(url, {
        method: 'GET',
        mode: 'cors',
        headers: { 'Accept': 'application/json' }
      });

      let json = await response.json();
      console.log('[API] Teste isolado - Resposta inicial:', json);

      // Se o script retornar erro de ação desconhecida, tentar fallback para action=getSurveys
      if (json.status === 'error' && String(json.message || '').includes('desconhecida')) {
        console.log('[API] action=getAllData não suportada na versão atual do Apps Script. Tentando fallback para action=getSurveys...');
        const fallbackUrl = targetUrl.includes('?') 
          ? `${targetUrl}&action=getSurveys&_t=${Date.now()}` 
          : `${targetUrl}?action=getSurveys&_t=${Date.now()}`;
        
        response = await fetch(fallbackUrl, {
          method: 'GET',
          mode: 'cors',
          headers: { 'Accept': 'application/json' }
        });
        json = await response.json();
        console.log('[API] Teste isolado - Resposta via fallback getSurveys:', json);
      }

      const latencyMs = Math.round(performance.now() - startTime);
      const httpStatus = response.status;

      const surveysList = (json.data && json.data.surveys) || json.surveys || (Array.isArray(json.data) ? json.data : []);
      const count = Array.isArray(surveysList) ? surveysList.length : 0;

      const isSuccess = (json.status === 'ok' || json.success === true || Array.isArray(json.surveys) || Array.isArray(json.data));

      return {
        success: isSuccess,
        httpStatus,
        surveysCount: count,
        rawResponse: json,
        message: isSuccess 
          ? `Busca executada em ${latencyMs}ms. Encontradas ${count} pesquisa(s) no Google Sheets.`
          : (json.message || 'Falha ao buscar pesquisas.'),
        latencyMs
      };
    } catch (e: any) {
      const latencyMs = Math.round(performance.now() - startTime);
      return {
        success: false,
        httpStatus: 0,
        surveysCount: 0,
        rawResponse: null,
        message: `Falha no teste de busca: ${e.message || e}`,
        latencyMs
      };
    }
  }

  // ==========================================
  // SINCRONIZAÇÃO COMPLETA COM GOOGLE SHEETS
  // ==========================================

  /**
   * Carrega todos os dados do banco de dados do Google Sheets.
   * Suporta nativamente tanto a versão moderna (action=getAllData) quanto a versão clássica (action=getSurveys + getSurvey).
   */
  public static async fetchAllDataFromSheets(): Promise<{
    success: boolean;
    data?: {
      surveys: Survey[];
      questions: Question[];
      options: Option[];
      respondents: Respondent[];
      answers: Answer[];
    };
    message?: string;
  }> {
    this.init();
    const config = this.getGasConfig();
    
    if (!config.webAppUrl) {
      console.warn('[API] URL do Google Apps Script não configurada.');
      this.lastError = 'Google Apps Script não configurado.';
      return { 
        success: false, 
        message: 'URL do Google Apps Script ainda não configurada nas Configurações.' 
      };
    }

    try {
      console.log('[API] Buscando pesquisas e dados completos do Google Sheets...');
      
      // Tentativa 1: Endpoint completo action=getAllData (v1.2+)
      const token = AuthService.getToken();
      const tokenParam = token ? `&token=${encodeURIComponent(token)}` : '';
      const url = config.webAppUrl.includes('?') 
        ? `${config.webAppUrl}&action=getAllData&_t=${Date.now()}${tokenParam}` 
        : `${config.webAppUrl}?action=getAllData&_t=${Date.now()}${tokenParam}`;

      const response = await fetch(url, {
        method: 'GET',
        mode: 'cors',
        headers: { 'Accept': 'application/json' }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ao carregar dados do Sheets: ${response.statusText}`);
      }

      const result = await response.json();
      console.log('[API] Resposta recebida do Google Apps Script (tentativa getAllData):', result);

      // Se retornou com sucesso com a estrutura completa
      if ((result.status === 'ok' || result.success) && result.data && (result.data.surveys || Array.isArray(result.data))) {
        return this.processFullDatabasePayload(result.data);
      }

      // Se retornou erro de ação desconhecida ou não suportada (versões anteriores do Apps Script)
      const isUnrecognizedAction = result.status === 'error' && (
        String(result.message || '').toLowerCase().includes('desconhecida') ||
        String(result.message || '').toLowerCase().includes('não suportada') ||
        String(result.message || '').includes('getAllData')
      );

      if (isUnrecognizedAction || result.surveys) {
        console.warn('[API] action=getAllData não reconhecida no Apps Script atual. Ativando fallback automático multi-endpoint (action=getSurveys)...');
        return await this.fetchViaCompatibilityMode(config.webAppUrl);
      }

      // Se foi outro tipo de erro
      const errMsg = result.message || 'Erro ao processar dados da planilha Google Sheets.';
      this.lastError = errMsg;
      console.error('[API] Erro retornado pelo Google Apps Script:', errMsg);
      return {
        success: false,
        message: errMsg
      };

    } catch (err: any) {
      console.warn('[API] Falha inicial ao tentar getAllData, tentando fallback:', err);
      // Tentativa de recuperação via compatibility mode antes de desistir
      try {
        if (config.webAppUrl) {
          return await this.fetchViaCompatibilityMode(config.webAppUrl);
        }
      } catch (fallbackErr: any) {
        console.error('[API] Falha também no fallback:', fallbackErr);
      }

      this.lastError = err.message || 'Falha de comunicação com o Google Apps Script.';
      this.saveGasConfig({ isConnected: false });
      return {
        success: false,
        message: err.message || 'Falha de comunicação com o Google Apps Script.'
      };
    }
  }

  /**
   * Processa e normaliza o payload completo do banco de dados (surveys, questions, options, respondents, answers).
   */
  private static processFullDatabasePayload(data: any): {
    success: boolean;
    data: {
      surveys: Survey[];
      questions: Question[];
      options: Option[];
      respondents: Respondent[];
      answers: Answer[];
    };
  } {
    const rawSurveys: any[] = data.surveys || (Array.isArray(data) ? data : []);
    const rawQuestions: any[] = data.questions || [];
    const rawOptions: any[] = data.options || [];
    const rawRespondents: any[] = data.respondents || [];
    const rawAnswers: any[] = data.answers || [];

    // Normalização e Saneamento de Surveys
    this.surveys = rawSurveys.map((s) => {
      let status: SurveyStatus = 'Rascunho';
      const sLower = String(s.status || '').toLowerCase();
      if (sLower === 'publicada' || sLower === 'published') status = 'Publicada';
      else if (sLower === 'encerrada' || sLower === 'closed') status = 'Encerrada';
      else if (sLower === 'arquivada' || sLower === 'archived') status = 'Arquivada';
      else status = 'Rascunho';

      return {
        id: String(s.id),
        titulo: String(s.titulo || 'Pesquisa sem título'),
        descricao: String(s.descricao || ''),
        status,
        data_criacao: String(s.data_criacao || ''),
        data_inicio: s.data_inicio ? String(s.data_inicio) : undefined,
        data_fim: s.data_fim ? String(s.data_fim) : undefined,
        link_publico: String(s.link_publico || s.id),
        configuracoes: typeof s.configuracoes === 'object' && s.configuracoes !== null
          ? s.configuracoes
          : { exigir_nome: true, permitir_anonimo: false, permitir_multiplas_respostas: false },
        criado_por: s.criado_por ? String(s.criado_por) : undefined
      };
    });

    // Saneamento de Questions
    const seenQuestionIds = new Set<string>();
    this.questions = rawQuestions.map((q, qIndex) => {
      let qId = String(q.id);
      if (!qId || seenQuestionIds.has(qId)) {
        qId = `${q.survey_id || 'q'}_fix_${qIndex + 1}_${Math.random().toString(36).substring(2, 6)}`;
      }
      seenQuestionIds.add(qId);

      return {
        id: qId,
        survey_id: String(q.survey_id),
        ordem: Number(q.ordem) || (qIndex + 1),
        titulo: String(q.titulo || `Pergunta #${qIndex + 1}`),
        descricao: q.descricao ? String(q.descricao) : undefined,
        tipo: q.tipo || 'single_choice',
        obrigatoria: Boolean(q.obrigatoria),
        ativa: q.ativa !== false
      };
    });

    // Saneamento de Options
    const seenOptionIds = new Set<string>();
    this.options = rawOptions.map((opt, optIndex) => {
      let optId = String(opt.id);
      if (!optId || seenOptionIds.has(optId)) {
        optId = `${opt.question_id || 'opt'}_fix_${optIndex + 1}_${Math.random().toString(36).substring(2, 6)}`;
      }
      seenOptionIds.add(optId);

      return {
        id: optId,
        question_id: String(opt.question_id),
        ordem: Number(opt.ordem) || (optIndex + 1),
        texto: String(opt.texto || `Opção #${optIndex + 1}`),
        valor: String(opt.valor || opt.texto || `Opção #${optIndex + 1}`),
        peso: opt.peso ? Number(opt.peso) : undefined
      };
    });

    // Respondents e Answers
    this.respondents = rawRespondents.map((r) => ({
      id: String(r.id),
      survey_id: String(r.survey_id),
      nome: String(r.nome || 'Respondente Anônimo'),
      identificador: r.identificador ? String(r.identificador) : undefined,
      data_resposta: String(r.data_resposta || ''),
      hora_resposta: String(r.hora_resposta || '')
    }));

    this.answers = rawAnswers.map((a) => ({
      id: String(a.id),
      survey_id: String(a.survey_id),
      respondent_id: String(a.respondent_id),
      question_id: String(a.question_id),
      option_id: a.option_id ? String(a.option_id) : undefined,
      valor: String(a.valor || ''),
      data_resposta: String(a.data_resposta || '')
    }));

    this.saveGasConfig({ isConnected: true, lastSync: new Date().toISOString() });
    this.lastError = null;

    console.log(`[API] Sincronização concluída com sucesso: ${this.surveys.length} pesquisas, ${this.questions.length} perguntas, ${this.respondents.length} respondentes`);

    return {
      success: true,
      data: {
        surveys: this.surveys,
        questions: this.questions,
        options: this.options,
        respondents: this.respondents,
        answers: this.answers
      }
    };
  }

  /**
   * Modo de Compatibilidade para versões do Google Apps Script que usam action=getSurveys, getSurvey e getResponses
   */
  private static async fetchViaCompatibilityMode(webAppUrl: string): Promise<{
    success: boolean;
    data?: {
      surveys: Survey[];
      questions: Question[];
      options: Option[];
      respondents: Respondent[];
      answers: Answer[];
    };
    message?: string;
  }> {
    console.log('[API] Executando busca no modo de compatibilidade (action=getSurveys)...');
    const url = webAppUrl.includes('?')
      ? `${webAppUrl}&action=getSurveys&_t=${Date.now()}`
      : `${webAppUrl}?action=getSurveys&_t=${Date.now()}`;

    const response = await fetch(url, {
      method: 'GET',
      mode: 'cors',
      headers: { 'Accept': 'application/json' }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ao carregar pesquisas no modo de compatibilidade.`);
    }

    const result = await response.json();
    console.log('[API] Resposta recebida de getSurveys:', result);

    const rawSurveys: any[] = (result.data && Array.isArray(result.data)) 
      ? result.data 
      : (result.surveys || (Array.isArray(result) ? result : []));

    if (!Array.isArray(rawSurveys)) {
      throw new Error(result.message || 'Estrutura de pesquisas inválida retornada pelo Apps Script.');
    }

    // Normalizar surveys
    const surveys: Survey[] = rawSurveys.map((s) => {
      let status: SurveyStatus = 'Rascunho';
      const sLower = String(s.status || '').toLowerCase();
      if (sLower === 'publicada' || sLower === 'published') status = 'Publicada';
      else if (sLower === 'encerrada' || sLower === 'closed') status = 'Encerrada';
      else if (sLower === 'arquivada' || sLower === 'archived') status = 'Arquivada';
      else status = 'Rascunho';

      return {
        id: String(s.id),
        titulo: String(s.titulo || 'Pesquisa sem título'),
        descricao: String(s.descricao || ''),
        status,
        data_criacao: String(s.data_criacao || ''),
        data_inicio: s.data_inicio ? String(s.data_inicio) : undefined,
        data_fim: s.data_fim ? String(s.data_fim) : undefined,
        link_publico: String(s.link_publico || s.id),
        configuracoes: typeof s.configuracoes === 'object' && s.configuracoes !== null
          ? s.configuracoes
          : { exigir_nome: true, permitir_anonimo: false, permitir_multiplas_respostas: false },
        criado_por: s.criado_por ? String(s.criado_por) : undefined
      };
    });

    this.surveys = surveys;

    // Se não há pesquisas, definir arrays vazios e retornar sucesso
    if (surveys.length === 0) {
      this.questions = [];
      this.options = [];
      this.respondents = [];
      this.answers = [];
      this.saveGasConfig({ isConnected: true, lastSync: new Date().toISOString() });
      this.lastError = null;
      return {
        success: true,
        data: {
          surveys: [],
          questions: [],
          options: [],
          respondents: [],
          answers: []
        }
      };
    }

    // Carregar detalhes (Perguntas, Opções, Respondentes) para cada pesquisa em paralelo
    const allQuestions: Question[] = [];
    const allOptions: Option[] = [];
    const allRespondents: Respondent[] = [];
    const allAnswers: Answer[] = [];

    const detailPromises = surveys.map(async (survey) => {
      try {
        // 1. Buscar perguntas e opções
        const surveyDetailUrl = webAppUrl.includes('?')
          ? `${webAppUrl}&action=getSurvey&id=${encodeURIComponent(survey.id)}&_t=${Date.now()}`
          : `${webAppUrl}?action=getSurvey&id=${encodeURIComponent(survey.id)}&_t=${Date.now()}`;
        
        const detailRes = await fetch(surveyDetailUrl, { headers: { 'Accept': 'application/json' } });
        if (detailRes.ok) {
          const detailJson = await detailRes.json();
          if (detailJson.data) {
            if (Array.isArray(detailJson.data.questions)) {
              detailJson.data.questions.forEach((q: any) => {
                allQuestions.push({
                  id: String(q.id),
                  survey_id: String(q.survey_id || survey.id),
                  ordem: Number(q.ordem) || 1,
                  titulo: String(q.titulo || ''),
                  descricao: q.descricao ? String(q.descricao) : undefined,
                  tipo: q.tipo || 'single_choice',
                  obrigatoria: Boolean(q.obrigatoria),
                  ativa: q.ativa !== false
                });
              });
            }
            if (Array.isArray(detailJson.data.options)) {
              detailJson.data.options.forEach((opt: any) => {
                allOptions.push({
                  id: String(opt.id),
                  question_id: String(opt.question_id),
                  ordem: Number(opt.ordem) || 1,
                  texto: String(opt.texto || ''),
                  valor: String(opt.valor || opt.texto || ''),
                  peso: opt.peso ? Number(opt.peso) : undefined
                });
              });
            }
          }
        }

        // 2. Buscar respostas/respondentes
        const responsesUrl = webAppUrl.includes('?')
          ? `${webAppUrl}&action=getResponses&id=${encodeURIComponent(survey.id)}&_t=${Date.now()}`
          : `${webAppUrl}?action=getResponses&id=${encodeURIComponent(survey.id)}&_t=${Date.now()}`;
        
        const respRes = await fetch(responsesUrl, { headers: { 'Accept': 'application/json' } });
        if (respRes.ok) {
          const respJson = await respRes.json();
          const respData = respJson.data || respJson;
          if (respData) {
            if (Array.isArray(respData.respondents)) {
              respData.respondents.forEach((r: any) => {
                allRespondents.push({
                  id: String(r.id),
                  survey_id: String(r.survey_id || survey.id),
                  nome: String(r.nome || 'Respondente'),
                  identificador: r.identificador ? String(r.identificador) : undefined,
                  data_resposta: String(r.data_resposta || ''),
                  hora_resposta: String(r.hora_resposta || '')
                });
              });
            }
            if (Array.isArray(respData.answers)) {
              respData.answers.forEach((a: any) => {
                allAnswers.push({
                  id: String(a.id),
                  survey_id: String(a.survey_id || survey.id),
                  respondent_id: String(a.respondent_id),
                  question_id: String(a.question_id),
                  option_id: a.option_id ? String(a.option_id) : undefined,
                  valor: String(a.valor || ''),
                  data_resposta: String(a.data_resposta || '')
                });
              });
            }
          }
        }
      } catch (err) {
        console.warn(`[API] Aviso ao carregar detalhes da pesquisa ${survey.id}:`, err);
      }
    });

    await Promise.allSettled(detailPromises);

    this.questions = allQuestions;
    this.options = allOptions;
    this.respondents = allRespondents;
    this.answers = allAnswers;

    this.saveGasConfig({ isConnected: true, lastSync: new Date().toISOString() });
    this.lastError = null;

    console.log(`[API] Modo de compatibilidade concluído com sucesso: ${this.surveys.length} pesquisas, ${this.questions.length} perguntas.`);

    return {
      success: true,
      data: {
        surveys: this.surveys,
        questions: this.questions,
        options: this.options,
        respondents: this.respondents,
        answers: this.answers
      }
    };
  }

  // ==========================================
  // OPERAÇÕES DE PESQUISAS (SURVEYS)
  // ==========================================

  public static getSurveys(): Survey[] {
    return [...this.surveys];
  }

  public static getSurvey(idOrSlug: string): { survey: Survey; questions: Question[]; options: Option[] } | null {
    const clean = extractCleanSurveySlug(idOrSlug).toLowerCase();
    const survey = this.surveys.find((s) => {
      const sId = String(s.id).toLowerCase();
      const sLink = extractCleanSurveySlug(String(s.link_publico || '')).toLowerCase();
      const sTitleSlug = String(s.titulo || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      const sTitle = String(s.titulo || '').toLowerCase();
      return sId === clean || sLink === clean || sTitleSlug === clean || sTitle === clean || s.id === idOrSlug || s.link_publico === idOrSlug;
    });
    if (!survey) return null;

    const questions = this.questions
      .filter((q) => q.survey_id === survey.id)
      .sort((a, b) => a.ordem - b.ordem);

    const questionIds = new Set(questions.map((q) => q.id));
    const options = this.options
      .filter((opt) => questionIds.has(opt.question_id))
      .sort((a, b) => a.ordem - b.ordem);

    return { survey, questions, options };
  }

  public static getSurveyResponses(surveyId: string): { respondents: Respondent[]; answers: Answer[] } {
    const respondents = this.respondents.filter((r) => r.survey_id === surveyId);
    const answers = this.answers.filter((a) => a.survey_id === surveyId);
    return { respondents, answers };
  }

  /**
   * Busca uma pesquisa pública diretamente (intermediada pelo backend do PesquisaHub ou via Apps Script)
   */
  public static async fetchPublicSurvey(surveyIdOrSlug: string): Promise<{
    survey: Survey;
    questions: Question[];
    options: Option[];
  } | null> {
    const cleanId = encodeURIComponent(surveyIdOrSlug.trim());

    // 1. Tentar intermediador seguro do backend PesquisaHub (/api/public/survey/:id)
    try {
      const serverRes = await fetch(`/api/public/survey/${cleanId}`);
      if (serverRes.ok) {
        const json = await serverRes.json();
        if (json.status === 'ok' && json.data && json.data.survey) {
          const { survey, questions, options } = json.data;
          
          const existingIdx = this.surveys.findIndex((s) => s.id === survey.id);
          if (existingIdx >= 0) this.surveys[existingIdx] = survey;
          else this.surveys.push(survey);

          if (Array.isArray(questions)) {
            questions.forEach((q: Question) => {
              const qIdx = this.questions.findIndex((existingQ) => existingQ.id === q.id);
              if (qIdx >= 0) this.questions[qIdx] = q;
              else this.questions.push(q);
            });
          }

          if (Array.isArray(options)) {
            options.forEach((opt: Option) => {
              const optIdx = this.options.findIndex((existingOpt) => existingOpt.id === opt.id);
              if (optIdx >= 0) this.options[optIdx] = opt;
              else this.options.push(opt);
            });
          }

          return { survey, questions: questions || [], options: options || [] };
        }
      }
    } catch (e) {
      console.warn('[API] Backend PesquisaHub indisponível para consulta pública, tentando fallback direto:', e);
    }

    // 2. Fallback: Se temos a URL do Apps Script no cliente, buscar online diretamente da planilha
    const config = this.getGasConfig();
    if (config.webAppUrl) {
      try {
        const url = config.webAppUrl.includes('?')
          ? `${config.webAppUrl}&action=getSurvey&id=${cleanId}&_t=${Date.now()}`
          : `${config.webAppUrl}?action=getSurvey&id=${cleanId}&_t=${Date.now()}`;

        console.log(`[API] Buscando pesquisa pública "${surveyIdOrSlug}" no Google Sheets...`);
        const response = await fetch(url, {
          method: 'GET',
          mode: 'cors',
          headers: { 'Accept': 'application/json' }
        });

        if (response.ok) {
          const result = await response.json();
          if ((result.status === 'ok' || result.success) && result.data && result.data.survey) {
            const { survey, questions, options } = result.data;
            
            // Atualizar estado em memória
            const existingIdx = this.surveys.findIndex((s) => s.id === survey.id);
            if (existingIdx >= 0) {
              this.surveys[existingIdx] = survey;
            } else {
              this.surveys.push(survey);
            }

            if (questions && questions.length > 0) {
              questions.forEach((q: Question) => {
                const qIdx = this.questions.findIndex((existingQ) => existingQ.id === q.id);
                if (qIdx >= 0) this.questions[qIdx] = q;
                else this.questions.push(q);
              });
            }

            if (options && options.length > 0) {
              options.forEach((opt: Option) => {
                const optIdx = this.options.findIndex((existingOpt) => existingOpt.id === opt.id);
                if (optIdx >= 0) this.options[optIdx] = opt;
                else this.options.push(opt);
              });
            }

            return { survey, questions, options };
          }
        }
      } catch (e) {
        console.warn('[API] Erro ao buscar pesquisa pública online, verificando memória local:', e);
      }
    }

    // Fallback para estado em memória local
    return this.getSurvey(surveyIdOrSlug);
  }

  /**
   * Salva uma nova pesquisa no Google Sheets com confirmação e IDs estritamente únicos.
   */
  public static async createSurvey(
    surveyData: Omit<Survey, 'id' | 'data_criacao'>,
    questionsData: Array<{ question: Omit<Question, 'id' | 'survey_id'>; options: Omit<Option, 'id' | 'question_id'>[] }>
  ): Promise<Survey> {
    const surveyId = generateId('srv');
    const linkPublico = surveyData.link_publico?.trim() || surveyId;
    const dateStr = new Date().toISOString().split('T')[0];

    const newSurvey: Survey = {
      ...surveyData,
      id: surveyId,
      link_publico: linkPublico,
      data_criacao: dateStr,
      data_inicio: (surveyData.status === 'Publicada' || (surveyData.status as any) === 'published') ? dateStr : undefined
    };

    const newQuestions: Question[] = [];
    const newOptions: Option[] = [];

    questionsData.forEach((qData, qIndex) => {
      // ID Único por pergunta: q_srv_TIMESTAMP_RANDOM_INDEX
      const questionId = `${generateId('q')}_${qIndex + 1}`;
      const newQuestion: Question = {
        ...qData.question,
        id: questionId,
        survey_id: surveyId,
        ordem: qIndex + 1,
        ativa: true
      };
      newQuestions.push(newQuestion);

      qData.options.forEach((optData, optIndex) => {
        // ID Único por opção: opt_TIMESTAMP_RANDOM_INDEX
        const optionId = `${generateId('opt')}_${optIndex + 1}`;
        const newOption: Option = {
          ...optData,
          id: optionId,
          question_id: questionId,
          ordem: optIndex + 1,
          valor: optData.valor || optData.texto
        };
        newOptions.push(newOption);
      });
    });

    // Atualizar estado em memória antecipadamente
    this.surveys.unshift(newSurvey);
    this.questions.push(...newQuestions);
    this.options.push(...newOptions);

    // Enviar e aguardar confirmação do Google Apps Script
    const config = this.getGasConfig();
    if (config.webAppUrl) {
      console.log(`[API] Enviando nova pesquisa "${newSurvey.titulo}" (${newSurvey.id}) com ${newQuestions.length} perguntas para o Google Sheets...`);
      try {
        const response = await fetch(config.webAppUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({
            action: 'createSurvey',
            payload: {
              survey: newSurvey,
              questions: newQuestions,
              options: newOptions
            }
          })
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status} ao salvar pesquisa: ${response.statusText}`);
        }

        const result = await response.json();
        console.log('[API] Resposta de createSurvey recebida:', result);

        if (result.status !== 'ok' && result.success !== true) {
          throw new Error(result.message || 'A API retornou erro ao salvar a pesquisa.');
        }
      } catch (err: any) {
        console.error('[API] Falha ao enviar createSurvey para o Apps Script:', err);
        throw err; // Repassar para que a interface informe ao usuário
      }
    } else {
      console.warn('[API] Atenção: Google Apps Script não configurado. Pesquisa salva apenas na sessão atual.');
    }

    return newSurvey;
  }

  /**
   * Atualiza o status da pesquisa no Google Sheets ('Publicada', 'Rascunho', 'Encerrada', 'Arquivada').
   */
  public static async updateSurveyStatus(surveyId: string, newStatus: SurveyStatus): Promise<boolean> {
    // 1. Atualizar localmente
    const survey = this.surveys.find((s) => s.id === surveyId);
    if (survey) {
      survey.status = newStatus;
      if (newStatus === 'Publicada' && !survey.data_inicio) {
        survey.data_inicio = new Date().toISOString().split('T')[0];
      } else if (newStatus === 'Encerrada') {
        survey.data_fim = new Date().toISOString().split('T')[0];
      }
    }

    // 2. Persistir no Google Sheets
    const config = this.getGasConfig();
    if (config.webAppUrl) {
      console.log(`[API] Atualizando status da pesquisa ${surveyId} para "${newStatus}" no Google Sheets...`);
      try {
        const response = await fetch(config.webAppUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({
            action: 'updateSurveyStatus',
            id: surveyId,
            status: newStatus
          })
        });
        const result = await response.json();
        console.log('[API] Resposta de updateSurveyStatus:', result);
        return result.status === 'ok' || result.success === true;
      } catch (err) {
        console.error('[API] Erro ao atualizar status no Google Sheets:', err);
        return false;
      }
    }
    return true;
  }

  /**
   * Exclui a pesquisa e seus dados no Google Sheets.
   */
  public static async deleteSurvey(surveyId: string): Promise<boolean> {
    // 1. Remover da memória local
    this.surveys = this.surveys.filter((s) => s.id !== surveyId);
    this.questions = this.questions.filter((q) => q.survey_id !== surveyId);
    this.respondents = this.respondents.filter((r) => r.survey_id !== surveyId);
    this.answers = this.answers.filter((a) => a.survey_id !== surveyId);

    // 2. Persistir no Google Sheets
    const config = this.getGasConfig();
    if (config.webAppUrl) {
      console.log(`[API] Excluindo pesquisa ${surveyId} do Google Sheets...`);
      try {
        const response = await fetch(config.webAppUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({
            action: 'deleteSurvey',
            id: surveyId
          })
        });
        const result = await response.json();
        console.log('[API] Resposta de deleteSurvey:', result);
        return result.status === 'ok' || result.success === true;
      } catch (err) {
        console.error('[API] Erro ao excluir pesquisa no Google Sheets:', err);
        return false;
      }
    }
    return true;
  }

  /**
   * Duplica uma pesquisa existente criando um novo Rascunho com novos IDs únicos.
   */
  public static async duplicateSurvey(surveyId: string): Promise<Survey | null> {
    const original = this.getSurvey(surveyId);
    if (!original) return null;

    const newSurveyData: Omit<Survey, 'id' | 'data_criacao'> = {
      titulo: `${original.survey.titulo} (Cópia)`,
      descricao: original.survey.descricao,
      status: 'Rascunho',
      link_publico: `copia-${original.survey.link_publico}-${Date.now().toString(36)}`,
      configuracoes: { ...original.survey.configuracoes }
    };

    const newQuestionsData = original.questions.map((q) => {
      const qOptions = original.options.filter((opt) => opt.question_id === q.id);
      return {
        question: {
          ordem: q.ordem,
          titulo: q.titulo,
          descricao: q.descricao,
          tipo: q.tipo,
          obrigatoria: q.obrigatoria,
          ativa: true
        },
        options: qOptions.map((opt) => ({
          ordem: opt.ordem,
          texto: opt.texto,
          valor: opt.valor,
          peso: opt.peso
        }))
      };
    });

    return this.createSurvey(newSurveyData, newQuestionsData);
  }

  // ==========================================
  // GRAVAÇÃO DE RESPOSTAS PÚBLICAS
  // ==========================================

  /**
   * Submete as respostas de um respondente anônimo/público diretamente para o Google Sheets.
   */
  public static async submitResponse(
    surveyId: string,
    respondentName: string,
    answersMap: Record<string, string | string[]>,
    identificador?: string
  ): Promise<{ success: boolean; message: string }> {
    const dateStr = new Date().toISOString().split('T')[0];
    const hourStr = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const respId = generateId('resp');

    const newRespondent: Respondent = {
      id: respId,
      survey_id: surveyId,
      nome: respondentName.trim(),
      identificador: identificador?.trim() || undefined,
      data_resposta: dateStr,
      hora_resposta: hourStr
    };

    const newAnswers: Answer[] = [];

    Object.entries(answersMap).forEach(([questionId, rawVal]) => {
      if (Array.isArray(rawVal)) {
        rawVal.forEach((v, vIdx) => {
          const matchedOpt = this.options.find((o) => o.question_id === questionId && (o.valor === v || o.texto === v));
          newAnswers.push({
            id: `${generateId('ans')}_${vIdx + 1}`,
            survey_id: surveyId,
            respondent_id: respId,
            question_id: questionId,
            option_id: matchedOpt?.id,
            valor: v,
            data_resposta: dateStr
          });
        });
      } else if (rawVal && String(rawVal).trim() !== '') {
        const strVal = String(rawVal).trim();
        const matchedOpt = this.options.find((o) => o.question_id === questionId && (o.valor === strVal || o.texto === strVal));
        newAnswers.push({
          id: generateId('ans'),
          survey_id: surveyId,
          respondent_id: respId,
          question_id: questionId,
          option_id: matchedOpt?.id,
          valor: strVal,
          data_resposta: dateStr
        });
      }
    });

    // Atualizar memória local
    this.respondents.push(newRespondent);
    this.answers.push(...newAnswers);

    // 1. Tentar gravar via intermediador seguro do backend PesquisaHub (/api/public/submit-response)
    try {
      const serverRes = await fetch('/api/public/submit-response', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          survey_id: surveyId,
          nome: respondentName,
          identificador,
          respostas: answersMap
        })
      });

      if (serverRes.ok) {
        const json = await serverRes.json();
        if (json.status === 'ok' || json.success) {
          console.log('[API] Resposta gravada com sucesso via PesquisaHub Backend:', json);
          return {
            success: true,
            message: json.message || 'Resposta registrada com sucesso no PesquisaHub e sincronizada com a nuvem!'
          };
        }
      }
    } catch (e) {
      console.warn('[API] Backend PesquisaHub indisponível para envio de resposta, tentando Apps Script direto:', e);
    }

    // 2. Fallback: Enviar diretamente para o Google Apps Script se configurado no cliente
    const config = this.getGasConfig();
    if (config.webAppUrl) {
      console.log(`[API] Gravando resposta de "${respondentName}" na pesquisa ${surveyId} no Google Sheets...`);
      try {
        const response = await fetch(config.webAppUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({
            action: 'submitResponse',
            payload: {
              survey_id: surveyId,
              respondent: newRespondent,
              answers: newAnswers
            }
          })
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status} ao registrar resposta.`);
        }

        const result = await response.json();
        console.log('[API] Resposta de submitResponse recebida:', result);

        if (result.status === 'ok' || result.success) {
          return {
            success: true,
            message: result.data?.message || result.message || 'Resposta registrada com sucesso no Google Sheets!'
          };
        } else {
          return {
            success: false,
            message: result.message || 'Erro ao registrar resposta no Google Sheets.'
          };
        }
      } catch (err: any) {
        console.error('[API] Falha ao enviar resposta para o Apps Script:', err);
        return {
          success: false,
          message: err.message || 'Falha de comunicação ao gravar a resposta na planilha.'
        };
      }
    }

    return {
      success: true,
      message: 'Resposta registrada com sucesso!'
    };
  }

  // ==========================================
  // UPLOAD DE FOTOS (RESPOSTAS DO TIPO "FOTO")
  // ==========================================

  /**
   * Envia uma foto (já comprimida e em base64) para o Google Apps Script, que a
   * salva no Google Drive e devolve uma URL pública para usar como valor da resposta.
   */
  public static async uploadPhotoAnswer(
    surveyId: string,
    base64: string,
    mimeType: string
  ): Promise<string> {
    const config = this.getGasConfig();
    if (!config.webAppUrl) {
      throw new Error('Google Apps Script não configurado.');
    }

    const response = await fetch(config.webAppUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'uploadPhoto',
        surveyId,
        mimeType,
        base64
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ao enviar a foto.`);
    }

    const result = await response.json();
    if (result.status !== 'ok' && result.success !== true) {
      throw new Error(result.message || 'Não foi possível enviar a foto.');
    }
    return result.data.url as string;
  }

  // ==========================================
  // ANÁLISE DE SENTIMENTO COM IA (GEMINI)
  // ==========================================

  /**
   * Busca uma análise de sentimento já em cache (rápida, não chama a IA).
   * Use antes de exibir a tela, para não deixar o usuário esperando à toa.
   */
  public static async getSentimentAnalysis(
    surveyId: string,
    questionId: string
  ): Promise<SentimentAnalysisResult | null> {
    const config = this.getGasConfig();
    if (!config.webAppUrl) return null;
    const token = AuthService.getToken();
    const tokenParam = token ? `&token=${encodeURIComponent(token)}` : '';

    const url = `${config.webAppUrl}?action=getSentimentAnalysis&survey_id=${encodeURIComponent(surveyId)}&question_id=${encodeURIComponent(questionId)}${tokenParam}`;
    const response = await fetch(url);
    if (!response.ok) return null;
    const result = await response.json();
    if ((result.status === 'ok' || result.success) && result.data) {
      return result.data as SentimentAnalysisResult;
    }
    return null;
  }

  /**
   * Dispara (ou atualiza) a análise de sentimento via IA para uma pergunta de texto livre.
   * Só reprocessa de fato quando há respostas novas desde a última análise (economiza cota gratuita).
   */
  public static async analyzeSentiment(
    surveyId: string,
    questionId: string
  ): Promise<SentimentAnalysisResult> {
    const config = this.getGasConfig();
    if (!config.webAppUrl) {
      throw new Error('Google Apps Script não configurado.');
    }
    const token = AuthService.getToken();
    if (!token) throw new Error('Você não está logado.');

    const response = await fetch(config.webAppUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'analisarSentimento',
        token,
        surveyId,
        questionId
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ao analisar sentimento.`);
    }

    const result = await response.json();
    if (result.status !== 'ok' && result.success !== true) {
      throw new Error(result.message || 'Não foi possível concluir a análise de sentimento.');
    }
    return result.data as SentimentAnalysisResult;
  }

  // ==========================================
  // IDENTIDADE VISUAL (LOGO / MARCA)
  // ==========================================

  /**
   * Busca a logo e o nome de exibição configurados pelo administrador.
   * Leitura pública — usada tanto no painel quanto no formulário público e no login.
   */
  public static async getAppSettings(): Promise<AppSettings> {
    const fallback: AppSettings = { logoUrl: '', nomeExibicao: '' };
    const config = this.getGasConfig();
    if (!config.webAppUrl) return fallback;

    try {
      const response = await fetch(`${config.webAppUrl}?action=getAppSettings&_t=${Date.now()}`);
      if (!response.ok) return fallback;
      const result = await response.json();
      if ((result.status === 'ok' || result.success) && result.data) {
        return { logoUrl: result.data.logoUrl || '', nomeExibicao: result.data.nomeExibicao || '' };
      }
      return fallback;
    } catch (e) {
      return fallback;
    }
  }

  /**
   * Salva a logo e/ou o nome de exibição. Apenas o ADM pode alterar (validado no backend).
   */
  public static async saveAppSettings(logoUrl?: string, nomeExibicao?: string): Promise<void> {
    const config = this.getGasConfig();
    if (!config.webAppUrl) throw new Error('Google Apps Script não configurado.');
    const token = AuthService.getToken();
    if (!token) throw new Error('Você não está logado.');

    const response = await fetch(config.webAppUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'saveAppSettings', token, logoUrl, nomeExibicao })
    });

    if (!response.ok) throw new Error(`HTTP ${response.status} ao salvar identidade visual.`);
    const result = await response.json();
    if (result.status !== 'ok' && result.success !== true) {
      throw new Error(result.message || 'Não foi possível salvar a identidade visual.');
    }
  }

  // ==========================================
  // EXPORTAÇÃO CSV DE DADOS REAIS
  // ==========================================
  public static exportToCSV(surveyId: string): string {
    const survey = this.surveys.find((s) => s.id === surveyId);
    if (!survey) return '';

    const questions = this.questions
      .filter((q) => q.survey_id === surveyId)
      .sort((a, b) => a.ordem - b.ordem);
    const respondents = this.respondents.filter((r) => r.survey_id === surveyId);
    const answers = this.answers.filter((a) => a.survey_id === surveyId);

    const headers = [
      'ID Respondente',
      'Nome',
      'Identificador',
      'Data Resposta',
      'Hora Resposta',
      ...questions.map((q) => `"${q.titulo.replace(/"/g, '""')}"`)
    ];

    const rows = respondents.map((resp) => {
      const respAnswers = answers.filter((a) => a.respondent_id === resp.id);
      const rowCols = [
        resp.id,
        `"${resp.nome.replace(/"/g, '""')}"`,
        resp.identificador ? `"${resp.identificador.replace(/"/g, '""')}"` : '""',
        resp.data_resposta,
        resp.hora_resposta || ''
      ];

      questions.forEach((q) => {
        const qAnswers = respAnswers.filter((a) => a.question_id === q.id);
        const valStr = qAnswers.map((a) => a.valor).join('; ');
        rowCols.push(`"${valStr.replace(/"/g, '""')}"`);
      });

      return rowCols.join(',');
    });

    return [headers.join(','), ...rows].join('\n');
  }
}
