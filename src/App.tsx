import React, { useState, useEffect, useCallback } from 'react';
import { Sidebar, NavTab } from './components/Sidebar';
import { Navbar } from './components/Navbar';
import { GeneralDashboard } from './components/GeneralDashboard';
import { SurveyList } from './components/SurveyList';
import { SurveyBuilder } from './components/SurveyBuilder';
import { AnalyticsView } from './components/analytics/AnalyticsView';
import { SettingsView } from './components/SettingsView';
import { PublicSurveyView } from './components/PublicSurveyView';
import { ShareModal } from './components/ShareModal';
import { LoginView } from './components/LoginView';
import { UsersView } from './components/UsersView';
import { DepartmentsView } from './components/DepartmentsView';
import { AcessoEspecialModal } from './components/AcessoEspecialModal';
import {
  podeCriarPesquisa,
  podeEditarPesquisa,
  podeExcluirPesquisa,
  podeLiberarAcesso,
  podeExportarPesquisa,
  departamentosParaCriar
} from './services/permissoes';
import { ApiService } from './services/api';
import { AuthService } from './services/authService';
import { 
  Survey, 
  Question, 
  Option, 
  Respondent, 
  Answer, 
  SurveyStatus,
  GoogleAppsScriptConfig,
  AppUser,
  AppSettings,
  Department,
  QuestionDraftPayload
} from './types';
import { Loader2 } from 'lucide-react';

