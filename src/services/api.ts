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
import { SUPABASE_URL, GAS_STORAGE_KEY } from './config';
import { AuthService } from './authService';
import { supabase, mensagemDeErro, chamarFuncao } from './supabaseClient';

/**
 * =========================================================================
 * PESQUISAHUB — CAMADA DE DADOS (SUPABASE)
 *
 * Substitui a comunicação com o Google Apps Script. Os nomes dos métodos e o
 * formato dos dados foram mantidos iguais aos da versão anterior, para que as
 * telas (dashboard, lista, construtor, análises) continuem funcionando sem mudança.
 * =========================================================================
 */

/**
 * Configuração Central do PesquisaHub
 */
export const APP_CONFIG = {
  get API_URL(): string {
    return SUPABASE_URL;
  },
  get PUBLIC_APP_URL(): string {
    const config = ApiService.getGasConfig();
    const custom = config.publicAppUrl?.trim();
    if (custom) {
      return custom.replace(/\/+$/, '');
    }
    if (typeof window !== 'undefined' && window.location) {
      const pathname = window.location.pathname.replace(/\/+$/, '');
      return `${window.location.origin}${pathname}`;
    }
    return 'https://app-pesquisa-hub.vercel.app';
  }
};

/**
 * Extrai o slug/ID limpo da pesquisa caso seja fornecida uma URL inteira ou caminho
 */
export function extractCleanSurveySlug(surveyIdOrSlugOrUrl: string): string {
  if (!surveyIdOrSlugOrUrl) return '';
  let str = String(surveyIdOrSlugOrUrl).trim();

  if (str.includes('/responder/')) {
    const parts = str.split('/responder/');
    str = parts[parts.length - 1];
  } else if (str.includes('#responder-')) {
    str = str.replace('#responder-', '');
  } else if (str.includes('#/responder-')) {
    str = str.replace('#/responder-', '');
  }

  str = str.split('?')[0].split('#')[0].replace(/^\/+|\/+$/g, '').trim();
  return str || 'pesquisa';
}

/**
 * Função central e única para gerar o Link Público da pesquisa
 */
export function generatePublicSurveyUrl(surveyIdOrSlug: string): string {
  const baseUrl = APP_CONFIG.PUBLIC_APP_URL;
  const cleanId = extractCleanSurveySlug(surveyIdOrSlug);
  return `${baseUrl}/#/responder/${encodeURIComponent(cleanId)}`;
}

/**
 * O link direto do Apps Script deixou de existir com a migração ao Supabase.
 * Devolver vazio faz a janela de compartilhamento mostrar só o link do app.
 */
export function generateGasDirectFormUrl(_surveyIdOrSlug: string): string {
  return '';
}

/**
 * Gerador centralizado de IDs únicos (timestamp + entropia)
 */
export function generateId(prefix: 'srv' | 'q' | 'opt' | 'resp' | 'ans' | string): string {
  const timestamp = Date.now().toString(36);
  const randomEntropy = Math.random().toString(36).substring(2, 8);
  return `${prefix}_${timestamp}_${randomEntropy}`;
}

/**
 * O Supabase devolve no máximo 1000 linhas por consulta. Esta função busca em
 * páginas de 1000 até trazer tudo (importante para as respostas, que crescem rápido).
 */
async function buscarTodasAsLinhas<T = any>(
  montarConsulta: () => any,
  tamanhoPagina = 1000
): Promise<T[]> {
  const todas: T[] = [];
  let inicio = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data, error } = await montarConsulta().range(inicio, inicio + tamanhoPagina - 1);
    if (error) throw new Error(mensagemDeErro(error, 'Erro ao ler dados do banco.'));
    const lote = (data || []) as T[];
    todas.push(...lote);
    if (lote.length < tamanhoPagina) break;
    inicio += tamanhoPagina;
  }
  return todas;
}

function hojeISO(): string {
  const agora = new Date();
  const local = new Date(agora.getTime() - agora.getTimezoneOffset() * 60000);
  return local.toISOString().split('T')[0];
}

