import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Caminho para armazenamento persistente dos dados e configuração do backend
const DATA_FILE = path.join(process.cwd(), "server-data.json");

interface ServerState {
  gasConfig: {
    webAppUrl: string;
    publicAppUrl?: string;
    sheetId?: string;
    isConnected: boolean;
    lastSync?: string;
  };
  surveys: any[];
  questions: any[];
  options: any[];
  respondents: any[];
  answers: any[];
}

function loadServerState(): ServerState {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, "utf-8");
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error("[Server] Erro ao ler server-data.json:", err);
  }
  return {
    gasConfig: {
      webAppUrl: "",
      publicAppUrl: "",
      sheetId: "",
      isConnected: false
    },
    surveys: [],
    questions: [],
    options: [],
    respondents: [],
    answers: []
  };
}

function saveServerState(state: ServerState) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(state, null, 2), "utf-8");
  } catch (err) {
    console.error("[Server] Erro ao salvar server-data.json:", err);
  }
}

let state: ServerState = loadServerState();

/**
 * Função utilitária para fazer requisições seguras ao Google Apps Script
 * Tratando redirecionamentos 302 do Google e CORS
 */
async function callGoogleAppsScript(action: string, payload?: any, customUrl?: string): Promise<any> {
  const targetUrl = customUrl || state.gasConfig.webAppUrl;
  if (!targetUrl) {
    throw new Error("URL do Google Apps Script não configurada no servidor.");
  }

  const urlWithAction = targetUrl.includes("?")
    ? `${targetUrl}&action=${encodeURIComponent(action)}&_t=${Date.now()}`
    : `${targetUrl}?action=${encodeURIComponent(action)}&_t=${Date.now()}`;

  const options: RequestInit = {
    method: payload ? "POST" : "GET",
    headers: {
      "Accept": "application/json",
      ...(payload ? { "Content-Type": "application/json" } : {})
    },
    redirect: "follow",
    ...(payload ? { body: JSON.stringify(payload) } : {})
  };

  const response = await fetch(urlWithAction, options);
  if (!response.ok) {
    throw new Error(`Google Apps Script respondeu com HTTP ${response.status}: ${response.statusText}`);
  }

  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch (e) {
    console.warn("[Server] Resposta não-JSON recebida do GAS:", text.substring(0, 300));
    return { status: "raw", data: text };
  }
}

// ==========================================
// ROTAS DE API DO BACKEND PESQUISAHUB
// ==========================================

// 1. Health check
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    server: "PesquisaHub Backend",
    isConnectedToGas: Boolean(state.gasConfig.webAppUrl && state.gasConfig.isConnected),
    surveysCount: state.surveys.length,
    timestamp: new Date().toISOString()
  });
});

// 2. Obter Configuração Atual do Servidor
app.get("/api/config", (_req, res) => {
  res.json({
    status: "ok",
    config: state.gasConfig,
    publicAppUrl: state.gasConfig.publicAppUrl || ""
  });
});

