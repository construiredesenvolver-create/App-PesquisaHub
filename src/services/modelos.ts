import { QuestionType, SurveySettings } from '../types';

/**
 * Modelos de pesquisa: prontos (do próprio app) e da organização (salvos pelos usuários).
 */

export interface PerguntaModelo {
  titulo: string;
  descricao?: string;
  tipo: QuestionType;
  obrigatoria: boolean;
  opcoes: string[];
}

export interface ConteudoModelo {
  titulo: string;
  descricao: string;
  configuracoes: Partial<SurveySettings>;
  perguntas: PerguntaModelo[];
}

export interface ModeloPesquisa {
  id: string;
  nome: string;
  descricao: string;
  origem: 'padrao' | 'organizacao';
  department_id?: string | null;
  department_nome?: string;
  criado_por?: string | null;
  criado_em?: string;
  conteudo: ConteudoModelo;
}

const NIVEIS_CAPACIDADE = [
  '🔴 — Consciente: Conheço o assunto, mas ainda preciso de ajuda ou orientação para executar.',
  '🔵 — Aplicado: Executo sozinho nas situações do dia a dia.',
  '🟢 — Avançado: Resolvo inclusive casos complexos ou fora do padrão, com segurança.',
  '🟣 — Referência: Sou procurado pelos colegas para tirar dúvidas e consigo ensinar o assunto.'
];

const CONCORDANCIA = [
  'Discordo totalmente',
  'Discordo',
  'Neutro',
  'Concordo',
  'Concordo totalmente'
];

const SATISFACAO = ['Muito insatisfeito', 'Insatisfeito', 'Neutro', 'Satisfeito', 'Muito satisfeito'];

const ZERO_A_DEZ = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];

const capacidade = (titulo: string): PerguntaModelo => ({ titulo, tipo: 'single_choice', obrigatoria: true, opcoes: NIVEIS_CAPACIDADE });
const afirmacao = (titulo: string): PerguntaModelo => ({ titulo, tipo: 'single_choice', obrigatoria: true, opcoes: CONCORDANCIA });

