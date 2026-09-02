import React, { useState } from 'react';
import { 
  Plus, 
  Trash2, 
  MoveUp, 
  MoveDown, 
  Copy, 
  CheckSquare, 
  CircleDot, 
  AlignLeft, 
  HelpCircle, 
  Settings, 
  Save, 
  Send, 
  Sparkles,
  Eye,
  AlertCircle,
  Hash,
  Star,
  ListOrdered,
  Layers,
  ChevronDown,
  Loader2
} from 'lucide-react';
import { Survey, Question, Option, QuestionType } from '../types';
import { generateId } from '../services/api';

interface QuestionDraft {
  id: string;
  titulo: string;
  descricao: string;
  tipo: QuestionType;
  obrigatoria: boolean;
  options: Array<{ id: string; texto: string; valor: string }>;
}

interface SurveyBuilderProps {
  initialSurvey?: Survey | null;
  initialQuestions?: Question[];
  initialOptions?: Option[];
  isSaving?: boolean;
  onSaveSurvey: (
    surveyData: Omit<Survey, 'id' | 'data_criacao'>,
    questionsData: Array<{ question: Omit<Question, 'id' | 'survey_id'>; options: Omit<Option, 'id' | 'question_id'>[] }>
  ) => Promise<void> | void;
  onCancel: () => void;
}