function base64ParaBlob(base64: string, mimeType: string): Blob {
  const limpo = base64.includes(',') ? base64.split(',')[1] : base64;
  const binario = atob(limpo);
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  return new Blob([bytes], { type: mimeType || 'image/jpeg' });
}

export class ApiService {
  private static isInitialized = false;

  // Cache em memória da sessão atual do navegador.
  // `surveys` e `respondents` vêm da carga leve (fetchDashboardDataFromSheets);
  // `questions`, `options` e `answers` chegam quando uma pesquisa é aberta.
  private static surveys: Survey[] = [];
  private static questions: Question[] = [];
  private static options: Option[] = [];
  private static respondents: Respondent[] = [];
  private static answers: Answer[] = [];

  private static lastError: string | null = null;

  public static init(): void {
    if (this.isInitialized) return;
    this.isInitialized = true;
  }

  public static getLastError(): string | null {
    return this.lastError;
  }

  // ==========================================
  // CONFIGURAÇÃO DE CONEXÃO (compatibilidade)
  // ==========================================

  /**
   * Mantido com o mesmo nome por compatibilidade com as telas. Agora o backend é
   * sempre o Supabase (fixo no código); só a URL pública do app é configurável.
   */
  public static getGasConfig(): GoogleAppsScriptConfig {
    let stored: Partial<GoogleAppsScriptConfig> = {};
    try {
      const raw = localStorage.getItem(GAS_STORAGE_KEY);
      if (raw) stored = JSON.parse(raw);
    } catch (e) {
      stored = {};
    }
    return {
      webAppUrl: SUPABASE_URL,
      publicAppUrl: stored.publicAppUrl || undefined,
      isConnected: true,
      lastSync: stored.lastSync,
      autoSync: true
    };
  }

  public static saveGasConfig(config: Partial<GoogleAppsScriptConfig>): GoogleAppsScriptConfig {
    const atual = this.getGasConfig();
    const salvar = {
      publicAppUrl: config.publicAppUrl !== undefined ? config.publicAppUrl : atual.publicAppUrl,
      lastSync: config.lastSync || atual.lastSync
    };
    try {
      localStorage.setItem(GAS_STORAGE_KEY, JSON.stringify(salvar));
    } catch (e) {
      // ignora: preferência local apenas
    }
    return this.getGasConfig();
  }

  /**
   * Teste rápido de conexão com o banco (usado na tela de Configurações).
   */
  public static async testGasConnection(_url?: string): Promise<{
    success: boolean;
    message: string;
    latencyMs?: number;
    timestamp?: string;
    version?: string;
  }> {
    const inicio = performance.now();
    const { error } = await supabase.from('app_settings').select('chave', { count: 'exact', head: true });
    const latencyMs = Math.round(performance.now() - inicio);
    if (error) {
      return { success: false, message: mensagemDeErro(error, 'Não foi possível conectar ao banco de dados.'), latencyMs };
    }
    return {
      success: true,
      message: 'Banco de dados Supabase respondendo normalmente.',
      latencyMs,
      timestamp: new Date().toISOString(),
      version: 'Supabase'
    };
  }

  // ==========================================
  // NORMALIZAÇÃO (mantém o formato esperado pelas telas)
  // ==========================================

