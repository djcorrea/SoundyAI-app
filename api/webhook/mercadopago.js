/**
 * 💳 WEBHOOK MERCADO PAGO - Aplicação Automática de Planos
 * ✅ Recebe notificações de pagamentos aprovados
 * ✅ Valida status do pagamento via API Mercado Pago
 * ✅ Aplica plano automaticamente no Firestore
 * ✅ Suporta: PRO mensal (30 dias) e Combo Lançamento (120 dias)
 */

import express from 'express';
import fetch from 'node-fetch';
import { applyPlan } from '../../work/lib/user/userPlans.js';
import { isPaymentProcessed, markPaymentAsProcessed } from '../../work/lib/mercadopago/idempotency.js';
import { validateMercadoPagoSignature } from '../../work/lib/mercadopago/signature.js';

const router = express.Router();

// Produtos configurados (mapear IDs do Mercado Pago para planos)
const PRODUCTS = {
  // Ajustar estes IDs de acordo com os produtos criados no Mercado Pago
  'PRO_MONTHLY': { plan: 'pro', durationDays: 30 },
  'PRO_COMBO_120': { plan: 'pro', durationDays: 120 },
  'PLUS_MONTHLY': { plan: 'plus', durationDays: 30 },
};

/**
 * Buscar detalhes do pagamento na API do Mercado Pago
 */
async function getPaymentDetails(paymentId) {
  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
  
  if (!accessToken) {
    throw new Error('MERCADOPAGO_ACCESS_TOKEN não configurado');
  }

  const response = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`Mercado Pago API error: ${response.status}`);
  }

  return response.json();
}

/**
 * Determinar qual plano aplicar baseado em metadados ou ID do produto
 */
function determinePlan(paymentData) {
  // Opção 1: Verificar metadata se o frontend enviou
  if (paymentData.metadata?.product_id) {
    const productId = paymentData.metadata.product_id;
    if (PRODUCTS[productId]) {
      return PRODUCTS[productId];
    }
  }

  // Opção 2: Verificar description
  const description = paymentData.description?.toLowerCase() || '';
  
  if (description.includes('combo') || description.includes('120 dias')) {
    return { plan: 'pro', durationDays: 120 };
  }
  
  if (description.includes('plus')) {
    return { plan: 'plus', durationDays: 30 };
  }
  
  // Padrão: PRO mensal
  return { plan: 'pro', durationDays: 30 };
}

/**
 * POST /webhook/mercadopago - Receber notificações do Mercado Pago
 */
