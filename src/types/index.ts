export type SurveyStatus = 'Rascunho' | 'Publicada' | 'Encerrada' | 'Arquivada';

export type QuestionType = 
  | 'single_choice' 
  | 'multiple_choice' 
  | 'scale' 
  | 'rating' 
  | 'short_text' 
  | 'long_text'
  | 'text'
  | 'foto';

export interface SurveySettings {
  exigir_nome: boolean;
  permitir_anonimo: boolean;
  permitir_multiplas_respostas: boolean;
  tempo_estimado_min?: number;
  mensagem_conclusao?: string;
  categoria?: string;
}

export interface Survey {
  id: string;
  titulo: string;
  descricao: string;
  status: SurveyStatus;
  data_criacao: string;
  data_inicio?: string;
  data_fim?: string;
  link_publico: string;
  configuracoes: SurveySettings;
  criado_por?: string;
}

export interface Question {
  id: string;
  survey_id: string;
  ordem: number;
  titulo: string;
  descricao?: string;
  tipo: QuestionType;
  obrigatoria: boolean;
  ativa: boolean;
}

export interface Option {
  id: string;
  question_id: string;
  ordem: number;
  texto: string;
  valor: string;
  peso?: number; // Para cálculos de índice/escala (ex: 1 a 5)
}

export interface Respondent {
  id: string;
  survey_id: string;
  nome: string;
  identificador?: string;
  data_resposta: string;
  hora_resposta: string;
}

export interface Answer {
  id: string;
  survey_id: string;
  respondent_id: string;
  question_id: string;
  option_id?: string;
  valor: string; // Texto da opção ou texto livre
  data_resposta: string;
}

export interface OptionDistribution {
  optionId: string;
  optionText: string;
  count: number;
  percentage: number;
  rank: number;
  color?: string;
}

export interface SatisfactionIndex {
  averageScore: number; // Ex: 4.2 / 5.0
  maxScore: number;
  positiveCount: number;
  positivePct: number;
  neutralCount: number;
  neutralPct: number;
  negativeCount: number;
  negativePct: number;
  label: string; // Ex: "72% de Satisfação (Favorável)"
}

export interface QuestionAnalytics {
  questionId: string;
  questionTitle: string;
  questionDescription?: string;
  questionType: QuestionType;
  totalAnswers: number;
  totalRespondents: number;
  responseRate: number; // % que respondeu esta pergunta
  unansweredCount: number;
  distribution: OptionDistribution[];
  dominantOption: OptionDistribution | null;
  leastSelectedOption: OptionDistribution | null;
  consensusScore: number; // 0-100
  isSplit: boolean; // Verdadeiro se as principais alternativas estiverem empatadas ou próximas
  satisfactionIndex?: SatisfactionIndex;
  recommendedChart: 'horizontal_bar' | 'donut' | 'vertical_bar' | 'ranking_list';
}

export interface CrossTabulationResult {
  questionA: { id: string; title: string };
  questionB: { id: string; title: string };
  rows: string[]; // Alternativas da Pergunta A
  columns: string[]; // Alternativas da Pergunta B
  matrix: { [row: string]: { [col: string]: number } };
  percentageMatrix: { [row: string]: { [col: string]: number } }; // % por linha
  rowTotals: { [row: string]: number };
  colTotals: { [col: string]: number };
  grandTotal: number;
  keyInsights: string[];
}

export interface ExecutiveSummary {
  totalResponses: number;
  totalQuestions: number;
  completionRate: number;
  firstResponseDate?: string;
  lastResponseDate?: string;
  keyFindings: string[];
  highConsensusQuestions: Array<{
    questionTitle: string;
    dominantOption: string;
    percentage: number;
  }>;
  divergentQuestions: Array<{
    questionTitle: string;
    explanation: string;
  }>;
  responsesOverTime: Array<{
    date: string;
    count: number;
    accumulated: number;
  }>;
  topSectorsOrCategories?: Array<{
    label: string;
    count: number;
    percentage: number;
  }>;
}

export interface SurveyAnalyticsData {
  survey: Survey;
  questions: Question[];
  options: Option[];
  respondents: Respondent[];
  answers: Answer[];
  executiveSummary: ExecutiveSummary;
  questionAnalytics: QuestionAnalytics[];
}

export interface SurveyFilter {
  dateFrom?: string;
  dateTo?: string;
  respondentSearch?: string;
  questionFilters: Record<string, string[]>; // questionId -> array de valores selecionados
}

export interface GoogleAppsScriptConfig {
  webAppUrl: string;
  publicAppUrl?: string; // URL pública do frontend (ex: https://pesquisahub.com ou URL de publicação)
  sheetId?: string;
  isConnected: boolean;
  lastSync?: string;
  autoSync: boolean;
}

export type UserRole = 'admin' | 'user';

export interface AppUser {
  id: string;
  nome: string;
  email: string;
  role: UserRole;
  deve_trocar_senha: boolean;
  ativo: boolean;
  criado_em?: string;
  ultimo_login?: string;
}

export interface AuthSession {
  token: string;
  user: AppUser;
}

export interface SentimentAnalysisResult {
  questionId: string;
  questionTitle: string;
  resumo: string;
  positivo: number; // %
  neutro: number; // %
  negativo: number; // %
  pontosPositivos: string[];
  pontosNegativos: string[];
  respostasAnalisadas: number;
  atualizadoEm: string;
}

export interface AppSettings {
  logoUrl: string;
  nomeExibicao: string;
}

export interface PhotoBatchEntry {
  nome: string;
  setor: string;
  url: string;
  transcricao: string;
  sentimento: 'positivo' | 'neutro' | 'negativo';
  perguntaTitulo: string;
}

export interface PhotoBatchGroupStats {
  titulo: string;
  totalRespostas: number;
  positivo: number;
  neutro: number;
  negativo: number;
  colaboradores: string[];
}

export interface PhotoBatchAnalysis {
  id: string;
  titulo: string;
  entradas: PhotoBatchEntry[];
  perguntas: PhotoBatchGroupStats[];
  setores: PhotoBatchGroupStats[];
  resumoGeral: string;
  positivoGeral: number;
  neutroGeral: number;
  negativoGeral: number;
  pontosPositivosGerais: string[];
  pontosNegativosGerais: string[];
  criadoEm: string;
  atualizadoEm: string;
}

export interface DrillDownTarget {
  type: 'question_option' | 'crosstab_cell' | 'satisfaction_group';
  surveyTitle: string;
  questionId: string;
  questionTitle: string;
  optionText: string;
  optionColor?: string;
  percentage?: number;
  totalCount?: number;
  crossTab?: {
    questionAId: string;
    questionATitle: string;
    valueA: string;
    questionBId: string;
    questionBTitle: string;
    valueB: string;
  };
  satisfactionGroup?: 'positive' | 'neutral' | 'negative';
}
