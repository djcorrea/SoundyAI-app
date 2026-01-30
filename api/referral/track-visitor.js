/**
 * 🔗 REFERRAL SYSTEM V3 - Track Visitor
 * 
 * Endpoint para rastrear visitantes vindos de links de afiliados (?ref)
 * 
 * ✅ SEGURANÇA:
 * - Usa Admin SDK (bypassa Firestore Rules)
 * - Validação rigorosa de entrada
 * - Idempotente (merge mode)
 * - Nunca sobrescreve dados de cadastro (registered, uid)
 * 
 * @route POST /api/referral/track-visitor
 * @version 3.0.0
 * @date 2026-01-29
 */

import { getFirestore } from '../../work/firebase/admin.js';
import cors from 'cors';
import { getCorsConfig } from '../../work/config/environment.js';

// ═══════════════════════════════════════════════════════════════════
// CORS MIDDLEWARE
// ═══════════════════════════════════════════════════════════════════

const corsMiddleware = cors(getCorsConfig());

function runMiddleware(req, res, fn) {
  return new Promise((resolve, reject) => {
    fn(req, res, (result) => {
      if (result instanceof Error) {
        return reject(result);
      }
      return resolve(result);
    });
  });
}

// ═══════════════════════════════════════════════════════════════════
// VALIDAÇÃO DE ENTRADA
// ═══════════════════════════════════════════════════════════════════

/**
 * Valida UUID v4
 */
function isValidUUID(uuid) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * Valida partnerId (código do parceiro)
 */
function isValidPartnerId(partnerId) {
  // Deve ser string alfanumérica, 3-50 caracteres, lowercase
  const partnerRegex = /^[a-z0-9_-]{3,50}$/;
  return typeof partnerId === 'string' && partnerRegex.test(partnerId);
}

/**
 * Valida timestamp ISO 8601
 */
function isValidTimestamp(timestamp) {
  try {
    const date = new Date(timestamp);
    return date instanceof Date && !isNaN(date.getTime());
  } catch {
    return false;
  }
}

/**
 * Valida payload completo
 */
