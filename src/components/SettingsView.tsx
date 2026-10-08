import React, { useState, useEffect } from 'react';
import {
  Database,
  Check,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Activity,
  Cpu,
  ShieldCheck
} from 'lucide-react';
import { ApiService, APP_CONFIG } from '../services/api';
import { SUPABASE_URL } from '../services/config';
import { compressImageToBase64 } from '../services/imageUtils';
import { GoogleAppsScriptConfig, AppSettings } from '../types';

interface SettingsViewProps {
  config: GoogleAppsScriptConfig;
  onSaveConfig: (config: Partial<GoogleAppsScriptConfig>) => void;
  onRefreshDataFromSheets: () => Promise<void>;
  appSettings?: AppSettings;
  isAdmin?: boolean;
  onSaveAppSettings?: (logoUrl: string, nomeExibicao: string) => Promise<void>;
}

/**
 * Configurações do PesquisaHub (backend Supabase).
 * - Identidade visual (logo e nome) — apenas ADM
 * - Status/diagnóstico da conexão com o banco
 * - URL pública usada nos links de resposta
 */
export const SettingsView: React.FC<SettingsViewProps> = ({
  config,
  onSaveConfig,
  onRefreshDataFromSheets,
  appSettings,
  isAdmin,
  onSaveAppSettings
}) => {
  const [publicAppUrl, setPublicAppUrl] = useState(config.publicAppUrl || '');
  const [publicUrlSaved, setPublicUrlSaved] = useState(false);

  // Identidade Visual (Logo)
  const [nomeExibicao, setNomeExibicao] = useState(appSettings?.nomeExibicao || '');
  const [logoPreview, setLogoPreview] = useState(appSettings?.logoUrl || '');
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [savingBrand, setSavingBrand] = useState(false);
  const [brandError, setBrandError] = useState<string | null>(null);
  const [brandSaved, setBrandSaved] = useState(false);

  useEffect(() => {
    if (appSettings) {
      setNomeExibicao(appSettings.nomeExibicao || '');
      setLogoPreview(appSettings.logoUrl || '');
    }
  }, [appSettings]);

  const handleLogoFileChange = async (file: File) => {
    setBrandError(null);
    setUploadingLogo(true);
    try {
      const { base64, mimeType } = await compressImageToBase64(file, 400, 0.85);
      const url = await ApiService.uploadPhotoAnswer('app-logo', base64, mimeType);
      setLogoPreview(url);
    } catch (err: any) {
      setBrandError(err.message || 'Não foi possível enviar a logo.');
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleSaveBrand = async () => {
    if (!onSaveAppSettings) return;
    setBrandError(null);
    setSavingBrand(true);
    try {
      await onSaveAppSettings(logoPreview, nomeExibicao);
      setBrandSaved(true);
      setTimeout(() => setBrandSaved(false), 2500);
    } catch (err: any) {
      setBrandError(err.message || 'Não foi possível salvar a identidade visual.');
    } finally {
      setSavingBrand(false);
    }
  };

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; latencyMs?: number } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshResult, setRefreshResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await ApiService.testGasConnection();
      setTestResult(res);
    } catch (e: any) {
      setTestResult({ success: false, message: e.message || 'Erro ao conectar com o banco de dados.' });
    } finally {
      setTesting(false);
    }
  };

  // Testa a conexão automaticamente ao abrir a tela
  useEffect(() => {
    handleTestConnection();
  }, []);

  const handleSavePublicUrl = () => {
    onSaveConfig({ publicAppUrl: publicAppUrl.trim() || undefined });
    setPublicUrlSaved(true);
    setTimeout(() => setPublicUrlSaved(false), 2500);
  };

  const handleManualRefresh = async () => {
    setRefreshing(true);
    setRefreshResult(null);
    try {
      await onRefreshDataFromSheets();
      setRefreshResult({ success: true, message: 'Dados recarregados do banco com sucesso!' });
    } catch (e: any) {
      setRefreshResult({ success: false, message: e.message || 'Falha ao recarregar os dados.' });
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-8 animate-in fade-in duration-200">

      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight font-display">
          Configurações
        </h1>
        <p className="text-xs md:text-sm text-slate-500 mt-1">
          O PesquisaHub guarda pesquisas, perguntas, opções e respostas no banco de dados Supabase, com regras de acesso por usuário.
        </p>
      </div>

      {/* Identidade Visual (Logo) — apenas ADM pode alterar */}
      {isAdmin && (
        <div className="bg-white rounded-3xl p-6 md:p-7 border border-slate-200/90 shadow-xs space-y-5">
          <div>
            <h2 className="text-base font-bold text-slate-900">Identidade Visual</h2>
            <p className="text-xs text-slate-500 mt-1">
              Envie a logo da sua empresa. Ela aparece como um ícone circular no menu, na tela de login e no
              formulário público — em um espaço de tamanho fixo, para nunca desalinhar o layout.
            </p>
          </div>

          {brandError && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-xs font-medium rounded-xl px-4 py-3">
              {brandError}
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
            <div className="shrink-0">
              {logoPreview ? (
                <img
                  src={logoPreview}
                  alt="Prévia da logo"
                  className="w-20 h-20 rounded-2xl object-cover border border-slate-200 shadow-xs"
                />
              ) : (
                <div className="w-20 h-20 rounded-2xl bg-slate-100 border border-dashed border-slate-300 flex items-center justify-center text-slate-400 text-[10px] font-semibold text-center px-2">
                  Sem logo
                </div>
              )}
            </div>

            <div className="flex-1 space-y-3 w-full">
              <label className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs cursor-pointer transition-colors">
                {uploadingLogo ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Cpu className="w-3.5 h-3.5" />
                )}
                <span>{uploadingLogo ? 'Enviando...' : logoPreview ? 'Trocar logo' : 'Enviar logo'}</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={uploadingLogo}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleLogoFileChange(file);
                  }}
                />
              </label>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Nome de exibição (opcional)</label>
                <input
                  type="text"
                  value={nomeExibicao}
                  onChange={(e) => setNomeExibicao(e.target.value)}
                  placeholder="Ex: Nome da sua empresa"
                  className="w-full max-w-sm px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              <button
                onClick={handleSaveBrand}
                disabled={savingBrand || uploadingLogo}
                className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-2 disabled:opacity-60"
              >
                {savingBrand ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : brandSaved ? <Check className="w-3.5 h-3.5" /> : null}
                <span>{brandSaved ? 'Salvo!' : 'Salvar Identidade Visual'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Status da Conexão com o Banco */}
      <div className="bg-white rounded-3xl p-6 md:p-7 border border-slate-200/90 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center">
              <Database className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Banco de Dados Supabase</h3>
              <p className="text-[11px] text-slate-500 font-mono break-all">{SUPABASE_URL}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleTestConnection}
              disabled={testing}
              className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-1.5 disabled:opacity-60"
            >
              {testing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Activity className="w-3.5 h-3.5 text-blue-600" />}
              <span>Testar conexão</span>
            </button>
            <button
              onClick={handleManualRefresh}
              disabled={refreshing}
              className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1.5 disabled:opacity-60"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              <span>Recarregar dados</span>
            </button>
          </div>
        </div>

        {testResult && (
          <div className={`p-4 rounded-2xl text-xs flex items-start gap-3 border ${
            testResult.success
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}>
            {testResult.success ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            )}
            <div>
              <p className="font-bold">{testResult.message}</p>
              {typeof testResult.latencyMs === 'number' && (
                <p className="mt-0.5 opacity-80">Tempo de resposta: {testResult.latencyMs} ms</p>
              )}
            </div>
          </div>
        )}

        {refreshResult && (
          <div className={`p-3 rounded-xl text-xs font-semibold border ${
            refreshResult.success
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}>
            {refreshResult.message}
          </div>
        )}

        <div className="flex items-start gap-2 text-[11px] text-slate-500 leading-relaxed">
          <ShieldCheck className="w-4 h-4 text-slate-400 shrink-0" />
          <span>
            Cada usuário enxerga apenas as próprias pesquisas (o administrador vê todas). Quem responde não precisa de
            login e só consegue enviar respostas para pesquisas publicadas.
          </span>
        </div>
      </div>

      {/* URL pública usada nos links de resposta */}
      <div className="bg-white rounded-3xl p-6 md:p-7 border border-slate-200/90 shadow-xs space-y-3">
        <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
          URL pública do app (links de resposta)
        </label>
        <div className="flex flex-col sm:flex-row items-stretch gap-2">
          <input
            type="url"
            value={publicAppUrl}
            onChange={(e) => setPublicAppUrl(e.target.value)}
            placeholder={`Padrão automático: ${APP_CONFIG.PUBLIC_APP_URL || 'https://...'}`}
            className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs md:text-sm text-slate-800 font-mono focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          />
          <button
            onClick={handleSavePublicUrl}
            className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center justify-center gap-1.5"
          >
            <Check className="w-3.5 h-3.5 text-emerald-600" />
            <span>{publicUrlSaved ? 'Salvo!' : 'Salvar'}</span>
          </button>
        </div>
        <p className="text-[11px] text-slate-500 leading-relaxed">
          Deixe em branco para usar o endereço atual (<code>{APP_CONFIG.PUBLIC_APP_URL}</code>). Preencha apenas se
          for usar um domínio próprio.
        </p>
      </div>

    </div>
  );
};
