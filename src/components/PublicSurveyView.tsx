import React, { useState } from 'react';
import confetti from 'canvas-confetti';
import { 
  CheckCircle2, 
  Send, 
  AlertCircle, 
  ArrowLeft, 
  ArrowRight,
  Sparkles, 
  Check, 
  Clock,
  FileCheck2,
  Lock,
  Archive,
  AlertTriangle,
  User,
  ShieldCheck
} from 'lucide-react';
import { Survey, Question, Option } from '../types';

interface PublicSurveyViewProps {
  survey: Survey;
  questions: Question[];
  options: Option[];
  onSubmitResponse: (
    surveyId: string,
    respondentName: string,
    answers: Record<string, string | string[]>,
    identificador?: string
  ) => Promise<{ success: boolean; message: string }>;
  onBackToAdmin?: () => void;
  logoUrl?: string;
}

export const PublicSurveyView: React.FC<PublicSurveyViewProps> = ({
  survey,
  questions,
  options,
  onSubmitResponse,
  onBackToAdmin,
  logoUrl
}) => {
  const [nome, setNome] = useState('');
  const [identificador, setIdentificador] = useState('');
  const [currentStep, setCurrentStep] = useState<number>(0); // 0 = Identificação (Nome), 1..N = Perguntas
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'step_by_step' | 'all_at_once'>('step_by_step');

  // Filtrar apenas perguntas ativas e ordenar por ordem
  const sortedQuestions = [...questions]
    .filter((q) => q.ativa !== false)
    .sort((a, b) => a.ordem - b.ordem);

  const totalQuestions = sortedQuestions.length;

  // 1. CHECAGEM DE STATUS DA PESQUISA
  if (survey.status !== 'Publicada') {
    let statusTitle = 'Pesquisa Indisponível';
    let statusDesc = 'Esta pesquisa não está aberta para respostas no momento.';
    let icon = <Lock className="w-12 h-12 text-amber-500 mx-auto" />;

    if (survey.status === 'Rascunho') {
      statusTitle = 'Pesquisa em Rascunho';
      statusDesc = 'Esta pesquisa ainda não foi publicada pelo organizador. Novas respostas não são aceitas.';
      icon = <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto" />;
    } else if (survey.status === 'Encerrada') {
      statusTitle = 'Pesquisa Encerrada';
      statusDesc = 'Esta pesquisa foi encerrada pelo organizador e não aceita mais novas respostas.';
      icon = <Clock className="w-12 h-12 text-slate-500 mx-auto" />;
    } else if (survey.status === 'Arquivada') {
      statusTitle = 'Pesquisa Arquivada';
      statusDesc = 'Esta pesquisa foi arquivada e não está mais disponível.';
      icon = <Archive className="w-12 h-12 text-slate-400 mx-auto" />;
    }

    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-slate-200 shadow-xl text-center space-y-5 animate-in fade-in zoom-in-95">
          <div className="w-20 h-20 rounded-3xl bg-slate-50 border border-slate-100 flex items-center justify-center mx-auto shadow-inner">
            {icon}
          </div>
          <div className="space-y-2">
            <h2 className="text-xl md:text-2xl font-bold text-slate-900 font-display">
              {statusTitle}
            </h2>
            <p className="text-xs md:text-sm text-slate-600 leading-relaxed">
              {statusDesc}
            </p>
          </div>
          <div className="pt-2 text-[11px] text-slate-400 border-t border-slate-100">
            PesquisaHub • Coleta Segura de Opiniões
          </div>
          {onBackToAdmin && (
            <button
              onClick={onBackToAdmin}
              className="w-full py-3 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs flex items-center justify-center gap-2 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Voltar ao Painel Administrativo</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  // 2. RESPOSTA REGISTRADA COM SUCESSO
  if (submitted) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-lg w-full bg-white rounded-3xl p-8 md:p-10 border border-slate-200 shadow-xl text-center space-y-6 animate-in fade-in zoom-in-95 duration-200">
          <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/10 border border-emerald-100">
            <CheckCircle2 className="w-12 h-12" />
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl md:text-3xl font-extrabold text-slate-900 font-display">
              Resposta enviada! ✓
            </h2>
            <p className="text-sm md:text-base text-slate-700 font-medium">
              Obrigado, <strong className="text-blue-600">{nome || 'Participante'}</strong>.
            </p>
            <p className="text-xs md:text-sm text-slate-500 leading-relaxed">
              {survey.configuracoes.mensagem_conclusao || 'Sua resposta foi registrada com sucesso no banco de dados do Google Sheets.'}
            </p>
          </div>

          <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 text-xs text-slate-600 space-y-1.5 text-left">
            <div className="flex justify-between py-0.5 border-b border-slate-200/50">
              <span className="text-slate-400">Pesquisa</span>
              <span className="font-semibold text-slate-800 line-clamp-1">{survey.titulo}</span>
            </div>
            <div className="flex justify-between py-0.5 border-b border-slate-200/50">
              <span className="text-slate-400">Respondente</span>
              <span className="font-semibold text-slate-800">{nome || 'Anônimo'}</span>
            </div>
            <div className="flex justify-between py-0.5">
              <span className="text-slate-400">Data e Hora</span>
              <span className="font-semibold text-slate-800">
                {new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>

          <div className="pt-2 flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Dados gravados diretamente na nuvem</span>
          </div>

          {onBackToAdmin && (
            <button
              onClick={onBackToAdmin}
              className="w-full py-3 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs flex items-center justify-center gap-2 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Voltar ao Painel Administrativo</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  // Manipuladores de resposta
  const handleSingleSelect = (questionId: string, optionValue: string) => {
    setErrorMessage(null);
    setAnswers((prev) => ({
      ...prev,
      [questionId]: optionValue
    }));
  };

  const handleMultipleSelect = (questionId: string, optionValue: string) => {
    setErrorMessage(null);
    setAnswers((prev) => {
      const current = (prev[questionId] as string[]) || [];
      const updated = current.includes(optionValue)
        ? current.filter((v) => v !== optionValue)
        : [...current, optionValue];
      return {
        ...prev,
        [questionId]: updated
      };
    });
  };

  const handleTextChange = (questionId: string, text: string) => {
    setErrorMessage(null);
    setAnswers((prev) => ({
      ...prev,
      [questionId]: text
    }));
  };

  // Validação de avanço no modo passo a passo
  const handleNextStep = () => {
    setErrorMessage(null);

    // Passo 0: Nome
    if (currentStep === 0) {
      if (survey.configuracoes.exigir_nome && !nome.trim()) {
        setErrorMessage('Por favor, informe seu nome para continuar.');
        return;
      }
      setCurrentStep(1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    // Passo 1..N: Validar pergunta atual
    const currentQ = sortedQuestions[currentStep - 1];
    if (currentQ && currentQ.obrigatoria) {
      const ans = answers[currentQ.id];
      if (!ans || (Array.isArray(ans) && ans.length === 0) || (typeof ans === 'string' && !ans.trim())) {
        setErrorMessage('Esta pergunta é obrigatória. Por favor, selecione ou preencha sua resposta.');
        return;
      }
    }

    if (currentStep < totalQuestions) {
      setCurrentStep((prev) => prev + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      // Última pergunta -> Enviar
      handleFinalSubmit();
    }
  };

  const handlePrevStep = () => {
    setErrorMessage(null);
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Envio final de todas as respostas
  const handleFinalSubmit = async () => {
    setErrorMessage(null);

    // Validar nome
    if (survey.configuracoes.exigir_nome && !nome.trim()) {
      setErrorMessage('Por favor, informe seu nome antes de enviar.');
      setCurrentStep(0);
      return;
    }

    // Validar todas as perguntas obrigatórias
    for (const q of sortedQuestions) {
      if (q.obrigatoria) {
        const ans = answers[q.id];
        if (!ans || (Array.isArray(ans) && ans.length === 0) || (typeof ans === 'string' && !ans.trim())) {
          setErrorMessage(`A pergunta "${q.titulo}" é obrigatória.`);
          // Direcionar para a pergunta não respondida no modo passo a passo
          const qIndex = sortedQuestions.findIndex((sq) => sq.id === q.id);
          if (qIndex >= 0) {
            setCurrentStep(qIndex + 1);
          }
          return;
        }
      }
    }

    setSubmitting(true);
    try {
      const result = await onSubmitResponse(survey.id, nome, answers, identificador);
      if (result.success) {
        setSubmitted(true);
        setSuccessMessage(result.message);
        
        try {
          confetti({
            particleCount: 90,
            spread: 70,
            origin: { y: 0.6 }
          });
        } catch (e) {
          // Ignorar se confetti falhar
        }
      } else {
        setErrorMessage(result.message || 'Erro ao registrar resposta no Google Sheets. Tente novamente.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro de comunicação ao enviar suas respostas.');
    } finally {
      setSubmitting(false);
    }
  };

  // Cálculo de Progresso
  const progressPercent = currentStep === 0 
    ? 5 
    : Math.round((currentStep / totalQuestions) * 100);

  const currentQuestion = currentStep > 0 ? sortedQuestions[currentStep - 1] : null;

  return (
    <div className="min-h-screen bg-slate-50/70 text-slate-900 font-sans flex flex-col justify-between py-6 md:py-10 px-4">
      
      {/* Container Central */}
      <div className="max-w-2xl w-full mx-auto space-y-6">
        
        {/* Top Minimal Brand & Admin Return (if previewed) */}
        <div className="flex items-center justify-between px-2">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold text-xs shadow-xs">
              P
            </div>
            <span className="font-bold text-slate-800 text-sm tracking-tight font-display">
              PesquisaHub
            </span>
          </div>

          <div className="flex items-center gap-2">
            {onBackToAdmin && (
              <button
                onClick={onBackToAdmin}
                className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 flex items-center gap-1.5 shadow-2xs transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Painel Admin</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setViewMode(viewMode === 'step_by_step' ? 'all_at_once' : 'step_by_step')}
              className="text-[11px] text-slate-500 hover:text-slate-700 underline font-medium px-2 py-1"
            >
              {viewMode === 'step_by_step' ? 'Ver todas juntas' : 'Uma por vez'}
            </button>
          </div>
        </div>

        {/* Minimal Progress Bar (Step-by-step mode) */}
        {viewMode === 'step_by_step' && (
          <div className="space-y-1.5 px-2">
            <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
              <span>
                {currentStep === 0 
                  ? 'Início • Identificação' 
                  : `Pergunta ${currentStep} de ${totalQuestions}`}
              </span>
              <span>{progressPercent}%</span>
            </div>
            <div className="w-full h-2 bg-slate-200/80 rounded-full overflow-hidden">
              <div 
                className="h-full bg-blue-600 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}

        {/* Survey Title Card */}
        <div className="bg-white rounded-3xl p-6 md:p-8 border border-slate-200/80 shadow-sm space-y-2">
          <div className="flex items-center gap-3 mb-1">
            {logoUrl && (
              <img
                src={logoUrl}
                alt="Logo"
                className="w-11 h-11 rounded-full object-cover border border-slate-200 shadow-xs shrink-0"
              />
            )}
            {survey.configuracoes.categoria && (
              <span className="text-[11px] font-bold text-blue-700 bg-blue-50 px-3 py-0.5 rounded-full border border-blue-100 uppercase tracking-wider inline-block">
                {survey.configuracoes.categoria}
              </span>
            )}
          </div>
          <h1 className="text-xl md:text-3xl font-extrabold text-slate-900 tracking-tight font-display">
            {survey.titulo}
          </h1>
          {survey.descricao && (
            <p className="text-xs md:text-sm text-slate-600 leading-relaxed whitespace-pre-line pt-1">
              {survey.descricao}
            </p>
          )}

          <div className="pt-3 flex items-center gap-4 text-xs text-slate-400 border-t border-slate-100">
            <span className="flex items-center gap-1.5">
              <FileCheck2 className="w-3.5 h-3.5 text-slate-500" />
              {totalQuestions} perguntas
            </span>
            <span>•</span>
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-500" />
              ~{survey.configuracoes.tempo_estimado_min || 2} min
            </span>
          </div>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-2xl text-xs flex items-center gap-3 animate-in slide-in-from-top-2">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <span className="font-medium">{errorMessage}</span>
          </div>
        )}

        {/* ============================================================== */}
        {/* MODO 1: UMA PERGUNTA POR VEZ (Typeform / Modern Step-by-Step) */}
        {/* ============================================================== */}
        {viewMode === 'step_by_step' && (
          <div className="space-y-4">
            
            {/* ETAPA 0: NOME / IDENTIFICAÇÃO */}
            {currentStep === 0 && (
              <div className="bg-white rounded-3xl p-6 md:p-8 border border-slate-200/80 shadow-sm space-y-5 animate-in fade-in duration-200">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-blue-600 text-xs font-bold uppercase tracking-wider">
                    <User className="w-4 h-4" />
                    <span>Vamos começar</span>
                  </div>
                  <h2 className="text-lg md:text-2xl font-bold text-slate-900">
                    Como podemos identificar você?
                  </h2>
                  <p className="text-xs md:text-sm text-slate-500">
                    {survey.configuracoes.exigir_nome 
                      ? 'Informe seu nome para participar desta pesquisa.' 
                      : 'Você pode informar seu nome ou responder anonimamente.'}
                  </p>
                </div>

                <div className="space-y-3">
                  <input
                    type="text"
                    autoFocus
                    value={nome}
                    onChange={(e) => {
                      setErrorMessage(null);
                      setNome(e.target.value);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleNextStep();
                      }
                    }}
                    placeholder="Digite seu nome completo..."
                    className="w-full text-base md:text-lg bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-slate-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400"
                  />

                  {survey.configuracoes.permitir_anonimo && (
                    <button
                      type="button"
                      onClick={() => {
                        setNome('Anônimo');
                        handleNextStep();
                      }}
                      className="text-xs text-slate-500 hover:text-slate-800 underline block"
                    >
                      Prefiro responder como Anônimo
                    </button>
                  )}
                </div>

                <div className="pt-3">
                  <button
                    type="button"
                    onClick={handleNextStep}
                    className="w-full py-4 px-6 rounded-2xl bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white font-bold text-sm md:text-base flex items-center justify-center gap-2 shadow-lg shadow-blue-600/25 transition-all"
                  >
                    <span>Iniciar Pesquisa</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* ETAPAS 1..N: PERGUNTA ATUAL */}
            {currentStep > 0 && currentQuestion && (
              <div className="bg-white rounded-3xl p-6 md:p-8 border border-slate-200/80 shadow-sm space-y-6 animate-in fade-in duration-200">
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
                    <span className="text-blue-600 font-bold">Pergunta {currentStep} de {totalQuestions}</span>
                    {currentQuestion.obrigatoria && (
                      <span className="text-rose-500 bg-rose-50 px-2 py-0.5 rounded-md font-semibold text-[11px]">
                        Obrigatória
                      </span>
                    )}
                  </div>
                  
                  <h2 className="text-base md:text-xl font-bold text-slate-900 leading-snug">
                    {currentQuestion.titulo}
                  </h2>
                  
                  {currentQuestion.descricao && (
                    <p className="text-xs md:text-sm text-slate-500 leading-relaxed">
                      {currentQuestion.descricao}
                    </p>
                  )}
                </div>

                {/* Opções de Resposta */}
                <div className="space-y-2.5 pt-1">
                  {renderQuestionInputs(currentQuestion, options, answers, handleSingleSelect, handleMultipleSelect, handleTextChange)}
                </div>

                {/* Controles de Navegação */}
                <div className="pt-4 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handlePrevStep}
                    className="py-3.5 px-5 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs md:text-sm flex items-center gap-1.5 transition-colors"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Anterior</span>
                  </button>

                  <button
                    type="button"
                    disabled={submitting}
                    onClick={handleNextStep}
                    className="flex-1 py-3.5 px-6 rounded-2xl bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white font-bold text-xs md:text-sm flex items-center justify-center gap-2 shadow-md shadow-blue-600/20 transition-all disabled:opacity-50"
                  >
                    {submitting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Enviando...</span>
                      </>
                    ) : currentStep === totalQuestions ? (
                      <>
                        <Send className="w-4 h-4" />
                        <span>Enviar Respostas</span>
                      </>
                    ) : (
                      <>
                        <span>Próxima Pergunta</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>

              </div>
            )}

          </div>
        )}

        {/* ============================================================== */}
        {/* MODO 2: TODAS AS PERGUNTAS JUNTAS (Visualização Contínua) */}
        {/* ============================================================== */}
        {viewMode === 'all_at_once' && (
          <form 
            onSubmit={(e) => {
              e.preventDefault();
              handleFinalSubmit();
            }} 
            className="space-y-4"
          >
            {/* Identificação */}
            {survey.configuracoes.exigir_nome && (
              <div className="bg-white rounded-3xl p-6 md:p-7 border border-slate-200 shadow-sm space-y-3">
                <label className="block text-sm md:text-base font-bold text-slate-900">
                  Seu Nome Completo <span className="text-rose-500">*</span>
                </label>
                <p className="text-xs text-slate-500">
                  Como gostaria de ser identificado nesta pesquisa.
                </p>
                <input
                  type="text"
                  required
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Digite seu nome..."
                  className="w-full text-sm md:text-base bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-slate-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                />
              </div>
            )}

            {/* Todas as perguntas */}
            {sortedQuestions.map((q, idx) => (
              <div key={q.id} className="bg-white rounded-3xl p-6 md:p-7 border border-slate-200 shadow-sm space-y-4">
                <div className="space-y-1">
                  <h3 className="text-sm md:text-base font-bold text-slate-900 leading-snug">
                    <span className="text-blue-600 mr-1.5">{idx + 1}.</span>
                    {q.titulo}
                    {q.obrigatoria && <span className="text-rose-500 ml-1">*</span>}
                  </h3>
                  {q.descricao && <p className="text-xs text-slate-500">{q.descricao}</p>}
                </div>

                <div className="space-y-2.5">
                  {renderQuestionInputs(q, options, answers, handleSingleSelect, handleMultipleSelect, handleTextChange)}
                </div>
              </div>
            ))}

            {/* Botão Enviar */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-4 px-6 rounded-2xl bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white font-bold text-sm md:text-base flex items-center justify-center gap-2 shadow-lg shadow-blue-600/25 transition-all disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Enviando Respostas...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Enviar Respostas</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}

      </div>

      {/* Footer Minimalista */}
      <div className="py-6 text-center text-xs text-slate-400">
        <p>Desenvolvido com PesquisaHub • Integração Segura com Google Sheets</p>
      </div>

    </div>
  );
};

/**
 * Renderizador modular de alternativas em formato de cards clicáveis grandes
 */
function renderQuestionInputs(
  question: Question,
  options: Option[],
  answers: Record<string, string | string[]>,
  onSingleSelect: (qId: string, val: string) => void,
  onMultipleSelect: (qId: string, val: string) => void,
  onTextChange: (qId: string, val: string) => void
) {
  const qOptions = options
    .filter((o) => o.question_id === question.id)
    .sort((a, b) => a.ordem - b.ordem);

  if (question.tipo === 'single_choice') {
    return (
      <div className="space-y-2.5">
        {qOptions.map((opt) => {
          const isSelected = answers[question.id] === opt.valor;
          return (
            <div
              key={opt.id}
              role="button"
              tabIndex={0}
              onClick={() => onSingleSelect(question.id, opt.valor)}
              onKeyDown={(e) => {
                if (e.key === ' ' || e.key === 'Enter') {
                  e.preventDefault();
                  onSingleSelect(question.id, opt.valor);
                }
              }}
              className={`flex items-center justify-between p-4 rounded-2xl border cursor-pointer select-none transition-all duration-150 ${
                isSelected
                  ? 'bg-blue-50/90 border-blue-500 text-blue-950 font-semibold shadow-xs ring-1 ring-blue-500/30'
                  : 'bg-white hover:bg-slate-50/80 border-slate-200 text-slate-800'
              }`}
            >
              <span className="text-xs md:text-sm leading-snug">{opt.texto}</span>
              <div className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ml-3 transition-colors ${
                isSelected ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300 bg-white'
              }`}>
                {isSelected && <span className="w-2 h-2 rounded-full bg-white" />}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  if (question.tipo === 'multiple_choice') {
    const currentSelected = (answers[question.id] as string[]) || [];
    return (
      <div className="space-y-2.5">
        {qOptions.map((opt) => {
          const isSelected = currentSelected.includes(opt.valor);
          return (
            <div
              key={opt.id}
              role="button"
              tabIndex={0}
              onClick={() => onMultipleSelect(question.id, opt.valor)}
              onKeyDown={(e) => {
                if (e.key === ' ' || e.key === 'Enter') {
                  e.preventDefault();
                  onMultipleSelect(question.id, opt.valor);
                }
              }}
              className={`flex items-center justify-between p-4 rounded-2xl border cursor-pointer select-none transition-all duration-150 ${
                isSelected
                  ? 'bg-blue-50/90 border-blue-500 text-blue-950 font-semibold shadow-xs ring-1 ring-blue-500/30'
                  : 'bg-white hover:bg-slate-50/80 border-slate-200 text-slate-800'
              }`}
            >
              <span className="text-xs md:text-sm leading-snug">{opt.texto}</span>
              <div className={`w-5 h-5 rounded-lg border flex items-center justify-center shrink-0 ml-3 transition-colors ${
                isSelected ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300 bg-white'
              }`}>
                {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  if (question.tipo === 'scale' || question.tipo === 'rating') {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1">
        {qOptions.map((opt) => {
          const isSelected = answers[question.id] === opt.valor;
          return (
            <button
              type="button"
              key={opt.id}
              onClick={() => onSingleSelect(question.id, opt.valor)}
              className={`p-3.5 rounded-2xl border text-center transition-all ${
                isSelected
                  ? 'bg-blue-600 border-blue-600 text-white font-bold shadow-md shadow-blue-600/20'
                  : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
              }`}
            >
              <span className="text-xs font-semibold block leading-tight">{opt.texto}</span>
            </button>
          );
        })}
      </div>
    );
  }

  if (question.tipo === 'long_text') {
    return (
      <textarea
        rows={4}
        value={(answers[question.id] as string) || ''}
        onChange={(e) => onTextChange(question.id, e.target.value)}
        placeholder="Escreva sua resposta detalhadamente aqui..."
        className="w-full text-xs md:text-sm bg-slate-50 border border-slate-200 rounded-2xl p-4 text-slate-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
      />
    );
  }

  // Texto curto padrão
  return (
    <input
      type="text"
      value={(answers[question.id] as string) || ''}
      onChange={(e) => onTextChange(question.id, e.target.value)}
      placeholder="Digite sua resposta aqui..."
      className="w-full text-xs md:text-sm bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3.5 text-slate-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
    />
  );
}

