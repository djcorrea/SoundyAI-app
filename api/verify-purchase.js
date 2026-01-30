/**
 * 🔍 VERIFY PURCHASE - Endpoint de verificação e ativação manual do plano PLUS
 * 
 * ✅ NÃO depende do webhook da Hotmart
 * ✅ Usuário logado pode verificar se comprou
 * ✅ Ativa plano PLUS por 30 dias se compra confirmada
 * ✅ Pode ser usado como fallback se webhook falhar
 * 
 * @version 2.0.0
 * @updated 2026-01-30 - Corrigido para PLUS 30 dias (era PRO 120d)
 * @created 2026-01-04
 */

import express from 'express';
import { getFirestore, getAuth } from '../firebase/admin.js';
import { applyPlan, getOrCreateUser } from '../work/lib/user/userPlans.js';
import { sendWelcomeProEmail } from '../lib/email/hotmart-welcome.js';

const router = express.Router();

// ═══════════════════════════════════════════════════════════════════
// 📊 CONFIGURAÇÃO
// ═══════════════════════════════════════════════════════════════════

const PLUS_DURATION_DAYS = 30; // 1 mês
const COLLECTION_TRANSACTIONS = 'hotmart_transactions';

// ═══════════════════════════════════════════════════════════════════
// 🔐 MIDDLEWARE DE AUTENTICAÇÃO
// ═══════════════════════════════════════════════════════════════════

/**
 * Verifica se o usuário está autenticado via Firebase Auth
 */
async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('❌ [VERIFY-PURCHASE] Authorization header ausente ou inválido');
      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Token de autenticação obrigatório'
      });
    }

    const token = authHeader.split('Bearer ')[1];
    const auth = getAuth();
    
    try {
      const decodedToken = await auth.verifyIdToken(token);
      req.user = {
        uid: decodedToken.uid,
        email: decodedToken.email
      };
      
      console.log(`✅ [VERIFY-PURCHASE] Usuário autenticado: ${req.user.uid}`);
      next();
      
    } catch (tokenError) {
      console.error('❌ [VERIFY-PURCHASE] Token inválido:', tokenError.message);
      return res.status(401).json({
        error: 'INVALID_TOKEN',
        message: 'Token de autenticação inválido ou expirado'
      });
    }
    
  } catch (error) {
    console.error('❌ [VERIFY-PURCHASE] Erro na autenticação:', error.message);
    return res.status(500).json({
      error: 'AUTH_ERROR',
      message: 'Erro ao verificar autenticação'
    });
  }
}

// ═══════════════════════════════════════════════════════════════════
// 🔍 FUNÇÕES DE VERIFICAÇÃO
// ═══════════════════════════════════════════════════════════════════

/**
 * Verifica se usuário tem transação Hotmart registrada
 * @param {string} email - E-mail do usuário
 * @returns {Promise<Object|null>} Transação ou null
 */
async function findHotmartTransaction(email) {
  try {
    const db = getFirestore();
    const normalizedEmail = email.toLowerCase().trim();
    
    console.log(`🔍 [VERIFY-PURCHASE] Buscando transação para: ${normalizedEmail}`);
    
    const snapshot = await db.collection(COLLECTION_TRANSACTIONS)
      .where('buyerEmail', '==', normalizedEmail)
      .where('status', '==', 'processed')
      .limit(1)
      .get();
    
    if (snapshot.empty) {
      console.log(`⚠️ [VERIFY-PURCHASE] Nenhuma transação encontrada para: ${normalizedEmail}`);
      return null;
    }
    
    const doc = snapshot.docs[0];
    const transaction = doc.data();
    
    console.log(`✅ [VERIFY-PURCHASE] Transação encontrada: ${transaction.transactionId}`);
    
    return {
      id: doc.id,
      ...transaction
    };
    
  } catch (error) {
    console.error('❌ [VERIFY-PURCHASE] Erro ao buscar transação:', error.message);
    throw error;
  }
}

/**
 * Verifica status do plano PRO do usuário
 * @param {string} uid - ID do usuário
 * @returns {Promise<Object>} Status do plano
 */
async function checkProPlanStatus(uid) {
  try {
    const db = getFirestore();
    const userDoc = await db.collection('usuarios').doc(uid).get();
    
    if (!userDoc.exists) {
      return {
        hasPro: false,
        isExpired: true
      };
    }
    
    const userData = userDoc.data();
    const proExpiresAt = userData.proExpiresAt;
    
    if (!proExpiresAt) {
      return {
        hasPro: false,
        isExpired: true
      };
    }
    
    const expiresDate = new Date(proExpiresAt);
    const isExpired = expiresDate < new Date();
    
    return {
      hasPro: !isExpired,
      isExpired,
      expiresAt: proExpiresAt,
      expiresDate
    };
    
  } catch (error) {
    console.error('❌ [VERIFY-PURCHASE] Erro ao verificar status PRO:', error.message);
    throw error;
  }
}

// ═══════════════════════════════════════════════════════════════════
// 🚀 ENDPOINTS
// ═══════════════════════════════════════════════════════════════════

/**
 * POST /api/verify-purchase - Verificar e ativar plano PRO
 * 
 * Fluxo:
 * 1. Verifica autenticação do usuário
 * 2. Busca transação Hotmart pelo e-mail
 * 3. Verifica se plano PRO já está ativo
 * 4. Se tiver compra e não tiver PRO ativo → ativa plano
 * 5. Retorna status completo
 */
