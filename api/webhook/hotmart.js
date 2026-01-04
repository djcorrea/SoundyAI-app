/**
 * 🎓 WEBHOOK HOTMART - Integração Combo Curso + PRO 4 meses
 * 
 * ✅ Recebe notificações de vendas aprovadas
 * ✅ Valida assinatura HMAC (Hotmart Token)
 * ✅ Cria usuário automaticamente se não existir
 * ✅ Ativa plano PRO por 120 dias
 * ✅ Envia e-mail de boas-vindas
 * ✅ Idempotente: transação processada apenas UMA vez
 * 
 * @version 1.0.0
 * @created 2026-01-04
 */

import express from 'express';
import crypto from 'crypto';
import { getFirestore, getAuth } from '../../firebase/admin.js';
import { applyPlan, getOrCreateUser } from '../../work/lib/user/userPlans.js';
import { sendWelcomeProEmail } from '../../lib/email/hotmart-welcome.js';

const router = express.Router();

// ═══════════════════════════════════════════════════════════════════
// � MIDDLEWARE CRÍTICO - RAW BODY (antes do express.json() global)
// ═══════════════════════════════════════════════════════════════════
// A Hotmart exige validação de assinatura com o body RAW (Buffer)
// O express.json() global consome o stream e causa erro -1 silencioso
// SOLUÇÃO: express.raw() captura o Buffer antes do parsing JSON
router.use(express.raw({ type: 'application/json' }));

// ═══════════════════════════════════════════════════════════════════
// �📊 CONFIGURAÇÃO
// ═══════════════════════════════════════════════════════════════════

const HOTMART_WEBHOOK_SECRET = process.env.HOTMART_WEBHOOK_SECRET;
const COLLECTION_TRANSACTIONS = 'hotmart_transactions';
const PRO_DURATION_DAYS = 120; // 4 meses

// ═══════════════════════════════════════════════════════════════════
// 🔐 FUNÇÕES DE SEGURANÇA E PARSING
// ═══════════════════════════════════════════════════════════════════

/**
 * Parse seguro do body da Hotmart (tolerante a Buffer ou Object)
 * @param {Object} req - Express request
 * @returns {Object} Body parseado
 * @throws {Error} Se formato for desconhecido ou JSON inválido
 */
function safeParseHotmartBody(req) {
  try {
    // Caso 1: Body é Buffer (express.raw capturou corretamente)
    if (Buffer.isBuffer(req.body)) {
      console.log('📦 [HOTMART] Body recebido como Buffer - parseando...');
      const rawBody = req.body.toString('utf8');
      return JSON.parse(rawBody);
    }
    
    // Caso 2: Body já é Object (express.json já processou)
    if (typeof req.body === 'object' && req.body !== null) {
      console.log('📦 [HOTMART] Body recebido como Object - usando diretamente');
      return req.body;
    }
    
    // Caso 3: Body é string (raramente acontece)
    if (typeof req.body === 'string') {
      console.log('📦 [HOTMART] Body recebido como String - parseando...');
      return JSON.parse(req.body);
    }
    
    // Caso 4: Formato desconhecido
    throw new Error(`Formato de body desconhecido: ${typeof req.body}`);
    
  } catch (error) {
    console.error('❌ [HOTMART] Erro no parse seguro do body:', error.message);
    console.error('❌ [HOTMART] Tipo recebido:', typeof req.body);
    console.error('❌ [HOTMART] Body raw:', req.body);
    throw error;
  }
}

/**
 * Valida assinatura HMAC do webhook Hotmart
 * @param {Object} req - Express request
 * @returns {boolean} true se válido
 */