export const MODELOS_PADRAO: ModeloPesquisa[] = [
  {
    id: 'padrao-autoavaliacao',
    nome: 'Autoavaliação de Capacidades',
    descricao: 'Cada pessoa se avalia de 1 a 4 em cada capacidade. Gera a Matriz de Competências (lacunas, referências e radar individual).',
    origem: 'padrao',
    conteudo: {
      titulo: 'Autoavaliação de Capacidades',
      descricao: 'Avalie com sinceridade o seu nível atual em cada capacidade abaixo. Não há resposta certa: o objetivo é mapear onde cada um está para direcionar treinamentos e desenvolvimento.',
      configuracoes: { categoria: 'Desenvolvimento', exigir_nome: true, uma_resposta_por_pessoa: true },
      perguntas: [
        capacidade('Capacidade 1 (substitua pelo texto da capacidade)'),
        capacidade('Capacidade 2 (substitua pelo texto da capacidade)'),
        capacidade('Capacidade 3 (substitua pelo texto da capacidade)'),
        capacidade('Capacidade 4 (substitua pelo texto da capacidade)'),
        capacidade('Capacidade 5 (substitua pelo texto da capacidade)'),
        { titulo: 'Em qual dessas capacidades você mais gostaria de receber treinamento nos próximos meses?', tipo: 'text', obrigatoria: false, opcoes: [] }
      ]
    }
  },
  {
    id: 'padrao-clima',
    nome: 'Pesquisa de Clima',
    descricao: 'Afirmações com escala de concordância (5 pontos) e duas perguntas abertas. Ideal para marcar como Restrita.',
    origem: 'padrao',
    conteudo: {
      titulo: 'Pesquisa de Clima',
      descricao: 'Queremos entender como você se sente no dia a dia de trabalho. Responda com sinceridade: as respostas são usadas apenas para melhorar o ambiente da equipe.',
      configuracoes: { categoria: 'Clima', exigir_nome: true, uma_resposta_por_pessoa: true },
      perguntas: [
        afirmacao('Tenho clareza sobre o que se espera do meu trabalho.'),
        afirmacao('Recebo as ferramentas e informações necessárias para fazer bem o meu trabalho.'),
        afirmacao('Meu líder me dá retorno (feedback) com frequência.'),
        afirmacao('Sinto que meu trabalho é reconhecido.'),
        afirmacao('Existe colaboração entre as pessoas da equipe.'),
        afirmacao('Me sinto à vontade para dar sugestões e apontar problemas.'),
        afirmacao('Vejo oportunidades de crescimento e aprendizado aqui.'),
        afirmacao('A carga de trabalho é adequada.'),
        { titulo: 'O que mais te motiva no trabalho hoje?', tipo: 'long_text', obrigatoria: false, opcoes: [] },
        { titulo: 'O que poderíamos melhorar?', tipo: 'long_text', obrigatoria: false, opcoes: [] }
      ]
    }
  },
  {
    id: 'padrao-enps',
    nome: 'eNPS (satisfação dos colaboradores)',
    descricao: 'Pergunta de 0 a 10 sobre recomendar a empresa como lugar para trabalhar, com motivo e sugestão.',
    origem: 'padrao',
    conteudo: {
      titulo: 'eNPS — Satisfação dos Colaboradores',
      descricao: 'Pesquisa rápida (menos de 1 minuto) sobre a sua experiência trabalhando aqui.',
      configuracoes: { categoria: 'eNPS', exigir_nome: true, uma_resposta_por_pessoa: true },
      perguntas: [
        {
          titulo: 'Em uma escala de 0 a 10, o quanto você recomendaria a empresa como um bom lugar para trabalhar?',
          descricao: '0 = não recomendaria de jeito nenhum · 10 = recomendaria com certeza',
          tipo: 'scale',
          obrigatoria: true,
          opcoes: ZERO_A_DEZ
        },
        { titulo: 'O que mais pesou na sua nota?', tipo: 'long_text', obrigatoria: false, opcoes: [] },
        { titulo: 'Uma coisa que faria a sua nota subir:', tipo: 'long_text', obrigatoria: false, opcoes: [] }
      ]
    }
  },
  {
    id: 'padrao-treinamento',
    nome: 'Avaliação de Treinamento',
    descricao: 'Avaliação de reação ao final de um treinamento: conteúdo, instrutor, aplicação prática e sugestões.',
    origem: 'padrao',
    conteudo: {
      titulo: 'Avaliação de Treinamento',
      descricao: 'Sua opinião sobre o treinamento nos ajuda a melhorar as próximas turmas.',
      configuracoes: { categoria: 'Treinamento', exigir_nome: true, uma_resposta_por_pessoa: true },
      perguntas: [
        { titulo: 'Qual o seu nível de satisfação geral com o treinamento?', tipo: 'single_choice', obrigatoria: true, opcoes: SATISFACAO },
        { titulo: 'O conteúdo foi claro e bem organizado.', tipo: 'single_choice', obrigatoria: true, opcoes: CONCORDANCIA },
        { titulo: 'O instrutor dominava o assunto e tirou as dúvidas.', tipo: 'single_choice', obrigatoria: true, opcoes: CONCORDANCIA },
        { titulo: 'Vou conseguir aplicar o que aprendi no meu dia a dia.', tipo: 'single_choice', obrigatoria: true, opcoes: CONCORDANCIA },
        { titulo: 'A carga horária foi adequada.', tipo: 'single_choice', obrigatoria: true, opcoes: ['Curta demais', 'Adequada', 'Longa demais'] },
        { titulo: 'O que você mais aproveitou?', tipo: 'long_text', obrigatoria: false, opcoes: [] },
        { titulo: 'O que poderia ser melhor?', tipo: 'long_text', obrigatoria: false, opcoes: [] }
      ]
    }
  }
];
