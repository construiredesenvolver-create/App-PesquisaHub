import React, { useState, useEffect } from 'react';
import { 
  Database, 
  Code, 
  Copy, 
  Check, 
  Send, 
  CheckCircle2, 
  AlertTriangle, 
  RefreshCw, 
  ExternalLink, 
  Layers, 
  Activity,
  Cpu,
  Wifi,
  WifiOff,
  Clock,
  ShieldCheck,
  Search,
  Terminal
} from 'lucide-react';
import { GOOGLE_APPS_SCRIPT_CODE } from '../services/appsScriptCode';
import { ApiService, APP_CONFIG } from '../services/api';
import { GoogleAppsScriptConfig } from '../types';

interface SettingsViewProps {
  config: GoogleAppsScriptConfig;
  onSaveConfig: (config: Partial<GoogleAppsScriptConfig>) => void;
  onRefreshDataFromSheets: () => Promise<void>;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  config,
  onSaveConfig,
  onRefreshDataFromSheets
}) => {
  const [webAppUrl, setWebAppUrl] = useState(config.webAppUrl || '');
  const [publicAppUrl, setPublicAppUrl] = useState(config.publicAppUrl || '');
  const [copiedCode, setCopiedCode] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ 
    success: boolean; 
    message: string; 
    latencyMs?: number;
    timestamp?: string;
    version?: string;
  } | null>(null);

  const [testingFetch, setTestingFetch] = useState(false);
  const [fetchResult, setFetchResult] = useState<{
    success: boolean;
    httpStatus: number;
    surveysCount: number;
    rawResponse: any;
    message: string;
    latencyMs: number;
  } | null>(null);

  const [refreshing, setRefreshing] = useState(false);
  const [refreshResult, setRefreshResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(GOOGLE_APPS_SCRIPT_CODE);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
  };

  const handleSaveAndTest = async () => {
    const trimmedApi = webAppUrl.trim();
    const trimmedPublic = publicAppUrl.trim();
    onSaveConfig({ 
      webAppUrl: trimmedApi,
      publicAppUrl: trimmedPublic || undefined
    });
    
    if (!trimmedApi) {
      setTestResult({ success: false, message: 'Informe a URL do Google Apps Script para testar.' });
      return;
    }

    setTesting(true);
    setTestResult(null);
    try {
      const res = await ApiService.testGasConnection(trimmedApi);
      setTestResult(res);
      if (res.success) {
        onSaveConfig({ isConnected: true, lastSync: new Date().toISOString() });
        // Recarregar dados após conectar com sucesso
        await onRefreshDataFromSheets();
      }
    } catch (e: any) {
      setTestResult({ success: false, message: e.message || 'Erro ao conectar com o Google Apps Script.' });
    } finally {
      setTesting(false);
    }
  };

  const handleTestFetchSurveysDirectly = async () => {
    const trimmed = webAppUrl.trim();
    if (!trimmed) {
      setFetchResult({
        success: false,
        httpStatus: 0,
        surveysCount: 0,
        rawResponse: null,
        message: 'Por favor, insira a URL do Google Apps Script antes de testar a busca.',
        latencyMs: 0
      });
      return;
    }

    setTestingFetch(true);
    setFetchResult(null);
    try {
      const res = await ApiService.testFetchSurveysDirectly(trimmed);
      setFetchResult(res);
      if (res.success) {
        await onRefreshDataFromSheets();
      }
    } catch (e: any) {
      setFetchResult({
        success: false,
        httpStatus: 0,
        surveysCount: 0,
        rawResponse: null,
        message: e.message || 'Erro ao testar endpoint de pesquisas.',
        latencyMs: 0
      });
    } finally {
      setTestingFetch(false);
    }
  };

  const handleManualRefresh = async () => {
    setRefreshing(true);
    setRefreshResult(null);
    try {
      await onRefreshDataFromSheets();
      setRefreshResult({ success: true, message: 'Dados lidos e atualizados diretamente do Google Sheets com sucesso!' });
    } catch (e: any) {
      setRefreshResult({ success: false, message: e.message || 'Falha ao buscar dados da planilha.' });
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-8 animate-in fade-in duration-200">
      
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight font-display">
          Conexão Google Sheets & Diagnóstico do Backend
        </h1>
        <p className="text-xs md:text-sm text-slate-500 mt-1">
          O PesquisaHub armazena todas as pesquisas, perguntas, opções e respostas diretamente na sua planilha Google Sheets através do Google Apps Script.
        </p>
      </div>

      {/* Painel de Diagnóstico em Tempo Real */}
      <div className="bg-white rounded-3xl p-6 md:p-7 border border-slate-200/90 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div className="flex items-center gap-3">
            <div className={`w-11 h-11 rounded-2xl flex items-center justify-center border ${
              config.isConnected 
                ? 'bg-emerald-50 border-emerald-200 text-emerald-600' 
                : 'bg-amber-50 border-amber-200 text-amber-600'
            }`}>
              {config.isConnected ? <Wifi className="w-5 h-5" /> : <WifiOff className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-900 text-base">Status do Google Apps Script API</h3>
                <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                  config.isConnected
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-amber-50 text-amber-700 border-amber-200'
                }`}>
                  {config.isConnected ? 'ONLINE & ATIVO' : 'DESCONECTADO'}
                </span>
              </div>
              <p className="text-xs text-slate-500">API Web App serverless conectada à sua conta Google</p>
            </div>
          </div>

          {config.lastSync && (
            <div className="text-left sm:text-right text-xs text-slate-400">
              <span className="block font-medium text-slate-600">Última leitura / sincronização</span>
              <span>{new Date(config.lastSync).toLocaleString('pt-BR')}</span>
            </div>
          )}
        </div>

        {/* Input URL do Web App (Backend API) */}
        <div className="space-y-2">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
            1. URL da API / Backend (Google Apps Script)
          </label>
          <div className="flex flex-col sm:flex-row items-stretch gap-2">
            <input
              type="url"
              value={webAppUrl}
              onChange={(e) => setWebAppUrl(e.target.value)}
              placeholder="https://script.google.com/macros/s/AKfycbx.../exec"
              className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs md:text-sm text-slate-800 font-mono focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
            <button
              onClick={handleSaveAndTest}
              disabled={testing}
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all disabled:opacity-50"
            >
              {testing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              <span>Testar Ping & Salvar</span>
            </button>
            <button
              onClick={handleTestFetchSurveysDirectly}
              disabled={testingFetch}
              title="Testa a consulta action=getAllData isoladamente"
              className="px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
            >
              {testingFetch ? <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600" /> : <Search className="w-3.5 h-3.5 text-slate-500" />}
              <span>Testar Busca</span>
            </button>
          </div>
          <p className="text-[11px] text-slate-400">
            Executa ações REST (GET/POST) com o Google Sheets. Deve ter permissão de acesso configurada para <strong>"Qualquer pessoa" (Anyone)</strong>.
          </p>
        </div>

        {/* Input URL Pública do Frontend (Aplicação Web do Respondente) */}
        <div className="space-y-2 pt-2 border-t border-slate-100">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
              2. URL Pública da Aplicação (Frontend Web)
            </label>
            <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              Intermediado pelo PesquisaHub
            </span>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch gap-2">
            <input
              type="url"
              value={publicAppUrl}
              onChange={(e) => setPublicAppUrl(e.target.value)}
              placeholder={`Padrão automático: ${APP_CONFIG.PUBLIC_APP_URL || 'https://...'}`}
              className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs md:text-sm text-slate-800 font-mono focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
            <button
              onClick={() => {
                const trimmedPublic = publicAppUrl.trim();
                onSaveConfig({ publicAppUrl: trimmedPublic || undefined });
                setRefreshResult({ success: true, message: 'URL Pública da Aplicação atualizada com sucesso!' });
              }}
              className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center justify-center gap-1.5 transition-all"
            >
              <Check className="w-3.5 h-3.5 text-emerald-600" />
              <span>Salvar Domínio</span>
            </button>
          </div>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            Endereço base utilizado para gerar os links de resposta pública (ex: <code>{APP_CONFIG.PUBLIC_APP_URL}</code> ou seu domínio personalizado). Os respondentes acessam este endereço livremente, sem erro 403 e sem login.
          </p>
        </div>

        {/* Resultado do Teste de Conexão (Ping) */}
        {testResult && (
          <div className={`p-4 rounded-2xl text-xs flex items-start gap-3 border ${
            testResult.success
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}>
            {testResult.success ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            )}
            <div className="space-y-1 flex-1">
              <div className="flex items-center justify-between">
                <p className="font-bold text-sm">
                  {testResult.success ? 'Conexão Estabelecida com Sucesso!' : 'Falha na Conexão'}
                </p>
                {testResult.latencyMs !== undefined && (
                  <span className="font-mono font-semibold px-2 py-0.5 rounded-md bg-white/70 border text-[11px]">
                    Latência: {testResult.latencyMs}ms {testResult.version ? `• v${testResult.version}` : ''}
                  </span>
                )}
              </div>
              <p className="text-slate-700 leading-relaxed">{testResult.message}</p>
            </div>
          </div>
        )}

        {/* Resultado do Teste de Busca Isolada de Pesquisas */}
        {fetchResult && (
          <div className={`p-4 rounded-2xl text-xs space-y-2 border ${
            fetchResult.success
              ? 'bg-blue-50/70 border-blue-200 text-blue-950'
              : 'bg-rose-50 border-rose-200 text-rose-950'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-blue-600" />
                <span className="font-bold text-sm">Resultado do Teste de Busca (action=getAllData)</span>
              </div>
              <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-white border">
                HTTP {fetchResult.httpStatus} • {fetchResult.latencyMs}ms
              </span>
            </div>
            <p className="font-medium text-slate-700">{fetchResult.message}</p>
            
            {fetchResult.rawResponse && (
              <details className="mt-2 pt-2 border-t border-blue-200/60">
                <summary className="cursor-pointer font-mono text-[11px] text-blue-700 hover:underline">
                  Ver payload JSON retornado pelo Google Apps Script ({fetchResult.surveysCount} pesquisas encontradas)
                </summary>
                <pre className="mt-2 p-3 bg-slate-900 text-slate-200 rounded-xl font-mono text-[10px] max-h-48 overflow-y-auto">
                  {JSON.stringify(fetchResult.rawResponse, null, 2)}
                </pre>
              </details>
            )}
          </div>
        )}

        {/* Botão de Atualização Manual de Dados */}
        {config.webAppUrl && (
          <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-t border-slate-100">
            <span className="text-xs text-slate-500 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Sincronização bidirecional ativa com a planilha</span>
            </span>
            <button
              onClick={handleManualRefresh}
              disabled={refreshing}
              className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-xs flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-blue-600' : 'text-slate-500'}`} />
              <span>Recarregar Todos os Dados da Planilha</span>
            </button>
          </div>
        )}

        {refreshResult && (
          <div className="text-xs p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-700">
            {refreshResult.message}
          </div>
        )}
      </div>

      {/* Guia de Implantação do Google Apps Script */}
      <div className="bg-white rounded-3xl p-6 md:p-8 border border-slate-200/90 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2.5">
            <Code className="w-5 h-5 text-indigo-600" />
            <h2 className="font-bold text-slate-900 text-base md:text-lg">
              Código Oficial do Google Apps Script (Code.gs v1.2.0)
            </h2>
          </div>
          <button
            onClick={handleCopyCode}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition-all ${
              copiedCode
                ? 'bg-emerald-600 text-white'
                : 'bg-indigo-600 hover:bg-indigo-700 text-white active:scale-95'
            }`}
          >
            {copiedCode ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedCode ? 'Código Copiado!' : 'Copiar Código Code.gs'}</span>
          </button>
        </div>

        {/* Passo a Passo */}
        <div className="space-y-3.5 text-xs md:text-sm text-slate-700">
          <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
            <span className="w-6 h-6 rounded-full bg-indigo-600 text-white font-bold text-xs flex items-center justify-center shrink-0">1</span>
            <div className="space-y-0.5">
              <strong className="text-slate-900">Crie uma nova Planilha no Google Sheets</strong>
              <p className="text-xs text-slate-500">
                Acesse <a href="https://sheets.new" target="_blank" rel="noreferrer" className="text-blue-600 font-semibold underline">sheets.new</a> no seu navegador e dê o nome de <code>"PesquisaHub — Banco de Dados"</code>.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
            <span className="w-6 h-6 rounded-full bg-indigo-600 text-white font-bold text-xs flex items-center justify-center shrink-0">2</span>
            <div className="space-y-0.5">
              <strong className="text-slate-900">Abra o editor do Apps Script</strong>
              <p className="text-xs text-slate-500">
                No menu superior da planilha, clique em <strong>Extensões</strong> &gt; <strong>Apps Script</strong>.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
            <span className="w-6 h-6 rounded-full bg-indigo-600 text-white font-bold text-xs flex items-center justify-center shrink-0">3</span>
            <div className="space-y-0.5">
              <strong className="text-slate-900">Cole o código atualizado do PesquisaHub</strong>
              <p className="text-xs text-slate-500">
                Clique no botão <strong>"Copiar Código Code.gs"</strong> acima, apague o conteúdo do arquivo <code>Code.gs</code> e cole o código completo. Pressione <code>Ctrl + S</code> para salvar.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
            <span className="w-6 h-6 rounded-full bg-indigo-600 text-white font-bold text-xs flex items-center justify-center shrink-0">4</span>
            <div className="space-y-1">
              <strong className="text-slate-900">Publique como App da Web</strong>
              <p className="text-xs text-slate-500">
                Clique em <strong>Implantar (Deploy)</strong> &gt; <strong>Nova implantação</strong> &gt; Selecione <strong>App da Web</strong>.
              </p>
              <div className="text-xs bg-amber-50 text-amber-900 p-3 rounded-xl border border-amber-200 space-y-1">
                <p className="font-bold">⚠️ Configurações OBRIGATÓRIAS para Funcionamento Completo:</p>
                <p>• <strong>Executar como:</strong> "Eu" (seu e-mail).</p>
                <p>• <strong>Quem tem acesso:</strong> <strong>"Qualquer pessoa" (Anyone)</strong>. Isso permite que qualquer respondente envie respostas pelo link público sem precisar de login.</p>
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
            <span className="w-6 h-6 rounded-full bg-indigo-600 text-white font-bold text-xs flex items-center justify-center shrink-0">5</span>
            <div className="space-y-0.5">
              <strong className="text-slate-900">Cole a URL no PesquisaHub</strong>
              <p className="text-xs text-slate-500">
                Copie a <strong>URL do app da Web</strong> fornecida pelo Google (terminada em <code>/exec</code>) e clique em <strong>"Testar Ping & Salvar"</strong> no topo desta página.
              </p>
            </div>
          </div>
        </div>

        {/* Visualizador de Código */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-slate-600">
            <span>Prévia do Código Code.gs</span>
            <button
              onClick={handleCopyCode}
              className="text-indigo-600 hover:text-indigo-700 flex items-center gap-1 font-semibold"
            >
              <Copy className="w-3 h-3" />
              Copiar
            </button>
          </div>
          <pre className="bg-slate-900 text-slate-200 p-4 rounded-2xl text-[11px] font-mono overflow-x-auto max-h-60 border border-slate-800">
            {GOOGLE_APPS_SCRIPT_CODE}
          </pre>
        </div>
      </div>

      {/* Estrutura das Abas Relacionais */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-xs space-y-4">
        <div className="flex items-center gap-2">
          <Layers className="w-5 h-5 text-slate-600" />
          <h3 className="font-bold text-slate-900 text-base">
            Abas Criadas Automaticamente na sua Planilha
          </h3>
        </div>
        <p className="text-xs text-slate-500">
          O Google Apps Script organiza as tabelas de forma relacional, permitindo exportar, consultar e cruzar dados com facilidade:
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
            <strong className="text-blue-700 block mb-1">📄 Surveys</strong>
            <p className="text-slate-500 font-mono text-[11px]">id, titulo, descricao, status, data_criacao, link_publico, configuracoes</p>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
            <strong className="text-indigo-700 block mb-1">❓ Questions</strong>
            <p className="text-slate-500 font-mono text-[11px]">id, survey_id, ordem, titulo, descricao, tipo, obrigatoria, ativa</p>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
            <strong className="text-teal-700 block mb-1">🔘 Options</strong>
            <p className="text-slate-500 font-mono text-[11px]">id, question_id, ordem, texto, valor, peso</p>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
            <strong className="text-amber-700 block mb-1">👥 Respondents</strong>
            <p className="text-slate-500 font-mono text-[11px]">id, survey_id, nome, identificador, data_resposta, hora_resposta</p>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
            <strong className="text-emerald-700 block mb-1">✍️ Answers</strong>
            <p className="text-slate-500 font-mono text-[11px]">id, survey_id, respondent_id, question_id, option_id, valor, data_resposta</p>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
            <strong className="text-slate-700 block mb-1">📜 Logs</strong>
            <p className="text-slate-500 font-mono text-[11px]">id, timestamp, acao, detalhes, status</p>
          </div>
        </div>
      </div>

    </div>
  );
};