function validateHotmartSignature(req) {
  // Hotmart envia a assinatura no header X-Hotmart-Hottok
  const signature = req.headers['x-hotmart-hottok'];
  
  if (!signature) {
    console.warn('⚠️ [HOTMART] Header X-Hotmart-Hottok ausente');
    return false;
  }

  // Se não tiver secret configurado, aceitar (dev mode)
  if (!HOTMART_WEBHOOK_SECRET) {
    console.warn('⚠️ [HOTMART] HOTMART_WEBHOOK_SECRET não configurado - aceitando webhook (DEV MODE)');
    return true;
  }

  // Validar token
  if (signature !== HOTMART_WEBHOOK_SECRET) {
    console.error('❌ [HOTMART] Token inválido');
    return false;
  }

  console.log('✅ [HOTMART] Assinatura válida');
  return true;
}

/**
 * Extrai dados relevantes do payload Hotmart
 * @param {Object} body - Corpo do webhook
 * @returns {Object|null} Dados extraídos ou null se inválido
 */
function extractHotmartData(body) {
  try {
    // Hotmart pode enviar em diferentes formatos
    // Formato padrão: { event, data: { purchase, buyer, product } }
    
    const event = body.event || body.status;
    const purchase = body.data?.purchase || body.purchase || body;
    const buyer = body.data?.buyer || body.buyer || {};
    const product = body.data?.product || body.product || {};

    // Extrair dados essenciais
    const transactionId = 
      purchase.transaction || 
      purchase.order_bump?.transaction ||
      body.hottok ||
      body.transaction ||
      `hotmart_${Date.now()}`; // Fallback com timestamp

    const buyerEmail = 
      buyer.email || 
      purchase.buyer?.email ||
      body.email;

    const buyerName = 
      buyer.name || 
      purchase.buyer?.name ||
      body.name ||
      'Cliente';

    const status = 
      purchase.status ||
      body.status ||
      event;

    const productName = 
      product.name ||
      purchase.product?.name ||
      body.prod_name ||
      'Combo Curso + PRO';

    console.log('📋 [HOTMART] Dados extraídos:', {
      event,
      transactionId,
      buyerEmail: buyerEmail ? '***@***' : null,
      status,
      productName
    });

    return {
      event,
      transactionId,
      buyerEmail,
      buyerName,
      status,
      productName,
      rawData: body
    };
  } catch (error) {
    console.error('❌ [HOTMART] Erro ao extrair dados:', error.message);
    return null;
  }
}

/**
 * Verifica se a transação é uma venda aprovada
 * @param {Object} data - Dados extraídos
 * @returns {boolean}
 */
function isApprovedSale(data) {
  if (!data) return false;

  // Eventos/status que indicam venda aprovada
  const approvedStatuses = [
    'PURCHASE_APPROVED',
    'approved',
    'APPROVED',
    'purchase_approved',
    'PURCHASE_COMPLETE',
    'completed',
    'COMPLETED'
  ];

  const status = (data.status || data.event || '').toUpperCase();
  const event = (data.event || '').toUpperCase();

  const isApproved = 
    approvedStatuses.some(s => status.includes(s.toUpperCase())) ||
    approvedStatuses.some(s => event.includes(s.toUpperCase()));

  console.log(`🔍 [HOTMART] Verificando status: "${status}" / event: "${event}" → ${isApproved ? '✅ APROVADO' : '❌ NÃO APROVADO'}`);
  
  return isApproved;
}

/**
 * Verifica idempotência (transação já processada?)
 * @param {string} transactionId - ID da transação
 * @returns {Promise<boolean>} true se já processada
 */