export function App() {
  // Autenticação: usuário logado (null = não autenticado)
  const [currentUser, setCurrentUser] = useState<AppUser | null>(() => AuthService.getCurrentUser());

  // Identidade visual (logo/nome customizados pelo ADM) — carregada uma vez, independente do login,
  // pois é usada na tela de login, no menu lateral e no formulário público
  const [appSettings, setAppSettings] = useState<AppSettings>({ logoUrl: '', nomeExibicao: '' });

  // Inicialização e dados centrais (sincronizados com Google Sheets).
  // `surveys` e `respondents` vêm do endpoint leve (getDashboardData) e são
  // recarregados a cada ação. `questions`/`options`/`answers` só chegam quando uma
  // pesquisa específica é aberta (ver fetchSurveyDetailFor abaixo) — evita baixar
  // o histórico de respostas de TODAS as pesquisas sempre que qualquer tela abre.
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [options, setOptions] = useState<Option[]>([]);
  const [respondents, setRespondents] = useState<Respondent[]>([]);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [gasConfig, setGasConfig] = useState<GoogleAppsScriptConfig>({
    webAppUrl: '',
    isConnected: false,
    autoSync: true
  });

  // Estado de navegação e visualização
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [activeSurveyId, setActiveSurveyId] = useState<string | null>(null);
  const [editingSurvey, setEditingSurvey] = useState<Survey | null>(null);
  const [publicViewSurveyId, setPublicViewSurveyId] = useState<string | null>(null);
  const [publicSurveyData, setPublicSurveyData] = useState<{
    survey: Survey;
    questions: Question[];
    options: Option[];
  } | null>(null);
  const [isLoadingPublicSurvey, setIsLoadingPublicSurvey] = useState(false);
  const [shareModalSurvey, setShareModalSurvey] = useState<Survey | null>(null);
  const [accessModalSurvey, setAccessModalSurvey] = useState<Survey | null>(null);

  // Departamentos (lista geral) e filtro de departamentos escolhido pela pessoa no painel
  const [departments, setDepartments] = useState<Department[]>([]);
  const [filtroDepartamentos, setFiltroDepartamentos] = useState<string[]>(
    () => AuthService.getCurrentUser()?.preferencias?.departamentos_visiveis || []
  );

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  // Carregando os detalhes completos (perguntas/opções/respostas) de UMA pesquisa,
  // ao abrir Analytics ou o Builder para editá-la.
  const [isLoadingSurveyDetail, setIsLoadingSurveyDetail] = useState(false);
  const [isSavingSurvey, setIsSavingSurvey] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((current) => (current === msg ? null : current));
    }, 4000);
  }, []);

  // Recarregar os dados "leves" da planilha Google Sheets: lista de pesquisas (já
  // com contadores prontos) + respondentes (sem as respostas de texto). Rápido o
  // bastante para ser chamado a cada ação (criar, publicar, excluir, duplicar) sem
  // travar a interface. NÃO mexe em questions/options/answers — esses só são
  // atualizados quando uma pesquisa específica é aberta (ver fetchSurveyDetailFor).
  const refreshDataFromSheets = useCallback(async () => {
    setIsRefreshing(true);
    ApiService.init();
    const config = ApiService.getGasConfig();
    setGasConfig(config);

    if (config.webAppUrl) {
      try {
        const result = await ApiService.fetchDashboardDataFromSheets();
        if (result.success && result.data) {
          setSurveys(result.data.surveys);
          setRespondents(result.data.respondents);
          setDepartments(ApiService.getDepartments());
          setGasConfig(ApiService.getGasConfig());
          setApiError(null);
        } else {
          setApiError(result.message || 'Erro ao carregar os dados do banco');
          // Manter dados locais caso a API falhe temporariamente
          setSurveys(ApiService.getSurveys());
        }
      } catch (err: any) {
        console.warn('Falha ao atualizar dados do banco:', err);
        setApiError(err.message || 'Falha de comunicação com o servidor');
        setSurveys(ApiService.getSurveys());
      }
    } else {
      // Carregar do estado em memória local se não houver URL
      setSurveys(ApiService.getSurveys());
    }
    setIsRefreshing(false);
  }, []);

  // Carrega perguntas/opções/respondentes/respostas de UMA pesquisa (sob demanda) e
  // atualiza o estado local com o cache completo já mesclado. Usado ao abrir
  // Analytics ou o Builder para editar uma pesquisa existente.
  const fetchSurveyDetailFor = useCallback(async (surveyId: string) => {
    setIsLoadingSurveyDetail(true);
    try {
      const result = await ApiService.fetchSurveyDetail(surveyId);
      setQuestions(result.questions);
      setOptions(result.options);
      setRespondents(result.respondents);
      setAnswers(result.answers);
      if (!result.success && result.message) {
        showToast(`Não foi possível carregar todos os detalhes: ${result.message}`);
      }
    } finally {
      setIsLoadingSurveyDetail(false);
    }
  }, [showToast]);

  // Carregar dados de uma pesquisa pública individual (para links diretos / anônimos)
  const loadPublicSurvey = useCallback(async (surveyIdOrSlug: string) => {
    setIsLoadingPublicSurvey(true);
    const data = await ApiService.fetchPublicSurvey(surveyIdOrSlug);
    setPublicSurveyData(data);
    setIsLoadingPublicSurvey(false);
  }, []);

  // Inicialização e detecção de rotas públicas sem login (#/responder/:id, #responder-:id, /responder/:id, ?survey=:id)
  useEffect(() => {
    ApiService.init();
    setGasConfig(ApiService.getGasConfig());
    // Identidade visual (logo) é pública — carregada sempre, com ou sem login
    ApiService.getAppSettings().then(setAppSettings);
    // Só busca os dados administrativos se já houver um usuário logado
    // (pesquisas públicas de resposta não precisam de login e são carregadas à parte)
    // Confere com o Supabase se a sessão salva ainda vale (e se o usuário segue ativo)
    // antes de carregar os dados. Se não valer mais, volta para a tela de login.
    if (AuthService.getCurrentUser()) {
      AuthService.validateSession().then((user) => {
        setCurrentUser(user);
        if (user) refreshDataFromSheets();
      });
    }

    const handleUrlRouting = () => {
      const urlParams = new URLSearchParams(window.location.search);
      const querySurvey = urlParams.get('survey') || urlParams.get('responder');
      const hash = window.location.hash || '';
      const pathname = window.location.pathname || '';

      let detectedSurveyId: string | null = null;

      if (querySurvey) {
        detectedSurveyId = decodeURIComponent(querySurvey.trim());
      } else if (hash.startsWith('#/responder/')) {
        detectedSurveyId = decodeURIComponent(hash.replace('#/responder/', '').trim());
      } else if (hash.startsWith('#responder-')) {
        detectedSurveyId = decodeURIComponent(hash.replace('#responder-', '').trim());
      } else if (hash.startsWith('#/responder-')) {
        detectedSurveyId = decodeURIComponent(hash.replace('#/responder-', '').trim());
      } else if (pathname.includes('/responder/')) {
        const parts = pathname.split('/responder/');
        if (parts[1]) {
          detectedSurveyId = decodeURIComponent(parts[1].split('/')[0].trim());
        }
      }

      if (detectedSurveyId) {
        setPublicViewSurveyId(detectedSurveyId);
        loadPublicSurvey(detectedSurveyId);
      } else {
        setPublicViewSurveyId(null);
        setPublicSurveyData(null);
      }
    };

    handleUrlRouting();
    window.addEventListener('hashchange', handleUrlRouting);
    window.addEventListener('popstate', handleUrlRouting);
    return () => {
      window.removeEventListener('hashchange', handleUrlRouting);
      window.removeEventListener('popstate', handleUrlRouting);
    };
  }, [loadPublicSurvey, refreshDataFromSheets]);

  // Pesquisa ativa atual para análise estatística
  const activeSurvey = surveys.find((s) => s.id === activeSurveyId) || null;

  // Ações de Pesquisas
  const handleAnalyzeSurvey = (surveyId: string) => {
    setActiveSurveyId(surveyId);
    setActiveTab('analytics');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    // Busca os detalhes completos desta pesquisa sob demanda (perguntas, opções,
    // respondentes e respostas) — não fica mais preso ao que já tivesse sido
    // baixado antes.
    fetchSurveyDetailFor(surveyId);
  };

  const handleOpenNewSurvey = () => {
    setEditingSurvey(null);
    setActiveTab('builder');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleEditSurvey = (survey: Survey) => {
    if (!podeEditarPesquisa(currentUser, survey)) {
      showToast('Você não tem permissão para editar esta pesquisa.');
      return;
    }
    setEditingSurvey(survey);
    setActiveTab('builder');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    // Garante que as perguntas/opções desta pesquisa estejam carregadas antes de
    // editar (caso o usuário ainda não tenha aberto essa pesquisa nesta sessão).
    fetchSurveyDetailFor(survey.id);
  };

  const handleSaveSurvey = async (
    surveyData: Omit<Survey, 'id' | 'data_criacao'>,
    questionsData: QuestionDraftPayload
  ) => {
    setIsSavingSurvey(true);
    try {
      if (editingSurvey) {
        // Edição completa (dados, perguntas e alternativas) numa única operação.
        // O ID e o link público da pesquisa não mudam.
        await ApiService.updateSurveyFull(editingSurvey.id, surveyData, questionsData);
        showToast(`Pesquisa "${surveyData.titulo}" atualizada!`);
      } else {
        const surveyDataComDono = { ...surveyData, criado_por: currentUser?.id || surveyData.criado_por };
        const newSurvey = await ApiService.createSurvey(surveyDataComDono, questionsData);
        // Atualizar imediatamente o estado de surveys para que apareça sem atraso
        setSurveys(ApiService.getSurveys());
        showToast(`Pesquisa "${newSurvey.titulo}" criada com sucesso!`);
      }

      // Sincronizar em segundo plano (agora leve — só pesquisas + respondentes)
      await refreshDataFromSheets();
      setEditingSurvey(null);
      setActiveTab('surveys');
    } catch (err: any) {
      console.error('Erro ao salvar pesquisa:', err);
      showToast(`Erro ao gravar a pesquisa: ${err.message || err}`);
    } finally {
      setIsSavingSurvey(false);
    }
  };

  const handleDuplicateSurvey = async (surveyId: string) => {
    try {
      // A pesquisa original precisa estar carregada em memória (perguntas/opções)
      // para poder ser duplicada — garante isso antes de chamar duplicateSurvey.
      await fetchSurveyDetailFor(surveyId);
      const duplicated = await ApiService.duplicateSurvey(surveyId);
      if (duplicated) {
        setSurveys(ApiService.getSurveys());
        await refreshDataFromSheets();
        showToast(`Pesquisa duplicada como "${duplicated.titulo}" (Rascunho)`);
      }
    } catch (err: any) {
      showToast(`Erro ao duplicar pesquisa: ${err.message || err}`);
    }
  };

  const handleToggleStatus = async (surveyId: string, newStatus: SurveyStatus) => {
    try {
      await ApiService.updateSurveyStatus(surveyId, newStatus);
      setSurveys(ApiService.getSurveys());
      await refreshDataFromSheets();
      showToast(`Status da pesquisa alterado para "${newStatus}".`);
    } catch (err: any) {
      showToast(`Erro ao atualizar status: ${err.message || err}`);
    }
  };

  const handleDeleteSurvey = async (surveyId: string) => {
    try {
      await ApiService.deleteSurvey(surveyId);
      if (activeSurveyId === surveyId) {
        setActiveSurveyId(null);
        setActiveTab('surveys');
      }
      setSurveys(ApiService.getSurveys());
      await refreshDataFromSheets();
      showToast('Pesquisa excluída do banco de dados.');
    } catch (err: any) {
      showToast(`Erro ao excluir pesquisa: ${err.message || err}`);
    }
  };

  // Ações de Autenticação
  const handleLoginSuccess = (user: AppUser) => {
    setCurrentUser(user);
    setFiltroDepartamentos(user.preferencias?.departamentos_visiveis || []);
    refreshDataFromSheets();
  };

  // Excluir a resposta de uma pessoa (feita por engano / duplicada)
  const handleDeleteRespondent = async (resp: Respondent) => {
    await ApiService.deleteRespondent(resp.survey_id, resp.id);
    setRespondents((prev) => prev.filter((r) => r.id !== resp.id));
    setAnswers((prev) => prev.filter((a) => a.respondent_id !== resp.id));
    setSurveys((prev) =>
      prev.map((s) =>
        s.id === resp.survey_id && typeof s.total_respostas === 'number'
          ? { ...s, total_respostas: Math.max(0, s.total_respostas - 1) }
          : s
      )
    );
    showToast(`Resposta de "${resp.nome}" excluída.`);
  };

  // Lista de pessoas esperadas (aba Adesão)
  const handleSalvarPublicoEsperado = async (surveyId: string, lista: string[]) => {
    await ApiService.updateSurveyConfiguracoes(surveyId, { publico_esperado: lista });
    setSurveys((prev) =>
      prev.map((s) => (s.id === surveyId ? { ...s, configuracoes: { ...s.configuracoes, publico_esperado: lista } } : s))
    );
    showToast('Lista de pessoas esperadas salva.');
  };

  // Filtro de departamentos do painel (salvo como preferência pessoal)
  const handleFiltroDepartamentos = (ids: string[]) => {
    setFiltroDepartamentos(ids);
    AuthService.savePreferences({ departamentos_visiveis: ids }).catch(() => {
      // preferência é conveniência: se falhar, o filtro vale só nesta sessão
    });
  };

  const handleLogout = async () => {
    await AuthService.logout();
    setCurrentUser(null);
    setFiltroDepartamentos([]);
    setSurveys([]);
    setQuestions([]);
    setOptions([]);
    setRespondents([]);
    setAnswers([]);
    setActiveTab('dashboard');
  };

  const handleOpenPublicView = (surveyId: string) => {
    setPublicViewSurveyId(surveyId);
    loadPublicSurvey(surveyId);
    window.location.hash = `/responder/${surveyId}`;
  };

  const handleBackFromPublicView = () => {
    setPublicViewSurveyId(null);
    setPublicSurveyData(null);
    window.location.hash = '';
    // Limpar query param se houver
    if (window.location.search) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  };

  // Submissão de resposta pública (executada por qualquer respondente anônimo sem login)
  const handleSubmitResponse = async (
    surveyId: string,
    respondentName: string,
    answersMap: Record<string, string | string[]>,
    identificador?: string
  ) => {
    // Observação: não recarregamos os dados administrativos aqui — quem responde
    // a pesquisa não está logado e não vê o painel, então não há nada para
    // atualizar nesta sessão. Isso também evita uma chamada extra ao Apps Script
    // logo após o envio, na hora em que ele está mais ocupado gravando a resposta.
    return ApiService.submitResponse(surveyId, respondentName, answersMap, identificador);
  };

  // Exportação CSV com dados reais
  const handleExportCSV = (surveyId: string) => {
    const alvo = surveys.find((s) => s.id === surveyId);
    if (alvo && !podeExportarPesquisa(currentUser, alvo, ApiService.podeExportarComoEspecial())) {
      showToast('Seu acesso a esta pesquisa não permite exportar.');
      return;
    }
    const csvContent = ApiService.exportToCSV(surveyId);
    if (!csvContent) {
      showToast('Não foi possível gerar a exportação CSV.');
      return;
    }

    const s = surveys.find((survey) => survey.id === surveyId);
    const filename = `respostas_${(s?.titulo || 'pesquisa').replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${new Date().toISOString().split('T')[0]}.csv`;
    
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    showToast('Planilha CSV exportada com sucesso!');
  };

  // MODO PÚBLICO: FORMULÁRIO PÚBLICO DE RESPOSTAS (Acesso sem login para qualquer pessoa)
  if (publicViewSurveyId) {
    if (isLoadingPublicSurvey) {
      return (
        <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-4">
          <div className="flex flex-col items-center gap-3 bg-white p-8 rounded-3xl border border-slate-200 shadow-md">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
            <p className="text-xs font-semibold text-slate-700">Carregando questionário...</p>
          </div>
        </div>
      );
    }

    const targetSurveyData = publicSurveyData || ApiService.getSurvey(publicViewSurveyId);
    if (!targetSurveyData) {
      return (
        <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-slate-200 text-center space-y-4 shadow-xl">
            <h2 className="text-xl font-bold text-slate-800">Pesquisa Não Encontrada</h2>
            <p className="text-xs text-slate-500">
              O link informado pode ter sido removido ou não está disponível no momento.
            </p>
            <button
              onClick={handleBackFromPublicView}
              className="px-4 py-2 bg-blue-600 text-white text-xs font-semibold rounded-xl hover:bg-blue-700"
            >
              Ir para a Página Principal
            </button>
          </div>
        </div>
      );
    }

    return (
      <PublicSurveyView
        survey={targetSurveyData.survey}
        questions={targetSurveyData.questions}
        options={targetSurveyData.options}
        onSubmitResponse={handleSubmitResponse}
        onBackToAdmin={handleBackFromPublicView}
        logoUrl={appSettings.logoUrl}
      />
    );
  }

  // ÁREA ADMINISTRATIVA: exige login (fora da rota pública de resposta acima)
  if (!currentUser) {
    return <LoginView onLoginSuccess={handleLoginSuccess} logoUrl={appSettings.logoUrl} />;
  }

  // Usuários que já são "user" comum não devem ficar presos na tela de Usuários (só ADM)
  const podeCriar = podeCriarPesquisa(currentUser);
  const effectiveTab =
    ((activeTab === 'users' || activeTab === 'departments') && currentUser.role !== 'admin') ||
    (activeTab === 'builder' && !editingSurvey && !podeCriar)
      ? 'dashboard'
      : activeTab;

  // Departamentos que aparecem nas pesquisas visíveis a esta pessoa
  const departamentosEmUso = departments.filter((d) => surveys.some((s) => s.department_id === d.id));
  const filtroAtivo = filtroDepartamentos.filter((id) => departamentosEmUso.some((d) => d.id === id));
  const surveysVisiveis = filtroAtivo.length > 0
    ? surveys.filter((s) => s.department_id && filtroAtivo.includes(s.department_id))
    : surveys;
  const idsVisiveis = new Set(surveysVisiveis.map((s) => s.id));
  const respondentsVisiveis = filtroAtivo.length > 0 ? respondents.filter((r) => idsVisiveis.has(r.survey_id)) : respondents;

  const permissoesLista = {
    podeCriar,
    podeEditar: (s: Survey) => podeEditarPesquisa(currentUser, s),
    podeExcluir: (s: Survey) => podeExcluirPesquisa(currentUser, s),
    podeLiberar: (s: Survey) => podeLiberarAcesso(currentUser, s)
  };

  // Obter perguntas e opções da pesquisa atualmente em análise
  const currentSurveyQuestions = activeSurveyId
    ? questions.filter((q) => q.survey_id === activeSurveyId)
    : [];
  const currentSurveyOptions = activeSurveyId
    ? options.filter((o) => currentSurveyQuestions.some((q) => q.id === o.question_id))
    : [];
  const currentSurveyRespondents = activeSurveyId
    ? respondents.filter((r) => r.survey_id === activeSurveyId)
    : [];
  const currentSurveyAnswers = activeSurveyId
    ? answers.filter((a) => a.survey_id === activeSurveyId)
    : [];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row text-slate-900 font-sans">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-2xl text-xs font-semibold flex items-center gap-2 border border-slate-800 animate-in slide-in-from-bottom-3 duration-200">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Sidebar Navigation */}
      <Sidebar
        activeTab={effectiveTab}
        onTabChange={(tab) => {
          if (tab === 'builder') {
            handleOpenNewSurvey();
          } else {
            setActiveTab(tab);
          }
        }}
        activeSurvey={activeSurvey}
        totalSurveysCount={surveysVisiveis.length}
        totalResponsesCount={respondentsVisiveis.length}
        podeCriar={podeCriar}
        isMobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
        currentUser={currentUser}
        onLogout={handleLogout}
        logoUrl={appSettings.logoUrl}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* Top Navbar */}
        <Navbar
          onToggleMobile={() => setMobileMenuOpen(!mobileMenuOpen)}
          onOpenNewSurvey={handleOpenNewSurvey}
          onRefreshData={refreshDataFromSheets}
          isRefreshing={isRefreshing}
          activeSurveyTitle={effectiveTab === 'analytics' && activeSurvey ? activeSurvey.titulo : undefined}
          gasConfig={gasConfig}
          onOpenSettings={() => setActiveTab('settings')}
          podeCriar={podeCriar}
        />

        {/* View Switcher */}
        <main className="flex-1 pb-16">
          {/* Filtro de departamentos (aparece quando há pesquisas de mais de um departamento) */}
          {(effectiveTab === 'dashboard' || effectiveTab === 'surveys') && departamentosEmUso.length > 1 && (
            <div className="px-4 md:px-8 pt-4 max-w-7xl mx-auto">
              <div className="bg-white border border-slate-200 rounded-2xl px-4 py-3 flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mr-1">Departamentos</span>
                <button
                  onClick={() => handleFiltroDepartamentos([])}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    filtroAtivo.length === 0 ? 'bg-slate-900 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                  }`}
                >
                  Todos
                </button>
                {departamentosEmUso.map((d) => {
                  const marcado = filtroAtivo.includes(d.id);
                  return (
                    <button
                      key={d.id}
                      onClick={() =>
                        handleFiltroDepartamentos(marcado ? filtroAtivo.filter((x) => x !== d.id) : [...filtroAtivo, d.id])
                      }
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                        marcado ? 'bg-blue-600 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                      }`}
                    >
                      {d.nome}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {effectiveTab === 'dashboard' && (
            <GeneralDashboard
              surveys={surveysVisiveis}
              totalResponsesCount={respondentsVisiveis.length}
              respondents={respondentsVisiveis}
              onAnalyzeSurvey={handleAnalyzeSurvey}
              onOpenNewSurvey={handleOpenNewSurvey}
              onOpenPublicView={handleOpenPublicView}
              onShareSurvey={(s) => setShareModalSurvey(s)}
              onViewAllSurveys={() => setActiveTab('surveys')}
              onOpenSettings={() => setActiveTab('settings')}
              onRefreshData={refreshDataFromSheets}
              currentUser={currentUser}
            />
          )}

          {effectiveTab === 'surveys' && (
            <SurveyList
              surveys={surveysVisiveis}
              questions={questions}
              respondents={respondentsVisiveis}
              permissoes={permissoesLista}
              onManageAccess={(s) => setAccessModalSurvey(s)}
              mostrarDepartamento={departamentosEmUso.length > 1 || currentUser.role === 'admin'}
              isLoading={isRefreshing}
              apiError={apiError}
              onRefreshData={refreshDataFromSheets}
              onAnalyzeSurvey={handleAnalyzeSurvey}
              onEditSurvey={handleEditSurvey}
              onDuplicateSurvey={handleDuplicateSurvey}
              onToggleStatus={handleToggleStatus}
              onDeleteSurvey={handleDeleteSurvey}
              onShareSurvey={(s) => setShareModalSurvey(s)}
              onOpenPublicView={handleOpenPublicView}
              onOpenNewSurvey={handleOpenNewSurvey}
            />
          )}

          {effectiveTab === 'builder' && (
            isLoadingSurveyDetail && editingSurvey ? (
              <div className="p-8 flex flex-col items-center justify-center gap-3 text-center min-h-[50vh]">
                <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                <p className="text-xs font-semibold text-slate-500">Carregando perguntas desta pesquisa...</p>
              </div>
            ) : (
              <SurveyBuilder
                initialSurvey={editingSurvey}
                initialQuestions={editingSurvey ? questions.filter((q) => q.survey_id === editingSurvey.id) : undefined}
                initialOptions={editingSurvey ? options : undefined}
                isSaving={isSavingSurvey}
                onSaveSurvey={handleSaveSurvey}
                departamentosDisponiveis={departamentosParaCriar(currentUser, departments)}
                key={editingSurvey ? `editar-${editingSurvey.id}` : 'nova'}
                onCancel={() => setActiveTab(surveys.length > 0 ? 'surveys' : 'dashboard')}
              />
            )
          )}

          {effectiveTab === 'analytics' && (
            activeSurvey ? (
              isLoadingSurveyDetail ? (
                <div className="p-8 flex flex-col items-center justify-center gap-3 text-center min-h-[50vh]">
                  <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                  <p className="text-xs font-semibold text-slate-500">Carregando respostas desta pesquisa...</p>
                </div>
              ) : (
                <AnalyticsView
                  survey={activeSurvey}
                  questions={currentSurveyQuestions}
                  options={currentSurveyOptions}
                  respondents={currentSurveyRespondents}
                  answers={currentSurveyAnswers}
                  onBackToSurveys={() => setActiveTab('surveys')}
                  onShareSurvey={(s) => setShareModalSurvey(s)}
                  onOpenPublicView={handleOpenPublicView}
                  onExportCSV={handleExportCSV}
                  somenteLeitura={!podeEditarPesquisa(currentUser, activeSurvey)}
                  podeExportar={podeExportarPesquisa(currentUser, activeSurvey, ApiService.podeExportarComoEspecial())}
                  podeExcluirRespostas={podeExcluirPesquisa(currentUser, activeSurvey)}
                  onDeleteRespondent={handleDeleteRespondent}
                  onSalvarPublicoEsperado={(lista) => handleSalvarPublicoEsperado(activeSurvey.id, lista)}
                />
              )
            ) : (
              <div className="p-8 text-center space-y-4">
                <p className="text-slate-500 text-sm">Selecione uma pesquisa para analisar.</p>
                <button
                  onClick={() => setActiveTab('surveys')}
                  className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-semibold"
                >
                  Ir para Lista de Pesquisas
                </button>
              </div>
            )
          )}

          {effectiveTab === 'users' && currentUser.role === 'admin' && (
            <UsersView />
          )}

          {effectiveTab === 'departments' && currentUser.role === 'admin' && (
            <DepartmentsView
              surveys={surveys}
              onDepartmentsChanged={() => {
                ApiService.fetchDepartments().then(setDepartments).catch(() => undefined);
              }}
            />
          )}

          {effectiveTab === 'settings' && (
            <SettingsView
              config={gasConfig}
              onSaveConfig={(cfg) => {
                const updated = ApiService.saveGasConfig(cfg);
                setGasConfig(updated);
                showToast('Configurações salvas!');
              }}
              onRefreshDataFromSheets={refreshDataFromSheets}
              appSettings={appSettings}
              isAdmin={currentUser.role === 'admin'}
              onSaveAppSettings={async (logoUrl, nomeExibicao) => {
                await ApiService.saveAppSettings(logoUrl, nomeExibicao);
                setAppSettings({ logoUrl, nomeExibicao });
                showToast('Identidade visual atualizada!');
              }}
            />
          )}
        </main>
      </div>

      {/* Liberação de acesso especial a uma pesquisa */}
      {accessModalSurvey && (
        <AcessoEspecialModal survey={accessModalSurvey} onClose={() => setAccessModalSurvey(null)} />
      )}

      {/* Share Modal Dialog */}
      {shareModalSurvey && (
        <ShareModal
          survey={shareModalSurvey}
          isOpen={Boolean(shareModalSurvey)}
          onClose={() => setShareModalSurvey(null)}
          onOpenPublicView={handleOpenPublicView}
        />
      )}

    </div>
  );
}
export default App;
