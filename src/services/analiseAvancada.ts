import { Question, Option, Respondent, Answer } from '../types';

/**
 * =========================================================================
 * Análises avançadas do PesquisaHub (Etapa 3)
 * - Respostas possivelmente duplicadas
 * - Escala de níveis (ex.: Autoavaliação 1–4) para a Matriz de Competências
 * - Adesão: quem respondeu x quem era esperado
 * Tudo é calculado no navegador, sobre os dados já carregados da pesquisa.
 * =========================================================================
 */

/** Nome comparável: sem acentos, minúsculo, sem espaços extras nem pontuação. */
export function normalizarNome(nome: string): string {
  return String(nome || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9@.\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ------------------------------------------------------------------------
// DUPLICADAS
// ------------------------------------------------------------------------

/**
 * Agrupa respondentes com o mesmo nome (normalizado) ou o mesmo identificador.
 * Devolve: id do respondente -> quantas respostas existem nesse grupo (só grupos com 2+).
 */
export function detectarDuplicadas(respondents: Respondent[]): Map<string, number> {
  const grupos = new Map<string, string[]>();
  respondents.forEach((r) => {
    const chaves = new Set<string>();
    const nome = normalizarNome(r.nome);
    if (nome && nome !== 'respondente anonimo') chaves.add('n:' + nome);
    const ident = normalizarNome(r.identificador || '');
    if (ident) chaves.add('i:' + ident);
    chaves.forEach((c) => {
      grupos.set(c, [...(grupos.get(c) || []), r.id]);
    });
  });

  const resultado = new Map<string, number>();
  grupos.forEach((ids) => {
    if (ids.length > 1) {
      ids.forEach((id) => resultado.set(id, Math.max(resultado.get(id) || 0, ids.length)));
    }
  });
  return resultado;
}

// ------------------------------------------------------------------------
// ESCALA DE NÍVEIS (Matriz de Competências)
// ------------------------------------------------------------------------

export interface EscalaDetectada {
  questoes: Question[];
  niveis: string[]; // rótulos dos níveis, do menor para o maior
}

/** Rótulo curto de um nível: "🔴 — Consciente: Conheço..." -> "Consciente" */
export function rotuloCurtoNivel(texto: string): string {
  const semEmoji = String(texto || '').replace(/^[^\p{L}\p{N}]+/u, '').trim();
  const antesDoisPontos = semEmoji.split(':')[0].trim();
  return antesDoisPontos.length > 0 && antesDoisPontos.length <= 30 ? antesDoisPontos : semEmoji.slice(0, 30);
}

/**
 * Procura um conjunto de perguntas de escolha única que usam exatamente a mesma
 * escala de alternativas (mesmos textos, mesma ordem). Ex.: as 28 capacidades da
 * Autoavaliação, todas com Consciente / Aplicado / Avançado / Referência.
 * Precisa de pelo menos 3 perguntas e de 2 a 7 níveis.
 */
export function detectarEscala(questions: Question[], options: Option[]): EscalaDetectada | null {
  const porAssinatura = new Map<string, { questoes: Question[]; niveis: string[] }>();

  questions
    .filter((q) => q.tipo === 'single_choice')
    .forEach((q) => {
      const opts = options.filter((o) => o.question_id === q.id).sort((a, b) => a.ordem - b.ordem);
      if (opts.length < 2 || opts.length > 7) return;
      const niveis = opts.map((o) => o.texto.trim());
      const assinatura = niveis.map(normalizarNome).join('|');
      const grupo = porAssinatura.get(assinatura) || { questoes: [], niveis };
      grupo.questoes.push(q);
      porAssinatura.set(assinatura, grupo);
    });

  let melhor: EscalaDetectada | null = null;
  porAssinatura.forEach((g) => {
    if (g.questoes.length >= 3 && (!melhor || g.questoes.length > melhor.questoes.length)) {
      melhor = { questoes: [...g.questoes].sort((a, b) => a.ordem - b.ordem), niveis: g.niveis };
    }
  });
  return melhor;
}

export interface MatrizCompetencias {
  escala: EscalaDetectada;
  pessoas: Respondent[];
  // nivel[respondentId][questionId] = 1..N (0 = não respondeu)
  nivel: Record<string, Record<string, number>>;
  mediaPorQuestao: Record<string, number>;
  mediaPorPessoa: Record<string, number>;
  distribuicaoPorQuestao: Record<string, number[]>; // quantas pessoas em cada nível
  mediaGeral: number;
}

export function montarMatriz(
  escala: EscalaDetectada,
  options: Option[],
  respondents: Respondent[],
  answers: Answer[]
): MatrizCompetencias {
  const nivelPorTexto = new Map<string, number>();
  escala.niveis.forEach((t, i) => nivelPorTexto.set(normalizarNome(t), i + 1));
  const nivelPorOpcao = new Map<string, number>();
  const idsQuestoes = new Set(escala.questoes.map((q) => q.id));
  options
    .filter((o) => idsQuestoes.has(o.question_id))
    .forEach((o) => nivelPorOpcao.set(o.id, nivelPorTexto.get(normalizarNome(o.texto)) || 0));

  const nivel: Record<string, Record<string, number>> = {};
  respondents.forEach((r) => { nivel[r.id] = {}; });
  answers.forEach((a) => {
    if (!idsQuestoes.has(a.question_id) || !nivel[a.respondent_id]) return;
    const n = (a.option_id && nivelPorOpcao.get(a.option_id)) || nivelPorTexto.get(normalizarNome(a.valor)) || 0;
    if (n > 0) nivel[a.respondent_id][a.question_id] = n;
  });

  const N = escala.niveis.length;
  const mediaPorQuestao: Record<string, number> = {};
  const distribuicaoPorQuestao: Record<string, number[]> = {};
  escala.questoes.forEach((q) => {
    const valores = respondents.map((r) => nivel[r.id][q.id] || 0).filter((v) => v > 0);
    mediaPorQuestao[q.id] = valores.length ? valores.reduce((s, v) => s + v, 0) / valores.length : 0;
    const dist = new Array(N).fill(0);
    valores.forEach((v) => { dist[v - 1] += 1; });
    distribuicaoPorQuestao[q.id] = dist;
  });

  const mediaPorPessoa: Record<string, number> = {};
  respondents.forEach((r) => {
    const valores = Object.values(nivel[r.id]).filter((v) => v > 0);
    mediaPorPessoa[r.id] = valores.length ? valores.reduce((s, v) => s + v, 0) / valores.length : 0;
  });

  const todas = Object.values(mediaPorQuestao).filter((v) => v > 0);
  const mediaGeral = todas.length ? todas.reduce((s, v) => s + v, 0) / todas.length : 0;

  return { escala, pessoas: respondents, nivel, mediaPorQuestao, mediaPorPessoa, distribuicaoPorQuestao, mediaGeral };
}

// ------------------------------------------------------------------------
// ADESÃO
// ------------------------------------------------------------------------

export interface ResultadoAdesao {
  esperados: string[];
  responderam: Array<{ esperado: string; respondente: Respondent }>;
  faltam: string[];
  semCorrespondencia: Respondent[]; // responderam mas não estão na lista
  percentual: number;
}

function correspondem(esperado: string, r: Respondent): boolean {
  const e = normalizarNome(esperado);
  if (!e) return false;
  const nome = normalizarNome(r.nome);
  const ident = normalizarNome(r.identificador || '');
  if (e === nome || (ident && e === ident)) return true;
  // "Josiel" x "Josiel Rodrigues" — aceita quando todas as palavras de um estão no outro
  const pe = e.split(' ');
  const pn = nome.split(' ');
  if (pe.length > 0 && pn.length > 0) {
    if (pe.every((p) => pn.includes(p)) || pn.every((p) => pe.includes(p))) return true;
  }
  return false;
}

export function calcularAdesao(esperados: string[], respondents: Respondent[]): ResultadoAdesao {
  const lista = esperados.map((e) => e.trim()).filter(Boolean);
  const usados = new Set<string>();
  const responderam: ResultadoAdesao['responderam'] = [];
  const faltam: string[] = [];

  lista.forEach((esp) => {
    const achado = respondents.find((r) => !usados.has(r.id) && correspondem(esp, r));
    if (achado) {
      usados.add(achado.id);
      responderam.push({ esperado: esp, respondente: achado });
    } else {
      faltam.push(esp);
    }
  });

  // Respostas duplicadas de quem já foi contado não entram como "sem correspondência"
  const semCorrespondencia = respondents.filter(
    (r) => !usados.has(r.id) && !lista.some((esp) => correspondem(esp, r))
  );

  return {
    esperados: lista,
    responderam,
    faltam,
    semCorrespondencia,
    percentual: lista.length ? Math.round((responderam.length / lista.length) * 100) : 0
  };
}

// ------------------------------------------------------------------------
// CORES DOS NÍVEIS (usadas na tela e no PDF da Matriz de Competências)
// ------------------------------------------------------------------------

/** Cores por nível (do menor para o maior). Para 4 níveis seguem as cores da Autoavaliação. */
export function paletaNiveis(n: number): { fundo: string; texto: string }[] {
  const quatro = [
    { fundo: '#fecaca', texto: '#991b1b' },
    { fundo: '#bfdbfe', texto: '#1e40af' },
    { fundo: '#bbf7d0', texto: '#166534' },
    { fundo: '#e9d5ff', texto: '#6b21a8' }
  ];
  if (n === 4) return quatro;
  const base = [
    { fundo: '#fecaca', texto: '#991b1b' },
    { fundo: '#fed7aa', texto: '#9a3412' },
    { fundo: '#fde68a', texto: '#854d0e' },
    { fundo: '#bfdbfe', texto: '#1e40af' },
    { fundo: '#bbf7d0', texto: '#166534' },
    { fundo: '#a7f3d0', texto: '#065f46' },
    { fundo: '#e9d5ff', texto: '#6b21a8' }
  ];
  if (n <= 1) return [base[4]];
  return Array.from({ length: n }, (_, i) => base[Math.round((i * (base.length - 1)) / (n - 1))]);
}