router.post('/', requireAuth, async (req, res) => {
  const startTime = Date.now();
  
  try {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('🔍 [VERIFY-PURCHASE] Iniciando verificação manual');
    console.log('👤 [VERIFY-PURCHASE] UID:', req.user.uid);
    console.log('📧 [VERIFY-PURCHASE] E-mail:', req.user.email);
    
    // ═══════════════════════════════════════════════════════════════
    // PASSO 1: Verificar se tem transação Hotmart
    // ═══════════════════════════════════════════════════════════════
    const transaction = await findHotmartTransaction(req.user.email);
    
    if (!transaction) {
      console.log('⚠️ [VERIFY-PURCHASE] Nenhuma compra encontrada');
      console.log('═══════════════════════════════════════════════════════════');
      
      return res.status(404).json({
        success: false,
        error: 'NO_PURCHASE_FOUND',
        message: 'Nenhuma compra Hotmart encontrada para este e-mail',
        email: req.user.email
      });
    }
    
    // ═══════════════════════════════════════════════════════════════
    // PASSO 2: Verificar status atual do plano PRO
    // ═══════════════════════════════════════════════════════════════
    const proStatus = await checkProPlanStatus(req.user.uid);
    
    console.log('📊 [VERIFY-PURCHASE] Status PRO atual:', proStatus);
    
    // ═══════════════════════════════════════════════════════════════
    // PASSO 3: Se já tem PRO ativo, retornar status
    // ═══════════════════════════════════════════════════════════════
    if (proStatus.hasPro && !proStatus.isExpired) {
      console.log('✅ [VERIFY-PURCHASE] Plano PRO já está ativo');
      console.log('═══════════════════════════════════════════════════════════');
      
      return res.json({
        success: true,
        message: 'Plano PRO já está ativo',
        plan: {
          type: 'pro',
          status: 'active',
          expiresAt: proStatus.expiresAt,
          expiresDate: proStatus.expiresDate
        },
        transaction: {
          id: transaction.transactionId,
          processedAt: transaction.processedAt
        }
      });
    }
    
    // ═══════════════════════════════════════════════════════════════
    // PASSO 4: Ativar plano PLUS
    // ═══════════════════════════════════════════════════════════════
    console.log('💳 [VERIFY-PURCHASE] Ativando plano PLUS por verificação manual');
    
    // Garantir documento no Firestore
    await getOrCreateUser(req.user.uid, {
      email: req.user.email,
      origin: 'hotmart-manual-verification'
    });
    
    // Aplicar plano PLUS
    const updatedUser = await applyPlan(req.user.uid, {
      plan: 'plus',
      durationDays: PLUS_DURATION_DAYS
    });
    
    console.log(`✅ [VERIFY-PURCHASE] Plano PLUS ativado: ${req.user.uid} até ${updatedUser.plusExpiresAt}`);
    
    // ═══════════════════════════════════════════════════════════════
    // PASSO 5: Tentar enviar e-mail de boas-vindas (não crítico)
    // ═══════════════════════════════════════════════════════════════
    try {
      await sendWelcomeProEmail({
        email: req.user.email,
        name: transaction.buyerName || req.user.email.split('@')[0],
        tempPassword: null, // Usuário já tem senha
        isNewUser: false,
        expiresAt: updatedUser.plusExpiresAt,
        transactionId: transaction.transactionId
      });
      console.log('📧 [VERIFY-PURCHASE] E-mail de confirmação enviado');
    } catch (emailError) {
      console.error('⚠️ [VERIFY-PURCHASE] Erro ao enviar e-mail (não crítico):', emailError.message);
    }
    
    // ═══════════════════════════════════════════════════════════════
    // PASSO 6: Retornar sucesso
    // ═══════════════════════════════════════════════════════════════
    const elapsed = Date.now() - startTime;
    console.log(`✅ [VERIFY-PURCHASE] Processamento concluído em ${elapsed}ms`);
    console.log('═══════════════════════════════════════════════════════════');
    
    return res.json({
      success: true,
      message: 'Plano PLUS ativado com sucesso!',
      plan: {
        type: 'plus',
        status: 'active',
        expiresAt: updatedUser.plusExpiresAt,
        durationDays: PLUS_DURATION_DAYS
      },
      transaction: {
        id: transaction.transactionId,
        processedAt: transaction.processedAt
      },
      activatedAt: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('💥 [VERIFY-PURCHASE] Erro no processamento:', error);
    console.error('💥 [VERIFY-PURCHASE] Stack:', error.stack);
    console.log('═══════════════════════════════════════════════════════════');
    
    return res.status(500).json({
      success: false,
      error: 'ACTIVATION_ERROR',
      message: 'Erro ao verificar/ativar plano PRO',
      details: error.message
    });
  }
});

/**
 * GET /api/verify-purchase/status - Verificar apenas status (sem ativar)
 */
router.get('/status', requireAuth, async (req, res) => {
  try {
    console.log('🔍 [VERIFY-PURCHASE] Consultando status');
    console.log('👤 [VERIFY-PURCHASE] UID:', req.user.uid);
    
    const [transaction, proStatus] = await Promise.all([
      findHotmartTransaction(req.user.email),
      checkProPlanStatus(req.user.uid)
    ]);
    
    return res.json({
      success: true,
      hasPurchase: !!transaction,
      plan: proStatus.hasPro ? {
        type: 'pro',
        status: 'active',
        expiresAt: proStatus.expiresAt,
        isExpired: proStatus.isExpired
      } : {
        type: 'free',
        status: 'inactive'
      },
      transaction: transaction ? {
        id: transaction.transactionId,
        processedAt: transaction.processedAt
      } : null
    });
    
  } catch (error) {
    console.error('❌ [VERIFY-PURCHASE] Erro ao consultar status:', error.message);
    
    return res.status(500).json({
      success: false,
      error: 'STATUS_ERROR',
      message: 'Erro ao consultar status',
      details: error.message
    });
  }
});

export default router;
