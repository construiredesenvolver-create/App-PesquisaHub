import React, { useState } from 'react';
import { BarChart3, Loader2, Eye, EyeOff, KeyRound, Mail, ArrowLeft } from 'lucide-react';
import { AuthService } from '../services/authService';
import { AppUser } from '../types';

interface LoginViewProps {
  onLoginSuccess: (user: AppUser) => void;
  logoUrl?: string;
}

type Screen = 'login' | 'trocarSenha' | 'esqueciSenha';

export const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess, logoUrl }) => {
  const [screen, setScreen] = useState<Screen>('login');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [showSenha, setShowSenha] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const session = await AuthService.login(email.trim(), senha);
      if (session.user.deve_trocar_senha) {
        setScreen('trocarSenha');
      } else {
        onLoginSuccess(session.user);
      }
    } catch (err: any) {
      setError(err.message || 'Não foi possível entrar. Verifique seus dados.');
    } finally {
      setLoading(false);
    }
  };

  const handleTrocarSenha = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (novaSenha.length < 6) {
      setError('A nova senha deve ter pelo menos 6 caracteres.');
      return;
    }
    if (novaSenha !== confirmarSenha) {
      setError('As senhas não coincidem.');
      return;
    }

    setLoading(true);
    try {
      await AuthService.changePassword(novaSenha);
      const user = AuthService.getCurrentUser();
      if (user) onLoginSuccess(user);
    } catch (err: any) {
      setError(err.message || 'Não foi possível trocar a senha.');
    } finally {
      setLoading(false);
    }
  };

  const handleEsqueciSenha = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      const message = await AuthService.requestPasswordReset(email.trim());
      setInfo(message);
    } catch (err: any) {
      setError(err.message || 'Não foi possível enviar a solicitação.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-xl shadow-slate-200/60 border border-slate-200 overflow-hidden">
        <div className="p-8 bg-gradient-to-br from-blue-600 to-indigo-700 text-white text-center">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt="Logo"
              className="w-14 h-14 rounded-2xl object-cover mx-auto mb-3 border-2 border-white/30 shadow-md"
            />
          ) : (
            <div className="w-14 h-14 rounded-2xl bg-white/15 flex items-center justify-center mx-auto mb-3">
              <BarChart3 className="w-7 h-7 text-white" />
            </div>
          )}
          <h1 className="text-xl font-extrabold tracking-tight">PesquisaHub</h1>
          <p className="text-xs text-blue-100 mt-1">Inteligência de Respostas</p>
        </div>

        <div className="p-8 space-y-5">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-xs font-medium rounded-xl px-4 py-3">
              {error}
            </div>
          )}
          {info && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium rounded-xl px-4 py-3">
              {info}
            </div>
          )}

          {screen === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">E-mail</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seuemail@exemplo.com"
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Senha</label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type={showSenha ? 'text' : 'password'}
                    required
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-9 pr-9 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSenha(!showSenha)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showSenha ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                <span>Entrar</span>
              </button>

              <button
                type="button"
                onClick={() => { setScreen('esqueciSenha'); setError(null); setInfo(null); }}
                className="w-full text-center text-xs font-semibold text-blue-600 hover:text-blue-700"
              >
                Esqueci minha senha
              </button>
            </form>
          )}

          {screen === 'trocarSenha' && (
            <form onSubmit={handleTrocarSenha} className="space-y-4">
              <p className="text-xs text-slate-500 leading-relaxed">
                Este é o seu primeiro acesso (ou sua senha foi redefinida). Por segurança, cadastre uma nova senha para continuar.
              </p>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Nova senha</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={novaSenha}
                  onChange={(e) => setNovaSenha(e.target.value)}
                  placeholder="Mínimo de 6 caracteres"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Confirmar nova senha</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={confirmarSenha}
                  onChange={(e) => setConfirmarSenha(e.target.value)}
                  placeholder="Repita a nova senha"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                <span>Salvar nova senha e entrar</span>
              </button>
            </form>
          )}

          {screen === 'esqueciSenha' && (
            <form onSubmit={handleEsqueciSenha} className="space-y-4">
              <p className="text-xs text-slate-500 leading-relaxed">
                Informe seu e-mail de acesso. O administrador será notificado para redefinir sua senha.
              </p>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">E-mail</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seuemail@exemplo.com"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                <span>Solicitar redefinição</span>
              </button>
              <button
                type="button"
                onClick={() => { setScreen('login'); setError(null); setInfo(null); }}
                className="w-full text-center text-xs font-semibold text-slate-500 hover:text-slate-700 flex items-center justify-center gap-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Voltar para o login</span>
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