function validatePayload(body) {
  const errors = [];

  // visitorId obrigatório (UUID v4)
  if (!body.visitorId || !isValidUUID(body.visitorId)) {
    errors.push('visitorId inválido (deve ser UUID v4)');
  }

  // partnerId obrigatório
  if (!body.partnerId || !isValidPartnerId(body.partnerId)) {
    errors.push('partnerId inválido (3-50 caracteres alfanuméricos)');
  }

  // timestamp obrigatório
  if (!body.timestamp || !isValidTimestamp(body.timestamp)) {
    errors.push('timestamp inválido (deve ser ISO 8601)');
  }

  // userAgent opcional mas se vier deve ser string
  if (body.userAgent !== undefined && typeof body.userAgent !== 'string') {
    errors.push('userAgent deve ser string');
  }

  // referrer opcional mas se vier deve ser string
  if (body.referrer !== undefined && typeof body.referrer !== 'string') {
    errors.push('referrer deve ser string');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

// ═══════════════════════════════════════════════════════════════════
// HANDLER PRINCIPAL
// ═══════════════════════════════════════════════════════════════════

export default async function handler(req, res) {
  const requestId = Math.random().toString(36).substring(7);
  
  console.log(`🔗 [REFERRAL:${requestId}] track-visitor iniciado:`, {
    method: req.method,
    timestamp: new Date().toISOString(),
    hasBody: !!req.body
  });

  // Prevenir múltiplas respostas
  let responseSent = false;
  const sendResponse = (status, data) => {
    if (responseSent) {
      console.warn(`⚠️ [REFERRAL:${requestId}] Resposta duplicada ignorada`);
      return;
    }
    responseSent = true;
    return res.status(status).json(data);
  };

  // CORS
  try {
    await runMiddleware(req, res, corsMiddleware);
  } catch (err) {
    console.error(`❌ [REFERRAL:${requestId}] CORS error:`, err);
    return sendResponse(403, { 
      success: false,
      error: 'CORS_ERROR', 
      message: 'Origem não permitida' 
    });
  }

  // OPTIONS (preflight)
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Apenas POST
  if (req.method !== 'POST') {
    return sendResponse(405, { 
      success: false,
      error: 'METHOD_NOT_ALLOWED', 
      message: 'Apenas POST permitido' 
    });
  }

  try {
    // ═══════════════════════════════════════════════════════════════
    // ETAPA 1: VALIDAR ENTRADA
    // ═══════════════════════════════════════════════════════════════
    
    const body = req.body || {};
    const validation = validatePayload(body);

    if (!validation.valid) {
      console.error(`❌ [REFERRAL:${requestId}] Validação falhou:`, validation.errors);
      return sendResponse(400, {
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'Dados inválidos',
        details: validation.errors
      });
    }

    const { visitorId, partnerId, timestamp, userAgent, referrer } = body;

    console.log(`✅ [REFERRAL:${requestId}] Payload validado:`, {
      visitorId: visitorId.substring(0, 8) + '...',
      partnerId,
      timestamp
    });

    // ═══════════════════════════════════════════════════════════════
    // ETAPA 2: VERIFICAR SE DOCUMENTO JÁ EXISTE
    // ═══════════════════════════════════════════════════════════════

    const db = getFirestore();
    const visitorRef = db.collection('referral_visitors').doc(visitorId);

    let existingDoc = null;
    try {
      const snapshot = await visitorRef.get();
      if (snapshot.exists) {
        existingDoc = snapshot.data();
        console.log(`📄 [REFERRAL:${requestId}] Documento existente encontrado:`, {
          registered: existingDoc.registered,
          hasUid: !!existingDoc.uid,
          partnerId: existingDoc.partnerId
        });
      } else {
        console.log(`🆕 [REFERRAL:${requestId}] Novo visitante (documento não existe)`);
      }
    } catch (error) {
      console.error(`❌ [REFERRAL:${requestId}] Erro ao verificar documento:`, error);
      // Continuar mesmo assim (merge irá criar)
    }

    // ═══════════════════════════════════════════════════════════════
    // ETAPA 3: PREPARAR DADOS COM LÓGICA DE MERGE SEGURA
    // ═══════════════════════════════════════════════════════════════

    const now = new Date();
    const dataToMerge = {
      visitorId: visitorId,
      partnerId: partnerId,
      lastSeenAt: now.toISOString(),
      updatedAt: now.toISOString()
    };

    // ⚠️ CRÍTICO: Adicionar campos APENAS se não existirem
    // Isso evita sobrescrever dados de cadastro
    if (!existingDoc) {
      // Novo documento: adicionar todos os campos iniciais
      dataToMerge.firstSeenAt = timestamp;
      dataToMerge.registered = false;
      dataToMerge.uid = null;
      dataToMerge.registeredAt = null;
      dataToMerge.converted = false;
      dataToMerge.plan = null;
      dataToMerge.convertedAt = null;
      dataToMerge.createdAt = now.toISOString();
      
      if (userAgent) dataToMerge.userAgent = userAgent;
      if (referrer) dataToMerge.referrer = referrer;
    } else {
      // Documento existente: NÃO sobrescrever campos críticos
      // Apenas atualizar lastSeenAt e updatedAt
      console.log(`🛡️ [REFERRAL:${requestId}] Preservando dados existentes de cadastro`);
    }

    // ═══════════════════════════════════════════════════════════════
    // ETAPA 4: SALVAR NO FIRESTORE (Admin SDK bypassa rules)
    // ═══════════════════════════════════════════════════════════════

    console.log(`💾 [REFERRAL:${requestId}] Salvando no Firestore (merge mode)...`);

    await visitorRef.set(dataToMerge, { merge: true });

    console.log(`✅ [REFERRAL:${requestId}] Sucesso! Documento atualizado`);

    // ═══════════════════════════════════════════════════════════════
    // ETAPA 5: RETORNAR SUCESSO
    // ═══════════════════════════════════════════════════════════════

    return sendResponse(200, {
      success: true,
      message: 'Visitante rastreado com sucesso',
      data: {
        visitorId,
        partnerId,
        isNew: !existingDoc,
        timestamp: now.toISOString()
      }
    });

  } catch (error) {
    console.error(`❌ [REFERRAL:${requestId}] Erro inesperado:`, error);
    console.error(`   Stack:`, error.stack);

    return sendResponse(500, {
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'Erro ao processar rastreamento de visitante'
    });
  }
}
