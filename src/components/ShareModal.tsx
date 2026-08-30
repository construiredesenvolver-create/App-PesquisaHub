import React, { useState, useEffect, useRef } from 'react';
import { 
  Copy, 
  Check, 
  ExternalLink, 
  QrCode, 
  X, 
  Share2, 
  MessageCircle, 
  Download, 
  Globe, 
  Sparkles,
  ShieldCheck,
  FileSpreadsheet,
  Info
} from 'lucide-react';
import QRCode from 'qrcode';
import { Survey } from '../types';
import { generatePublicSurveyUrl, generateGasDirectFormUrl, APP_CONFIG } from '../services/api';

interface ShareModalProps {
  survey: Survey;
  isOpen: boolean;
  onClose: () => void;
  onOpenPublicView: (surveyId: string) => void;
}

export const ShareModal: React.FC<ShareModalProps> = ({
  survey,
  isOpen,
  onClose,
  onOpenPublicView
}) => {
  const [activeTab, setActiveTab] = useState<'gas' | 'web'>('gas');
  const [copied, setCopied] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');

  const gasDirectUrl = generateGasDirectFormUrl(survey.link_publico || survey.id);
  const webAppUrl = generatePublicSurveyUrl(survey.link_publico || survey.id);

  // Link ativo selecionado pelo usuário
  const activeUrl = activeTab === 'gas' && gasDirectUrl ? gasDirectUrl : webAppUrl;

  useEffect(() => {
    // Se não tiver URL do Apps Script configurada, padronizar para web
    if (!gasDirectUrl) {
      setActiveTab('web');
    }
  }, [gasDirectUrl]);

  useEffect(() => {
    if (isOpen && activeUrl) {
      QRCode.toDataURL(activeUrl, {
        width: 320,
        margin: 2,
        color: {
          dark: '#0f172a',
          light: '#ffffff'
        }
      })
      .then((url) => setQrCodeUrl(url))
      .catch((err) => console.warn('Erro ao gerar QR Code:', err));
    }
  }, [isOpen, activeUrl]);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(activeUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleWhatsAppShare = () => {
    const text = encodeURIComponent(
      `Olá! Gostaria de convidar você para responder à pesquisa "${survey.titulo}". Leva menos de 2 minutos e não precisa de login:\n\n${activeUrl}`
    );
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
  };

  const handleDownloadQr = () => {
    if (!qrCodeUrl) return;
    const a = document.createElement('a');
    a.href = qrCodeUrl;
    a.download = `qrcode_pesquisa_${survey.id}.png`;
    a.click();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shadow-xs">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Compartilhar Pesquisa</h3>
              <p className="text-xs text-slate-500">Distribua o link para coletar respostas públicas</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-2 rounded-xl hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          
          {/* Survey Status Banner */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Pesquisa</span>
              <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                survey.status === 'Publicada'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}>
                {survey.status === 'Publicada' ? '✓ Publicada & Ativa' : survey.status}
              </span>
            </div>
            <p className="text-sm font-bold text-slate-900 line-clamp-1">{survey.titulo}</p>
            
            {survey.status === 'Publicada' ? (
              <div className="flex items-center gap-1.5 text-xs text-emerald-700 pt-1">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Pronta para receber respostas anônimas ou identificadas sem login.</span>
              </div>
            ) : (
              <div className="text-xs text-amber-700 bg-amber-100/50 p-2.5 rounded-xl border border-amber-200 flex items-start gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse mt-1 shrink-0" />
                <span>Esta pesquisa está em status <strong>{survey.status}</strong>. Publique-a para que os respondentes possam acessá-la.</span>
              </div>
            )}
          </div>

          {/* Opções de Link */}
          {gasDirectUrl && (
            <div className="flex p-1 bg-slate-100 rounded-2xl gap-1">
              <button
                onClick={() => setActiveTab('gas')}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  activeTab === 'gas'
                    ? 'bg-white text-blue-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Link Direto Google (Recomendado)</span>
              </button>
              <button
                onClick={() => setActiveTab('web')}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  activeTab === 'web'
                    ? 'bg-white text-blue-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Globe className="w-3.5 h-3.5" />
                <span>Link Web PesquisaHub</span>
              </button>
            </div>
          )}

          {/* Link Box */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                {activeTab === 'gas' ? (
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                ) : (
                  <Globe className="w-3.5 h-3.5 text-blue-600" />
                )}
                <span>
                  {activeTab === 'gas' ? 'Link Direto Google Apps Script' : 'Link Web da Aplicação'}
                </span>
              </label>
              <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                Livre de Login
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={activeUrl}
                className="flex-1 text-xs bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-3 text-slate-800 font-mono focus:outline-hidden select-all"
              />
              <button
                onClick={handleCopy}
                className={`px-4 py-3 rounded-2xl font-bold text-xs flex items-center gap-1.5 transition-all shrink-0 shadow-sm ${
                  copied
                    ? 'bg-emerald-600 text-white shadow-emerald-500/20'
                    : 'bg-blue-600 hover:bg-blue-700 text-white active:scale-95 shadow-blue-500/20'
                }`}
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Copiar</span>
                  </>
                )}
              </button>
            </div>
            
            {activeTab === 'gas' ? (
              <div className="p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-100 flex items-start gap-2 text-[11px] text-emerald-800 leading-relaxed">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>
                  <strong>100% Funcional e Autônomo:</strong> Este link é hospedado diretamente pela infraestrutura do Google Apps Script. Funciona em qualquer celular, WhatsApp ou computador sem depender do ambiente de desenvolvimento.
                </span>
              </div>
            ) : (
              <div className="p-2.5 rounded-xl bg-blue-50/70 border border-blue-100 flex items-start gap-2 text-[11px] text-blue-800 leading-relaxed">
                <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Link Web SPA:</strong> Para compartilhar este link publicamente a partir do Google AI Studio, clique no botão <strong>"Share" (Compartilhar)</strong> no canto superior direito do AI Studio para ativar o domínio público do preview. Caso contrário, utilize o <strong>Link Direto Google</strong>.
                </span>
              </div>
            )}
          </div>

          {/* Quick Share Buttons */}
          <div className="grid grid-cols-2 gap-2.5">
            <button
              onClick={handleWhatsAppShare}
              className="py-3 px-4 rounded-2xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-semibold text-xs flex items-center justify-center gap-2 transition-all active:scale-98"
            >
              <MessageCircle className="w-4 h-4 text-emerald-600" />
              <span>Enviar via WhatsApp</span>
            </button>
            <a
              href={activeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="py-3 px-4 rounded-2xl bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-200 font-semibold text-xs flex items-center justify-center gap-2 transition-all text-center"
            >
              <ExternalLink className="w-4 h-4 text-slate-600" />
              <span>Abrir em Nova Aba</span>
            </a>
          </div>

          {/* QR Code Section */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex items-center gap-4">
            <div className="w-20 h-20 bg-white border border-slate-200 rounded-xl p-1 flex items-center justify-center shrink-0 shadow-xs">
              {qrCodeUrl ? (
                <img src={qrCodeUrl} alt="QR Code da Pesquisa" className="w-full h-full object-contain" />
              ) : (
                <QrCode className="w-10 h-10 text-slate-400 animate-pulse" />
              )}
            </div>
            <div className="flex-1 space-y-1.5">
              <p className="text-xs font-bold text-slate-800">QR Code para Cartazes e Eventos</p>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Ideal para pesquisas presenciais. Aponte a câmera do celular para responder instantaneamente.
              </p>
              {qrCodeUrl && (
                <button
                  onClick={handleDownloadQr}
                  className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 hover:underline pt-0.5"
                >
                  <Download className="w-3 h-3" />
                  <span>Baixar imagem do QR Code (PNG)</span>
                </button>
              )}
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <span className="text-[11px] text-slate-400">
            Sem login • 100% responsivo para celulares
          </span>
          <button
            onClick={onClose}
            className="text-xs font-semibold text-slate-700 hover:text-slate-900 px-4 py-2 rounded-xl hover:bg-slate-200/60 transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};

