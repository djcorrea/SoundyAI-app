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
  console.log('🔔 [WEBHOOK] Notificação recebida do Mercado Pago');
  console.log('📋 [WEBHOOK] Body:', JSON.stringify(req.body, null, 2));

  try {
    // Mercado Pago envia notificações de diferentes tipos
    const { type, data } = req.body;

    // Só processar notificações de pagamento
    if (type !== 'payment') {
      console.log(`⚠️ [WEBHOOK] Tipo ignorado: ${type}`);
      return res.status(200).send('OK');
    }

    // Obter ID do pagamento
    const paymentId = data?.id;
    if (!paymentId) {
      console.error('❌ [WEBHOOK] ID de pagamento ausente');
      return res.status(400).json({ error: 'Payment ID missing' });
    }

    console.log(`🔍 [WEBHOOK] Buscando detalhes do pagamento: ${paymentId}`);

    // Buscar detalhes completos do pagamento
    const paymentData = await getPaymentDetails(paymentId);
    
    console.log('💳 [WEBHOOK] Status do pagamento:', paymentData.status);
    console.log('👤 [WEBHOOK] External reference:', paymentData.external_reference);

    // Só processar pagamentos aprovados
    if (paymentData.status !== 'approved') {
      console.log(`⚠️ [WEBHOOK] Pagamento não aprovado: ${paymentData.status}`);
      return res.status(200).send('OK');
    }

    // Obter UID do Firebase (enviado como external_reference no frontend)
    const uid = paymentData.external_reference;
    if (!uid) {
      console.error('❌ [WEBHOOK] External reference (UID) ausente');
      return res.status(400).json({ error: 'User UID missing' });
    }

    // Determinar qual plano aplicar
    const planConfig = determinePlan(paymentData);
    console.log(`📦 [WEBHOOK] Aplicando plano: ${planConfig.plan} (${planConfig.durationDays} dias) para ${uid}`);

    // Aplicar plano no Firestore
    await applyPlan(uid, planConfig);

    console.log(`✅ [WEBHOOK] Plano aplicado com sucesso: ${uid} → ${planConfig.plan}`);

    // SEMPRE responder 200 OK para evitar reenvios
    return res.status(200).json({
      success: true,
      message: 'Plano aplicado com sucesso',
      uid,
      plan: planConfig.plan,
      durationDays: planConfig.durationDays
    });

  } catch (error) {
    console.error('💥 [WEBHOOK] Erro ao processar webhook:', error);
    console.error('💥 [WEBHOOK] Stack:', error.stack);

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
