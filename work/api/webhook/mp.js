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

const router = express.Router();

/**
 * GET /api/webhook/mp
 * O Mercado Pago valida a URL do webhook com uma requisição GET antes de ativar.
 * Sem este handler, Express retorna "Cannot GET" (404) e o MP rejeita o endpoint.
 */
router.get('/', (_req, res) => {
  console.error('[MP WEBHOOK] GET health-check recebido');
  res.status(200).json({ ok: true, service: 'mp-webhook' });
});

/**
 * POST /api/webhook/mp
 * Aceita dois formatos de notificação do Mercado Pago:
 *
 * 1. Webhook (novo): POST com body JSON
 *    { action: "payment.created", type: "payment", data: { id: "12345" }, ... }
 *
 * 2. IPN (legado): POST com paymentId em query params
 *    POST /api/webhook/mp?id=12345&topic=payment  (body pode estar vazio)
 */
router.post('/', async (req, res) => {
  const timestamp = new Date().toISOString();
  console.error(`\n[MP WEBHOOK RECEIVED] [${timestamp}] ────────────────────────────────────`);
  console.error('[MP WEBHOOK HIT]');

  const body  = req.body  || {};
  const query = req.query || {};

  console.error(`[MP WEBHOOK] body.type=${body?.type} body.action=${body?.action} body.data.id=${body?.data?.id} query.topic=${query?.topic} query.id=${query?.id}`);

  // Responder 200 imediatamente para evitar timeout do MP.
  // Processamento continua assíncrono.
  res.status(200).json({ received: true });

  // Resolver paymentId — suporta webhook (body.data.id) e IPN (query.id)
  let paymentId = body?.data?.id || query?.id || null;

  // Para formato webhook: validar que type === 'payment'
  // Para formato IPN: topic pode ser 'payment' ou vir como string numérica no campo id
  const isWebhookFormat = !!body?.type;
  if (isWebhookFormat && body.type !== 'payment') {
    console.error(`[MP WEBHOOK] Ignorado — type='${body.type}' não é 'payment'`);
    return;
  }

  // Para IPN sem type no body, topic deve ser 'payment'
  if (!isWebhookFormat && query.topic && query.topic !== 'payment') {
    console.error(`[MP WEBHOOK] Ignorado — IPN topic='${query.topic}' não é 'payment'`);
    return;
  }

  if (!paymentId) {
    console.error('[MP WEBHOOK] paymentId ausente (body.data.id e query.id vazios) — ignorado');
    return;
  }

  // Processar de forma assíncrona após responder 200
  processPayment(String(paymentId), timestamp).catch((err) => {
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

  // 3️⃣ VERIFICAR STATUS DO PAGAMENTO — processar SOMENTE pagamentos aprovados
  // Ignorar: payment.created, payment.updated, pending, in_process, merchant_order
  console.error(`[MP WEBHOOK] PAYMENT STATUS: ${payment.status} | id=${paymentId}`);

  if (payment.status !== 'approved') {
    console.error(`[MP WEBHOOK] Ignorado — status=${payment.status} não é 'approved'`);
    return;
  }

  // 4️⃣ OBTER UID DO USUÁRIO
  // Prioridade: metadata.uid → external_reference
  const uid = payment.metadata?.uid || payment.external_reference;
  console.error(`[MP WEBHOOK] UID: ${uid}`);

  const db             = getFirestore();
  const idempotencyRef = db.collection('processed_mp_payments').doc(String(paymentId));

  if (!uid) {
    console.error(`[MP WEBHOOK] UID ausente no pagamento ${paymentId} — não é possível processar`);
    // Marcar como erro permanente — retry não resolve ausência de uid
    await idempotencyRef.set({
      paymentId: String(paymentId),
      error:     'uid_missing',
      status:    payment.status,
      payerId:   payment.payer?.id || null,
      processedAt: timestamp,
    }).catch((e) => console.error('[MP WEBHOOK] Erro ao marcar idempotência (uid_missing):', e.message));
    return;
  }

  // 5️⃣ ATUALIZAR FIRESTORE — idempotência ATÔMICA + creditsLimit += 1
  //
  // A verificação de idempotência e o incremento de crédito ocorrem na MESMA
  // transação Firestore. Isso elimina race conditions: dois eventos paralelos do
  // MP com o mesmo paymentId não conseguem ambos passar pelo check simultaneamente.
  // Apenas o primeiro a adquirir o lock da transação prossegue; o segundo lê o
  // doc de idempotência já criado e aborta.
  const userRef = db.collection('usuarios').doc(uid);

  try {
    await db.runTransaction(async (tx) => {
      // Verificar idempotência DENTRO da transação (atômica — sem race condition)
      const idempotencySnap = await tx.get(idempotencyRef);
      if (idempotencySnap.exists) {
        console.error(`[MP WEBHOOK] ⚠️ paymentId ${paymentId} já processado — ignorado (idempotência atômica)`);
        throw new Error('already_processed');
      }

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
      // creditsUsed é gerenciado exclusivamente por consumeJobCredit.
      tx.update(userRef, { creditsLimit: newLimit });

      // Marcar como processado ATOMICAMENTE — mesma operação do update de crédito.
      // Garante que duplicação é impossível mesmo com eventos MP paralelos.
      tx.set(idempotencyRef, {
        paymentId:       String(paymentId),
        uid,
        type:            payment.metadata?.type || 'single_credit',
        jobId:           payment.metadata?.jobId || '',
        status:          payment.status,
        amount:          payment.transaction_amount,
        currency:        payment.currency_id,
        paymentMethodId: payment.payment_method_id,
        processedAt:     timestamp,
      });
    });

    console.error(`[MP WEBHOOK] ✅ creditsLimit+1 aplicado — uid=${uid} paymentId=${paymentId}`);
    console.error(`[MP WEBHOOK] ✅ Pagamento ${paymentId} processado com sucesso — uid=${uid}`);
    console.error(`[MP WEBHOOK] ────────────────────────────────────────────────────────────\n`);

  } catch (err) {
    if (err.message === 'already_processed') {
      // Tratado dentro da transação — não é erro fatal
      return;
    }
    // NÃO marcar como processado → permite reprocessamento manual pelo admin
    console.error(`[MP WEBHOOK] ❌ Erro Firestore: ${err.message}`);
  }
}

export default router;