async function isTransactionProcessed(transactionId) {
  try {
    const db = getFirestore();
    const docRef = db.collection(COLLECTION_TRANSACTIONS).doc(transactionId);
    const doc = await docRef.get();
    
    if (doc.exists) {
      console.log(`⚠️ [HOTMART] Transação já processada: ${transactionId}`);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('❌ [HOTMART] Erro ao verificar idempotência:', error.message);
    // Em caso de erro, retornar false para tentar processar
    // (melhor processar 2x do que não processar)
    return false;
  }
}

/**
 * Marca transação como processada (idempotência)
 * @param {string} transactionId - ID da transação
 * @param {Object} data - Dados da transação
 * @returns {Promise<void>}
 */
async function markTransactionProcessed(transactionId, data) {
  try {
    const db = getFirestore();
    await db.collection(COLLECTION_TRANSACTIONS).doc(transactionId).set({
      transactionId,
      buyerEmail: data.buyerEmail,
      status: 'processed',
      origin: 'hotmart',
      productName: data.productName,
      processedAt: new Date().toISOString(),
      rawData: JSON.stringify(data.rawData || {})
    });
    
    console.log(`✅ [HOTMART] Transação marcada como processada: ${transactionId}`);
  } catch (error) {
    console.error('❌ [HOTMART] Erro ao marcar transação:', error.message);
    // Não lançar erro - não é crítico para o fluxo
  }
}

// ═══════════════════════════════════════════════════════════════════
// 👤 FUNÇÕES DE USUÁRIO
// ═══════════════════════════════════════════════════════════════════

/**
 * Gera senha provisória segura
 * @returns {string} Senha de 12 caracteres
 */
function generateTempPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
  let password = '';
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

/**
 * Busca usuário existente por e-mail
 * @param {string} email - E-mail do comprador
 * @returns {Promise<Object|null>} Dados do usuário ou null
 */
async function findUserByEmail(email) {
  try {
    const auth = getAuth();
    const userRecord = await auth.getUserByEmail(email);
    console.log(`👤 [HOTMART] Usuário encontrado por email: ${userRecord.uid}`);
    return {
      uid: userRecord.uid,
      email: userRecord.email,
      displayName: userRecord.displayName,
      isNew: false
    };
  } catch (error) {
    if (error.code === 'auth/user-not-found') {
      console.log(`👤 [HOTMART] Usuário não existe: ${email}`);
      return null;
    }
    throw error;
  }
}

/**
 * Cria novo usuário no Firebase Auth
 * @param {string} email - E-mail do comprador
 * @param {string} name - Nome do comprador
 * @returns {Promise<Object>} Dados do usuário criado
 */
async function createNewUser(email, name) {
  const auth = getAuth();
  const tempPassword = generateTempPassword();
  
  console.log(`🆕 [HOTMART] Criando novo usuário: ${email}`);
  
  const userRecord = await auth.createUser({
    email: email,
    password: tempPassword,
    displayName: name || 'Usuário Hotmart',
    emailVerified: false
  });

  console.log(`✅ [HOTMART] Usuário criado: ${userRecord.uid}`);

  return {
    uid: userRecord.uid,
    email: userRecord.email,
    displayName: userRecord.displayName,
    tempPassword, // Importante: só disponível para usuários novos
    isNew: true
  };
}

// ═══════════════════════════════════════════════════════════════════
// 🚀 ENDPOINT PRINCIPAL
// ═══════════════════════════════════════════════════════════════════

/**
 * Processa o webhook de forma assíncrona (após responder 200 OK)
 * @param {Object} data - Dados extraídos do webhook
 */
async function processWebhookAsync(data) {
  const startTime = Date.now();
  
  try {
    console.log(`🔄 [HOTMART-ASYNC] Iniciando processamento: ${data.transactionId}`);

    // ═══════════════════════════════════════════════════════════════
    // PASSO 1: Verificar idempotência (novamente, por segurança)
    // ═══════════════════════════════════════════════════════════════
    const alreadyProcessed = await isTransactionProcessed(data.transactionId);
    
    if (alreadyProcessed) {
      console.log(`⚠️ [HOTMART-ASYNC] Transação já processada: ${data.transactionId}`);
      return;
    }

    // ═══════════════════════════════════════════════════════════════
    // PASSO 2: Buscar ou criar usuário
    // ═══════════════════════════════════════════════════════════════
    console.log(`👤 [HOTMART-ASYNC] Processando usuário: ${data.buyerEmail}`);
    
    let user = await findUserByEmail(data.buyerEmail);
    
    if (!user) {
      user = await createNewUser(data.buyerEmail, data.buyerName);
    }

    // ═══════════════════════════════════════════════════════════════
    // PASSO 3: Garantir documento no Firestore
    // ═══════════════════════════════════════════════════════════════
    await getOrCreateUser(user.uid, {
      email: data.buyerEmail,
      name: data.buyerName,
      origin: 'hotmart',
      hotmartTransactionId: data.transactionId
    });

    // ═══════════════════════════════════════════════════════════════
    // PASSO 4: Ativar plano PRO por 120 dias
    // ═══════════════════════════════════════════════════════════════
    console.log(`💳 [HOTMART-ASYNC] Ativando PRO para ${user.uid} (${PRO_DURATION_DAYS} dias)`);
    
    const updatedUser = await applyPlan(user.uid, {
      plan: 'pro',
      durationDays: PRO_DURATION_DAYS
    });

    console.log(`✅ [HOTMART-ASYNC] Plano PRO ativado: ${user.uid} até ${updatedUser.proExpiresAt}`);

    // ═══════════════════════════════════════════════════════════════
    // PASSO 5: Marcar transação como processada
    // ═══════════════════════════════════════════════════════════════
    await markTransactionProcessed(data.transactionId, {
      ...data,
      uid: user.uid,
      planApplied: 'pro',
      durationDays: PRO_DURATION_DAYS,
      expiresAt: updatedUser.proExpiresAt
    });

    // ═══════════════════════════════════════════════════════════════
    // PASSO 6: Enviar e-mail de boas-vindas
    // ═══════════════════════════════════════════════════════════════
    try {
      await sendWelcomeProEmail({
        email: data.buyerEmail,
        name: data.buyerName,
        tempPassword: user.tempPassword,
        isNewUser: user.isNew,
        expiresAt: updatedUser.proExpiresAt,
        transactionId: data.transactionId
      });
      console.log(`📧 [HOTMART-ASYNC] E-mail enviado para: ${data.buyerEmail}`);
    } catch (emailError) {
      console.error('⚠️ [HOTMART-ASYNC] Erro ao enviar e-mail (não crítico):', emailError.message);
    }

    const elapsed = Date.now() - startTime;
    console.log(`✅ [HOTMART-ASYNC] Processamento concluído em ${elapsed}ms`);
    console.log('═══════════════════════════════════════════════════════════');

  } catch (error) {
    console.error('💥 [HOTMART-ASYNC] Erro no processamento:', error);
    console.error('💥 [HOTMART-ASYNC] Stack:', error.stack);
    console.log('═══════════════════════════════════════════════════════════');
    // Erro é logado mas não propagado - webhook já foi aceito
  }
}

/**
 * POST /webhook/hotmart - Receber notificações da Hotmart
 * 
 * ⚡ FLUSH FORÇADO: res.end() para envio imediato no socket (sem buffering)
 * 🛡️ GARANTIA: Nenhum erro interno pode fechar a conexão
 * 🔄 PROCESSAMENTO: Firebase, Firestore, e-mail executam em IIFE async isolado
 * 
 * PADRÃO CRÍTICO (obrigatório para Railway/proxy):
 * - res.writeHead() + res.end() — força flush imediato no socket
 * - Handler síncrono (não async)
 * - Resposta ANTES de qualquer validação pesada
 * - Todo processamento pesado em IIFE async com try/catch
 */
router.post('/', (req, res) => {
  // ═══════════════════════════════════════════════════════════════
  // ⚡ RESPOSTA IMEDIATA E FORÇADA (flush no socket)
  // ═══════════════════════════════════════════════════════════════
  // CRÍTICO: res.json() NÃO garante flush atrás de proxy (Railway)
  // res.end() força envio imediato eliminando buffering
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('OK');

  // ═══════════════════════════════════════════════════════════════
  // 🔄 PROCESSAMENTO ISOLADO EM IIFE ASYNC
  // ═══════════════════════════════════════════════════════════════
  (async () => {
    try {
      console.log('═══════════════════════════════════════════════════════════');
      console.log('🔔 [HOTMART] Webhook recebido');
      console.log('📋 [HOTMART] Headers:', JSON.stringify({
        'x-hotmart-hottok': req.headers['x-hotmart-hottok'] ? '***' : 'ausente',
        'content-type': req.headers['content-type']
      }, null, 2));
      console.log('📋 [HOTMART] Body type:', typeof req.body);
      console.log('📋 [HOTMART] Body é Buffer?:', Buffer.isBuffer(req.body));

      // ═══════════════════════════════════════════════════════════
      // 🔧 PARSE SEGURO DO BODY (tolerante a Buffer OU Object)
      // ═══════════════════════════════════════════════════════════
      let parsedBody;
      
      try {
        parsedBody = safeParseHotmartBody(req);
        console.log('✅ [HOTMART] Body parseado com sucesso');
        console.log('📋 [HOTMART] Evento:', parsedBody.event || parsedBody.status);
      } catch (parseError) {
        console.error('❌ [HOTMART] Erro ao parsear body:', parseError.message);
        console.error('❌ [HOTMART] Body não será processado');
        // Resposta já foi enviada - apenas logar erro
        return;
      }

      // ═══════════════════════════════════════════════════════════
      // VALIDAÇÕES (após resposta - não bloqueiam webhook)
      // ═══════════════════════════════════════════════════════════

      // 1. Validar assinatura
      if (!validateHotmartSignature(req)) {
        console.error('❌ [HOTMART] Assinatura inválida - ignorando processamento');
        return;
      }

      // 2. Extrair dados do payload
      const data = extractHotmartData(parsedBody);
      
      if (!data) {
        console.error('❌ [HOTMART] Payload inválido - ignorando processamento');
        return;
      }

      // 3. Verificar se é venda aprovada
      if (!isApprovedSale(data)) {
        console.log(`⚠️ [HOTMART] Evento ignorado: ${data.event || data.status}`);
        return;
      }

      // 4. Validar e-mail do comprador
      if (!data.buyerEmail || !data.buyerEmail.includes('@')) {
        console.error('❌ [HOTMART] E-mail inválido - ignorando processamento');
        return;
      }

      // Normalizar e-mail
      data.buyerEmail = data.buyerEmail.toLowerCase().trim();

      console.log(`✅ [HOTMART] Processando transactionId: ${data.transactionId}`);

      // ═══════════════════════════════════════════════════════════
      // 🚀 PROCESSAMENTO DE NEGÓCIO
      // ═══════════════════════════════════════════════════════════
      await processWebhookAsync(data);

    } catch (err) {
      console.error('💥 [HOTMART] Erro no processamento async:', err);
      console.error('💥 [HOTMART] Stack:', err.stack);
      console.log('═══════════════════════════════════════════════════════════');
      // Erro logado mas NÃO propagado - resposta já foi enviada com 200 OK
    }
  })();
});

/**
 * GET /webhook/hotmart - Health check
 */
router.get('/', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Hotmart Webhook',
    timestamp: new Date().toISOString(),
    configured: !!HOTMART_WEBHOOK_SECRET
  });
});

/**
 * POST /webhook/hotmart/test - Teste manual (apenas em dev)
 */
router.post('/test', async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'Não disponível em produção' });
  }

  console.log('🧪 [HOTMART] Requisição de TESTE recebida');
  console.log('📋 [HOTMART] Body:', JSON.stringify(req.body, null, 2));

  // Simular payload de teste
  const testPayload = req.body.email ? req.body : {
    event: 'PURCHASE_APPROVED',
    data: {
      purchase: {
        transaction: `TEST_${Date.now()}`,
        status: 'APPROVED'
      },
      buyer: {
        email: req.body.email || 'teste@exemplo.com',
        name: req.body.name || 'Usuário Teste'
      },
      product: {
        name: 'Combo Teste'
      }
    }
  };

  // Processar como webhook real
  req.body = testPayload;
  req.headers['x-hotmart-hottok'] = HOTMART_WEBHOOK_SECRET || 'test-mode';
  
  // Delegar para o handler principal
  return router.handle(req, res);
});

export default router;
