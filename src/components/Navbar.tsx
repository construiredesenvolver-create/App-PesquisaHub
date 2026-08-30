import React from 'react';
import { Menu, Plus, RefreshCw, CheckCircle2, AlertCircle, CloudOff } from 'lucide-react';
import { GoogleAppsScriptConfig } from '../types';

interface NavbarProps {
  onToggleMobile: () => void;
  onOpenNewSurvey: () => void;
  onRefreshData?: () => void;
  isRefreshing?: boolean;
  activeSurveyTitle?: string;
  gasConfig?: GoogleAppsScriptConfig;
  onOpenSettings?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  onToggleMobile,
  onOpenNewSurvey,
  onRefreshData,
  isRefreshing,
  activeSurveyTitle,
  gasConfig,
  onOpenSettings
}) => {
  return (
    <header className="h-16 bg-white border-b border-slate-200/80 px-4 md:px-6 flex items-center justify-between sticky top-0 z-30">
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleMobile}
          className="md:hidden p-2 rounded-xl text-slate-600 hover:bg-slate-100"
          aria-label="Abrir menu lateral"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 text-xs">
          <span className="font-bold text-slate-800">PesquisaHub</span>
          {activeSurveyTitle && (
            <>
              <span className="text-slate-300 hidden sm:inline">/</span>
              <span className="font-semibold text-blue-600 truncate max-w-[200px] md:max-w-md">
                {activeSurveyTitle}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Action Buttons & Status */}
      <div className="flex items-center gap-2.5">
        {/* Indicador de Conexão com Google Sheets */}
        {gasConfig && (
          <button
            onClick={onOpenSettings}
            title={gasConfig.isConnected ? 'Google Sheets Conectado (Clique para gerenciar)' : 'Google Sheets Não Conectado (Clique para configurar)'}
            className={`px-2.5 py-1.5 rounded-xl border text-xs font-medium flex items-center gap-1.5 transition-colors ${
              gasConfig.isConnected
                ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
                : 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100'
            }`}
          >
            {gasConfig.isConnected ? (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="hidden sm:inline">Sheets Ativo</span>
              </>
            ) : (
              <>
                <CloudOff className="w-3.5 h-3.5 text-amber-600" />
                <span className="hidden sm:inline">Conectar Sheets</span>
              </>
            )}
          </button>
        )}

        {/* Botão de Atualizar / Sincronizar Dados Reais */}
        {onRefreshData && (
          <button
            onClick={onRefreshData}
            disabled={isRefreshing}
            title="Recarregar dados reais da planilha Google Sheets"
            className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium text-xs flex items-center gap-1.5 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-blue-600' : 'text-slate-500'}`} />
            <span className="hidden sm:inline">Atualizar</span>
          </button>
        )}

        {/* Botão Criar Pesquisa */}
        <button
          onClick={onOpenNewSurvey}
          className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs flex items-center gap-1.5 transition-colors shadow-sm"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Criar Pesquisa</span>
        </button>
      </div>
    </header>
  );
};
