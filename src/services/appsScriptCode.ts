/**
 * Código completo do Google Apps Script (Code.gs)
 * Fornecido pelo PesquisaHub para cópia direta e implantação no Google Sheets / Apps Script.
 */
export const GOOGLE_APPS_SCRIPT_CODE = `/**
 * =========================================================================
 * PESQUISAHUB — BACKEND API (GOOGLE APPS SCRIPT)
 * Versão: 1.2.0 (Persistência Confiável, IDs Únicos & Suporte Multi-Endpoint)
 * 
 * INSTRUÇÕES RÁPIDAS DE IMPLANTAÇÃO:
 * 1. Crie uma nova planilha no Google Sheets (ex: "PesquisaHub — Banco de Dados").
 * 2. No menu superior, clique em "Extensões" > "Apps Script".
 * 3. Apague qualquer código existente no arquivo Code.gs e cole este código completo.
 * 4. Salve o projeto (Ctrl+S ou ícone de disquete).
 * 5. Clique no botão azul "Implantar" (Deploy) > "Nova implantação" (New deployment).
 * 6. Tipo: Selecione "App da Web" (Web app).
 * 7. Configurações OBRIGATÓRIAS:
 *    - Executar como: "Eu" (seu e-mail).
 *    - Quem tem acesso: "Qualquer pessoa" (Anyone). -> CRUCIAL para formulários anônimos sem login!
 * 8. Clique em "Implantar" e conceda as permissões de acesso ao Google Sheets.
 * 9. Copie a "URL do app da Web" gerada (termina em /exec) e cole nas Configurações do PesquisaHub!
 * =========================================================================
 */

// Nomes das abas do banco de dados relacional no Google Sheets
var SHEETS = {
  SURVEYS: 'Surveys',
  QUESTIONS: 'Questions',
  OPTIONS: 'Options',
  RESPONDENTS: 'Respondents',
  ANSWERS: 'Answers',
  SETTINGS: 'Settings',
  LOGS: 'Logs'
};

/**
 * Inicializa a estrutura de abas e cabeçalhos na planilha se não existirem.
 */
function initDatabase() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  var schemas = [
    {
      name: SHEETS.SURVEYS,
      headers: ['id', 'titulo', 'descricao', 'status', 'data_criacao', 'data_inicio', 'data_fim', 'link_publico', 'configuracoes', 'criado_por']
    },
    {
      name: SHEETS.QUESTIONS,
      headers: ['id', 'survey_id', 'ordem', 'titulo', 'descricao', 'tipo', 'obrigatoria', 'ativa']
    },
    {
      name: SHEETS.OPTIONS,
      headers: ['id', 'question_id', 'ordem', 'texto', 'valor', 'peso']
    },
    {
      name: SHEETS.RESPONDENTS,
      headers: ['id', 'survey_id', 'nome', 'identificador', 'data_resposta', 'hora_resposta']
    },
    {
      name: SHEETS.ANSWERS,
      headers: ['id', 'survey_id', 'respondent_id', 'question_id', 'option_id', 'valor', 'data_resposta']
    },
    {
      name: SHEETS.SETTINGS,
      headers: ['chave', 'valor', 'atualizado_em']
    },
    {
      name: SHEETS.LOGS,
      headers: ['id', 'timestamp', 'acao', 'detalhes', 'status']
    }
  ];

  schemas.forEach(function(schema) {
    var sheet = ss.getSheetByName(schema.name);
    if (!sheet) {
      sheet = ss.insertSheet(schema.name);
      sheet.appendRow(schema.headers);
      sheet.setFrozenRows(1);
      sheet.getRange(1, 1, 1, schema.headers.length).setFontWeight('bold').setBackground('#f1f5f9');
    }
  });

  logOperation('INIT_DB', 'Estrutura de abas inicializada/verificada com sucesso.', 'SUCCESS');
  return { status: 'ok', success: true, message: 'Planilha configurada e pronta para operar!' };
}

/**
 * Trata requisições HTTP GET (Leituras, Diagnóstico, Consultas Públicas e Formulário Web Direto)
 */
function doGet(e) {
  try {
    initDatabase();
    
    // Se o respondente abrir diretamente pelo navegador (ex: ?survey=teste ou ?id=teste)
    var paramSurvey = e && e.parameter && (e.parameter.survey || e.parameter.id || e.parameter.slug || e.parameter.responder || e.parameter.p);
    var action = (e && e.parameter && e.parameter.action) || '';

    var isExplicitJsonApi = action === 'ping' || action === 'init' || action === 'getAllData' || action === 'getData' || 
                            action === 'readAll' || action === 'all' || action === 'get_all_data' || 
                            action === 'getSurveys' || action === 'listSurveys' || action === 'getResponses' ||
                            (action === 'getSurvey' && e.parameter.format === 'json') ||
                            (e && e.parameter && e.parameter.format === 'json');

    if (paramSurvey && !isExplicitJsonApi) {
      return renderStandaloneSurveyHtml(paramSurvey, e);
    }

    var action = (e && e.parameter && e.parameter.action) || 'getAllData';
    var responseData = {};

    switch (action) {
      case 'ping':
        responseData = { 
          status: 'ok', 
          success: true,
          message: 'API PesquisaHub operacional', 
          timestamp: new Date().toISOString(),
          version: '1.2.1'
        };
        break;

      case 'init':
        responseData = initDatabase();
        break;

      case 'getAllData':
      case 'getData':
      case 'readAll':
      case 'all':
      case 'get_all_data':
        var allData = getAllDatabaseData();
        responseData = { 
          status: 'ok', 
          success: true,
          data: allData,
          surveysCount: allData.surveys ? allData.surveys.length : 0
        };
        break;

      case 'getSurveys':
      case 'listSurveys':
      case 'surveys':
      case 'get_surveys':
        var surveysList = getSurveysList();
        responseData = { 
          status: 'ok', 
          success: true,
          surveys: surveysList,
          data: surveysList,
          count: surveysList.length 
        };
        break;

      case 'getSurvey':
      case 'survey':
      case 'get_survey':
        var surveyId = (e.parameter && (e.parameter.id || e.parameter.survey_id));
        if (!surveyId) throw new Error('Parâmetro id ou survey_id é obrigatório');
        var surveyData = getFullSurvey(surveyId);
        responseData = { 
          status: 'ok', 
          success: true,
          data: surveyData,
          survey: surveyData.survey,
          questions: surveyData.questions,
          options: surveyData.options
        };
        break;

      case 'getResponses':
      case 'responses':
      case 'get_responses':
        var sId = (e.parameter && (e.parameter.id || e.parameter.survey_id));
        if (!sId) throw new Error('Parâmetro id é obrigatório');
        responseData = { 
          status: 'ok', 
          success: true,
          data: getSurveyResponses(sId) 
        };
        break;

      default:
        // Se a ação não for reconhecida, retorna todos os dados por padrão em vez de erro
        var defaultData = getAllDatabaseData();
        responseData = { 
          status: 'ok', 
          success: true, 
          actionExecuted: 'getAllData',
          data: defaultData,
          surveysCount: defaultData.surveys ? defaultData.surveys.length : 0
        };
    }

    return createJsonResponse(responseData);
  } catch (err) {
    logOperation('GET_ERROR', err.toString(), 'ERROR');
    return createJsonResponse({ 
      status: 'error', 
      success: false, 
      message: err.toString() 
    });
  }
}

/**
 * Trata requisições HTTP POST (Criação, Status, Exclusão e Envio de Respostas)
 */
function doPost(e) {
  try {
    initDatabase();
    var postData = {};
    if (e.postData && e.postData.contents) {
      try {
        postData = JSON.parse(e.postData.contents);
      } catch (parseErr) {
        postData = e.parameter || {};
      }
    } else if (e.parameter) {
      postData = e.parameter;
    }

    var action = postData.action || (e.parameter && e.parameter.action);
    var responseData = {};

    switch (action) {
      case 'createSurvey':
        var created = saveNewSurvey(postData.payload);
        responseData = { 
          status: 'ok', 
          success: true, 
          data: created,
          message: 'Pesquisa salva com sucesso no Google Sheets'
        };
        break;

      case 'updateSurveyStatus':
        var updated = updateSurveyStatus(postData.id || postData.survey_id, postData.status);
        responseData = { 
          status: 'ok', 
          success: true, 
          data: updated,
          message: 'Status atualizado com sucesso'
        };
        break;

      case 'deleteSurvey':
        var deleted = deleteSurveyAndData(postData.id || postData.survey_id);
        responseData = { 
          status: 'ok', 
          success: true, 
          data: deleted,
          message: 'Pesquisa excluída do banco de dados'
        };
        break;

      case 'submitResponse':
        var recorded = recordResponse(postData.payload);
        responseData = { 
          status: 'ok', 
          success: true, 
          data: recorded,
          message: recorded.message || 'Resposta registrada com sucesso'
        };
        break;

      default:
        responseData = { 
          status: 'error', 
          success: false, 
          message: 'Ação POST desconhecida: ' + action 
        };
    }

    return createJsonResponse(responseData);
  } catch (err) {
    logOperation('POST_ERROR', err.toString(), 'ERROR');
    return createJsonResponse({ 
      status: 'error', 
      success: false, 
      message: err.toString() 
    });
  }
}

// ==========================================
// FUNÇÕES DE ACESSO A DADOS
// ==========================================

/**
 * Retorna todos os dados reais do Google Sheets em uma única requisição.
 */
function getAllDatabaseData() {
  var surveysSheet = getOrCreateSheet(SHEETS.SURVEYS);
  var surveysRaw = getRowsAsObjects(surveysSheet);
  var surveys = surveysRaw.map(function(s) {
    var config = {};
    if (s.configuracoes) {
      try {
        config = typeof s.configuracoes === 'string' ? JSON.parse(s.configuracoes) : s.configuracoes;
      } catch(e) {
        config = {};
      }
    }
    return {
      id: s.id,
      titulo: s.titulo || '',
      descricao: s.descricao || '',
      status: s.status || 'Rascunho',
      data_criacao: s.data_criacao || '',
      data_inicio: s.data_inicio || '',
      data_fim: s.data_fim || '',
      link_publico: s.link_publico || s.id,
      configuracoes: config,
      criado_por: s.criado_por || ''
    };
  });

  var questionsSheet = getOrCreateSheet(SHEETS.QUESTIONS);
  var questionsRaw = getRowsAsObjects(questionsSheet);
  var questions = questionsRaw.map(function(q) {
    return {
      id: q.id,
      survey_id: q.survey_id,
      ordem: Number(q.ordem) || 1,
      titulo: q.titulo || '',
      descricao: q.descricao || '',
      tipo: q.tipo || 'single_choice',
      obrigatoria: q.obrigatoria === true || q.obrigatoria === 'TRUE' || q.obrigatoria === 'true',
      ativa: q.ativa !== false && q.ativa !== 'FALSE' && q.ativa !== 'false'
    };
  });

  var optionsSheet = getOrCreateSheet(SHEETS.OPTIONS);
  var optionsRaw = getRowsAsObjects(optionsSheet);
  var options = optionsRaw.map(function(opt) {
    return {
      id: opt.id,
      question_id: opt.question_id,
      ordem: Number(opt.ordem) || 1,
      texto: opt.texto || '',
      valor: opt.valor || opt.texto || '',
      peso: opt.peso ? Number(opt.peso) : undefined
    };
  });

  var respondentsSheet = getOrCreateSheet(SHEETS.RESPONDENTS);
  var respondents = getRowsAsObjects(respondentsSheet).map(function(r) {
    return {
      id: r.id,
      survey_id: r.survey_id,
      nome: r.nome || '',
      identificador: r.identificador || '',
      data_resposta: r.data_resposta || '',
      hora_resposta: r.hora_resposta || ''
    };
  });

  var answersSheet = getOrCreateSheet(SHEETS.ANSWERS);
  var answers = getRowsAsObjects(answersSheet).map(function(a) {
    return {
      id: a.id,
      survey_id: a.survey_id,
      respondent_id: a.respondent_id,
      question_id: a.question_id,
      option_id: a.option_id || '',
      valor: a.valor || '',
      data_resposta: a.data_resposta || ''
    };
  });

  return {
    surveys: surveys,
    questions: questions,
    options: options,
    respondents: respondents,
    answers: answers
  };
}

function getSurveysList() {
  var sheet = getOrCreateSheet(SHEETS.SURVEYS);
  var rows = getRowsAsObjects(sheet);
  var respondentsSheet = getOrCreateSheet(SHEETS.RESPONDENTS);
  var respRows = getRowsAsObjects(respondentsSheet);
  var questionsSheet = getOrCreateSheet(SHEETS.QUESTIONS);
  var qRows = getRowsAsObjects(questionsSheet);

  return rows.map(function(s) {
    var respCount = respRows.filter(function(r) { return r.survey_id === s.id; }).length;
    var qCount = qRows.filter(function(q) { return q.survey_id === s.id; }).length;
    var config = {};
    if (s.configuracoes) {
      try {
        config = typeof s.configuracoes === 'string' ? JSON.parse(s.configuracoes) : s.configuracoes;
      } catch(e) {
        config = {};
      }
    }
    return {
      id: s.id,
      titulo: s.titulo || '',
      descricao: s.descricao || '',
      status: s.status || 'Rascunho',
      data_criacao: s.data_criacao || '',
      data_inicio: s.data_inicio || '',
      data_fim: s.data_fim || '',
      link_publico: s.link_publico || s.id,
      configuracoes: config,
      criado_por: s.criado_por || '',
      total_respostas: respCount,
      total_perguntas: qCount
    };
  });
}

function getFullSurvey(surveyIdOrSlug) {
  var clean = String(surveyIdOrSlug || '').trim().toLowerCase();
  // Limpar qualquer prefixo ou hash se houver
  clean = clean.split('?')[0].split('#')[0].replace(/^#\/?responder-?/, '').replace(/^\/+|\/+$/g, '');

  var surveysSheet = getOrCreateSheet(SHEETS.SURVEYS);
  var surveyRows = getRowsAsObjects(surveysSheet);
  var surveyRaw = surveyRows.find(function(s) { 
    var sId = String(s.id || '').trim().toLowerCase();
    var sLink = String(s.link_publico || '').trim().toLowerCase().replace(/.*\/responder\//, '').replace(/^#\/?responder-?/, '');
    var sTitle = String(s.titulo || '').trim().toLowerCase();
    var sTitleSlug = sTitle.replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    
    return sId === clean || sLink === clean || sTitle === clean || sTitleSlug === clean || s.id === surveyIdOrSlug || s.link_publico === surveyIdOrSlug;
  });
  
  if (!surveyRaw) {
    throw new Error('Pesquisa não encontrada: ' + surveyIdOrSlug);
  }

  var config = {};
  if (surveyRaw.configuracoes) {
    try {
      config = typeof surveyRaw.configuracoes === 'string' ? JSON.parse(surveyRaw.configuracoes) : surveyRaw.configuracoes;
    } catch(e) {
      config = {};
    }
  }

  var survey = {
    id: surveyRaw.id,
    titulo: surveyRaw.titulo || '',
    descricao: surveyRaw.descricao || '',
    status: surveyRaw.status || 'Rascunho',
    data_criacao: surveyRaw.data_criacao || '',
    data_inicio: surveyRaw.data_inicio || '',
    data_fim: surveyRaw.data_fim || '',
    link_publico: surveyRaw.link_publico || surveyRaw.id,
    configuracoes: config,
    criado_por: surveyRaw.criado_por || ''
  };

  var questionsSheet = getOrCreateSheet(SHEETS.QUESTIONS);
  var questions = getRowsAsObjects(questionsSheet)
    .filter(function(q) { return q.survey_id === survey.id && (q.ativa !== false && q.ativa !== 'FALSE' && q.ativa !== 'false'); })
    .map(function(q) {
      return {
        id: q.id,
        survey_id: q.survey_id,
        ordem: Number(q.ordem) || 1,
        titulo: q.titulo || '',
        descricao: q.descricao || '',
        tipo: q.tipo || 'single_choice',
        obrigatoria: q.obrigatoria === true || q.obrigatoria === 'TRUE' || q.obrigatoria === 'true',
        ativa: true
      };
    })
    .sort(function(a, b) { return a.ordem - b.ordem; });

  var optionsSheet = getOrCreateSheet(SHEETS.OPTIONS);
  var allOptions = getRowsAsObjects(optionsSheet);
  var questionIds = questions.map(function(q) { return q.id; });
  
  var options = allOptions
    .filter(function(opt) { return questionIds.indexOf(opt.question_id) !== -1; })
    .map(function(opt) {
      return {
        id: opt.id,
        question_id: opt.question_id,
        ordem: Number(opt.ordem) || 1,
        texto: opt.texto || '',
        valor: opt.valor || opt.texto || '',
        peso: opt.peso ? Number(opt.peso) : undefined
      };
    })
    .sort(function(a, b) { return a.ordem - b.ordem; });

  return {
    survey: survey,
    questions: questions,
    options: options
  };
}

function getSurveyResponses(surveyId) {
  var respSheet = getOrCreateSheet(SHEETS.RESPONDENTS);
  var respondents = getRowsAsObjects(respSheet).filter(function(r) { return r.survey_id === surveyId; });

  var ansSheet = getOrCreateSheet(SHEETS.ANSWERS);
  var answers = getRowsAsObjects(ansSheet).filter(function(a) { return a.survey_id === surveyId; });

  return {
    respondents: respondents,
    answers: answers
  };
}

function saveNewSurvey(payload) {
  if (!payload || !payload.survey) {
    throw new Error('Dados da pesquisa inválidos');
  }

  var survey = payload.survey;
  var questions = payload.questions || [];
  var options = payload.options || [];

  if (!survey.id || !survey.titulo) {
    throw new Error('ID e Título da pesquisa são obrigatórios');
  }

  var surveysSheet = getOrCreateSheet(SHEETS.SURVEYS);
  surveysSheet.appendRow([
    survey.id,
    survey.titulo,
    survey.descricao || '',
    survey.status || 'Rascunho',
    survey.data_criacao || new Date().toISOString().split('T')[0],
    survey.data_inicio || '',
    survey.data_fim || '',
    survey.link_publico || survey.id,
    JSON.stringify(survey.configuracoes || {}),
    survey.criado_por || 'Admin'
  ]);

  // Gravar Perguntas com IDs únicos garantidos
  if (questions.length > 0) {
    var qSheet = getOrCreateSheet(SHEETS.QUESTIONS);
    var existingQIds = {};
    var qRows = questions.map(function(q, qIdx) {
      var safeQId = q.id;
      // Garantir que cada pergunta tenha ID único mesmo se o payload enviar duplicado
      if (!safeQId || existingQIds[safeQId]) {
        safeQId = 'q_' + survey.id + '_' + (qIdx + 1) + '_' + Utilities.getUuid().substring(0, 4);
      }
      existingQIds[safeQId] = true;
      q.id = safeQId; // atualizar referência para as opções se necessário

      return [
        safeQId, 
        q.survey_id || survey.id, 
        q.ordem || (qIdx + 1), 
        q.titulo, 
        q.descricao || '', 
        q.tipo || 'single_choice', 
        q.obrigatoria ? 'TRUE' : 'FALSE', 
        q.ativa !== false ? 'TRUE' : 'FALSE'
      ];
    });

    var lastQRow = Math.max(1, qSheet.getLastRow());
    qSheet.getRange(lastQRow + 1, 1, qRows.length, qRows[0].length).setValues(qRows);
  }

  // Gravar Opções com IDs únicos garantidos
  if (options.length > 0) {
    var optSheet = getOrCreateSheet(SHEETS.OPTIONS);
    var existingOptIds = {};
    var optRows = options.map(function(opt, optIdx) {
      var safeOptId = opt.id;
      if (!safeOptId || existingOptIds[safeOptId]) {
        safeOptId = 'opt_' + (opt.question_id || survey.id) + '_' + (optIdx + 1) + '_' + Utilities.getUuid().substring(0, 4);
      }
      existingOptIds[safeOptId] = true;

      return [
        safeOptId, 
        opt.question_id, 
        opt.ordem || (optIdx + 1), 
        opt.texto, 
        opt.valor || opt.texto, 
        opt.peso || ''
      ];
    });

    var lastOptRow = Math.max(1, optSheet.getLastRow());
    optSheet.getRange(lastOptRow + 1, 1, optRows.length, optRows[0].length).setValues(optRows);
  }

  logOperation('CREATE_SURVEY', 'Pesquisa criada: ' + survey.titulo + ' (' + survey.id + ') com ' + questions.length + ' perguntas.', 'SUCCESS');
  return { id: survey.id, success: true, survey: survey };
}

function updateSurveyStatus(surveyId, newStatus) {
  var sheet = getOrCreateSheet(SHEETS.SURVEYS);
  var data = sheet.getDataRange().getValues();
  var idCol = 0;
  var statusCol = 3;

  for (var i = 1; i < data.length; i++) {
    if (data[i][idCol] === surveyId) {
      sheet.getRange(i + 1, statusCol + 1).setValue(newStatus);
      logOperation('UPDATE_STATUS', 'Status de ' + surveyId + ' alterado para ' + newStatus, 'SUCCESS');
      return { success: true, id: surveyId, status: newStatus };
    }
  }
  throw new Error('Pesquisa não encontrada no banco de dados: ' + surveyId);
}

function deleteSurveyAndData(surveyId) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // 1. Remover de Surveys
  removeRowsWhereColumnEquals(ss.getSheetByName(SHEETS.SURVEYS), 0, surveyId);
  
  // 2. Remover de Questions
  var qSheet = ss.getSheetByName(SHEETS.QUESTIONS);
  var qData = qSheet ? qSheet.getDataRange().getValues() : [];
  var qIdsToDelete = [];
  for (var i = 1; i < qData.length; i++) {
    if (qData[i][1] === surveyId) {
      qIdsToDelete.push(qData[i][0]);
    }
  }
  removeRowsWhereColumnEquals(qSheet, 1, surveyId);

  // 3. Remover de Options
  var optSheet = ss.getSheetByName(SHEETS.OPTIONS);
  if (optSheet && qIdsToDelete.length > 0) {
    var optData = optSheet.getDataRange().getValues();
    for (var j = optData.length - 1; j >= 1; j--) {
      if (qIdsToDelete.indexOf(optData[j][1]) !== -1) {
        optSheet.deleteRow(j + 1);
      }
    }
  }

  // 4. Remover de Respondents
  removeRowsWhereColumnEquals(ss.getSheetByName(SHEETS.RESPONDENTS), 1, surveyId);

  // 5. Remover de Answers
  removeRowsWhereColumnEquals(ss.getSheetByName(SHEETS.ANSWERS), 1, surveyId);

  logOperation('DELETE_SURVEY', 'Pesquisa e respostas excluídas: ' + surveyId, 'SUCCESS');
  return { success: true, id: surveyId };
}

function removeRowsWhereColumnEquals(sheet, colIndex, value) {
  if (!sheet) return;
  var data = sheet.getDataRange().getValues();
  for (var i = data.length - 1; i >= 1; i--) {
    if (data[i][colIndex] === value) {
      sheet.deleteRow(i + 1);
    }
  }
}

/**
 * Grava a resposta pública de forma segura e atômica.
 */
function recordResponse(payload) {
  if (!payload) throw new Error('Dados de envio vazios');
  
  var surveyId = payload.survey_id;
  var respondent = payload.respondent || {
    nome: payload.nome || payload.respondent_nome,
    identificador: payload.identificador || payload.respondent_email || ''
  };

  // Se vier no formato { respostas: { q1: 'val', q2: ['opt1', 'opt2'] } } do formulário HTML
  var answers = [];
  if (Array.isArray(payload.answers)) {
    answers = payload.answers;
  } else if (payload.respostas && typeof payload.respostas === 'object') {
    Object.keys(payload.respostas).forEach(function(qId) {
      var val = payload.respostas[qId];
      if (Array.isArray(val)) {
        val.forEach(function(item) {
          answers.push({
            question_id: qId,
            option_id: typeof item === 'object' ? item.id : item,
            valor: typeof item === 'object' ? item.valor : item
          });
        });
      } else if (val !== null && val !== undefined && String(val).trim() !== '') {
        answers.push({
          question_id: qId,
          option_id: typeof val === 'object' ? val.id : val,
          valor: typeof val === 'object' ? val.valor : String(val)
        });
      }
    });
  }

  if (!surveyId) throw new Error('survey_id é obrigatório');
  if (!respondent || !respondent.nome || !String(respondent.nome).trim()) {
    throw new Error('O nome do respondente é obrigatório');
  }

  // Validação: Obter a pesquisa usando busca flexível (id, slug, link)
  var targetSurveyData = getFullSurvey(surveyId);
  var targetSurvey = targetSurveyData.survey;

  var isPublished = targetSurvey.status === 'Publicada' || targetSurvey.status === 'published';
  if (!isPublished) {
    throw new Error('Esta pesquisa não está aberta para receber respostas (Status atual: ' + targetSurvey.status + '). Publique a pesquisa no painel de administração.');
  }

  var actualSurveyId = targetSurvey.id;
  var respId = respondent.id || ('resp_' + Utilities.getUuid().substring(0, 8));
  var dateStr = respondent.data_resposta || new Date().toISOString().split('T')[0];
  var hourStr = respondent.hora_resposta || new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  // 1. Gravar respondente
  var respSheet = getOrCreateSheet(SHEETS.RESPONDENTS);
  respSheet.appendRow([
    respId,
    actualSurveyId,
    String(respondent.nome).trim(),
    respondent.identificador ? String(respondent.identificador).trim() : '',
    dateStr,
    hourStr
  ]);

  // 2. Gravar respostas
  if (answers.length > 0) {
    var ansSheet = getOrCreateSheet(SHEETS.ANSWERS);
    var ansRows = answers.map(function(a, aIdx) {
      return [
        a.id || ('ans_' + respId + '_' + (aIdx + 1) + '_' + Utilities.getUuid().substring(0, 4)),
        actualSurveyId,
        respId,
        a.question_id,
        a.option_id || '',
        a.valor || '',
        dateStr
      ];
    });

    var lastAnsRow = Math.max(1, ansSheet.getLastRow());
    ansSheet.getRange(lastAnsRow + 1, 1, ansRows.length, ansRows[0].length).setValues(ansRows);
  }

  logOperation('SUBMIT_RESPONSE', 'Nova resposta registrada por "' + respondent.nome + '" na pesquisa ' + actualSurveyId, 'SUCCESS');
  return { 
    success: true, 
    respondentId: respId,
    message: targetSurvey.configuracoes && targetSurvey.configuracoes.mensagem_conclusao 
      ? targetSurvey.configuracoes.mensagem_conclusao 
      : 'Resposta gravada com sucesso!'
  };
}

// ==========================================
// UTILITÁRIOS INTERNOS
// ==========================================

function getOrCreateSheet(sheetName) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    initDatabase();
    sheet = ss.getSheetByName(sheetName);
  }
  return sheet;
}

function getRowsAsObjects(sheet) {
  if (!sheet) return [];
  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  var headers = data[0];
  var objects = [];
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var hasData = row.some(function(cell) { return cell !== '' && cell !== null && cell !== undefined; });
    if (!hasData) continue;

    var obj = {};
    for (var j = 0; j < headers.length; j++) {
      obj[headers[j]] = row[j];
    }
    objects.push(obj);
  }
  return objects;
}

function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function logOperation(action, details, status) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(SHEETS.LOGS);
    if (sheet) {
      sheet.appendRow([
        Utilities.getUuid().substring(0, 8),
        new Date().toISOString(),
        action,
        details,
        status
      ]);
    }
  } catch(e) {
    // Ignorar erros de log para não interromper a operação principal
  }
}

/**
 * Renderiza o Formulário Web Autônomo (HTML) caso o respondente acesse diretamente pelo Apps Script
 */
function renderStandaloneSurveyHtml(surveyId, e) {
  var cleanId = String(surveyId || '').trim();
  var surveyData = null;
  try {
    surveyData = getFullSurvey(cleanId);
  } catch (err) {
    // ignorar erro e checar surveyData
  }

  if (!surveyData || !surveyData.survey) {
    var notFoundHtml = '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Pesquisa Não Encontrada | PesquisaHub</title><script src="https://cdn.tailwindcss.com"></script><link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700&display=swap" rel="stylesheet"><style>body{font-family:"Plus Jakarta Sans",sans-serif;}</style></head><body class="bg-slate-100 flex items-center justify-center min-h-screen p-4"><div class="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full text-center border border-slate-200"><div class="w-16 h-16 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-4 text-2xl font-bold">⚠️</div><h2 class="text-xl font-bold text-slate-800 mb-2">Pesquisa Não Encontrada</h2><p class="text-slate-500 text-sm mb-6">O código da pesquisa <code>' + cleanId + '</code> não foi localizado ou ainda não foi sincronizado nesta planilha.</p><p class="text-xs text-slate-400">PesquisaHub • Google Sheets Backend</p></div></body></html>';
    return HtmlService.createHtmlOutput(notFoundHtml).setTitle('Pesquisa Não Encontrada').setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  var survey = surveyData.survey;
  var questions = surveyData.questions || [];
  var options = surveyData.options || [];

  var isPublished = survey.status === 'Publicada' || survey.status === 'published';
  if (!isPublished) {
    var closedHtml = '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Pesquisa Indisponível | PesquisaHub</title><script src="https://cdn.tailwindcss.com"></script><link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700&display=swap" rel="stylesheet"><style>body{font-family:"Plus Jakarta Sans",sans-serif;}</style></head><body class="bg-slate-100 flex items-center justify-center min-h-screen p-4"><div class="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full text-center border border-slate-200"><div class="w-16 h-16 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 text-2xl font-bold">🔒</div><h2 class="text-xl font-bold text-slate-800 mb-2">Pesquisa Fechada</h2><p class="text-slate-500 text-sm mb-6">Esta pesquisa está com status <strong>' + survey.status + '</strong> e não está aceitando novas respostas no momento.</p><p class="text-xs text-slate-400">PesquisaHub • Google Sheets Backend</p></div></body></html>';
    return HtmlService.createHtmlOutput(closedHtml).setTitle(survey.titulo || 'Pesquisa').setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  var surveyJsonStr = JSON.stringify({ survey: survey, questions: questions, options: options }).replace(/</g, '\\u003c');

  var html = '<!DOCTYPE html>' +
'<html lang="pt-BR">' +
'<head>' +
'  <meta charset="UTF-8">' +
'  <meta name="viewport" content="width=device-width, initial-scale=1.0">' +
'  <title>' + (survey.titulo || 'Pesquisa') + ' | PesquisaHub</title>' +
'  <script src="https://cdn.tailwindcss.com"></script>' +
'  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">' +
'  <style>' +
'    body { font-family: "Plus Jakarta Sans", sans-serif; }' +
'    .custom-scroll::-webkit-scrollbar { width: 6px; }' +
'    .custom-scroll::-webkit-scrollbar-track { background: transparent; }' +
'    .custom-scroll::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 9999px; }' +
'  </style>' +
'</head>' +
'<body class="bg-slate-100 text-slate-800 min-h-screen py-8 px-4 sm:px-6 flex flex-col justify-between antialiased">' +
'  <div class="max-w-2xl mx-auto w-full">' +
'    <div class="bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-200 overflow-hidden mb-6">' +
'      <!-- Header -->' +
'      <div class="p-6 sm:p-8 bg-gradient-to-br from-blue-600 to-indigo-700 text-white">' +
'        <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 text-xs font-semibold backdrop-blur-xs mb-3">' +
'          <span>✓ Pesquisa Oficial</span>' +
'        </div>' +
'        <h1 class="text-2xl sm:text-3xl font-extrabold tracking-tight">' + (survey.titulo || 'Pesquisa') + '</h1>' +
'        ' + (survey.descricao ? '<p class="mt-2 text-blue-100 text-sm leading-relaxed">' + survey.descricao + '</p>' : '') +
'      </div>' +
'      ' +
'      <!-- Form -->' +
'      <form id="surveyForm" onsubmit="submitForm(event)" class="p-6 sm:p-8 space-y-8">' +
'        <!-- Identificação do Respondente -->' +
'        <div class="bg-slate-50 p-5 rounded-2xl border border-slate-200/80 space-y-4">' +
'          <h3 class="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">' +
'            <span>Sua Identificação</span>' +
'          </h3>' +
'          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">' +
'            <div>' +
'              <label class="block text-xs font-bold text-slate-700 mb-1">Seu Nome <span class="text-red-500">*</span></label>' +
'              <input type="text" id="resp_nome" required placeholder="Digite seu nome completo" class="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all">' +
'            </div>' +
'            <div>' +
'              <label class="block text-xs font-bold text-slate-700 mb-1">E-mail ou Contato <span class="text-slate-400 font-normal">(opcional)</span></label>' +
'              <input type="text" id="resp_identificador" placeholder="ex: seuemail@exemplo.com" class="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all">' +
'            </div>' +
'          </div>' +
'        </div>' +
'        ' +
'        <!-- Questions Container -->' +
'        <div id="questionsContainer" class="space-y-6"></div>' +
'        ' +
'        <!-- Submit Button -->' +
'        <div class="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">' +
'          <div class="text-xs text-slate-400 flex items-center gap-1.5">' +
'            <span>🔒 Respostas gravadas com segurança no Google Sheets</span>' +
'          </div>' +
'          <button type="submit" id="btnSubmit" class="w-full sm:w-auto px-8 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-2xl shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 active:scale-98 transition-all flex items-center justify-center gap-2">' +
'            <span>Enviar Respostas</span>' +
'            <span>➔</span>' +
'          </button>' +
'        </div>' +
'      </form>' +
'      ' +
'      <!-- Success Screen (Hidden by default) -->' +
'      <div id="successScreen" class="hidden p-8 sm:p-12 text-center space-y-4">' +
'        <div class="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-3xl flex items-center justify-center mx-auto text-4xl shadow-inner animate-bounce">' +
'          ✓' +
'        </div>' +
'        <h2 class="text-2xl font-bold text-slate-900">Obrigado pela sua resposta!</h2>' +
'        <p id="successMessage" class="text-slate-600 text-sm max-w-md mx-auto leading-relaxed">' +
'          ' + (survey.configuracoes && survey.configuracoes.mensagem_conclusao ? survey.configuracoes.mensagem_conclusao : 'Sua resposta foi gravada com sucesso no sistema.') +
'        </p>' +
'        <div class="pt-6">' +
'          <button onclick="window.location.reload()" class="px-6 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-all">' +
'            Responder Novamente' +
'          </button>' +
'        </div>' +
'      </div>' +
'    </div>' +
'  </div>' +
'  ' +
'  <script>' +
'    var surveyData = ' + surveyJsonStr + ';' +
'    var container = document.getElementById("questionsContainer");' +
'    ' +
'    function renderQuestions() {' +
'      if (!surveyData.questions || surveyData.questions.length === 0) {' +
'        container.innerHTML = "<p class=\'text-slate-400 text-sm text-center py-6\'>Nenhuma pergunta configurada nesta pesquisa.</p>";' +
'        return;' +
'      }' +
'      ' +
'      surveyData.questions.forEach(function(q, idx) {' +
'        var qOpts = surveyData.options.filter(function(o) { return o.question_id === q.id; });' +
'        var div = document.createElement("div");' +
'        div.className = "bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-3";' +
'        ' +
'        var header = "<div class=\'flex items-start gap-2.5\'>" +' +
'          "<span class=\'w-6 h-6 rounded-lg bg-blue-50 text-blue-600 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5\'>" + (idx + 1) + "</span>" +' +
'          "<div class=\'flex-1\'>" +' +
'            "<h4 class=\'text-sm font-bold text-slate-900\'>" + (q.titulo || "Pergunta") + (q.obrigatoria ? " <span class=\'text-red-500\'>*</span>" : "") + "</h4>" +' +
'            (q.descricao ? "<p class=\'text-xs text-slate-500 mt-0.5\'>" + q.descricao + "</p>" : "") +' +
'          "</div>" +' +
'        "</div>";' +
'        ' +
'        var body = "";' +
'        var reqAttr = q.obrigatoria ? "required" : "";' +
'        var qType = String(q.tipo || "text").toLowerCase();' +
'        ' +
'        if (qType === "single_choice" || qType === "multipla_escolha" || qType === "escolha_unica") {' +
'          body = "<div class=\'space-y-2.5 pt-1\'>";' +
'          qOpts.forEach(function(opt) {' +
'            body += "<label class=\'flex items-center gap-3.5 p-3.5 rounded-2xl border border-slate-200 hover:border-blue-400 hover:bg-blue-50/50 cursor-pointer transition-all group\'>" +' +
'              "<input type=\'radio\' name=\'q_" + q.id + "\' value=\'" + opt.id + "\' data-text=\'" + (opt.texto || "") + "\' " + reqAttr + " class=\'w-4 h-4 text-blue-600 focus:ring-blue-500\'>" +' +
'              "<span class=\'text-sm font-medium text-slate-700 group-hover:text-slate-900\'>" + (opt.texto || "Opção") + "</span>" +' +
'            "</label>";' +
'          });' +
'          body += "</div>";' +
'        } else if (qType === "multiple_choice" || qType === "caixa_verificacao") {' +
'          body = "<div class=\'space-y-2.5 pt-1\'>";' +
'          qOpts.forEach(function(opt) {' +
'            body += "<label class=\'flex items-center gap-3.5 p-3.5 rounded-2xl border border-slate-200 hover:border-blue-400 hover:bg-blue-50/50 cursor-pointer transition-all group\'>" +' +
'              "<input type=\'checkbox\' name=\'q_" + q.id + "\' value=\'" + opt.id + "\' data-text=\'" + (opt.texto || "") + "\' class=\'w-4 h-4 text-blue-600 rounded focus:ring-blue-500\'>" +' +
'              "<span class=\'text-sm font-medium text-slate-700 group-hover:text-slate-900\'>" + (opt.texto || "Opção") + "</span>" +' +
'            "</label>";' +
'          });' +
'          body += "</div>";' +
'        } else if (qType === "rating" || qType === "avaliacao" || qType === "escala" || qType === "scale") {' +
'          body = "<div class=\'space-y-2 pt-2\'><div class=\'flex flex-wrap gap-2.5\'>";' +
'          for (var i = 1; i <= 5; i++) {' +
'            body += "<label class=\'flex-1 min-w-[55px] py-3 border border-slate-200 rounded-2xl flex flex-col items-center justify-center cursor-pointer hover:bg-blue-50 hover:border-blue-300 transition-all\'>" +' +
'              "<input type=\'radio\' name=\'q_" + q.id + "\' value=\'" + i + "\' " + reqAttr + " class=\'sr-only peer\'>" +' +
'              "<span class=\'text-sm font-bold text-slate-700 peer-checked:text-blue-600\'>" + i + " ★</span>" +' +
'            "</label>";' +
'          }' +
'          body += "</div><div class=\'flex justify-between text-[11px] text-slate-400 font-semibold px-1\'><span>1 - Muito Baixo / Insatisfeito</span><span>5 - Excelente / Satisfeito</span></div></div>";' +
'        } else if (qType === "nps") {' +
'          body = "<div class=\'space-y-2 pt-1\'><div class=\'grid grid-cols-6 sm:grid-cols-11 gap-1.5\'>";' +
'          for (var n = 0; n <= 10; n++) {' +
'            body += "<label class=\'py-2.5 border border-slate-200 rounded-xl flex items-center justify-center cursor-pointer hover:bg-blue-50 hover:border-blue-300 transition-all\'>" +' +
'              "<input type=\'radio\' name=\'q_" + q.id + "\' value=\'" + n + "\' " + reqAttr + " class=\'sr-only peer\'>" +' +
'              "<span class=\'text-xs font-bold text-slate-700 peer-checked:text-blue-600\'>" + n + "</span>" +' +
'            "</label>";' +
'          }' +
'          body += "</div><div class=\'flex justify-between text-[10px] text-slate-400 font-semibold px-1\'><span>0 - Nada provável</span><span>10 - Extremamente provável</span></div></div>";' +
'        } else if (qType === "long_text" || qType === "paragrafo" || qType === "texto_longo") {' +
'          body = "<textarea name=\'q_" + q.id + "\' rows=\'4\' " + reqAttr + " placeholder=\'Sua resposta detalhada...\' class=\'w-full bg-slate-50 border border-slate-200 rounded-2xl p-3.5 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all\'></textarea>";' +
'        } else {' +
'          body = "<input type=\'text\' name=\'q_" + q.id + "\' " + reqAttr + " placeholder=\'Sua resposta...\' class=\'w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all\'>";' +
'        }' +
'        ' +
'        div.innerHTML = header + body;' +
'        container.appendChild(div);' +
'      });' +
'    }' +
'    renderQuestions();' +
'    ' +
'    function submitForm(e) {' +
'      e.preventDefault();' +
'      var btn = document.getElementById("btnSubmit");' +
'      btn.disabled = true;' +
'      btn.innerHTML = "<span class=\'animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full\'></span><span>Gravando...</span>";' +
'      ' +
'      var nome = document.getElementById("resp_nome").value;' +
'      var identificador = document.getElementById("resp_identificador").value;' +
'      ' +
'      var answersMap = {};' +
'      surveyData.questions.forEach(function(q) {' +
'        var inputs = document.querySelectorAll("[name=\'q_" + q.id + "\']");' +
'        if (inputs.length > 0) {' +
'          if (inputs[0].type === "radio") {' +
'            inputs.forEach(function(r) { if (r.checked) answersMap[q.id] = r.value; });' +
'          } else if (inputs[0].type === "checkbox") {' +
'            var selected = [];' +
'            inputs.forEach(function(cb) { if (cb.checked) selected.push(cb.value); });' +
'            if (selected.length > 0) answersMap[q.id] = selected;' +
'          } else {' +
'            answersMap[q.id] = inputs[0].value;' +
'          }' +
'        }' +
'      });' +
'      ' +
'      var payload = {' +
'        action: "submitResponse",' +
'        payload: {' +
'          survey_id: surveyData.survey.id,' +
'          nome: nome,' +
'          identificador: identificador,' +
'          respostas: answersMap' +
'        }' +
'      };' +
'      ' +
'      fetch(window.location.href.split("?")[0], {' +
'        method: "POST",' +
'        headers: { "Content-Type": "text/plain;charset=utf-8" },' +
'        body: JSON.stringify(payload)' +
'      })' +
'      .then(function(res) { return res.json(); })' +
'      .then(function(result) {' +
'        if (result.success || result.status === "ok") {' +
'          document.getElementById("surveyForm").classList.add("hidden");' +
'          document.getElementById("successScreen").classList.remove("hidden");' +
'          if (result.message) {' +
'            document.getElementById("successMessage").textContent = result.message;' +
'          }' +
'        } else {' +
'          alert("Erro ao gravar resposta: " + (result.message || "Erro desconhecido"));' +
'          btn.disabled = false;' +
'          btn.innerHTML = "<span>Enviar Respostas</span><span>➔</span>";' +
'        }' +
'      })' +
'      .catch(function(err) {' +
'        alert("Falha na comunicação: " + err.message);' +
'        btn.disabled = false;' +
'        btn.innerHTML = "<span>Enviar Respostas</span><span>➔</span>";' +
'      });' +
'    }' +
'  </script>' +
'</body>' +
'</html>';

  return HtmlService.createHtmlOutput(html)
    .setTitle((survey.titulo || 'Pesquisa') + ' | PesquisaHub')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
`;
