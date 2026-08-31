import React from 'react';
import { 
  BarChart3, 
  Layers, 
  PlusCircle, 
  Settings, 
  FileText, 
  ChevronRight,
  TrendingUp,
  Users,
  LogOut,
  ShieldCheck,
  User as UserIcon,
  Camera
} from 'lucide-react';
import { Survey, AppUser } from '../types';

export type NavTab = 'dashboard' | 'surveys' | 'builder' | 'analytics' | 'settings' | 'users' | 'photos';

interface SidebarProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  activeSurvey?: Survey | null;
  totalSurveysCount: number;
  totalResponsesCount: number;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
  currentUser?: AppUser | null;
  onLogout?: () => void;
  logoUrl?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onTabChange,
  activeSurvey,
  totalSurveysCount,
  totalResponsesCount,
  isMobileOpen,
  onCloseMobile,
  currentUser,
  onLogout,
  logoUrl
}) => {
  const isAdmin = currentUser?.role === 'admin';

  return (
    <>
      {/* Overlay Mobile */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-xs md:hidden"
          onClick={onCloseMobile}
        />
      )}

      <aside className={`
        fixed md:static inset-y-0 left-0 z-50
        w-64 bg-slate-900 text-slate-100 flex flex-col justify-between
        transform transition-transform duration-200 ease-in-out
        ${isMobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        border-r border-slate-800
      `}>
        {/* Brand Header */}
        <div>
          <div className="p-5 flex items-center gap-3 border-b border-slate-800/80">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt="Logo"
                className="w-10 h-10 rounded-xl object-cover shadow-lg shadow-blue-500/20 border border-slate-700 shrink-0"
              />
            ) : (
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/20 shrink-0">
                <BarChart3 className="w-5 h-5 text-white" />
              </div>
            )}
            <div>
              <span className="font-extrabold text-base tracking-tight text-white font-display">PesquisaHub</span>
              <p className="text-xs text-slate-400">Inteligência de Respostas</p>
            </div>
          </div>

          {/* Quick Create Action */}
          <div className="p-3">
            <button
              onClick={() => {
                onTabChange('builder');
                onCloseMobile();
              }}
              className="w-full py-2.5 px-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-semibold text-xs flex items-center justify-center gap-2 transition-all shadow-md shadow-blue-600/20 group"
            >
              <PlusCircle className="w-4 h-4 transition-transform group-hover:rotate-90" />
              <span>Nova Pesquisa</span>
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="px-3 py-2 space-y-1">
            <button
              onClick={() => {
                onTabChange('dashboard');
                onCloseMobile();
              }}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-colors ${
                activeTab === 'dashboard'
                  ? 'bg-slate-800 text-white font-semibold border-l-2 border-blue-500'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Layers className="w-4 h-4 text-blue-400" />
                <span>Dashboard Geral</span>
              </div>
            </button>

            <button
              onClick={() => {
                onTabChange('surveys');
                onCloseMobile();
              }}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-colors ${
                activeTab === 'surveys'
                  ? 'bg-slate-800 text-white font-semibold border-l-2 border-blue-500'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <FileText className="w-4 h-4 text-indigo-400" />
                <span>Todas as Pesquisas</span>
              </div>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                {totalSurveysCount}
              </span>
            </button>

            <button
              onClick={() => {
                onTabChange('photos');
                onCloseMobile();
              }}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-colors ${
                activeTab === 'photos'
                  ? 'bg-slate-800 text-white font-semibold border-l-2 border-blue-500'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Camera className="w-4 h-4 text-emerald-400" />
                <span>Análise de Fotos</span>
              </div>
            </button>

            {/* Active Survey Direct Sub-item if an analytics session is active */}
            {activeSurvey && (
              <div className="pt-2">
                <div className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                  <TrendingUp className="w-3 h-3 text-blue-400" />
                  <span>Em Análise</span>
                </div>
                <button
                  onClick={() => {
                    onTabChange('analytics');
                    onCloseMobile();
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                    activeTab === 'analytics'
                      ? 'bg-blue-600/20 text-blue-300 border border-blue-500/40 font-semibold'
                      : 'text-slate-300 hover:bg-slate-800/60'
                  }`}
                >
                  <span className="truncate text-left max-w-[170px]">{activeSurvey.titulo}</span>
                  <ChevronRight className="w-3.5 h-3.5 shrink-0 text-blue-400" />
                </button>
              </div>
            )}

            {isAdmin && (
              <button
                onClick={() => {
                  onTabChange('users');
                  onCloseMobile();
                }}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-colors ${
                  activeTab === 'users'
                    ? 'bg-slate-800 text-white font-semibold border-l-2 border-blue-500'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Users className="w-4 h-4 text-purple-400" />
                  <span>Usuários</span>
                </div>
              </button>
            )}

            <div className="pt-4 border-t border-slate-800/60 mt-4">
              <button
                onClick={() => {
                  onTabChange('settings');
                  onCloseMobile();
                }}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-colors ${
                  activeTab === 'settings'
                    ? 'bg-slate-800 text-white font-semibold border-l-2 border-blue-500'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Settings className="w-4 h-4 text-slate-400" />
                  <span>Google Sheets & API</span>
                </div>
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              </button>
            </div>
          </nav>
        </div>

        {/* Footer info box */}
        <div className="p-3 m-3 space-y-3">
          <div className="rounded-xl bg-slate-800/60 border border-slate-700/50 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-300">Banco de Dados</span>
              <span className="text-[10px] text-emerald-400 font-medium">Sheets V1</span>
            </div>
            <div className="text-[11px] text-slate-400">
              <strong>{totalResponsesCount}</strong> respostas processadas pelo Motor Analítico.
            </div>
          </div>

          {currentUser && (
            <div className="rounded-xl bg-slate-800/60 border border-slate-700/50 p-3 flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-slate-700 flex items-center justify-center shrink-0">
                {currentUser.role === 'admin' ? (
                  <ShieldCheck className="w-4 h-4 text-purple-300" />
                ) : (
                  <UserIcon className="w-4 h-4 text-slate-300" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-bold text-slate-200 truncate">{currentUser.nome}</div>
                <div className="text-[10px] text-slate-400 truncate">{currentUser.email}</div>
              </div>
              {onLogout && (
                <button
                  onClick={onLogout}
                  title="Sair"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-700/60"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              )}
            </div>
          )}
        </div>
      </aside>
    </>
  );
};
