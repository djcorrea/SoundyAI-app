// work/api/webhook/mp.js
// POST /api/webhook/mp
// Webhook Mercado Pago — processa pagamentos de crédito avulso.
//
// ARQUITETURA:
//  • Mercado Pago é o ÚNICO responsável por crédito avulso (single_credit).
//  • Stripe trata exclusivamente planos (Plus / Pro).
//  • creditsUsed NUNCA é alterado por pagamento — apenas creditsLimit += 1.
//
// Fluxo:
//  1. Recebe notificação MP (action: payment.created / payment.updated)
//  2. Se type !== 'payment' → ignorar (200 OK silencioso)
//  3. Buscar pagamento via API Mercado Pago
//  4. Se payment.status !== 'approved' → ignorar
//  5. Idempotência: se paymentId já processado → ignorar
//  6. Obter uid = payment.metadata.uid (fallback: payment.external_reference)
//  7. Firestore transaction: creditsLimit += 1  (creditsUsed INTOCADO)
//  8. markPaymentAsProcessed → nunca antes

import express from 'express';
import { getFirestore } from '../../../firebase/admin.js';
import { isPaymentProcessed, markPaymentAsProcessed } from '../../lib/mp/idempotency.js';

const router = express.Router();

/**
 * POST /api/webhook/mp
 * Corpo: JSON enviado pelo Mercado Pago
 * {
 *   action: "payment.created" | "payment.updated",
 *   type:   "payment",
 *   data:   { id: "12345678" },
 *   ...
 * }
 */
router.post('/', async (req, res) => {
  const timestamp = new Date().toISOString();
  console.error(`\n[MP WEBHOOK RECEIVED] [${timestamp}] ────────────────────────────────────`);

  const body = req.body;
  console.error(`[MP WEBHOOK] type=${body?.type} action=${body?.action} dataId=${body?.data?.id}`);

  // Responder 200 imediatamente para evitar timeout do MP
  // O processamento continua assíncrono
  res.status(200).json({ received: true });

  // 1️⃣ VERIFICAR TIPO DO EVENTO
  if (body?.type !== 'payment') {
    console.error(`[MP WEBHOOK] Ignorado — type=${body?.type} não é 'payment'`);
    return;
  }

  const paymentId = body?.data?.id;
  if (!paymentId) {
    console.error('[MP WEBHOOK] data.id ausente — ignorado');
    return;
  }

  // Processar de forma assíncrona após responder 200
  processPayment(paymentId, timestamp).catch((err) => {
    console.error(`[MP WEBHOOK] Erro não tratado em processPayment(${paymentId}):`, err.message);
  });
});

/**
 * Processa um pagamento MP de forma idempotente.
 * Busca o pagamento na API MP, valida status e atualiza Firestore.
 * @param {string} paymentId
 * @param {string} timestamp
 */
async function processPayment(paymentId, timestamp) {
  const accessToken = process.env.MP_ACCESS_TOKEN;
  if (!accessToken) {
    console.error('[MP WEBHOOK] MP_ACCESS_TOKEN não configurado — abortando');
    return;
  }

  // 2️⃣ BUSCAR PAGAMENTO NA API MERCADO PAGO
  let payment;
  try {
    const response = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error(`[MP WEBHOOK] Erro ao buscar payment ${paymentId}: HTTP ${response.status} — ${errBody}`);
      return;
    }

    payment = await response.json();
  } catch (err) {
    console.error(`[MP WEBHOOK] Falha na requisição à API MP para payment ${paymentId}:`, err.message);
    return;
  }

  // 3️⃣ VERIFICAR STATUS DO PAGAMENTO
  console.error(`[MP WEBHOOK] PAYMENT STATUS: ${payment.status} | id=${paymentId}`);

  if (payment.status !== 'approved') {
    console.error(`[MP WEBHOOK] Ignorado — status=${payment.status} não é 'approved'`);
    return;
  }

  // 4️⃣ IDEMPOTÊNCIA — verificar se já foi processado
  const alreadyProcessed = await isPaymentProcessed(paymentId);
  if (alreadyProcessed) {
    console.error(`[MP WEBHOOK] Pagamento ${paymentId} já processado — ignorado (idempotência)`);
    return;
  }

  // 5️⃣ OBTER UID DO USUÁRIO
  // Prioridade: metadata.uid → external_reference
  const uid = payment.metadata?.uid || payment.external_reference;
  console.error(`[MP WEBHOOK] UID: ${uid}`);

  if (!uid) {
    console.error(`[MP WEBHOOK] UID ausente no pagamento ${paymentId} — não é possível processar`);
    // Marcar como processado (erro permanente — retry não resolve falta de uid)
    await markPaymentAsProcessed(paymentId, {
      status:  payment.status,
      error:   'uid_missing',
      payerId: payment.payer?.id,
    }).catch((e) => console.error('[MP WEBHOOK] Erro ao marcar idempotência (uid_missing):', e.message));
    return;
  }

  // 6️⃣ ATUALIZAR FIRESTORE — creditsLimit += 1
  const db      = getFirestore();
  const userRef = db.collection('usuarios').doc(uid);

  try {
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(userRef);

      if (!snap.exists) {
        throw new Error(`user_not_found: uid=${uid}`);
      }

      const data         = snap.data() || {};
      const currentLimit = Math.max(typeof data.creditsLimit === 'number' ? data.creditsLimit : 0, 0);
      const currentUsed  = typeof data.creditsUsed === 'number' ? data.creditsUsed : 0;
      const newLimit     = currentLimit + 1;

      console.error(`[MP WEBHOOK] CREDITS BEFORE: creditsLimit=${currentLimit} creditsUsed=${currentUsed}`);
      console.error(`[MP WEBHOOK] CREDITS AFTER:  creditsLimit=${newLimit}     creditsUsed=${currentUsed} (inalterado)`);

      // ⚠️ REGRA ABSOLUTA: NUNCA alterar creditsUsed aqui.
      // creditsUsed é gerenciado exclusivamente por consumeJobCredit (após conclusão do DSP).
      tx.update(userRef, {
        creditsLimit: newLimit,
      });
    });

    console.error(`[MP WEBHOOK] ✅ creditsLimit+1 aplicado — uid=${uid} paymentId=${paymentId}`);
  } catch (err) {
    // NÃO marcar como processado → permite que o admin reprocesse manualmente
    console.error(`[MP WEBHOOK] ❌ Erro Firestore ao atualizar creditsLimit: ${err.message}`);
    return;
  }

  // 7️⃣ MARCAR COMO PROCESSADO — SOMENTE após sucesso confirmado
  await markPaymentAsProcessed(paymentId, {
    uid,
    type:      payment.metadata?.type || 'single_credit',
    jobId:     payment.metadata?.jobId || '',
    status:    payment.status,
    amount:    payment.transaction_amount,
    currency:  payment.currency_id,
    processedAt: timestamp,
    paymentMethodId: payment.payment_method_id,
  });

  console.error(`[MP WEBHOOK] ✅ Pagamento ${paymentId} processado com sucesso — uid=${uid}`);
  console.error(`[MP WEBHOOK] ────────────────────────────────────────────────────────────\n`);
}

export default router;
