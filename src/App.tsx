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
  AppUser
} from './types';
import { Loader2 } from 'lucide-react';

export function App() {
  // Autenticação: usuário logado (null = não autenticado)
  const [currentUser, setCurrentUser] = useState<AppUser | null>(() => AuthService.getCurrentUser());

  // Inicialização e dados centrais (sincronizados com Google Sheets)
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

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSavingSurvey, setIsSavingSurvey] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((current) => (current === msg ? null : current));
    }, 4000);
  }, []);

  // Recarregar dados reais da planilha Google Sheets
  const refreshDataFromSheets = useCallback(async () => {
    setIsRefreshing(true);
    ApiService.init();
    const config = ApiService.getGasConfig();
    setGasConfig(config);

    if (config.webAppUrl) {
      try {
        const result = await ApiService.fetchAllDataFromSheets();
        if (result.success && result.data) {
          setSurveys(result.data.surveys);
          setQuestions(result.data.questions);
          setOptions(result.data.options);
          setRespondents(result.data.respondents);
          setAnswers(result.data.answers);
          setGasConfig(ApiService.getGasConfig());
          setApiError(null);
        } else {
          setApiError(result.message || 'Erro ao sincronizar com Google Sheets');
          // Manter dados locais caso a API falhe temporariamente
          setSurveys(ApiService.getSurveys());
        }
      } catch (err: any) {
        console.warn('Falha ao atualizar dados do Google Sheets:', err);
        setApiError(err.message || 'Falha de comunicação com Google Sheets');
        setSurveys(ApiService.getSurveys());
      }
    } else {
      // Carregar do estado em memória local se não houver URL
      setSurveys(ApiService.getSurveys());
    }
    setIsRefreshing(false);
  }, []);

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
    // Só busca os dados administrativos se já houver um usuário logado
    // (pesquisas públicas de resposta não precisam de login e são carregadas à parte)
    if (AuthService.getCurrentUser()) {
      refreshDataFromSheets();
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
  };

  const handleOpenNewSurvey = () => {
    setEditingSurvey(null);
    setActiveTab('builder');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleEditSurvey = (survey: Survey) => {
    setEditingSurvey(survey);
    setActiveTab('builder');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSaveSurvey = async (
    surveyData: Omit<Survey, 'id' | 'data_criacao'>,
    questionsData: Array<{ question: Omit<Question, 'id' | 'survey_id'>; options: Omit<Option, 'id' | 'question_id'>[] }>
  ) => {
    setIsSavingSurvey(true);
    try {
      if (editingSurvey) {
        const updatedSurvey: Survey = {
          ...editingSurvey,
          ...surveyData
        };
        // Atualizar localmente e enviar status/dados
        await ApiService.updateSurveyStatus(updatedSurvey.id, updatedSurvey.status);
        showToast(`Pesquisa "${updatedSurvey.titulo}" atualizada no Google Sheets!`);
      } else {
        const surveyDataComDono = { ...surveyData, criado_por: currentUser?.id || surveyData.criado_por };
        const newSurvey = await ApiService.createSurvey(surveyDataComDono, questionsData);
        // Atualizar imediatamente o estado de surveys para que apareça sem atraso
        setSurveys(ApiService.getSurveys());
        showToast(`Pesquisa "${newSurvey.titulo}" criada com sucesso no Google Sheets!`);
      }

      // Sincronizar em background
      await refreshDataFromSheets();
      setEditingSurvey(null);
      setActiveTab('surveys');
    } catch (err: any) {
      console.error('Erro ao salvar pesquisa:', err);
      showToast(`Erro ao gravar no Google Sheets: ${err.message || err}`);
    } finally {
      setIsSavingSurvey(false);
    }
  };

  const handleDuplicateSurvey = async (surveyId: string) => {
    try {
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
      showToast(`Status da pesquisa alterado para "${newStatus}" no Google Sheets.`);
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
    refreshDataFromSheets();
  };

  const handleLogout = async () => {
    await AuthService.logout();
    setCurrentUser(null);
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
    const result = await ApiService.submitResponse(surveyId, respondentName, answersMap, identificador);
    // Atualizar dados em segundo plano
    refreshDataFromSheets().catch(console.warn);
    return result;
  };

  // Exportação CSV com dados reais
  const handleExportCSV = (surveyId: string) => {
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
      />
    );
  }

  // ÁREA ADMINISTRATIVA: exige login (fora da rota pública de resposta acima)
  if (!currentUser) {
    return <LoginView onLoginSuccess={handleLoginSuccess} />;
  }

  // Usuários que já são "user" comum não devem ficar presos na tela de Usuários (só ADM)
  const effectiveTab = (activeTab === 'users' && currentUser.role !== 'admin') ? 'dashboard' : activeTab;

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
          setActiveTab(tab);
        }}
        activeSurvey={activeSurvey}
        totalSurveysCount={surveys.length}
        totalResponsesCount={respondents.length}
        isMobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
        currentUser={currentUser}
        onLogout={handleLogout}
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
        />

        {/* View Switcher */}
        <main className="flex-1 pb-16">
          {effectiveTab === 'dashboard' && (
            <GeneralDashboard
              surveys={surveys}
              totalResponsesCount={respondents.length}
              respondents={respondents}
              onAnalyzeSurvey={handleAnalyzeSurvey}
              onOpenNewSurvey={handleOpenNewSurvey}
              onOpenPublicView={handleOpenPublicView}
              onShareSurvey={(s) => setShareModalSurvey(s)}
              onViewAllSurveys={() => setActiveTab('surveys')}
              onOpenSettings={() => setActiveTab('settings')}
              onRefreshData={refreshDataFromSheets}
            />
          )}

          {effectiveTab === 'surveys' && (
            <SurveyList
              surveys={surveys}
              questions={questions}
              respondents={respondents}
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
            <SurveyBuilder
              initialSurvey={editingSurvey}
              initialQuestions={editingSurvey ? questions.filter((q) => q.survey_id === editingSurvey.id) : undefined}
              initialOptions={editingSurvey ? options : undefined}
              isSaving={isSavingSurvey}
              onSaveSurvey={handleSaveSurvey}
              onCancel={() => setActiveTab(surveys.length > 0 ? 'surveys' : 'dashboard')}
            />
          )}

          {effectiveTab === 'analytics' && (
            activeSurvey ? (
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
              />
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

          {effectiveTab === 'settings' && (
            <SettingsView
              config={gasConfig}
              onSaveConfig={(cfg) => {
                const updated = ApiService.saveGasConfig(cfg);
                setGasConfig(updated);
                showToast('Configurações salvas!');
              }}
              onRefreshDataFromSheets={refreshDataFromSheets}
            />
          )}
        </main>
      </div>

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
