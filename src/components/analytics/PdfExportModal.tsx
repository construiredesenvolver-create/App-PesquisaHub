import React, { useState } from 'react';
import { X, FileText, FileStack, Loader2, Download } from 'lucide-react';
import { SurveyAnalyticsData } from '../../types';
import { PrintableReport, ReportMode } from './PrintableReport';
import { exportPrintableReportToPdf } from '../../services/pdfExportService';
import { QuestionChartType } from './QuestionAnalyticsCard';

interface PdfExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  analyticsData: SurveyAnalyticsData;
  getChartTypeForQuestion: (questionId: string, recommendedChart: string) => QuestionChartType;
}

const PDF_CONTAINER_ID = 'pesquisahub-printable-report';

export const PdfExportModal: React.FC<PdfExportModalProps> = ({
  isOpen,
  onClose,
  analyticsData,
  getChartTypeForQuestion
}) => {
  const [selectedMode, setSelectedMode] = useState<ReportMode>('simples');
  const [isGenerating, setIsGenerating] = useState(false);
  const [progressLabel, setProgressLabel] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleGenerate = async () => {
    setError(null);
    setIsGenerating(true);
    try {
      // Pequena espera para garantir que o relatório fora da tela (com os gráficos) já renderizou
      await new Promise((resolve) => setTimeout(resolve, 350));

      const safeTitle = analyticsData.survey.titulo
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')
        .toLowerCase();
      const fileName = `relatorio-${safeTitle || 'pesquisa'}-${selectedMode}.pdf`;

      await exportPrintableReportToPdf(PDF_CONTAINER_ID, fileName, (etapa, atual, total) => {
        setProgressLabel(`${etapa} (${atual}/${total})`);
      });

      onClose();
    } catch (err: any) {
      setError(err.message || 'Não foi possível gerar o PDF. Tente novamente.');
    } finally {
      setIsGenerating(false);
      setProgressLabel('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-lg p-6 space-y-5 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">Extrair Relatório em PDF</h2>
          {!isGenerating && (
            <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700">
              <X className="w-4.5 h-4.5" />
            </button>
          )}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-xs font-medium rounded-xl px-4 py-3">
            {error}
          </div>
        )}

        {!isGenerating ? (
          <>
            <p className="text-xs text-slate-500">
              Escolha o nível de detalhe do relatório. Os gráficos exportados são exatamente os mesmos que você está vendo na aba "Análise por Pergunta".
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                onClick={() => setSelectedMode('simples')}
                className={`text-left p-4 rounded-2xl border-2 transition-all ${
                  selectedMode === 'simples' ? 'border-blue-500 bg-blue-50/60' : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <FileText className={`w-5 h-5 mb-2 ${selectedMode === 'simples' ? 'text-blue-600' : 'text-slate-400'}`} />
                <div className="font-bold text-sm text-slate-900">Versão Simplificada</div>
                <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                  Capa executiva, principais conclusões e a tabela-resumo com totais e percentuais. Ideal para envio rápido.
                </p>
              </button>

              <button
                onClick={() => setSelectedMode('completo')}
                className={`text-left p-4 rounded-2xl border-2 transition-all ${
                  selectedMode === 'completo' ? 'border-blue-500 bg-blue-50/60' : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <FileStack className={`w-5 h-5 mb-2 ${selectedMode === 'completo' ? 'text-blue-600' : 'text-slate-400'}`} />
                <div className="font-bold text-sm text-slate-900">Versão Completa</div>
                <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                  Tudo da versão simplificada + Análise por Pergunta (com gráficos), Cruzar Respostas e Respostas Individuais.
                </p>
              </button>
            </div>

            <button
              onClick={handleGenerate}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" />
              <span>Gerar e Baixar PDF</span>
            </button>
          </>
        ) : (
          <div className="py-10 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
            <p className="text-xs font-semibold text-slate-600">{progressLabel || 'Gerando relatório...'}</p>
            <p className="text-[11px] text-slate-400">Isso pode levar alguns segundos em pesquisas com muitas perguntas.</p>
          </div>
        )}
      </div>

      {/* Relatório fora da tela usado apenas para capturar as imagens do PDF */}
      <PrintableReport
        containerId={PDF_CONTAINER_ID}
        analyticsData={analyticsData}
        mode={selectedMode}
        getChartTypeForQuestion={getChartTypeForQuestion}
      />
    </div>
  );
};