// 3. Salvar Configuração e Testar Conexão
app.post("/api/config", async (req, res) => {
  try {
    const { webAppUrl, publicAppUrl, sheetId } = req.body;
    
    if (webAppUrl !== undefined) state.gasConfig.webAppUrl = String(webAppUrl || "").trim();
    if (publicAppUrl !== undefined) state.gasConfig.publicAppUrl = String(publicAppUrl || "").trim();
    if (sheetId !== undefined) state.gasConfig.sheetId = String(sheetId || "").trim();

    if (state.gasConfig.webAppUrl) {
      try {
        const pingResult = await callGoogleAppsScript("ping");
        state.gasConfig.isConnected = Boolean(pingResult.status === "ok" || pingResult.success);
        state.gasConfig.lastSync = new Date().toISOString();
      } catch (err: any) {
        state.gasConfig.isConnected = false;
        console.warn("[Server] Teste de ping falhou:", err.message);
      }
    } else {
      state.gasConfig.isConnected = false;
    }

    saveServerState(state);

    res.json({
      status: "ok",
      config: state.gasConfig,
      message: state.gasConfig.isConnected 
        ? "Google Apps Script conectado com sucesso!" 
        : "Configuração salva. Conexão pendente de verificação."
    });
  } catch (err: any) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

// 4. Sincronização Completa com o Google Sheets
app.post("/api/sync", async (_req, res) => {
  try {
    if (!state.gasConfig.webAppUrl) {
      return res.json({
        status: "ok",
        source: "local",
        data: {
          surveys: state.surveys,
          questions: state.questions,
          options: state.options,
          respondents: state.respondents,
          answers: state.answers
        }
      });
    }

    // Tentar action=getAllData
    let gasData = await callGoogleAppsScript("getAllData");
    
    if (gasData.data && (gasData.data.surveys || Array.isArray(gasData.data))) {
      const d = gasData.data;
      state.surveys = Array.isArray(d.surveys) ? d.surveys : (Array.isArray(d) ? d : state.surveys);
      state.questions = Array.isArray(d.questions) ? d.questions : state.questions;
      state.options = Array.isArray(d.options) ? d.options : state.options;
      state.respondents = Array.isArray(d.respondents) ? d.respondents : state.respondents;
      state.answers = Array.isArray(d.answers) ? d.answers : state.answers;
      state.gasConfig.isConnected = true;
      state.gasConfig.lastSync = new Date().toISOString();
      saveServerState(state);
    }

    res.json({
      status: "ok",
      source: "sheets",
      data: {
        surveys: state.surveys,
        questions: state.questions,
        options: state.options,
        respondents: state.respondents,
        answers: state.answers
      }
    });
  } catch (err: any) {
    console.error("[Server] Erro na sincronização com Google Sheets:", err.message);
    res.json({
      status: "partial",
      message: `Erro ao contatar Google Sheets: ${err.message}. Retornando cache local do servidor.`,
      data: {
        surveys: state.surveys,
        questions: state.questions,
        options: state.options,
        respondents: state.respondents,
        answers: state.answers
      }
    });
  }
});

// 5. Listar todas as pesquisas (Admin)
app.get("/api/surveys", (_req, res) => {
  res.json({
    status: "ok",
    data: {
      surveys: state.surveys,
      questions: state.questions,
      options: state.options,
      respondents: state.respondents,
      answers: state.answers
    }
  });
});

// 6. ROTA PÚBLICA: Carregar Pesquisa para Respondente (Intermediada pelo PesquisaHub)
// Qualquer pessoa pode acessar /api/public/survey/:id sem nenhuma autenticação!
app.get("/api/public/survey/:id", async (req, res) => {
  try {
    const rawParam = decodeURIComponent(req.params.id || "").trim();
    const cleanId = rawParam.split("?")[0].split("#")[0].replace(/^#\/?responder-?/, "").replace(/^\/+|\/+$/g, "").toLowerCase();
    
    // Primeiro verificar se já temos em memória/cache
    let survey = state.surveys.find((s) => {
      const sId = String(s.id || "").toLowerCase();
      const sLink = String(s.link_publico || "").toLowerCase().replace(/.*\/responder\//, "").replace(/^#\/?responder-?/, "");
      const sTitleSlug = String(s.titulo || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
      const sTitle = String(s.titulo || "").toLowerCase();
      return sId === cleanId || sLink === cleanId || sTitleSlug === cleanId || sTitle === cleanId || s.id === rawParam || s.link_publico === rawParam;
    });

    let questions = survey ? state.questions.filter((q) => q.survey_id === survey.id) : [];
    const qIds = new Set(questions.map((q) => q.id));
    let options = state.options.filter((o) => qIds.has(o.question_id));

    // Se não encontrou ou temos conexão com GAS, tentar atualizar do Google Apps Script
    if ((!survey || questions.length === 0) && state.gasConfig.webAppUrl) {
      try {
        const gasResult = await callGoogleAppsScript("getSurvey", undefined, `${state.gasConfig.webAppUrl}?id=${encodeURIComponent(cleanId)}`);
        if (gasResult.data && gasResult.data.survey) {
          survey = gasResult.data.survey;
          questions = gasResult.data.questions || [];
          options = gasResult.data.options || [];

          // Atualizar cache
          const existingIdx = state.surveys.findIndex((s) => s.id === survey.id);
          if (existingIdx >= 0) state.surveys[existingIdx] = survey;
          else state.surveys.push(survey);

          saveServerState(state);
        }
      } catch (err: any) {
        console.warn(`[Server] Falha ao buscar pesquisa pública "${cleanId}" no Sheets:`, err.message);
      }
    }

    if (!survey) {
      return res.status(404).json({
        status: "error",
        message: "Pesquisa não encontrada ou link inválido."
      });
    }

    res.json({
      status: "ok",
      data: {
        survey,
        questions: questions.sort((a: any, b: any) => (a.ordem || 0) - (b.ordem || 0)),
        options: options.sort((a: any, b: any) => (a.ordem || 0) - (b.ordem || 0))
      }
    });
  } catch (err: any) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

// 7. ROTA PÚBLICA: Enviar Respostas do Respondente (Intermediada com Segurança)
// Recebe as respostas da interface Web do PesquisaHub, valida e grava no Sheets via Apps Script
app.post("/api/public/submit-response", async (req, res) => {
  try {
    const { survey_id, nome, identificador, respostas } = req.body;

    if (!survey_id) {
      return res.status(400).json({ status: "error", message: "ID da pesquisa é obrigatório." });
    }

    const survey = state.surveys.find((s) => s.id === survey_id || s.link_publico === survey_id);
    if (survey && survey.status !== "Publicada") {
      return res.status(403).json({
        status: "error",
        message: `Esta pesquisa está com status "${survey.status}" e não aceita mais respostas.`
      });
    }

    const now = new Date();
    const respondentId = `resp_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;
    const dataStr = now.toISOString().split("T")[0];
    const horaStr = now.toTimeString().split(" ")[0];

    const newRespondent = {
      id: respondentId,
      survey_id: survey ? survey.id : survey_id,
      nome: String(nome || "Anônimo").trim(),
      identificador: identificador ? String(identificador).trim() : undefined,
      data_resposta: dataStr,
      hora_resposta: horaStr
    };

    const newAnswers: any[] = [];
    if (respostas && typeof respostas === "object") {
      Object.entries(respostas).forEach(([questionId, val]) => {
        if (val === undefined || val === null || val === "") return;

        if (Array.isArray(val)) {
          val.forEach((itemVal) => {
            newAnswers.push({
              id: `ans_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`,
              survey_id: survey ? survey.id : survey_id,
              respondent_id: respondentId,
              question_id: questionId,
              valor: String(itemVal),
              data_resposta: dataStr
            });
          });
        } else {
          newAnswers.push({
            id: `ans_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`,
            survey_id: survey ? survey.id : survey_id,
            respondent_id: respondentId,
            question_id: questionId,
            valor: String(val),
            data_resposta: dataStr
          });
        }
      });
    }

    // Gravar no cache local do servidor
    state.respondents.push(newRespondent);
    state.answers.push(...newAnswers);
    saveServerState(state);

    // Se temos conexão com Google Apps Script, enviar para a planilha
    let sheetsSaved = false;
    if (state.gasConfig.webAppUrl) {
      try {
        const gasPayload = {
          survey_id: survey ? survey.id : survey_id,
          nome: newRespondent.nome,
          identificador: newRespondent.identificador,
          respostas: respostas || {}
        };
        const gasResult = await callGoogleAppsScript("submitResponse", gasPayload);
        sheetsSaved = Boolean(gasResult.status === "ok" || gasResult.success);
      } catch (err: any) {
        console.warn("[Server] Aviso: Falha ao enviar resposta para o Google Apps Script:", err.message);
      }
    }

    res.json({
      status: "ok",
      success: true,
      respondentId,
      sheetsSynced: sheetsSaved,
      message: "Resposta registrada com sucesso!"
    });
  } catch (err: any) {
    console.error("[Server] Erro ao registrar resposta pública:", err);
    res.status(500).json({ status: "error", message: err.message });
  }
});

// 8. Salvar/Atualizar Pesquisa (Admin)
app.post("/api/survey/save", async (req, res) => {
  try {
    const { survey, questions, options } = req.body;
    if (!survey || !survey.id) {
      return res.status(400).json({ status: "error", message: "Dados da pesquisa incompletos." });
    }

    // Atualizar no cache do servidor
    const sIdx = state.surveys.findIndex((s) => s.id === survey.id);
    if (sIdx >= 0) state.surveys[sIdx] = survey;
    else state.surveys.push(survey);

    if (Array.isArray(questions)) {
      state.questions = state.questions.filter((q) => q.survey_id !== survey.id);
      state.questions.push(...questions);
    }

    if (Array.isArray(options) && Array.isArray(questions)) {
      const qIds = new Set(questions.map((q) => q.id));
      state.options = state.options.filter((o) => !qIds.has(o.question_id));
      state.options.push(...options);
    }

    saveServerState(state);

    // Encaminhar para Google Apps Script
    let sheetsSaved = false;
    if (state.gasConfig.webAppUrl) {
      try {
        const gasResult = await callGoogleAppsScript("saveSurvey", { survey, questions, options });
        sheetsSaved = Boolean(gasResult.status === "ok" || gasResult.success);
      } catch (err: any) {
        console.warn("[Server] Falha ao sincronizar pesquisa salva no Google Sheets:", err.message);
      }
    }

    res.json({
      status: "ok",
      success: true,
      sheetsSynced: sheetsSaved,
      survey
    });
  } catch (err: any) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

// 9. Atualizar Status de Pesquisa (Admin)
app.post("/api/survey/status", async (req, res) => {
  try {
    const { id, status } = req.body;
    const survey = state.surveys.find((s) => s.id === id);
    if (!survey) {
      return res.status(404).json({ status: "error", message: "Pesquisa não encontrada." });
    }

    survey.status = status;
    saveServerState(state);

    if (state.gasConfig.webAppUrl) {
      try {
        await callGoogleAppsScript("updateSurveyStatus", { id, status });
      } catch (err: any) {
        console.warn("[Server] Falha ao atualizar status no Sheets:", err.message);
      }
    }

    res.json({ status: "ok", survey });
  } catch (err: any) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

// 10. Excluir Pesquisa (Admin)
app.post("/api/survey/delete", async (req, res) => {
  try {
    const { id } = req.body;
    state.surveys = state.surveys.filter((s) => s.id !== id);
    state.questions = state.questions.filter((q) => q.survey_id !== id);
    state.respondents = state.respondents.filter((r) => r.survey_id !== id);
    state.answers = state.answers.filter((a) => a.survey_id !== id);
    saveServerState(state);

    if (state.gasConfig.webAppUrl) {
      try {
        await callGoogleAppsScript("deleteSurvey", { id });
      } catch (err: any) {
        console.warn("[Server] Falha ao excluir no Sheets:", err.message);
      }
    }

    res.json({ status: "ok", message: "Pesquisa excluída com sucesso." });
  } catch (err: any) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

// ==========================================
// VITE MIDDLEWARE & CLIENT SERVING
// ==========================================

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true, host: "0.0.0.0", port: PORT },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[PesquisaHub Server] Rodando com sucesso na porta ${PORT}`);
    console.log(`[PesquisaHub Server] Conectado ao Google Sheets: ${state.gasConfig.isConnected ? "SIM" : "NÃO"}`);
  });
}

startServer().catch((err) => {
  console.error("[PesquisaHub Server] Erro fatal ao iniciar servidor:", err);
});