  private static normalizeSurveys(rawSurveys: any[]): Survey[] {
    return rawSurveys.map((s) => {
      let status: SurveyStatus = 'Rascunho';
      const sLower = String(s.status || '').toLowerCase();
      if (sLower === 'publicada' || sLower === 'published') status = 'Publicada';
      else if (sLower === 'encerrada' || sLower === 'closed') status = 'Encerrada';
      else if (sLower === 'arquivada' || sLower === 'archived') status = 'Arquivada';

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
        criado_por: s.criado_por ? String(s.criado_por) : undefined,
        total_perguntas: typeof s.total_perguntas === 'number' ? s.total_perguntas : undefined,
        total_respostas: typeof s.total_respostas === 'number' ? s.total_respostas : undefined
      } as Survey;
    });
  }

  private static normalizeQuestions(rawQuestions: any[]): Question[] {
    return rawQuestions.map((q, qIndex) => ({
      id: String(q.id),
      survey_id: String(q.survey_id),
      ordem: Number(q.ordem) || (qIndex + 1),
      titulo: String(q.titulo || `Pergunta #${qIndex + 1}`),
      descricao: q.descricao ? String(q.descricao) : undefined,
      tipo: q.tipo || 'single_choice',
      obrigatoria: Boolean(q.obrigatoria),
      ativa: q.ativa !== false
    }));
  }

  private static normalizeOptions(rawOptions: any[]): Option[] {
    return rawOptions.map((opt, optIndex) => ({
      id: String(opt.id),
      question_id: String(opt.question_id),
      ordem: Number(opt.ordem) || (optIndex + 1),
      texto: String(opt.texto || `Opção #${optIndex + 1}`),
      valor: String(opt.valor || opt.texto || `Opção #${optIndex + 1}`),
      peso: opt.peso !== null && opt.peso !== undefined && opt.peso !== '' ? Number(opt.peso) : undefined
    }));
  }

  private static normalizeRespondents(rawRespondents: any[]): Respondent[] {
    return rawRespondents.map((r) => ({
      id: String(r.id),
      survey_id: String(r.survey_id),
      nome: String(r.nome || 'Respondente Anônimo'),
      identificador: r.identificador ? String(r.identificador) : undefined,
      data_resposta: String(r.data_resposta || ''),
      hora_resposta: String(r.hora_resposta || '')
    }));
  }

  private static normalizeAnswers(rawAnswers: any[]): Answer[] {
    return rawAnswers.map((a) => ({
      id: String(a.id),
      survey_id: String(a.survey_id),
      respondent_id: String(a.respondent_id),
      question_id: String(a.question_id),
      option_id: a.option_id ? String(a.option_id) : undefined,
      valor: String(a.valor || ''),
      data_resposta: String(a.data_resposta || '')
    }));
  }

  // ==========================================
  // LEITURA
  // ==========================================

  /**
   * Carga leve: lista de pesquisas (com contadores prontos) + respondentes.
   * O próprio banco filtra o que cada usuário pode ver (admin vê tudo).
   */
  public static async fetchDashboardDataFromSheets(): Promise<{
    success: boolean;
    data?: { surveys: Survey[]; respondents: Respondent[] };
    message?: string;
  }> {
    this.init();
    try {
      const [rawSurveys, rawRespondents] = await Promise.all([
        buscarTodasAsLinhas(() =>
          supabase.from('survey_list').select('*').order('created_at', { ascending: false }).order('id')
        ),
        buscarTodasAsLinhas(() =>
          supabase
            .from('respondents')
            .select('id, survey_id, nome, identificador, data_resposta, hora_resposta')
            .order('created_at', { ascending: true })
            .order('id')
        )
      ]);

      this.surveys = this.normalizeSurveys(rawSurveys);
      this.respondents = this.normalizeRespondents(rawRespondents);
      this.lastError = null;
      this.saveGasConfig({ lastSync: new Date().toISOString() });

      return { success: true, data: { surveys: [...this.surveys], respondents: [...this.respondents] } };
    } catch (err: any) {
      this.lastError = mensagemDeErro(err, 'Falha ao carregar as pesquisas.');
      return { success: false, message: this.lastError };
    }
  }

  /**
   * Carrega perguntas, opções, respondentes e respostas de UMA pesquisa.
   */
  public static async fetchSurveyDetail(surveyId: string): Promise<{
    success: boolean;
    questions: Question[];
    options: Option[];
    respondents: Respondent[];
    answers: Answer[];
    message?: string;
  }> {
    try {
      const { data: rawQuestions, error: qErr } = await supabase
        .from('questions')
        .select('*')
        .eq('survey_id', surveyId)
        .eq('ativa', true)
        .order('ordem');
      if (qErr) throw qErr;

      const questionIds: string[] = (rawQuestions || []).map((q: any) => String(q.id));

      const [rawOptions, rawRespondents, rawAnswers] = await Promise.all([
        questionIds.length > 0
          ? buscarTodasAsLinhas(() =>
              supabase.from('options').select('*').in('question_id', questionIds).order('ordem').order('id')
            )
          : Promise.resolve([] as any[]),
        buscarTodasAsLinhas(() =>
          supabase.from('respondents').select('*').eq('survey_id', surveyId).order('created_at').order('id')
        ),
        buscarTodasAsLinhas(() =>
          supabase.from('answers').select('*').eq('survey_id', surveyId).order('id')
        )
      ]);

      const freshQuestions = this.normalizeQuestions(rawQuestions || []);
      const freshOptions = this.normalizeOptions(rawOptions as any[]);
      const freshRespondents = this.normalizeRespondents(rawRespondents as any[]);
      const freshAnswers = this.normalizeAnswers(rawAnswers as any[]);

      // Substitui no cache apenas os dados desta pesquisa
      const oldQuestionIds = new Set(this.questions.filter((q) => q.survey_id === surveyId).map((q) => q.id));
      const newQuestionIds = new Set(questionIds);
      this.questions = [...this.questions.filter((q) => q.survey_id !== surveyId), ...freshQuestions];
      this.options = [
        ...this.options.filter((o) => !oldQuestionIds.has(o.question_id) && !newQuestionIds.has(o.question_id)),
        ...freshOptions
      ];
      this.respondents = [...this.respondents.filter((r) => r.survey_id !== surveyId), ...freshRespondents];
      this.answers = [...this.answers.filter((a) => a.survey_id !== surveyId), ...freshAnswers];

      this.lastError = null;
      return {
        success: true,
        questions: this.questions,
        options: this.options,
        respondents: this.respondents,
        answers: this.answers
      };
    } catch (err: any) {
      this.lastError = mensagemDeErro(err, 'Falha ao carregar os detalhes da pesquisa.');
      return {
        success: false,
        questions: this.questions,
        options: this.options,
        respondents: this.respondents,
        answers: this.answers,
        message: this.lastError
      };
    }
  }

  public static getSurveys(): Survey[] {
    return [...this.surveys];
  }

  public static getSurvey(idOrSlug: string): { survey: Survey; questions: Question[]; options: Option[] } | null {
    const clean = extractCleanSurveySlug(idOrSlug).toLowerCase();
    const survey = this.surveys.find((s) => {
      const sId = String(s.id).toLowerCase();
      const sLink = extractCleanSurveySlug(String(s.link_publico || '')).toLowerCase();
      return sId === clean || sLink === clean || s.id === idOrSlug || s.link_publico === idOrSlug;
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
    return {
      respondents: this.respondents.filter((r) => r.survey_id === surveyId),
      answers: this.answers.filter((a) => a.survey_id === surveyId)
    };
  }

  /**
   * Busca uma pesquisa para o formulário público (sem login).
   * Se a pesquisa não estiver Publicada, volta só o cabeçalho com o status,
   * e a tela pública mostra a mensagem de "pesquisa encerrada/indisponível".
   */
  public static async fetchPublicSurvey(surveyIdOrSlug: string): Promise<{
    survey: Survey;
    questions: Question[];
    options: Option[];
  } | null> {
    const cleanId = extractCleanSurveySlug(surveyIdOrSlug);
    try {
      const { data, error } = await supabase.rpc('get_public_survey', { p_ref: cleanId });
      if (error) throw error;
      if (!data || data.found === false) return null;

      const [survey] = this.normalizeSurveys([data.survey]);
      const questions = data.aberta ? this.normalizeQuestions(data.questions || []) : [];
      const options = data.aberta ? this.normalizeOptions(data.options || []) : [];
      return { survey, questions, options };
    } catch (err) {
      console.warn('[API] Erro ao buscar pesquisa pública:', err);
      return null;
    }
  }

  // ==========================================
  // ESCRITA — PESQUISAS
  // ==========================================

  public static async createSurvey(
    surveyData: Omit<Survey, 'id' | 'data_criacao'>,
    questionsData: Array<{ question: Omit<Question, 'id' | 'survey_id'>; options: Omit<Option, 'id' | 'question_id'>[] }>
  ): Promise<Survey> {
    const usuario = AuthService.getCurrentUser();
    if (!usuario) throw new Error('Você não está logado.');

    const surveyId = generateId('srv');
    const dateStr = hojeISO();
    const publicada = surveyData.status === 'Publicada' || (surveyData.status as any) === 'published';
    let linkPublico = (surveyData.link_publico || '').trim() || surveyId;

    const montarLinhaPesquisa = (link: string) => ({
      id: surveyId,
      titulo: surveyData.titulo,
      descricao: surveyData.descricao || '',
      status: surveyData.status || 'Rascunho',
      data_criacao: dateStr,
      data_inicio: publicada ? dateStr : (surveyData.data_inicio || null),
      data_fim: surveyData.data_fim || null,
      link_publico: link,
      configuracoes: surveyData.configuracoes || {},
      criado_por: usuario.id
    });

    let { error: sErr } = await supabase.from('surveys').insert(montarLinhaPesquisa(linkPublico));
    if (sErr && (sErr as any).code === '23505') {
      // Já existe outra pesquisa com o mesmo link público: acrescenta um sufixo único
      linkPublico = `${linkPublico}-${Date.now().toString(36)}`;
      ({ error: sErr } = await supabase.from('surveys').insert(montarLinhaPesquisa(linkPublico)));
    }
    if (sErr) throw new Error(mensagemDeErro(sErr, 'Não foi possível salvar a pesquisa.'));

    const newQuestions: Question[] = [];
    const newOptions: Option[] = [];
    questionsData.forEach((qData, qIndex) => {
      const questionId = `${generateId('q')}_${qIndex + 1}`;
      newQuestions.push({
        ...qData.question,
        id: questionId,
        survey_id: surveyId,
        ordem: qIndex + 1,
        ativa: true
      });
      qData.options.forEach((optData, optIndex) => {
        newOptions.push({
          ...optData,
          id: `${generateId('opt')}_${qIndex + 1}_${optIndex + 1}`,
          question_id: questionId,
          ordem: optIndex + 1,
          valor: optData.valor || optData.texto
        });
      });
    });

    try {
      if (newQuestions.length > 0) {
        const { error } = await supabase.from('questions').insert(
          newQuestions.map((q) => ({
            id: q.id,
            survey_id: q.survey_id,
            ordem: q.ordem,
            titulo: q.titulo,
            descricao: q.descricao || '',
            tipo: q.tipo,
            obrigatoria: Boolean(q.obrigatoria),
            ativa: true
          }))
        );
        if (error) throw error;
      }
      if (newOptions.length > 0) {
        const { error } = await supabase.from('options').insert(
          newOptions.map((o) => ({
            id: o.id,
            question_id: o.question_id,
            ordem: o.ordem,
            texto: o.texto,
            valor: o.valor || o.texto,
            peso: o.peso ?? null
          }))
        );
        if (error) throw error;
      }
    } catch (err: any) {
      // Desfaz a pesquisa incompleta (as perguntas/opções saem junto, em cascata)
      await supabase.from('surveys').delete().eq('id', surveyId);
      throw new Error(mensagemDeErro(err, 'Não foi possível salvar as perguntas da pesquisa.'));
    }

    const newSurvey: Survey = {
      ...surveyData,
      id: surveyId,
      link_publico: linkPublico,
      data_criacao: dateStr,
      data_inicio: publicada ? dateStr : surveyData.data_inicio,
      criado_por: usuario.id,
      total_perguntas: newQuestions.length,
      total_respostas: 0
    };

    this.surveys.unshift(newSurvey);
    this.questions.push(...newQuestions);
    this.options.push(...newOptions);
    return newSurvey;
  }

  public static async updateSurveyStatus(surveyId: string, newStatus: SurveyStatus): Promise<boolean> {
    const hoje = hojeISO();
    const mudancas: Record<string, any> = { status: newStatus };
    const survey = this.surveys.find((s) => s.id === surveyId);

    if (newStatus === 'Publicada' && !survey?.data_inicio) mudancas.data_inicio = hoje;
    if (newStatus === 'Encerrada') mudancas.data_fim = hoje;

    const { error } = await supabase.from('surveys').update(mudancas).eq('id', surveyId);
    if (error) throw new Error(mensagemDeErro(error, 'Não foi possível atualizar o status.'));

    if (survey) {
      survey.status = newStatus;
      if (mudancas.data_inicio) survey.data_inicio = mudancas.data_inicio;
      if (mudancas.data_fim) survey.data_fim = mudancas.data_fim;
    }
    return true;
  }

  public static async deleteSurvey(surveyId: string): Promise<boolean> {
    // Perguntas, opções, respondentes, respostas e análises saem juntos (cascata no banco)
    const { error } = await supabase.from('surveys').delete().eq('id', surveyId);
    if (error) throw new Error(mensagemDeErro(error, 'Não foi possível excluir a pesquisa.'));

    const qIds = new Set(this.questions.filter((q) => q.survey_id === surveyId).map((q) => q.id));
    this.surveys = this.surveys.filter((s) => s.id !== surveyId);
    this.questions = this.questions.filter((q) => q.survey_id !== surveyId);
    this.options = this.options.filter((o) => !qIds.has(o.question_id));
    this.respondents = this.respondents.filter((r) => r.survey_id !== surveyId);
    this.answers = this.answers.filter((a) => a.survey_id !== surveyId);
    return true;
  }

  /**
   * Duplica uma pesquisa existente como novo Rascunho (requer fetchSurveyDetail antes).
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

    const newQuestionsData = original.questions.map((q) => ({
      question: {
        ordem: q.ordem,
        titulo: q.titulo,
        descricao: q.descricao,
        tipo: q.tipo,
        obrigatoria: q.obrigatoria,
        ativa: true
      },
      options: original.options
        .filter((opt) => opt.question_id === q.id)
        .map((opt) => ({ ordem: opt.ordem, texto: opt.texto, valor: opt.valor, peso: opt.peso }))
    }));

    return this.createSurvey(newSurveyData, newQuestionsData);
  }

  // ==========================================
  // GRAVAÇÃO DE RESPOSTAS PÚBLICAS
  // ==========================================

  /**
   * Grava a resposta inteira numa única chamada atômica ao banco (tudo ou nada).
   */
  public static async submitResponse(
    surveyId: string,
    respondentName: string,
    answersMap: Record<string, string | string[]>,
    identificador?: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      const { data, error } = await supabase.rpc('submit_response', {
        p_survey_id: surveyId,
        p_nome: respondentName.trim(),
        p_identificador: identificador?.trim() || '',
        p_respostas: answersMap
      });
      if (error) throw error;
      return {
        success: true,
        message: (data && data.message) || 'Resposta registrada com sucesso!'
      };
    } catch (err: any) {
      return {
        success: false,
        message: mensagemDeErro(err, 'Não foi possível gravar sua resposta. Tente novamente.')
      };
    }
  }

  // ==========================================
  // UPLOAD DE IMAGENS (LOGO / FOTOS)
  // ==========================================

  public static async uploadPhotoAnswer(surveyId: string, base64: string, mimeType: string): Promise<string> {
    const tipo = mimeType || 'image/jpeg';
    const extensao = (tipo.split('/')[1] || 'jpg').replace('jpeg', 'jpg').replace(/[^a-z0-9]/gi, '');
    const pasta = surveyId === 'app-logo' ? 'marca' : `respostas/${surveyId}`;
    const caminho = `${pasta}/${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${extensao}`;

    const { error } = await supabase.storage
      .from('fotos')
      .upload(caminho, base64ParaBlob(base64, tipo), { contentType: tipo, upsert: false });
    if (error) throw new Error(mensagemDeErro(error, 'Não foi possível enviar a imagem.'));

    const { data } = supabase.storage.from('fotos').getPublicUrl(caminho);
    return data.publicUrl;
  }

  // ==========================================
  // ANÁLISE DE SENTIMENTO COM IA (GEMINI via Edge Function)
  // ==========================================

  public static async getSentimentAnalysis(surveyId: string, questionId: string): Promise<SentimentAnalysisResult | null> {
    const { data, error } = await supabase
      .from('ai_analysis')
      .select('*')
      .eq('survey_id', surveyId)
      .eq('question_id', questionId)
      .maybeSingle();
    if (error || !data) return null;

    const pergunta = this.questions.find((q) => q.id === questionId);
    return {
      questionId: data.question_id,
      questionTitle: pergunta?.titulo || '',
      resumo: data.resumo || '',
      positivo: Number(data.positivo) || 0,
      neutro: Number(data.neutro) || 0,
      negativo: Number(data.negativo) || 0,
      pontosPositivos: Array.isArray(data.pontos_positivos) ? data.pontos_positivos : [],
      pontosNegativos: Array.isArray(data.pontos_negativos) ? data.pontos_negativos : [],
      respostasAnalisadas: Number(data.respostas_count) || 0,
      atualizadoEm: data.atualizado_em || ''
    };
  }

  public static async analyzeSentiment(surveyId: string, questionId: string): Promise<SentimentAnalysisResult> {
    const resultado = await chamarFuncao<{ data: SentimentAnalysisResult }>('analisar-sentimento', { surveyId, questionId });
    return resultado.data;
  }

  public static async updateSurveyContextoIA(surveyId: string, contextoIA: string): Promise<void> {
    const { data, error } = await supabase.from('surveys').select('configuracoes').eq('id', surveyId).maybeSingle();
    if (error) throw new Error(mensagemDeErro(error, 'Não foi possível ler a pesquisa.'));
    if (!data) throw new Error('Pesquisa não encontrada.');

    const configuracoes = { ...(data.configuracoes || {}), contexto_ia: String(contextoIA || '').trim() };
    const { error: upErr } = await supabase.from('surveys').update({ configuracoes }).eq('id', surveyId);
    if (upErr) throw new Error(mensagemDeErro(upErr, 'Não foi possível salvar o contexto.'));

    const survey = this.surveys.find((s) => s.id === surveyId);
    if (survey) survey.configuracoes = { ...survey.configuracoes, contexto_ia: configuracoes.contexto_ia };
  }

  // ==========================================
  // IDENTIDADE VISUAL (LOGO / MARCA)
  // ==========================================

  public static async getAppSettings(): Promise<AppSettings> {
    try {
      const { data, error } = await supabase.from('app_settings').select('chave, valor');
      if (error || !data) return { logoUrl: '', nomeExibicao: '' };
      const mapa: Record<string, string> = {};
      data.forEach((r: any) => { mapa[r.chave] = r.valor || ''; });
      return { logoUrl: mapa['logo_url'] || '', nomeExibicao: mapa['nome_exibicao'] || '' };
    } catch (e) {
      return { logoUrl: '', nomeExibicao: '' };
    }
  }

  public static async saveAppSettings(logoUrl?: string, nomeExibicao?: string): Promise<void> {
    const agora = new Date().toISOString();
    const linhas: Array<{ chave: string; valor: string; atualizado_em: string }> = [];
    if (logoUrl !== undefined) linhas.push({ chave: 'logo_url', valor: logoUrl, atualizado_em: agora });
    if (nomeExibicao !== undefined) linhas.push({ chave: 'nome_exibicao', valor: nomeExibicao, atualizado_em: agora });
    if (linhas.length === 0) return;

    const { error } = await supabase.from('app_settings').upsert(linhas, { onConflict: 'chave' });
    if (error) throw new Error(mensagemDeErro(error, 'Não foi possível salvar a identidade visual.'));
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
