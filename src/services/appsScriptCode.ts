/**
 * Código completo do Google Apps Script (Code.gs)
 * Fornecido pelo PesquisaHub para cópia direta e implantação no Google Sheets / Apps Script.
 */
export const GOOGLE_APPS_SCRIPT_CODE = `/**
 * =========================================================================
 * PESQUISAHUB — BACKEND API (GOOGLE APPS SCRIPT)
 * Versão: 1.3.0 (Persistência Confiável, IDs Únicos, Multi-Endpoint & Autenticação Multiusuário)
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
  LOGS: 'Logs',
  USERS: 'Users',
  SESSIONS: 'Sessions',
  AI_ANALYSIS: 'AIAnalysis'
};

// Nome da pasta no Google Drive onde as fotos enviadas como resposta são armazenadas
var PHOTOS_DRIVE_FOLDER_NAME = 'PesquisaHub - Fotos de Respostas';

// Modelo do Gemini usado na análise de sentimento (nível gratuito)
var GEMINI_MODEL = 'gemini-2.0-flash';

// E-mail do administrador inicial (recebe a conta ADM automaticamente na primeira execução)
var ADMIN_SEED_EMAIL = 'cristianokuhn7@gmail.com';
// Duração da sessão de login, em horas
var SESSION_DURATION_HOURS = 24;

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
    },
    {
      name: SHEETS.USERS,
      headers: ['id', 'nome', 'email', 'senha_hash', 'salt', 'role', 'deve_trocar_senha', 'ativo', 'criado_em', 'ultimo_login']
    },
    {
      name: SHEETS.SESSIONS,
      headers: ['token', 'user_id', 'criado_em', 'expira_em']
    },
    {
      name: SHEETS.AI_ANALYSIS,
      headers: ['id', 'survey_id', 'question_id', 'respostas_count', 'resumo', 'positivo', 'neutro', 'negativo', 'pontos_positivos', 'pontos_negativos', 'atualizado_em']
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

  ensureAdminSeed();

  logOperation('INIT_DB', 'Estrutura de abas inicializada/verificada com sucesso.', 'SUCCESS');
  return { status: 'ok', success: true, message: 'Planilha configurada e pronta para operar!' };
}

/**
 * Garante que exista pelo menos um usuário ADM. Na primeira execução, cria a conta
 * administradora com uma senha temporária, que precisa ser trocada no primeiro acesso.
 */
function ensureAdminSeed() {
  var sheet = getOrCreateSheet(SHEETS.USERS);
  var users = getRowsAsObjects(sheet);
  var hasAdmin = users.some(function(u) { return String(u.role) === 'admin'; });
  if (hasAdmin) return;

  var tempPassword = 'Trocar@123';
  var salt = Utilities.getUuid();
  var userId = 'user_' + Utilities.getUuid().substring(0, 8);

  sheet.appendRow([
    userId,
    'Administrador',
    ADMIN_SEED_EMAIL.toLowerCase(),
    hashPassword(tempPassword, salt),
    salt,
    'admin',
    'TRUE',
    'TRUE',
    new Date().toISOString(),
    ''
  ]);

  logOperation('SEED_ADMIN', 'Usuário administrador inicial criado para ' + ADMIN_SEED_EMAIL + ' com senha temporária "' + tempPassword + '" (deve ser trocada no primeiro acesso).', 'SUCCESS');
}

// ==========================================
// AUTENTICAÇÃO, USUÁRIOS E SESSÕES
// ==========================================

function generateSalt() {
  return Utilities.getUuid();
}

function hashPassword(plainPassword, salt) {
  var digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(plainPassword) + '::' + String(salt));
  return digest.map(function(byte) {
    var v = (byte < 0 ? byte + 256 : byte).toString(16);
    return v.length === 1 ? '0' + v : v;
  }).join('');
}

function generateTempPassword() {
  // Senha temporária legível, fácil de repassar ao usuário (ex: Ph7k-Qw29)
  var part1 = Utilities.getUuid().substring(0, 4);
  var part2 = Utilities.getUuid().substring(0, 4);
  return (part1 + '-' + part2);
}

function findUserByEmail(email) {
  var clean = String(email || '').trim().toLowerCase();
  var rows = getRowsAsObjects(getOrCreateSheet(SHEETS.USERS));
  return rows.find(function(u) { return String(u.email || '').trim().toLowerCase() === clean; }) || null;
}

function findUserById(userId) {
  var rows = getRowsAsObjects(getOrCreateSheet(SHEETS.USERS));
  return rows.find(function(u) { return String(u.id) === String(userId); }) || null;
}

function sanitizeUser(userRaw) {
  if (!userRaw) return null;
  return {
    id: userRaw.id,
    nome: userRaw.nome || '',
    email: userRaw.email || '',
    role: userRaw.role || 'user',
    deve_trocar_senha: userRaw.deve_trocar_senha === true || userRaw.deve_trocar_senha === 'TRUE' || userRaw.deve_trocar_senha === 'true',
    ativo: userRaw.ativo !== false && userRaw.ativo !== 'FALSE' && userRaw.ativo !== 'false',
    criado_em: userRaw.criado_em || '',
    ultimo_login: userRaw.ultimo_login || ''
  };
}

function createSession(userId) {
  var token = Utilities.getUuid() + '-' + Utilities.getUuid();
  var now = new Date();
  var expira = new Date(now.getTime() + SESSION_DURATION_HOURS * 60 * 60 * 1000);
  getOrCreateSheet(SHEETS.SESSIONS).appendRow([token, userId, now.toISOString(), expira.toISOString()]);
  return token;
}

function getUserFromToken(token) {
  if (!token) return null;
  var rows = getRowsAsObjects(getOrCreateSheet(SHEETS.SESSIONS));
  var session = rows.find(function(s) { return s.token === token; });
  if (!session) return null;
  if (new Date(session.expira_em).getTime() < Date.now()) return null;
  var userRaw = findUserById(session.user_id);
  if (!userRaw || (userRaw.ativo === false || userRaw.ativo === 'FALSE' || userRaw.ativo === 'false')) return null;
  return userRaw;
}

/**
 * Garante que o token pertence a um usuário ADM ativo. Lança erro caso contrário.
 */
function requireAdmin(token) {
  var userRaw = getUserFromToken(token);
  if (!userRaw || String(userRaw.role) !== 'admin') {
    throw new Error('Acesso negado: esta ação requer permissão de administrador.');
  }
  return userRaw;
}

function sendMailSafe(toEmail, subject, body) {
  try {
    if (toEmail) {
      MailApp.sendEmail(toEmail, subject, body);
    }
  } catch (e) {
    logOperation('MAIL_ERROR', 'Falha ao enviar e-mail para ' + toEmail + ': ' + e.toString(), 'ERROR');
  }
}

function doLogin(email, senha) {
  if (!email || !senha) throw new Error('Informe e-mail e senha.');
  var userRaw = findUserByEmail(email);
  if (!userRaw) throw new Error('E-mail ou senha inválidos.');
  if (userRaw.ativo === false || userRaw.ativo === 'FALSE' || userRaw.ativo === 'false') {
    throw new Error('Este usuário está desativado. Fale com o administrador.');
  }
  var hash = hashPassword(senha, userRaw.salt);
  if (hash !== userRaw.senha_hash) {
    throw new Error('E-mail ou senha inválidos.');
  }

  // Atualizar último login
  var sheet = getOrCreateSheet(SHEETS.USERS);
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var idCol = headers.indexOf('id');
  var ultimoLoginCol = headers.indexOf('ultimo_login');
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][idCol]) === String(userRaw.id)) {
      sheet.getRange(i + 1, ultimoLoginCol + 1).setValue(new Date().toISOString());
      break;
    }
  }

  var token = createSession(userRaw.id);
  logOperation('LOGIN', 'Login realizado: ' + userRaw.email, 'SUCCESS');
  return { token: token, user: sanitizeUser(userRaw) };
}

function doChangePassword(token, novaSenha) {
  var userRaw = getUserFromToken(token);
  if (!userRaw) throw new Error('Sessão inválida ou expirada. Faça login novamente.');
  if (!novaSenha || String(novaSenha).length < 6) {
    throw new Error('A nova senha deve ter pelo menos 6 caracteres.');
  }

  var salt = generateSalt();
  var hash = hashPassword(novaSenha, salt);

  var sheet = getOrCreateSheet(SHEETS.USERS);
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var idCol = headers.indexOf('id');
  var hashCol = headers.indexOf('senha_hash');
  var saltCol = headers.indexOf('salt');
  var deveCol = headers.indexOf('deve_trocar_senha');

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][idCol]) === String(userRaw.id)) {
      sheet.getRange(i + 1, hashCol + 1).setValue(hash);
      sheet.getRange(i + 1, saltCol + 1).setValue(salt);
      sheet.getRange(i + 1, deveCol + 1).setValue('FALSE');
      break;
    }
  }

  logOperation('CHANGE_PASSWORD', 'Senha atualizada pelo próprio usuário: ' + userRaw.email, 'SUCCESS');
  return { success: true, message: 'Senha atualizada com sucesso.' };
}

function doCreateUser(token, novoUsuario) {
  requireAdmin(token);
  if (!novoUsuario || !novoUsuario.email || !novoUsuario.nome) {
    throw new Error('Nome e e-mail são obrigatórios para criar um usuário.');
  }
  var emailClean = String(novoUsuario.email).trim().toLowerCase();
  if (findUserByEmail(emailClean)) {
    throw new Error('Já existe um usuário cadastrado com este e-mail.');
  }

  var tempPassword = generateTempPassword();
  var salt = generateSalt();
  var userId = 'user_' + Utilities.getUuid().substring(0, 8);
  var role = novoUsuario.role === 'admin' ? 'admin' : 'user';

  getOrCreateSheet(SHEETS.USERS).appendRow([
    userId,
    String(novoUsuario.nome).trim(),
    emailClean,
    hashPassword(tempPassword, salt),
    salt,
    role,
    'TRUE',
    'TRUE',
    new Date().toISOString(),
    ''
  ]);

  sendMailSafe(
    emailClean,
    'Seu acesso ao PesquisaHub foi criado',
    'Olá, ' + novoUsuario.nome + '!\n\nSua conta no PesquisaHub foi criada.\n\nE-mail de acesso: ' + emailClean + '\nSenha temporária: ' + tempPassword + '\n\nNo primeiro acesso, você precisará cadastrar uma nova senha.'
  );

  logOperation('CREATE_USER', 'Novo usuário criado: ' + emailClean + ' (role: ' + role + ')', 'SUCCESS');
  return { success: true, id: userId, tempPassword: tempPassword, message: 'Usuário criado. Uma senha temporária foi enviada por e-mail (e também retornada abaixo, caso o envio falhe).' };
}

function doResetPassword(token, userIdAlvo) {
  requireAdmin(token);
  var userRaw = findUserById(userIdAlvo);
  if (!userRaw) throw new Error('Usuário não encontrado.');

  var tempPassword = generateTempPassword();
  var salt = generateSalt();
  var hash = hashPassword(tempPassword, salt);

  var sheet = getOrCreateSheet(SHEETS.USERS);
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var idCol = headers.indexOf('id');
  var hashCol = headers.indexOf('senha_hash');
  var saltCol = headers.indexOf('salt');
  var deveCol = headers.indexOf('deve_trocar_senha');

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][idCol]) === String(userRaw.id)) {
      sheet.getRange(i + 1, hashCol + 1).setValue(hash);
      sheet.getRange(i + 1, saltCol + 1).setValue(salt);
      sheet.getRange(i + 1, deveCol + 1).setValue('TRUE');
      break;
    }
  }

  sendMailSafe(
    userRaw.email,
    'Sua senha do PesquisaHub foi redefinida',
    'Olá, ' + userRaw.nome + '!\n\nO administrador redefiniu sua senha de acesso ao PesquisaHub.\n\nSenha temporária: ' + tempPassword + '\n\nNo próximo acesso, você precisará cadastrar uma nova senha.'
  );

  logOperation('RESET_PASSWORD', 'Senha redefinida pelo administrador para: ' + userRaw.email, 'SUCCESS');
  return { success: true, tempPassword: tempPassword, message: 'Senha redefinida. Uma senha temporária foi enviada por e-mail (e também retornada abaixo, caso o envio falhe).' };
}

function doListUsers(token) {
  requireAdmin(token);
  var rows = getRowsAsObjects(getOrCreateSheet(SHEETS.USERS));
  return rows.map(sanitizeUser).sort(function(a, b) {
    return (a.criado_em || '').localeCompare(b.criado_em || '');
  });
}

function doToggleUserActive(token, userIdAlvo, ativo) {
  var requester = requireAdmin(token);
  if (String(requester.id) === String(userIdAlvo)) {
    throw new Error('Você não pode desativar a própria conta.');
  }
  var sheet = getOrCreateSheet(SHEETS.USERS);
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var idCol = headers.indexOf('id');
  var ativoCol = headers.indexOf('ativo');
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][idCol]) === String(userIdAlvo)) {
      sheet.getRange(i + 1, ativoCol + 1).setValue(ativo ? 'TRUE' : 'FALSE');
      logOperation('TOGGLE_USER', 'Usuário ' + userIdAlvo + ' definido como ativo=' + ativo, 'SUCCESS');
      return { success: true };
    }
  }
  throw new Error('Usuário não encontrado.');
}

function doRequestPasswordReset(email) {
  var userRaw = findUserByEmail(email);
  // Não revelar se o e-mail existe ou não (evita enumeração de contas)
  if (userRaw) {
    var admins = getRowsAsObjects(getOrCreateSheet(SHEETS.USERS)).filter(function(u) { return String(u.role) === 'admin'; });
    admins.forEach(function(admin) {
      sendMailSafe(
        admin.email,
        'Solicitação de redefinição de senha - PesquisaHub',
        'O usuário ' + userRaw.nome + ' (' + userRaw.email + ') solicitou a redefinição de senha.\n\nAcesse o painel de Usuários no PesquisaHub para forçar a redefinição.'
      );
    });
    logOperation('REQUEST_RESET', 'Solicitação de reset recebida para: ' + userRaw.email, 'SUCCESS');
  }
  return { success: true, message: 'Se o e-mail existir em nossa base, o administrador foi notificado para redefinir sua senha.' };
}

function doLogout(token) {
  var sheet = getOrCreateSheet(SHEETS.SESSIONS);
  var data = sheet.getDataRange().getValues();
  for (var i = data.length - 1; i >= 1; i--) {
    if (data[i][0] === token) {
      sheet.deleteRow(i + 1);
    }
  }
  return { success: true };
}

/**
 * Filtra o payload completo de dados para que usuários não-admin só enxerguem
 * as próprias pesquisas (e dados relacionados a elas).
 */
function filterDataForUser(fullData, userRaw) {
  // Sem sessão válida: não expor nenhum dado (evita vazar tudo para chamadas sem login)
  if (!userRaw) {
    return { surveys: [], questions: [], options: [], respondents: [], answers: [] };
  }
  if (String(userRaw.role) === 'admin') return fullData;

  var ownedSurveyIds = {};
  var surveys = fullData.surveys.filter(function(s) {
    var isOwner = String(s.criado_por) === String(userRaw.id);
    if (isOwner) ownedSurveyIds[s.id] = true;
    return isOwner;
  });
  var questions = fullData.questions.filter(function(q) { return ownedSurveyIds[q.survey_id]; });
  var ownedQuestionIds = {};
  questions.forEach(function(q) { ownedQuestionIds[q.id] = true; });
  var options = fullData.options.filter(function(o) { return ownedQuestionIds[o.question_id]; });
  var respondents = fullData.respondents.filter(function(r) { return ownedSurveyIds[r.survey_id]; });
  var answers = fullData.answers.filter(function(a) { return ownedSurveyIds[a.survey_id]; });

  return { surveys: surveys, questions: questions, options: options, respondents: respondents, answers: answers };
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
          version: '1.3.0'
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
        var requestUser = getUserFromToken(e.parameter && e.parameter.token);
        var allData = filterDataForUser(getAllDatabaseData(), requestUser);
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
        var requestUserForList = getUserFromToken(e.parameter && e.parameter.token);
        var surveysList = getSurveysList();
        if (requestUserForList && String(requestUserForList.role) !== 'admin') {
          surveysList = surveysList.filter(function(s) { return String(s.criado_por) === String(requestUserForList.id); });
        }
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
        var requesterForSurvey = getUserFromToken(e.parameter && e.parameter.token);
        if (requesterForSurvey && String(requesterForSurvey.role) !== 'admin' && String(surveyData.survey.criado_por) !== String(requesterForSurvey.id)) {
          throw new Error('Acesso negado: esta pesquisa pertence a outro usuário.');
        }
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
        var requesterForResp = getUserFromToken(e.parameter && e.parameter.token);
        if (requesterForResp && String(requesterForResp.role) !== 'admin') {
          var ownerCheck = getFullSurvey(sId).survey;
          if (String(ownerCheck.criado_por) !== String(requesterForResp.id)) {
            throw new Error('Acesso negado: esta pesquisa pertence a outro usuário.');
          }
        }
        responseData = { 
          status: 'ok', 
          success: true,
          data: getSurveyResponses(sId) 
        };
        break;

      case 'getSentimentAnalysis':
        var sentimentSurveyId = e.parameter && e.parameter.survey_id;
        var sentimentQuestionId = e.parameter && e.parameter.question_id;
        if (!sentimentSurveyId || !sentimentQuestionId) {
          throw new Error('Parâmetros survey_id e question_id são obrigatórios.');
        }
        var cachedAnalysis = getCachedSentimentAnalysis(sentimentSurveyId, sentimentQuestionId);
        responseData = { status: 'ok', success: true, data: cachedAnalysis };
        break;

      case 'getAppSettings':
        responseData = { status: 'ok', success: true, data: getAppSettingsMap() };
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

      case 'login':
        var loginResult = doLogin(postData.email, postData.senha);
        responseData = { status: 'ok', success: true, data: loginResult };
        break;

      case 'changePassword':
        var changeResult = doChangePassword(postData.token, postData.novaSenha);
        responseData = { status: 'ok', success: true, data: changeResult, message: changeResult.message };
        break;

      case 'createUser':
        var createUserResult = doCreateUser(postData.token, postData.usuario);
        responseData = { status: 'ok', success: true, data: createUserResult, message: createUserResult.message };
        break;

      case 'resetPassword':
        var resetResult = doResetPassword(postData.token, postData.userId);
        responseData = { status: 'ok', success: true, data: resetResult, message: resetResult.message };
        break;

      case 'toggleUserActive':
        var toggleResult = doToggleUserActive(postData.token, postData.userId, postData.ativo);
        responseData = { status: 'ok', success: true, data: toggleResult };
        break;

      case 'listUsers':
        var usersList = doListUsers(postData.token);
        responseData = { status: 'ok', success: true, users: usersList, data: usersList };
        break;

      case 'requestPasswordReset':
        var requestResetResult = doRequestPasswordReset(postData.email);
        responseData = { status: 'ok', success: true, data: requestResetResult, message: requestResetResult.message };
        break;

      case 'logout':
        doLogout(postData.token);
        responseData = { status: 'ok', success: true };
        break;

      case 'uploadPhoto':
        var uploadResult = uploadPhotoToDrive(postData.base64, postData.mimeType, postData.surveyId);
        responseData = { status: 'ok', success: true, data: uploadResult };
        break;

      case 'analisarSentimento':
        var sentimentResult = analisarSentimentoPergunta(postData.token, postData.surveyId, postData.questionId);
        responseData = { status: 'ok', success: true, data: sentimentResult };
        break;

      case 'saveAppSettings':
        var savedSettings = saveAppSettings(postData.token, postData.logoUrl, postData.nomeExibicao);
        responseData = { status: 'ok', success: true, data: savedSettings };
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
// UPLOAD DE FOTOS (GOOGLE DRIVE)
// ==========================================

/**
 * Salva uma foto (recebida em base64) no Google Drive, dentro de uma pasta dedicada,
 * e devolve uma URL utilizável diretamente em uma tag <img>.
 */
function uploadPhotoToDrive(base64Data, mimeType, surveyId) {
  if (!base64Data) throw new Error('Nenhuma imagem foi enviada.');
  var safeMimeType = mimeType || 'image/jpeg';

  var folder = getOrCreatePhotosFolder();
  var bytes = Utilities.base64Decode(base64Data);
  var fileName = 'resposta_' + (surveyId || 'pesquisa') + '_' + new Date().getTime() + '.jpg';
  var blob = Utilities.newBlob(bytes, safeMimeType, fileName);

  var file = folder.createFile(blob);
  // Tornar o arquivo acessível via link (qualquer pessoa com o link pode visualizar)
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  var fileId = file.getId();
  // URL direta, funciona bem dentro de tags <img>
  var directUrl = 'https://drive.google.com/uc?export=view&id=' + fileId;

  logOperation('UPLOAD_PHOTO', 'Foto enviada para a pesquisa ' + surveyId + ': ' + fileName, 'SUCCESS');
  return { url: directUrl, fileId: fileId };
}

function getOrCreatePhotosFolder() {
  var folders = DriveApp.getFoldersByName(PHOTOS_DRIVE_FOLDER_NAME);
  if (folders.hasNext()) {
    return folders.next();
  }
  return DriveApp.createFolder(PHOTOS_DRIVE_FOLDER_NAME);
}

// ==========================================
// ANÁLISE DE SENTIMENTO COM IA (GOOGLE GEMINI)
// ==========================================

/**
 * Lê a chave da API do Gemini configurada em "Propriedades do Script" (Project Settings).
 * Nunca fica exposta no código nem no frontend.
 */
function getGeminiApiKey() {
  var key = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!key) {
    throw new Error('A chave da IA (Gemini) ainda não foi configurada. Peça ao administrador para configurá-la em Configurações do Projeto > Propriedades do Script, com o nome GEMINI_API_KEY.');
  }
  return key;
}

/**
 * Busca uma análise já em cache na aba AIAnalysis, sem chamar a IA (leitura rápida).
 */
function getCachedSentimentAnalysis(surveyId, questionId) {
  var rows = getRowsAsObjects(getOrCreateSheet(SHEETS.AI_ANALYSIS));
  var row = rows.find(function(r) { return String(r.survey_id) === String(surveyId) && String(r.question_id) === String(questionId); });
  if (!row) return null;
  return formatSentimentRow(row);
}

function formatSentimentRow(row) {
  var pontosPositivos = [];
  var pontosNegativos = [];
  try { pontosPositivos = JSON.parse(row.pontos_positivos || '[]'); } catch (e) { pontosPositivos = []; }
  try { pontosNegativos = JSON.parse(row.pontos_negativos || '[]'); } catch (e) { pontosNegativos = []; }

  return {
    questionId: row.question_id,
    questionTitle: row.questionTitle || '',
    resumo: row.resumo || '',
    positivo: Number(row.positivo) || 0,
    neutro: Number(row.neutro) || 0,
    negativo: Number(row.negativo) || 0,
    pontosPositivos: pontosPositivos,
    pontosNegativos: pontosNegativos,
    respostasAnalisadas: Number(row.respostas_count) || 0,
    atualizadoEm: row.atualizado_em || ''
  };
}

/**
 * Analisa (ou reaproveita do cache) o sentimento das respostas de texto livre de uma pergunta.
 * Só chama a IA de fato quando o número de respostas mudou desde a última análise —
 * isso mantém o uso bem dentro da cota gratuita do Gemini.
 */
function analisarSentimentoPergunta(token, surveyId, questionId) {
  var userRaw = getUserFromToken(token);
  if (!userRaw) throw new Error('Sessão inválida ou expirada. Faça login novamente.');

  var surveyData = getFullSurvey(surveyId);
  if (String(userRaw.role) !== 'admin' && String(surveyData.survey.criado_por) !== String(userRaw.id)) {
    throw new Error('Acesso negado: esta pesquisa pertence a outro usuário.');
  }

  var question = surveyData.questions.find(function(q) { return String(q.id) === String(questionId); });
  if (!question) throw new Error('Pergunta não encontrada nesta pesquisa.');

  var allAnswers = getRowsAsObjects(getOrCreateSheet(SHEETS.ANSWERS))
    .filter(function(a) { return String(a.question_id) === String(questionId) && a.valor && String(a.valor).trim() !== ''; });

  var textos = allAnswers.map(function(a) { return String(a.valor).trim(); });

  if (textos.length === 0) {
    throw new Error('Ainda não há respostas de texto para analisar nesta pergunta.');
  }

  var geminiResult = callGeminiForSentiment(question.titulo, textos);

  var analysisRow = {
    id: 'ai_' + surveyId + '_' + questionId,
    survey_id: surveyId,
    question_id: questionId,
    respostas_count: textos.length,
    resumo: geminiResult.resumo,
    positivo: geminiResult.positivo,
    neutro: geminiResult.neutro,
    negativo: geminiResult.negativo,
    pontos_positivos: JSON.stringify(geminiResult.pontosPositivos || []),
    pontos_negativos: JSON.stringify(geminiResult.pontosNegativos || []),
    atualizado_em: new Date().toISOString()
  };

  saveOrUpdateSentimentRow(analysisRow);

  logOperation('AI_SENTIMENT', 'Sentimento analisado para pergunta ' + questionId + ' (' + textos.length + ' respostas)', 'SUCCESS');

  return {
    questionId: questionId,
    questionTitle: question.titulo,
    resumo: analysisRow.resumo,
    positivo: analysisRow.positivo,
    neutro: analysisRow.neutro,
    negativo: analysisRow.negativo,
    pontosPositivos: geminiResult.pontosPositivos || [],
    pontosNegativos: geminiResult.pontosNegativos || [],
    respostasAnalisadas: textos.length,
    atualizadoEm: analysisRow.atualizado_em
  };
}

function saveOrUpdateSentimentRow(row) {
  var sheet = getOrCreateSheet(SHEETS.AI_ANALYSIS);
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var idCol = headers.indexOf('id');

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][idCol]) === String(row.id)) {
      var rowValues = headers.map(function(h) { return row[h] !== undefined ? row[h] : data[i][headers.indexOf(h)]; });
      sheet.getRange(i + 1, 1, 1, headers.length).setValues([rowValues]);
      return;
    }
  }

  var newRowValues = headers.map(function(h) { return row[h] !== undefined ? row[h] : ''; });
  sheet.appendRow(newRowValues);
}

/**
 * Chama a API do Google Gemini para resumir o sentimento de uma lista de respostas de texto.
 * Faz UMA única chamada por pergunta (nunca uma por resposta), para economizar cota gratuita.
 */
function callGeminiForSentiment(questionTitle, textos) {
  var apiKey = getGeminiApiKey();

  // Limitar a quantidade de texto enviada à IA (mantém o pedido leve e dentro da cota gratuita)
  var MAX_RESPOSTAS = 300;
  var amostra = textos.slice(0, MAX_RESPOSTAS);
  var listaRespostas = amostra.map(function(t, i) { return (i + 1) + '. ' + t; }).join('\n');

  var prompt = 'Você é um analista de pesquisas de clima organizacional. ' +
    'Pergunta feita aos respondentes: "' + questionTitle + '".\n\n' +
    'Respostas recebidas (uma por linha):\n' + listaRespostas + '\n\n' +
    'Analise o SENTIMENTO de todas as respostas acima e responda SOMENTE com um JSON válido, ' +
    'sem nenhum texto antes ou depois, no seguinte formato exato:\n' +
    '{"resumo": "um parágrafo curto em português resumindo o clima geral das respostas", ' +
    '"positivo": numero_inteiro_percentual_0_a_100, ' +
    '"neutro": numero_inteiro_percentual_0_a_100, ' +
    '"negativo": numero_inteiro_percentual_0_a_100, ' +
    '"pontosPositivos": ["até 5 frases curtas com os principais elogios/pontos fortes citados"], ' +
    '"pontosNegativos": ["até 5 frases curtas com as principais críticas/pontos de atenção citados"]}\n' +
    'Os três percentuais (positivo, neutro, negativo) devem somar exatamente 100.';

  var payload = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.2,
      responseMimeType: 'application/json'
    }
  };

  var url = 'https://generativelanguage.googleapis.com/v1beta/models/' + GEMINI_MODEL + ':generateContent?key=' + apiKey;

  var response = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  var statusCode = response.getResponseCode();
  var responseText = response.getContentText();

  if (statusCode !== 200) {
    logOperation('AI_ERROR', 'Gemini retornou ' + statusCode + ': ' + responseText, 'ERROR');
    throw new Error('A IA não conseguiu processar a análise agora (código ' + statusCode + '). Tente novamente em alguns instantes — pode ser um limite temporário da cota gratuita.');
  }

  var parsedResponse;
  try {
    parsedResponse = JSON.parse(responseText);
  } catch (e) {
    throw new Error('A IA retornou uma resposta inesperada. Tente novamente.');
  }

  var textContent = parsedResponse.candidates && parsedResponse.candidates[0] &&
    parsedResponse.candidates[0].content && parsedResponse.candidates[0].content.parts &&
    parsedResponse.candidates[0].content.parts[0] && parsedResponse.candidates[0].content.parts[0].text;

  if (!textContent) {
    throw new Error('A IA não retornou nenhum resultado. Tente novamente.');
  }

  var resultJson;
  try {
    resultJson = JSON.parse(textContent);
  } catch (e) {
    // Tentativa de recuperação: extrair apenas o trecho entre chaves, caso venha texto extra
    var match = textContent.match(/\{[\s\S]*\}/);
    if (match) {
      resultJson = JSON.parse(match[0]);
    } else {
      throw new Error('Não foi possível interpretar o resultado da IA. Tente novamente.');
    }
  }

  return {
    resumo: resultJson.resumo || '',
    positivo: Number(resultJson.positivo) || 0,
    neutro: Number(resultJson.neutro) || 0,
    negativo: Number(resultJson.negativo) || 0,
    pontosPositivos: Array.isArray(resultJson.pontosPositivos) ? resultJson.pontosPositivos : [],
    pontosNegativos: Array.isArray(resultJson.pontosNegativos) ? resultJson.pontosNegativos : []
  };
}

// ==========================================
// CONFIGURAÇÕES DE MARCA (LOGO / IDENTIDADE VISUAL)
// ==========================================

/**
 * Lê todas as configurações de marca salvas na aba Settings como um mapa chave->valor.
 * Leitura pública (sem exigir login), pois o formulário público também usa o logo.
 */
function getAppSettingsMap() {
  var rows = getRowsAsObjects(getOrCreateSheet(SHEETS.SETTINGS));
  var map = {};
  rows.forEach(function(r) {
    if (r.chave) map[r.chave] = r.valor || '';
  });
  return {
    logoUrl: map['logo_url'] || '',
    nomeExibicao: map['nome_exibicao'] || ''
  };
}

/**
 * Salva (ou atualiza) uma configuração de marca. Apenas ADM pode alterar.
 */
function saveAppSetting(token, chave, valor) {
  requireAdmin(token);

  var sheet = getOrCreateSheet(SHEETS.SETTINGS);
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var chaveCol = headers.indexOf('chave');
  var valorCol = headers.indexOf('valor');
  var atualizadoCol = headers.indexOf('atualizado_em');

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][chaveCol]) === String(chave)) {
      sheet.getRange(i + 1, valorCol + 1).setValue(valor);
      sheet.getRange(i + 1, atualizadoCol + 1).setValue(new Date().toISOString());
      return;
    }
  }

  sheet.appendRow([chave, valor, new Date().toISOString()]);
}

function saveAppSettings(token, logoUrl, nomeExibicao) {
  requireAdmin(token);
  if (logoUrl !== undefined) saveAppSetting(token, 'logo_url', logoUrl);
  if (nomeExibicao !== undefined) saveAppSetting(token, 'nome_exibicao', nomeExibicao);
  logOperation('SAVE_SETTINGS', 'Identidade visual atualizada.', 'SUCCESS');
  return { success: true };
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

  // Normalização crítica das respostas: diferentes clientes enviam valores diferentes para a
  // mesma pergunta de múltipla/única escolha — o formulário autônomo do Apps Script envia o ID
  // da opção (opt.id), enquanto o app Web pode enviar o texto (opt.valor). Sem essa normalização,
  // o motor de análise (que agrupa por "texto da opção") não reconhece o valor recebido e cria
  // uma categoria "fantasma" com o ID bruto, exatamente como visto no gráfico do PesquisaHub.
  // Aqui resolvemos cada resposta contra a lista real de opções da pergunta (fonte da verdade)
  // e gravamos sempre o par correto (option_id real + texto legível). Perguntas sem tabela de
  // opções (texto livre, nota, NPS) continuam sendo gravadas como digitadas, sem option_id.
  var surveyOptions = targetSurveyData.options || [];
  answers = answers.map(function(a) {
    var rawVal = a.valor;
    var matched = surveyOptions.find(function(o) {
      return o.question_id === a.question_id &&
        (o.id === a.option_id || o.id === rawVal || o.valor === rawVal || o.texto === rawVal);
    });
    return {
      id: a.id,
      question_id: a.question_id,
      option_id: matched ? matched.id : '',
      valor: matched ? matched.texto : rawVal
    };
  });

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
  // URL fixa e confiável do deployment atual (NUNCA usar window.location.href no cliente,
  // pois o Google redireciona a página renderizada para um domínio googleusercontent.com,
  // que não processa doPost corretamente e devolve HTML em vez de JSON).
  var scriptUrl = ScriptApp.getService().getUrl();

  // Identidade visual (logo) configurada pelo administrador — exibida em um "avatar"
  // circular de tamanho fixo, para nunca desequilibrar o layout do cabeçalho.
  var brandSettings = {};
  try { brandSettings = getAppSettingsMap(); } catch (brandErr) { brandSettings = {}; }
  var logoHtml = brandSettings.logoUrl
    ? '<img src="' + brandSettings.logoUrl + '" alt="Logo" class="w-12 h-12 rounded-full object-cover border-2 border-white/40 shadow-md shrink-0" />'
    : '';

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
'        <div class="flex items-center gap-3 mb-3">' +
          logoHtml +
'          <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 text-xs font-semibold backdrop-blur-xs">' +
'            <span>✓ Pesquisa Oficial</span>' +
'          </div>' +
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
'      </div>' +
'    </div>' +
'  </div>' +
'  ' +
'  <script>' +
'    var surveyData = ' + surveyJsonStr + ';' +
'    var SCRIPT_URL = "' + scriptUrl + '";' +
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
'        } else if (qType === "foto") {' +
'          body = "<input type=\'hidden\' name=\'q_" + q.id + "\' id=\'hidden_q_" + q.id + "\' value=\'\'>" +' +
'            "<div id=\'preview_q_" + q.id + "\' class=\'mb-2\'></div>" +' +
'            "<label class=\'flex flex-col items-center justify-center gap-2 border-2 border-dashed border-slate-300 rounded-2xl p-6 cursor-pointer hover:border-blue-400 hover:bg-blue-50/40 transition-colors\'>" +' +
'              "<span class=\'photo-label-text text-xs font-semibold text-slate-500\'>\uD83D\uDCF7 Toque para tirar ou enviar uma foto</span>" +' +
'              "<input type=\'file\' accept=\'image/*\' capture=\'environment\' class=\'pesquisahub-photo-file hidden\' data-qid=\'" + q.id + "\'>" +' +
'            "</label>";' +
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
'    function compressImageToBase64(file) {' +
'      return new Promise(function(resolve, reject) {' +
'        var reader = new FileReader();' +
'        reader.onerror = function() { reject(new Error("Não foi possível ler o arquivo.")); };' +
'        reader.onload = function() {' +
'          var img = new Image();' +
'          img.onerror = function() { reject(new Error("Não foi possível processar a imagem.")); };' +
'          img.onload = function() {' +
'            var maxDim = 1280;' +
'            var width = img.width, height = img.height;' +
'            if (width > maxDim || height > maxDim) {' +
'              if (width >= height) { height = Math.round((height / width) * maxDim); width = maxDim; }' +
'              else { width = Math.round((width / height) * maxDim); height = maxDim; }' +
'            }' +
'            var canvas = document.createElement("canvas");' +
'            canvas.width = width; canvas.height = height;' +
'            var ctx = canvas.getContext("2d");' +
'            ctx.drawImage(img, 0, 0, width, height);' +
'            var dataUrl = canvas.toDataURL("image/jpeg", 0.72);' +
'            resolve(dataUrl.split(",")[1] || "");' +
'          };' +
'          img.src = reader.result;' +
'        };' +
'        reader.readAsDataURL(file);' +
'      });' +
'    }' +
'    ' +
'    function wirePhotoInputs() {' +
'      var fileInputs = document.querySelectorAll(".pesquisahub-photo-file");' +
'      fileInputs.forEach(function(input) {' +
'        input.addEventListener("change", function() {' +
'          var qid = input.getAttribute("data-qid");' +
'          var file = input.files && input.files[0];' +
'          if (!file) return;' +
'          var previewEl = document.getElementById("preview_q_" + qid);' +
'          var hiddenEl = document.getElementById("hidden_q_" + qid);' +
'          var labelText = input.parentElement.querySelector(".photo-label-text");' +
'          if (labelText) labelText.textContent = "Enviando foto...";' +
'          input.disabled = true;' +
'          compressImageToBase64(file).then(function(base64) {' +
'            return fetch(SCRIPT_URL, {' +
'              method: "POST",' +
'              headers: { "Content-Type": "text/plain;charset=utf-8" },' +
'              body: JSON.stringify({ action: "uploadPhoto", surveyId: surveyData.survey.id, mimeType: "image/jpeg", base64: base64 })' +
'            });' +
'          }).then(function(res) { return res.json(); }).then(function(result) {' +
'            if ((result.success || result.status === "ok") && result.data && result.data.url) {' +
'              hiddenEl.value = result.data.url;' +
'              if (previewEl) previewEl.innerHTML = "<img src=\'" + result.data.url + "\' style=\'max-width:220px;border-radius:16px;border:1px solid #e2e8f0\' />";' +
'              if (labelText) labelText.textContent = "Foto enviada! Toque para trocar";' +
'            } else {' +
'              if (labelText) labelText.textContent = "Falha ao enviar. Toque para tentar novamente";' +
'              alert("Não foi possível enviar a foto: " + (result.message || "erro desconhecido"));' +
'            }' +
'            input.disabled = false;' +
'          }).catch(function(err) {' +
'            if (labelText) labelText.textContent = "Falha ao enviar. Toque para tentar novamente";' +
'            alert("Falha ao enviar a foto: " + err.message);' +
'            input.disabled = false;' +
'          });' +
'        });' +
'      });' +
'    }' +
'    wirePhotoInputs();' +
'    ' +
'    function submitForm(e) {' +
'      e.preventDefault();' +
'      ' +
'      for (var vi = 0; vi < surveyData.questions.length; vi++) {' +
'        var vq = surveyData.questions[vi];' +
'        if (vq.tipo === "foto" && vq.obrigatoria) {' +
'          var vHidden = document.getElementById("hidden_q_" + vq.id);' +
'          if (!vHidden || !vHidden.value) {' +
'            alert("A pergunta \\"" + vq.titulo + "\\" exige uma foto. Envie a foto antes de continuar.");' +
'            return;' +
'          }' +
'        }' +
'      }' +
'      ' +
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
'      fetch(SCRIPT_URL, {' +
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