router.post('/mercadopago', async (req, res) => {
  const timestamp = new Date().toISOString();
  console.log(`🔔 [WEBHOOK] [${timestamp}] Notificação recebida do Mercado Pago`);
  console.log('📋 [WEBHOOK] Body:', JSON.stringify(req.body, null, 2));

  try {
    // 1️⃣ VALIDAR ASSINATURA HMAC
    const isSignatureValid = validateMercadoPagoSignature(req);
    if (!isSignatureValid) {
      console.error(`❌ [WEBHOOK] [${timestamp}] Assinatura inválida`);
      // ✅ Retornar 200 para evitar reenvios (segurança)
      return res.status(200).json({ received: true, error: 'invalid_signature' });
    }
    
    console.log(`🔐 [WEBHOOK] [${timestamp}] Assinatura validada`);

    // 2️⃣ FILTRAR TIPO DE NOTIFICAÇÃO
    // Mercado Pago envia notificações de diferentes tipos
    const { type, data } = req.body;

    // Só processar notificações de pagamento
    if (type !== 'payment') {
      console.log(`⚠️ [WEBHOOK] [${timestamp}] Tipo ignorado: ${type}`);
      return res.status(200).send('OK');
    }

    // 3️⃣ OBTER ID DO PAGAMENTO
    const paymentId = data?.id;
    if (!paymentId) {
      console.error(`❌ [WEBHOOK] [${timestamp}] ID de pagamento ausente`);
      return res.status(400).json({ error: 'Payment ID missing' });
    }
    
    // 4️⃣ VERIFICAR IDEMPOTÊNCIA
    const alreadyProcessed = await isPaymentProcessed(paymentId);
    if (alreadyProcessed) {
      console.log(`⏭️ [WEBHOOK] [${timestamp}] Pagamento já processado: ${paymentId}`);
      return res.status(200).json({ received: true, already_processed: true });
    }

    console.log(`🔍 [WEBHOOK] [${timestamp}] Buscando detalhes do pagamento: ${paymentId}`);

    // 5️⃣ BUSCAR DETALHES DO PAGAMENTO NA API
    // Buscar detalhes completos do pagamento
    const paymentData = await getPaymentDetails(paymentId);
    
    console.log(`💳 [WEBHOOK] [${timestamp}] Status do pagamento: ${paymentData.status}`);
    console.log(`👤 [WEBHOOK] [${timestamp}] External reference (UID): ${paymentData.external_reference}`);

    // 6️⃣ VALIDAR STATUS DO PAGAMENTO
    // Só processar pagamentos aprovados
    if (paymentData.status !== 'approved') {
      console.log(`⚠️ [WEBHOOK] [${timestamp}] Pagamento não aprovado: ${paymentData.status}`);
      
      // ✅ Marcar como processado mesmo sem aprovação (evitar reprocessamento)
      await markPaymentAsProcessed(paymentId, {
        status: paymentData.status,
        uid: paymentData.external_reference,
        result: 'payment_not_approved',
      });
      
      return res.status(200).send('OK');
    }

    // 7️⃣ VALIDAR UID DO USUÁRIO
    // Obter UID do Firebase (enviado como external_reference no frontend)
    const uid = paymentData.external_reference;
    if (!uid) {
      console.error(`❌ [WEBHOOK] [${timestamp}] External reference (UID) ausente`);
      
      // ✅ Marcar como processado com erro
      await markPaymentAsProcessed(paymentId, {
        error: 'uid_missing',
        status: paymentData.status,
        result: 'error',
      });
      
      return res.status(400).json({ error: 'User UID missing' });
    }

    // 8️⃣ DETERMINAR PLANO
    // Determinar qual plano aplicar
    const planConfig = determinePlan(paymentData);
    console.log(`📦 [WEBHOOK] [${timestamp}] Plano determinado: ${planConfig.plan} (${planConfig.durationDays} dias) para ${uid}`);

    // 9️⃣ APLICAR PLANO (ÚNICO PONTO DE MUTAÇÃO)
    try {
      await applyPlan(uid, planConfig);
      console.log(`✅ [WEBHOOK] [${timestamp}] Plano aplicado com sucesso: ${uid} → ${planConfig.plan}`);
      
      // 🔟 REGISTRAR IDEMPOTÊNCIA
      await markPaymentAsProcessed(paymentId, {
        uid: uid,
        plan: planConfig.plan,
        durationDays: planConfig.durationDays,
        status: paymentData.status,
        paymentType: paymentData.payment_type_id,
        amount: paymentData.transaction_amount,
        currency: paymentData.currency_id,
        result: 'success',
      });
      
    } catch (error) {
      console.error(`❌ [WEBHOOK] [${timestamp}] Erro ao aplicar plano: ${error.message}`);
      
      // ✅ Registrar idempotência mesmo com erro (evitar reprocessamento)
      await markPaymentAsProcessed(paymentId, {
        error: 'plan_activation_failed',
        errorMessage: error.message,
        uid: uid,
        plan: planConfig.plan,
        result: 'error',
      });
    }

    // SEMPRE responder 200 OK para evitar reenvios
    return res.status(200).json({
      success: true,
      message: 'Webhook processado',
      paymentId,
    });

  } catch (error) {
    const timestamp = new Date().toISOString();
    console.error(`💥 [WEBHOOK] [${timestamp}] Erro ao processar webhook:`, error);
    console.error(`💥 [WEBHOOK] [${timestamp}] Stack:`, error.stack);

    // SEMPRE responder 200 OK mesmo em erro para evitar reenvios
    // O Mercado Pago reenvia automaticamente se receber 4xx/5xx
    return res.status(200).json({
      success: false,
      error: 'Internal error',
      message: 'Webhook recebido mas houve erro no processamento'
    });
  }
});

/**
 * GET /webhook/mercadopago - Endpoint de health check
 */
router.get('/mercadopago', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Mercado Pago Webhook',
    timestamp: new Date().toISOString()
  });
});

export default router;
