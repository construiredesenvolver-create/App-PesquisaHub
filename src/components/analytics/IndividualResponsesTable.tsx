import React, { useState } from 'react';
import { 
  Respondent, 
  Answer, 
  Question, 
  Option 
} from '../../types';
import { 
  Users, 
  Search, 
  Eye, 
  X, 
  Download, 
  Calendar, 
  Clock, 
  FileText,
  UserCheck
} from 'lucide-react';

interface IndividualResponsesTableProps {
  surveyTitle: string;
  questions: Question[];
  options: Option[];
  respondents: Respondent[];
  answers: Answer[];
  onExportCSV: () => void;
}

export const IndividualResponsesTable: React.FC<IndividualResponsesTableProps> = ({
  surveyTitle,
  questions,
  options,
  respondents,
  answers,
  onExportCSV
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRespondent, setSelectedRespondent] = useState<Respondent | null>(null);

  // Filtragem
  const filteredRespondents = respondents.filter((r) =>
    r.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (r.identificador && r.identificador.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-4">
      
      {/* Search & Export Toolbar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por nome do respondente ou matrícula..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          />
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <span className="text-xs text-slate-500 font-semibold">
            {filteredRespondents.length} de {respondents.length} respondentes
          </span>
          <button
            onClick={onExportCSV}
            className="px-3.5 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-xs flex items-center gap-1.5 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Exportar CSV</span>
          </button>
        </div>
      </div>

      {/* Tabela de Respondentes */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                <th className="p-4">Respondente</th>
                <th className="p-4">Identificador</th>
                <th className="p-4">Data / Hora</th>
                <th className="p-4">Perguntas Respondidas</th>
                <th className="p-4 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRespondents.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-400 text-xs">
                    Nenhum respondente encontrado para os critérios de busca.
                  </td>
                </tr>
              ) : (
                filteredRespondents.map((resp) => {
                  const respAnswers = answers.filter((a) => a.respondent_id === resp.id);
                  const answeredCount = new Set(respAnswers.map((a) => a.question_id)).size;

                  return (
                    <tr key={resp.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-4 font-bold text-slate-900 flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-xs">
                          {resp.nome.charAt(0).toUpperCase()}
                        </div>
                        <span>{resp.nome}</span>
                      </td>

                      <td className="p-4 text-slate-500 font-mono">
                        {resp.identificador || '—'}
                      </td>

                      <td className="p-4 text-slate-600">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          <span>{resp.data_resposta}</span>
                          {resp.hora_resposta && (
                            <span className="text-slate-400">às {resp.hora_resposta}</span>
                          )}
                        </div>
                      </td>

                      <td className="p-4">
                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold text-[11px]">
                          {answeredCount} de {questions.length} perguntas
                        </span>
                      </td>

                      <td className="p-4 text-right">
                        <button
                          onClick={() => setSelectedRespondent(resp)}
                          className="px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs inline-flex items-center gap-1.5 transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Ver Respostas</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Drill-down Modal: Visualização Detalhada do Respondente */}
      {selectedRespondent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] shadow-2xl border border-slate-100 overflow-hidden flex flex-col animate-in zoom-in-95 duration-150">
            
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-sm shadow-sm">
                  {selectedRespondent.nome.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">
                    {selectedRespondent.nome}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Respondido em {selectedRespondent.data_resposta} {selectedRespondent.hora_resposta ? `às ${selectedRespondent.hora_resposta}` : ''}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSelectedRespondent(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Answers List */}
            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400 pb-1">
                Questionário: {surveyTitle}
              </div>

              {questions.map((q, idx) => {
                const respAnswers = answers.filter(
                  (a) => a.respondent_id === selectedRespondent.id && a.question_id === q.id
                );

                return (
                  <div
                    key={q.id}
                    className="p-4 rounded-2xl bg-slate-50 border border-slate-200/70 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-xs font-bold text-slate-900">
                        {idx + 1}. {q.titulo}
                      </h4>
                      <span className="text-[10px] text-slate-400 font-mono shrink-0">
                        {q.tipo}
                      </span>
                    </div>

                    {respAnswers.length === 0 ? (
                      <p className="text-xs text-slate-400 italic">Não respondida</p>
                    ) : (
                      <div className="space-y-1">
                        {respAnswers.map((ans) => (
                          <div
                            key={ans.id}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-blue-200 text-blue-900 font-semibold text-xs shadow-xs"
                          >
                            <span className="w-2 h-2 rounded-full bg-blue-600" />
                            <span>{ans.valor}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                ID do Respondente: <code className="font-mono text-slate-700">{selectedRespondent.id}</code>
              </span>
              <button
                onClick={() => setSelectedRespondent(null)}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs"
              >
                Fechar
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
