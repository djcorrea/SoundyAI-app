/**
 * 🔗 REFERRAL SYSTEM V3 - Link Registration
 * 
 * Endpoint para vincular um visitante (visitor) a um usuário cadastrado (uid)
 * 
 * ✅ SEGURANÇA:
 * - Usa Admin SDK (bypassa Firestore Rules)
 * - Validação rigorosa de entrada
 * - Idempotente (não falha se já vinculado)
 * - NÃO bloqueia cadastro se falhar (graceful handling)
 * 
 * @route POST /api/referral/link-registration
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
 * Valida Firebase UID (28 caracteres alfanuméricos)
 */
function isValidFirebaseUID(uid) {
  return typeof uid === 'string' && uid.length >= 20 && uid.length <= 128;
}

/**
 * Valida payload completo
 */
function validatePayload(body) {
  const errors = [];

  // uid obrigatório (Firebase UID)
  if (!body.uid || !isValidFirebaseUID(body.uid)) {
    errors.push('uid inválido (deve ser Firebase UID válido)');
  }

  // visitorId obrigatório (UUID v4)
  if (!body.visitorId || !isValidUUID(body.visitorId)) {
    errors.push('visitorId inválido (deve ser UUID v4)');
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
  
  console.log(`🔗 [REFERRAL:${requestId}] link-registration iniciado:`, {
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

    const { uid, visitorId } = body;

    console.log(`✅ [REFERRAL:${requestId}] Payload validado:`, {
      uid: uid.substring(0, 8) + '...',
      visitorId: visitorId.substring(0, 8) + '...'
    });

    // ═══════════════════════════════════════════════════════════════
    // ETAPA 2: VERIFICAR SE DOCUMENTO referral_visitors EXISTE
    // ═══════════════════════════════════════════════════════════════

    const db = getFirestore();
    const visitorRef = db.collection('referral_visitors').doc(visitorId);

    let existingDoc = null;
    try {
      const snapshot = await visitorRef.get();
      
      if (!snapshot.exists) {
        // ⚠️ IMPORTANTE: Documento não existe (localStorage pode ter sido limpo)
        // NÃO bloquear cadastro! Apenas logar e retornar sucesso
        console.warn(`⚠️ [REFERRAL:${requestId}] Documento não existe para visitorId: ${visitorId}`);
        console.warn(`   Possível causa: localStorage limpo entre visita e cadastro`);
        console.warn(`   Ação: Cadastro prossegue normalmente (sem vínculo de afiliado)`);
        
        return sendResponse(200, {
          success: true,
          message: 'Cadastro processado (sem vínculo de afiliado)',
          reason: 'VISITOR_NOT_FOUND',
          data: {
            uid,
            visitorId,
            linked: false
          }
        });
      }

      existingDoc = snapshot.data();
      
      console.log(`📄 [REFERRAL:${requestId}] Documento encontrado:`, {
        registered: existingDoc.registered,
        existingUid: existingDoc.uid || 'null',
        partnerId: existingDoc.partnerId
      });

    } catch (error) {
      console.error(`❌ [REFERRAL:${requestId}] Erro ao buscar documento:`, error);
      // NÃO bloquear cadastro!
      return sendResponse(200, {
        success: true,
        message: 'Cadastro processado (erro ao buscar afiliado)',
        reason: 'LOOKUP_ERROR',
        data: {
          uid,
          visitorId,
          linked: false,
          error: error.message
        }
      });
    }

    // ═══════════════════════════════════════════════════════════════
    // ETAPA 3: VERIFICAR SE JÁ ESTÁ VINCULADO (IDEMPOTÊNCIA)
    // ═══════════════════════════════════════════════════════════════

    if (existingDoc.registered === true) {
      console.log(`✅ [REFERRAL:${requestId}] Já vinculado anteriormente`);
      console.log(`   UID atual: ${existingDoc.uid}`);
      console.log(`   UID solicitado: ${uid}`);
      
      // Verificar se é o mesmo UID (idempotência) ou tentativa de fraude
      if (existingDoc.uid === uid) {
        return sendResponse(200, {
          success: true,
          message: 'Visitante já vinculado (idempotente)',
          reason: 'ALREADY_REGISTERED',
          data: {
            uid,
            visitorId,
            linked: true,
            registeredAt: existingDoc.registeredAt
          }
        });
      } else {
        // ⚠️ ALERTA: Tentativa de vincular outro UID ao mesmo visitor
        console.error(`⚠️ [REFERRAL:${requestId}] ALERTA DE SEGURANÇA!`);
        console.error(`   VisitorId já vinculado a UID diferente`);
        console.error(`   UID existente: ${existingDoc.uid}`);
        console.error(`   UID tentando vincular: ${uid}`);
        
        return sendResponse(200, {
          success: true,
          message: 'Visitante já vinculado a outro usuário',
          reason: 'ALREADY_REGISTERED_DIFFERENT_UID',
          data: {
            uid,
            visitorId,
            linked: false
          }
        });
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // ETAPA 4: VINCULAR (registered: false → true)
    // ═══════════════════════════════════════════════════════════════

    console.log(`💾 [REFERRAL:${requestId}] Vinculando cadastro...`);

    const now = new Date();
    const updateData = {
      registered: true,
      uid: uid,
      registeredAt: now.toISOString(),
      lastSeenAt: now.toISOString(),
      updatedAt: now.toISOString()
    };

    await visitorRef.update(updateData);

    console.log(`✅ [REFERRAL:${requestId}] Vinculação concluída com sucesso!`);
    console.log(`   VisitorId: ${visitorId}`);
    console.log(`   UID: ${uid}`);
    console.log(`   PartnerId: ${existingDoc.partnerId}`);

    // ═══════════════════════════════════════════════════════════════
    // ETAPA 5: RETORNAR SUCESSO
    // ═══════════════════════════════════════════════════════════════

    return sendResponse(200, {
      success: true,
      message: 'Cadastro vinculado ao afiliado com sucesso',
      data: {
        uid,
        visitorId,
        partnerId: existingDoc.partnerId,
        linked: true,
        registeredAt: now.toISOString()
      }
    });

  } catch (error) {
    console.error(`❌ [REFERRAL:${requestId}] Erro inesperado:`, error);
    console.error(`   Stack:`, error.stack);

    // ⚠️ CRÍTICO: Mesmo com erro, NÃO bloquear cadastro
    // Frontend deve continuar normalmente
    return sendResponse(200, {
      success: true,
      message: 'Cadastro processado (erro ao vincular afiliado)',
      reason: 'UNEXPECTED_ERROR',
      data: {
        uid: req.body?.uid,
        visitorId: req.body?.visitorId,
        linked: false,
        error: error.message
      }
    });
  }
}
