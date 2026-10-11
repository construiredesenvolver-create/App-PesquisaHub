import React, { useEffect, useState } from 'react';
import { X, FilePlus2, LayoutTemplate, Building2, Trash2, Loader2, BookmarkPlus } from 'lucide-react';
import { ApiService } from '../services/api';
import { AuthService } from '../services/authService';
import { MODELOS_PADRAO, ModeloPesquisa, ConteudoModelo } from '../services/modelos';
import { Department, Survey } from '../types';

// ------------------------------------------------------------------------
// ESCOLHER MODELO (ao criar uma nova pesquisa)
// ------------------------------------------------------------------------

interface EscolherModeloModalProps {
  onClose: () => void;
  onEscolher: (conteudo: ConteudoModelo | null) => void; // null = pesquisa em branco
}

export const EscolherModeloModal: React.FC<EscolherModeloModalProps> = ({ onClose, onEscolher }) => {
  const [modelosOrg, setModelosOrg] = useState<ModeloPesquisa[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const usuario = AuthService.getCurrentUser();

  const carregar = async () => {
    setCarregando(true);
    try {
      setModelosOrg(await ApiService.listTemplates());
    } catch (err: any) {
      setErro(err.message || 'Não foi possível carregar os modelos da organização.');
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregar();
  }, []);

  const remover = async (m: ModeloPesquisa) => {
    if (!confirm(`Remover o modelo "${m.nome}"? As pesquisas já criadas a partir dele não são afetadas.`)) return;
    try {
      await ApiService.deleteTemplate(m.id);
      await carregar();
    } catch (err: any) {
      setErro(err.message || 'Não foi possível remover o modelo.');
    }
  };

  const Cartao: React.FC<{ m: ModeloPesquisa }> = ({ m }) => (
    <div className="relative group">
      <button
        onClick={() => onEscolher(m.conteudo)}
        className="w-full h-full text-left p-4 rounded-2xl border border-slate-200 hover:border-blue-400 hover:bg-blue-50/40 transition-colors"
      >
        <div className="text-sm font-bold text-slate-900 pr-6">{m.nome}</div>
        <p className="text-[11px] text-slate-500 mt-1 leading-relaxed line-clamp-3">{m.descricao || 'Sem descrição.'}</p>
        <div className="flex flex-wrap items-center gap-1.5 mt-2">
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
            {m.conteudo.perguntas.length} perguntas
          </span>
          {m.origem === 'organizacao' && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 flex items-center gap-1">
              <Building2 className="w-3 h-3" /> {m.department_nome || 'Geral'}
            </span>
          )}
        </div>
      </button>
      {m.origem === 'organizacao' && (usuario?.role === 'admin' || m.criado_por === usuario?.id) && (
        <button
          onClick={() => remover(m)}
          title="Remover modelo"
          className="absolute top-3 right-3 p-1 rounded-lg text-slate-300 hover:text-rose-600 hover:bg-rose-50"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-3xl p-6 space-y-5 shadow-2xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <LayoutTemplate className="w-5 h-5 text-blue-600" /> Nova pesquisa
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100" aria-label="Fechar">
            <X className="w-5 h-5" />
          </button>
        </div>

        <button
          onClick={() => onEscolher(null)}
          className="w-full flex items-center gap-3 p-4 rounded-2xl border-2 border-dashed border-slate-300 hover:border-blue-400 hover:bg-blue-50/40 text-left"
        >
          <FilePlus2 className="w-6 h-6 text-slate-500" />
          <span>
            <span className="block text-sm font-bold text-slate-900">Começar em branco</span>
            <span className="block text-[11px] text-slate-500">Monte a pesquisa do zero.</span>
          </span>
        </button>

        <div>
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">Modelos prontos</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {MODELOS_PADRAO.map((m) => <Cartao key={m.id} m={m} />)}
          </div>
        </div>

        <div>
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">Modelos da organização</h3>
          {erro && <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl px-3 py-2 mb-2">{erro}</div>}
          {carregando ? (
            <div className="py-6 flex justify-center"><Loader2 className="w-5 h-5 text-blue-600 animate-spin" /></div>
          ) : modelosOrg.length === 0 ? (
            <p className="text-[11px] text-slate-500">
              Nenhum modelo salvo ainda. Para criar um, abra o menu ⋮ de qualquer pesquisa e escolha "Salvar como modelo".
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {modelosOrg.map((m) => <Cartao key={m.id} m={m} />)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ------------------------------------------------------------------------
// SALVAR PESQUISA COMO MODELO
// ------------------------------------------------------------------------

interface SalvarModeloModalProps {
  survey: Survey;
  departamentos: Department[]; // departamentos onde a pessoa pode salvar
  onClose: () => void;
  onSalvo: () => void;
}

export const SalvarModeloModal: React.FC<SalvarModeloModalProps> = ({ survey, departamentos, onClose, onSalvo }) => {
  const usuario = AuthService.getCurrentUser();
  const ehAdmin = usuario?.role === 'admin';
  const [nome, setNome] = useState(survey.titulo.replace(/\s*\(aplicação \d{2}\/\d{4}\)$/i, ''));
  const [descricao, setDescricao] = useState('');
  const [departamento, setDepartamento] = useState<string>(ehAdmin ? '' : survey.department_id || departamentos[0]?.id || '');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const salvar = async () => {
    if (!nome.trim()) {
      setErro('Dê um nome ao modelo.');
      return;
    }
    if (!ehAdmin && !departamento) {
      setErro('Escolha o departamento do modelo.');
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      await ApiService.fetchSurveyDetail(survey.id);
      const conteudo = ApiService.montarConteudoModelo(survey.id);
      if (!conteudo) throw new Error('Não foi possível ler as perguntas desta pesquisa.');
      await ApiService.saveTemplate(nome, descricao, departamento || null, conteudo);
      onSalvo();
    } catch (err: any) {
      setErro(err.message || 'Não foi possível salvar o modelo.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <BookmarkPlus className="w-5 h-5 text-blue-600" /> Salvar como modelo
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100" aria-label="Fechar">
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className="text-[11px] text-slate-500">
          O modelo guarda o título, a descrição, as configurações e todas as perguntas. Não leva respostas, lista de
          Adesão nem contexto da IA.
        </p>
        {erro && <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl px-3 py-2">{erro}</div>}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">Nome do modelo</label>
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">Para que serve (opcional)</label>
          <input
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Ex.: Autoavaliação técnica do Suporte, aplicada a cada trimestre"
            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">Quem pode usar</label>
          <select
            value={departamento}
            onChange={(e) => setDepartamento(e.target.value)}
            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
          >
            {ehAdmin && <option value="">Todos os departamentos (modelo geral)</option>}
            {departamentos.map((d) => (
              <option key={d.id} value={d.id}>Só o departamento {d.nome}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-3 pt-1">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50">
            Cancelar
          </button>
          <button
            onClick={salvar}
            disabled={salvando}
            className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {salvando && <Loader2 className="w-4 h-4 animate-spin" />} Salvar modelo
          </button>
        </div>
      </div>
    </div>
  );
};