export const SurveyBuilder: React.FC<SurveyBuilderProps> = ({
  initialSurvey,
  initialQuestions = [],
  initialOptions = [],
  isSaving = false,
  onSaveSurvey,
  onCancel
}) => {
  const [titulo, setTitulo] = useState(initialSurvey?.titulo || '');
  const [descricao, setDescricao] = useState(initialSurvey?.descricao || '');
  const [categoria, setCategoria] = useState(initialSurvey?.configuracoes?.categoria || 'Geral');
  const [exigirNome, setExigirNome] = useState(initialSurvey?.configuracoes?.exigir_nome !== false);
  const [mensagemConclusao, setMensagemConclusao] = useState(
    initialSurvey?.configuracoes?.mensagem_conclusao || 'Obrigado por enviar suas respostas!'
  );
  const [activeTab, setActiveTab] = useState<'editor' | 'preview'>('editor');

  // Inicializar perguntas a partir dos dados existentes ou padrão inicial
  const [questions, setQuestions] = useState<QuestionDraft[]>(() => {
    if (initialQuestions.length > 0) {
      return initialQuestions.map((q) => {
        const qOpts = initialOptions.filter((opt) => opt.question_id === q.id);
        return {
          id: q.id,
          titulo: q.titulo,
          descricao: q.descricao || '',
          tipo: q.tipo,
          obrigatoria: q.obrigatoria,
          options: qOpts.map((opt) => ({
            id: opt.id,
            texto: opt.texto,
            valor: opt.valor
          }))
        };
      });
    }

    // Perguntas padrão para iniciar
    return [
      {
        id: generateId('temp_q'),
        titulo: 'Como você avalia seu nível de satisfação geral?',
        descricao: 'Selecione uma das opções abaixo.',
        tipo: 'single_choice',
        obrigatoria: true,
        options: [
          { id: generateId('temp_opt'), texto: 'Muito satisfeito', valor: 'Muito satisfeito' },
          { id: generateId('temp_opt'), texto: 'Satisfeito', valor: 'Satisfeito' },
          { id: generateId('temp_opt'), texto: 'Neutro', valor: 'Neutro' },
          { id: generateId('temp_opt'), texto: 'Insatisfeito', valor: 'Insatisfeito' },
          { id: generateId('temp_opt'), texto: 'Muito insatisfeito', valor: 'Muito insatisfeito' }
        ]
      }
    ];
  });

  const [validationError, setValidationError] = useState<string | null>(null);

  // Adicionar Pergunta
  const handleAddQuestion = (presetType: QuestionType = 'single_choice') => {
    const newQuestion: QuestionDraft = {
      id: generateId('temp_q'),
      titulo: '',
      descricao: '',
      tipo: presetType,
      obrigatoria: true,
      options: [
        { id: generateId('temp_opt'), texto: 'Opção 1', valor: 'Opção 1' },
        { id: generateId('temp_opt'), texto: 'Opção 2', valor: 'Opção 2' }
      ]
    };
    setQuestions([...questions, newQuestion]);
  };

  // Duplicar Pergunta
  const handleDuplicateQuestion = (index: number) => {
    const target = questions[index];
    const newQ: QuestionDraft = {
      ...target,
      id: generateId('temp_q'),
      titulo: `${target.titulo} (Cópia)`,
      options: target.options.map((o) => ({ ...o, id: generateId('temp_opt') }))
    };
    const updated = [...questions];
    updated.splice(index + 1, 0, newQ);
    setQuestions(updated);
  };

  // Remover Pergunta
  const handleRemoveQuestion = (index: number) => {
    if (questions.length <= 1) {
      alert('A pesquisa deve conter pelo menos uma pergunta.');
      return;
    }
    setQuestions(questions.filter((_, i) => i !== index));
  };

  // Mover Pergunta para cima/baixo
  const handleMoveQuestion = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === questions.length - 1) return;

    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    const updated = [...questions];
    const temp = updated[index];
    updated[index] = updated[targetIdx];
    updated[targetIdx] = temp;
    setQuestions(updated);
  };

  // Atualizar campo da Pergunta
  const handleUpdateQuestion = (index: number, field: keyof QuestionDraft, value: any) => {
    const updated = [...questions];
    updated[index] = { ...updated[index], [field]: value };

    // Ao trocar para um tipo que não usa alternativas (ex: Foto, Texto Livre), limpar opções antigas
    if (field === 'tipo' && !['single_choice', 'multiple_choice'].includes(value)) {
      updated[index].options = [];
    }
    // Ao trocar PARA um tipo de escolha e não houver nenhuma alternativa ainda, iniciar com 2
    if (field === 'tipo' && ['single_choice', 'multiple_choice'].includes(value) && updated[index].options.length === 0) {
      updated[index].options = [
        { id: generateId('temp_opt'), texto: 'Opção 1', valor: 'Opção 1' },
        { id: generateId('temp_opt'), texto: 'Opção 2', valor: 'Opção 2' }
      ];
    }

    setQuestions(updated);
  };

  // Adicionar Alternativa
  const handleAddOption = (qIndex: number) => {
    const updated = [...questions];
    const optCount = updated[qIndex].options.length + 1;
    updated[qIndex].options.push({
      id: generateId('temp_opt'),
      texto: `Opção ${optCount}`,
      valor: `Opção ${optCount}`
    });
    setQuestions(updated);
  };

  // Atualizar Alternativa
  const handleUpdateOption = (qIndex: number, optIndex: number, text: string) => {
    const updated = [...questions];
    updated[qIndex].options[optIndex].texto = text;
    updated[qIndex].options[optIndex].valor = text;
    setQuestions(updated);
  };

  // Remover Alternativa
  const handleRemoveOption = (qIndex: number, optIndex: number) => {
    const updated = [...questions];
    if (updated[qIndex].options.length <= 2) {
      alert('Perguntas de escolha devem ter no mínimo duas opções.');
      return;
    }
    updated[qIndex].options = updated[qIndex].options.filter((_, i) => i !== optIndex);
    setQuestions(updated);
  };

  // Predefinição rápida de alternativas comuns
  const handleApplyPreset = (qIndex: number, presetType: 'satisfaction' | 'agreement' | 'frequency' | 'yes_no') => {
    const presets: Record<string, string[]> = {
      satisfaction: ['Muito satisfeito', 'Satisfeito', 'Neutro', 'Insatisfeito', 'Muito insatisfeito'],
      agreement: ['Concordo totalmente', 'Concordo em parte', 'Neutro', 'Discordo em parte', 'Discordo totalmente'],
      frequency: ['Sempre', 'Frequentemente', 'Às vezes', 'Raramente', 'Nunca'],
      yes_no: ['Sim', 'Não']
    };

    const newOpts = presets[presetType];
    if (newOpts) {
      const updated = [...questions];
      updated[qIndex].options = newOpts.map((text) => ({
        id: generateId('temp_opt'),
        texto: text,
        valor: text
      }));
      setQuestions(updated);
    }
  };

  // Validação e Salvamento
  const handleSave = (status: 'Publicada' | 'Rascunho') => {
    if (isSaving) return;

    if (!titulo.trim()) {
      setValidationError('Por favor, informe o título da pesquisa.');
      return;
    }

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.titulo.trim()) {
        setValidationError(`A pergunta #${i + 1} precisa de um título.`);
        return;
      }
      if (['single_choice', 'multiple_choice'].includes(q.tipo)) {
        if (q.options.length < 2) {
          setValidationError(`A pergunta "${q.titulo || '#' + (i + 1)}" precisa de pelo menos 2 alternativas.`);
          return;
        }
        for (let j = 0; j < q.options.length; j++) {
          if (!q.options[j].texto.trim()) {
            setValidationError(`Preencha o texto da alternativa #${j + 1} na pergunta #${i + 1}.`);
            return;
          }
        }
      }
    }

    setValidationError(null);

    const surveyData: Omit<Survey, 'id' | 'data_criacao'> = {
      titulo: titulo.trim(),
      descricao: descricao.trim(),
      status,
      link_publico: titulo.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || `pesquisa-${Date.now()}`,
      configuracoes: {
        exigir_nome: exigirNome,
        permitir_anonimo: !exigirNome,
        permitir_multiplas_respostas: false,
        categoria,
        mensagem_conclusao: mensagemConclusao.trim()
      }
    };

    const questionsData = questions.map((q, idx) => ({
      question: {
        ordem: idx + 1,
        titulo: q.titulo.trim(),
        descricao: q.descricao.trim(),
        tipo: q.tipo,
        obrigatoria: q.obrigatoria,
        ativa: true
      },
      options: q.options.map((opt, optIdx) => ({
        ordem: optIdx + 1,
        texto: opt.texto.trim(),
        valor: opt.valor.trim() || opt.texto.trim()
      }))
    }));

    onSaveSurvey(surveyData, questionsData);
  };

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6 animate-in fade-in duration-200">
      
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 font-display">
            {initialSurvey ? 'Editar Pesquisa' : 'Criar Nova Pesquisa'}
          </h1>
          <p className="text-xs text-slate-500">
            Configure as perguntas, alternativas e regras de preenchimento.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Tab Switcher: Editor vs Preview */}
          <div className="bg-slate-100 p-1 rounded-xl flex items-center text-xs font-semibold text-slate-600">
            <button
              onClick={() => setActiveTab('editor')}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                activeTab === 'editor' ? 'bg-white text-slate-900 shadow-xs' : 'hover:text-slate-900'
              }`}
            >
              Construtor
            </button>
            <button
              onClick={() => setActiveTab('preview')}
              className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 ${
                activeTab === 'preview' ? 'bg-white text-slate-900 shadow-xs' : 'hover:text-slate-900'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Prévia</span>
            </button>
          </div>

          <button
            onClick={onCancel}
            disabled={isSaving}
            className="px-3.5 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-semibold disabled:opacity-50"
          >
            Cancelar
          </button>

          <button
            onClick={() => handleSave('Rascunho')}
            disabled={isSaving}
            className="px-3.5 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 font-semibold text-xs flex items-center gap-1.5 shadow-xs disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-600" /> : <Save className="w-3.5 h-3.5" />}
            <span>Salvar Rascunho</span>
          </button>

          <button
            onClick={() => handleSave('Publicada')}
            disabled={isSaving}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-blue-600/20 active:scale-95 transition-all disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin text-white" /> : <Send className="w-3.5 h-3.5" />}
            <span>Publicar no Sheets</span>
          </button>
        </div>
      </div>

      {validationError && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-xl text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>{validationError}</span>
        </div>
      )}

      {/* Main Content: Editor Mode */}
      {activeTab === 'editor' ? (
        <div className="space-y-6">
          
          {/* Card: Metadados Básicos */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-xs space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                Título da Pesquisa *
              </label>
              <input
                type="text"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder="Ex: Pesquisa de Clima Organizacional e Escala de Trabalho"
                className="w-full text-base md:text-lg font-bold text-slate-900 border border-slate-200 rounded-xl px-4 py-2.5 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                Descrição ou Instruções aos Respondentes
              </label>
              <textarea
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                rows={2}
                placeholder="Explique o objetivo da pesquisa, prazo de preenchimento e confidencialidade..."
                className="w-full text-xs md:text-sm text-slate-700 border border-slate-200 rounded-xl px-4 py-2.5 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Categoria
                </label>
                <input
                  type="text"
                  value={categoria}
                  onChange={(e) => setCategoria(e.target.value)}
                  placeholder="Ex: RH, Operações, Clima..."
                  className="w-full text-xs text-slate-800 border border-slate-200 rounded-xl px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Mensagem de Agradecimento ao Concluir
                </label>
                <input
                  type="text"
                  value={mensagemConclusao}
                  onChange={(e) => setMensagemConclusao(e.target.value)}
                  placeholder="Ex: Respostas salvas com sucesso! Obrigado pela colaboração."
                  className="w-full text-xs text-slate-800 border border-slate-200 rounded-xl px-3 py-2"
                />
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700 select-none">
                <input
                  type="checkbox"
                  checked={exigirNome}
                  onChange={(e) => setExigirNome(e.target.checked)}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
                />
                <span>Exigir Identificação / Nome do Respondente</span>
              </label>
            </div>
          </div>

          {/* Lista de Perguntas */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-600 flex items-center gap-2">
                <Layers className="w-4 h-4 text-blue-600" />
                <span>Perguntas ({questions.length})</span>
              </h2>
            </div>

            {questions.map((q, qIndex) => (
              <div
                key={q.id}
                className="bg-white rounded-2xl p-5 md:p-6 border border-slate-200/90 shadow-xs space-y-4 hover:border-slate-300 transition-colors"
              >
                {/* Header da Pergunta */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2.5 flex-1">
                    <span className="w-6 h-6 rounded-lg bg-blue-50 text-blue-700 font-bold text-xs flex items-center justify-center shrink-0 border border-blue-200">
                      {qIndex + 1}
                    </span>
                    <input
                      type="text"
                      value={q.titulo}
                      onChange={(e) => handleUpdateQuestion(qIndex, 'titulo', e.target.value)}
                      placeholder={`Título da pergunta #${qIndex + 1} (Ex: Quantos domingos por mês você teria disponibilidade?)`}
                      className="font-bold text-slate-900 text-sm md:text-base flex-1 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 focus:outline-hidden px-1 py-0.5"
                    />
                  </div>

                  {/* Ações da Pergunta */}
                  <div className="flex items-center gap-1.5 self-end sm:self-auto">
                    <button
                      onClick={() => handleMoveQuestion(qIndex, 'up')}
                      disabled={qIndex === 0}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30"
                      title="Mover para cima"
                    >
                      <MoveUp className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleMoveQuestion(qIndex, 'down')}
                      disabled={qIndex === questions.length - 1}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30"
                      title="Mover para baixo"
                    >
                      <MoveDown className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDuplicateQuestion(qIndex)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                      title="Duplicar pergunta"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleRemoveQuestion(qIndex)}
                      className="p-1.5 rounded-lg text-rose-400 hover:text-rose-600 hover:bg-rose-50"
                      title="Excluir pergunta"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Descrição & Tipo */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="md:col-span-2">
                    <input
                      type="text"
                      value={q.descricao}
                      onChange={(e) => handleUpdateQuestion(qIndex, 'descricao', e.target.value)}
                      placeholder="Instrução adicional (opcional)"
                      className="w-full text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2"
                    />
                  </div>

                  <div>
                    <select
                      value={q.tipo}
                      onChange={(e) => handleUpdateQuestion(qIndex, 'tipo', e.target.value as QuestionType)}
                      className="w-full text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 cursor-pointer"
                    >
                      <option value="single_choice">Única Escolha (Radio)</option>
                      <option value="multiple_choice">Múltipla Escolha (Checkbox)</option>
                      <option value="text">Texto Livre</option>
                      <option value="rating">Avaliação / Estrelas</option>
                    </select>
                  </div>
                </div>

                {/* Alternativas (se for single_choice ou multiple_choice) */}
                {['single_choice', 'multiple_choice'].includes(q.tipo) && (
                  <div className="space-y-2.5 pt-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        Alternativas de Resposta
                      </span>

                      {/* Presets Rápidos */}
                      <div className="flex items-center gap-1.5 text-[11px]">
                        <span className="text-slate-400">Predefinir:</span>
                        <button
                          type="button"
                          onClick={() => handleApplyPreset(qIndex, 'yes_no')}
                          className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 font-medium"
                        >
                          Sim/Não
                        </button>
                        <button
                          type="button"
                          onClick={() => handleApplyPreset(qIndex, 'satisfaction')}
                          className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 font-medium"
                        >
                          Satisfação
                        </button>
                        <button
                          type="button"
                          onClick={() => handleApplyPreset(qIndex, 'frequency')}
                          className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 font-medium"
                        >
                          Frequência
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      {q.options.map((opt, optIndex) => (
                        <div key={opt.id} className="flex items-center gap-2">
                          <span className="w-4 text-center text-xs font-semibold text-slate-400">
                            {q.tipo === 'single_choice' ? '○' : '□'}
                          </span>
                          <input
                            type="text"
                            value={opt.texto}
                            onChange={(e) => handleUpdateOption(qIndex, optIndex, e.target.value)}
                            placeholder={`Alternativa ${optIndex + 1}`}
                            className="flex-1 text-xs text-slate-800 bg-white border border-slate-200 rounded-xl px-3 py-1.5 focus:border-blue-500 focus:outline-hidden"
                          />
                          <button
                            type="button"
                            onClick={() => handleRemoveOption(qIndex, optIndex)}
                            disabled={q.options.length <= 2}
                            className="p-1 text-slate-400 hover:text-rose-600 disabled:opacity-20"
                            title="Remover alternativa"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleAddOption(qIndex)}
                      className="mt-1 text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1.5 py-1 px-2 rounded-lg hover:bg-blue-50 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Adicionar Alternativa</span>
                    </button>
                  </div>
                )}

                {/* Pergunta Obrigatória */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                  <label className="flex items-center gap-2 cursor-pointer text-slate-600 select-none font-medium">
                    <input
                      type="checkbox"
                      checked={q.obrigatoria}
                      onChange={(e) => handleUpdateQuestion(qIndex, 'obrigatoria', e.target.checked)}
                      className="w-3.5 h-3.5 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
                    />
                    <span>Resposta Obrigatória</span>
                  </label>
                </div>
              </div>
            ))}

            {/* Botão Adicionar Pergunta */}
            <div className="pt-2 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => handleAddQuestion('single_choice')}
                className="px-4 py-2.5 rounded-xl border border-dashed border-slate-300 hover:border-blue-500 hover:bg-blue-50 text-blue-600 font-bold text-xs flex items-center gap-2 transition-colors bg-white shadow-xs"
              >
                <Plus className="w-4 h-4" />
                <span>Adicionar Pergunta de Única Escolha</span>
              </button>

              <button
                type="button"
                onClick={() => handleAddQuestion('multiple_choice')}
                className="px-4 py-2.5 rounded-xl border border-dashed border-slate-300 hover:border-slate-400 hover:bg-slate-50 text-slate-700 font-semibold text-xs flex items-center gap-2 transition-colors bg-white shadow-xs"
              >
                <Plus className="w-4 h-4" />
                <span>Múltipla Escolha</span>
              </button>

              <button
                type="button"
                onClick={() => handleAddQuestion('text')}
                className="px-4 py-2.5 rounded-xl border border-dashed border-slate-300 hover:border-slate-400 hover:bg-slate-50 text-slate-700 font-semibold text-xs flex items-center gap-2 transition-colors bg-white shadow-xs"
              >
                <Plus className="w-4 h-4" />
                <span>Texto Livre</span>
              </button>
            </div>
          </div>

        </div>
      ) : (
        /* Preview Tab */
        <div className="bg-white rounded-3xl p-6 md:p-8 border border-slate-200 shadow-md max-w-2xl mx-auto space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-100">
              Pré-Visualização do Formulário
            </span>
            <h2 className="text-2xl font-extrabold text-slate-900 mt-2 font-display">
              {titulo || 'Título da Pesquisa'}
            </h2>
            {descricao && <p className="text-xs text-slate-500 mt-1">{descricao}</p>}
          </div>

          <div className="space-y-6">
            {exigirNome && (
              <div className="space-y-1.5 p-4 rounded-2xl bg-slate-50 border border-slate-100">
                <label className="block text-xs font-bold text-slate-800">
                  Nome Completo *
                </label>
                <input
                  type="text"
                  disabled
                  placeholder="Seu nome completo"
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs"
                />
              </div>
            )}

            {questions.map((q, idx) => (
              <div key={q.id} className="space-y-2 p-4 rounded-2xl bg-slate-50/50 border border-slate-100">
                <p className="font-bold text-slate-900 text-xs">
                  {idx + 1}. {q.titulo || 'Pergunta sem título'} {q.obrigatoria && <span className="text-rose-500">*</span>}
                </p>
                {q.descricao && <p className="text-[11px] text-slate-400">{q.descricao}</p>}

                {['single_choice', 'multiple_choice'].includes(q.tipo) ? (
                  <div className="space-y-1.5 pt-1">
                    {q.options.map((opt) => (
                      <label key={opt.id} className="flex items-center gap-2 text-xs text-slate-700 p-2 rounded-lg bg-white border border-slate-200">
                        <span className="text-slate-400">{q.tipo === 'single_choice' ? '○' : '□'}</span>
                        <span>{opt.texto}</span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <textarea
                    disabled
                    placeholder="Sua resposta..."
                    rows={2}
                    className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs text-slate-400"
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
};
