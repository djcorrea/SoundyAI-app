// work/api/webhook/stripe.js
// Webhook Stripe seguro e idempotente (ASSINATURAS RECORRENTES)

import express from 'express';
import stripe from '../../lib/stripe/config.js';
import { applySubscription, cancelSubscription } from '../../lib/user/userPlans.js';
import { isEventProcessed, markEventAsProcessed } from '../../lib/stripe/idempotency.js';

const router = express.Router();

/**
 * POST /api/webhook/stripe
 * Receber webhooks assinados do Stripe
 * 
 * ⚠️ ATENÇÃO: Este endpoint DEVE usar express.raw() para validar assinatura
 * Configure no server.js:
 * app.use('/api/webhook/stripe', express.raw({ type: 'application/json' }));
 * 
 * EVENTOS SUPORTADOS:
 * - checkout.session.completed: Criação inicial de assinatura
 * - invoice.payment_succeeded: Renovação mensal
 * - customer.subscription.deleted: Cancelamento
 */
router.post('/stripe', async (req, res) => {
  const timestamp = new Date().toISOString();
  console.log(`📨 [STRIPE WEBHOOK] [${timestamp}] Webhook recebido`);

  try {
    // 1️⃣ VALIDAR ASSINATURA STRIPE (HMAC)
    const sig = req.headers['stripe-signature'];
    
    if (!sig) {
      console.error(`❌ [STRIPE WEBHOOK] [${timestamp}] Assinatura ausente`);
      return res.status(400).json({ error: 'No signature' });
    }

    let event;
    
    try {
      // ✅ Validar assinatura usando webhook secret
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.error(`❌ [STRIPE WEBHOOK] [${timestamp}] Assinatura inválida: ${err.message}`);
      return res.status(400).json({ error: `Webhook Error: ${err.message}` });
    }

    console.log(`🔐 [STRIPE WEBHOOK] [${timestamp}] Assinatura validada: ${event.type} | ID: ${event.id}`);

    // 2️⃣ VERIFICAR IDEMPOTÊNCIA (todos os eventos)
    const eventId = event.id;
    const alreadyProcessed = await isEventProcessed(eventId);
    
    if (alreadyProcessed) {
      console.log(`⏭️ [STRIPE WEBHOOK] [${timestamp}] Evento já processado: ${eventId}`);
      return res.status(200).json({ received: true });
    }

    // 3️⃣ ROTEAR PARA HANDLER ESPECÍFICO
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event, eventId, timestamp);
        break;
      
      case 'invoice.payment_succeeded':
        await handleInvoicePaymentSucceeded(event, eventId, timestamp);
        break;
      
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event, eventId, timestamp);
        break;
      
      default:
        console.log(`⏭️ [STRIPE WEBHOOK] [${timestamp}] Evento ignorado: ${event.type}`);
        return res.status(200).json({ received: true });
    }

    console.log(`✅ [STRIPE WEBHOOK] [${timestamp}] Evento processado: ${eventId}`);

    // 🔟 RETORNAR 200 (SEMPRE)
    return res.status(200).json({ received: true });

  } catch (error) {
    console.error(`❌ [STRIPE WEBHOOK] [${timestamp}] Erro crítico: ${error.message}`);
    console.error(error.stack);
    
    // ✅ SEMPRE retornar 200 (evitar reenvios infinitos)
    return res.status(200).json({ received: true });
  }
});

/**
 * HANDLER: checkout.session.completed
 * Criar assinatura inicial quando checkout é completado
 */
async function handleCheckoutCompleted(event, eventId, timestamp) {
  const session = event.data.object;
  
  console.log(`📦 [STRIPE][${timestamp}][CHECKOUT] Session ID: ${session.id} | Mode: ${session.mode}`);
  
  // Se não for subscription, ignorar (pode ser pagamento único futuro)
  if (session.mode !== 'subscription') {
    console.log(`⏭️ [STRIPE][${timestamp}][CHECKOUT] Modo não é subscription: ${session.mode}`);
    await markEventAsProcessed(eventId, {
      sessionId: session.id,
      mode: session.mode,
      result: 'ignored_non_subscription',
    });
    return;
  }
  
  // ✅ Modo subscription confirmado, processar criação inicial
  console.log(`🔔 [STRIPE][${timestamp}][CHECKOUT] Processando subscription: ${session.id}`);

  // Buscar session completa
  let fullSession;
  try {
    fullSession = await stripe.checkout.sessions.retrieve(session.id, {
      expand: ['subscription']
    });
  } catch (error) {
    console.error(`❌ [STRIPE][${timestamp}][CHECKOUT] Erro ao buscar session: ${error.message}`);
    await markEventAsProcessed(eventId, {
      error: 'session_retrieval_failed',
      sessionId: session.id,
    });
    return;
  }

  // Validar pagamento
  if (fullSession.payment_status !== 'paid') {
    console.log(`⏭️ [STRIPE][${timestamp}][CHECKOUT] Pagamento não confirmado: ${fullSession.payment_status}`);
    await markEventAsProcessed(eventId, {
      sessionId: session.id,
      paymentStatus: fullSession.payment_status,
      result: 'payment_not_confirmed',
    });
    return;
  }

  // Extrair metadata
  const metadata = fullSession.metadata;
  if (!metadata || !metadata.uid || !metadata.plan) {
    console.error(`❌ [STRIPE][${timestamp}][CHECKOUT] Metadata incompleta:`, metadata);
    await markEventAsProcessed(eventId, {
      error: 'metadata_incomplete',
      sessionId: session.id,
    });
    return;
  }

  const { uid, plan } = metadata;

  // Validar plano
  if (plan !== 'plus' && plan !== 'pro') {
    console.error(`❌ [STRIPE][${timestamp}][CHECKOUT] Plano inválido: ${plan}`);
    await markEventAsProcessed(eventId, {
      error: 'invalid_plan',
      sessionId: session.id,
      uid,
      plan,
    });
    return;
  }

  // Obter subscription
  const subscription = fullSession.subscription;
  if (!subscription) {
    console.error(`❌ [STRIPE][${timestamp}][CHECKOUT] Subscription ausente`);
    await markEventAsProcessed(eventId, {
      error: 'subscription_missing',
      sessionId: session.id,
      uid,
      plan,
    });
    return;
  }

  // Obter detalhes da subscription
  const subscriptionId = typeof subscription === 'string' ? subscription : subscription.id;
  const subscriptionObj = typeof subscription === 'string' 
    ? await stripe.subscriptions.retrieve(subscriptionId)
    : subscription;

  const priceId = subscriptionObj.items.data[0]?.price?.id;
  const currentPeriodEnd = new Date(subscriptionObj.current_period_end * 1000);

  console.log(`📋 [STRIPE][${timestamp}][CHECKOUT] UID=${uid} | Plan=${plan} | Sub=${subscriptionId} | PeriodEnd=${currentPeriodEnd.toISOString()}`);

  // Ativar assinatura
  try {
    await applySubscription(uid, {
      plan,
      subscriptionId,
      status: 'active',
      currentPeriodEnd,
      priceId,
    });

    console.log(`✅ [STRIPE][${timestamp}][CHECKOUT] Assinatura ativada: ${uid} → ${plan}`);
  } catch (error) {
    console.error(`❌ [STRIPE][${timestamp}][CHECKOUT] Erro ao ativar assinatura: ${error.message}`);
    await markEventAsProcessed(eventId, {
      error: 'subscription_activation_failed',
      errorMessage: error.message,
      sessionId: session.id,
      uid,
      plan,
      subscriptionId,
    });
    return;
  }

  // Registrar idempotência
  await markEventAsProcessed(eventId, {
    eventType: 'checkout.session.completed',
    sessionId: session.id,
    uid,
    plan,
    subscriptionId,
    priceId,
    currentPeriodEnd: currentPeriodEnd.toISOString(),
    status: 'success',
  });
}

/**
 * HANDLER: invoice.payment_succeeded
 * Renovar assinatura quando pagamento mensal é bem-sucedido
 */
async function handleInvoicePaymentSucceeded(event, eventId, timestamp) {
  const invoice = event.data.object;
  
  console.log(`💳 [STRIPE][${timestamp}][RENEWAL] Invoice: ${invoice.id} | Sub: ${invoice.subscription}`);

  // Ignorar se não tiver subscription
  if (!invoice.subscription) {
    console.log(`⏭️ [STRIPE][${timestamp}][RENEWAL] Invoice sem subscription`);
    await markEventAsProcessed(eventId, {
      invoiceId: invoice.id,
      result: 'no_subscription',
    });
    return;
  }

  // Buscar subscription
  let subscription;
  try {
    subscription = await stripe.subscriptions.retrieve(invoice.subscription);
  } catch (error) {
    console.error(`❌ [STRIPE][${timestamp}][RENEWAL] Erro ao buscar subscription: ${error.message}`);
    await markEventAsProcessed(eventId, {
      error: 'subscription_retrieval_failed',
      invoiceId: invoice.id,
      subscriptionId: invoice.subscription,
    });
    return;
  }

  // Extrair dados
  const subscriptionId = subscription.id;
  const priceId = subscription.items.data[0]?.price?.id;
  const currentPeriodEnd = new Date(subscription.current_period_end * 1000);
  const customerId = subscription.customer;

  // Buscar UID via metadata da subscription ou customer
  let uid = subscription.metadata?.uid;
  
  if (!uid) {
    // Tentar buscar via customer
    try {
      const customer = await stripe.customers.retrieve(customerId);
      uid = customer.metadata?.uid;
    } catch (error) {
      console.error(`❌ [STRIPE][${timestamp}][RENEWAL] Erro ao buscar customer: ${error.message}`);
    }
  }

  if (!uid) {
    console.error(`❌ [STRIPE][${timestamp}][RENEWAL] UID não encontrado em subscription nem customer`);
    await markEventAsProcessed(eventId, {
      error: 'uid_not_found',
      invoiceId: invoice.id,
      subscriptionId,
    });
    return;
  }

  // Determinar plano via priceId
  let plan;
  if (priceId === process.env.STRIPE_PRICE_ID_PLUS) {
    plan = 'plus';
  } else if (priceId === process.env.STRIPE_PRICE_ID_PRO) {
    plan = 'pro';
  } else {
    console.error(`❌ [STRIPE][${timestamp}][RENEWAL] Price ID não reconhecido: ${priceId}`);
    await markEventAsProcessed(eventId, {
      error: 'unknown_price_id',
      invoiceId: invoice.id,
      subscriptionId,
      priceId,
    });
    return;
  }

  console.log(`📋 [STRIPE][${timestamp}][RENEWAL] UID=${uid} | Plan=${plan} | Sub=${subscriptionId} | PeriodEnd=${currentPeriodEnd.toISOString()}`);

  // Renovar assinatura
  try {
    await applySubscription(uid, {
      plan,
      subscriptionId,
      status: 'active',
      currentPeriodEnd,
      priceId,
    });

    console.log(`✅ [STRIPE][${timestamp}][RENEWAL] Assinatura renovada: ${uid} → ${plan}`);
  } catch (error) {
    console.error(`❌ [STRIPE][${timestamp}][RENEWAL] Erro ao renovar assinatura: ${error.message}`);
    await markEventAsProcessed(eventId, {
      error: 'subscription_renewal_failed',
      errorMessage: error.message,
      invoiceId: invoice.id,
      uid,
      plan,
      subscriptionId,
    });
    return;
  }

  // Registrar idempotência
  await markEventAsProcessed(eventId, {
    eventType: 'invoice.payment_succeeded',
    invoiceId: invoice.id,
    uid,
    plan,
    subscriptionId,
    priceId,
    currentPeriodEnd: currentPeriodEnd.toISOString(),
    status: 'success',
  });
}

/**
 * HANDLER: customer.subscription.deleted
 * Cancelar assinatura (aguarda fim do período)
 */
async function handleSubscriptionDeleted(event, eventId, timestamp) {
  const subscription = event.data.object;
  
  console.log(`🚫 [STRIPE][${timestamp}][CANCEL] Sub: ${subscription.id} | Status: ${subscription.status}`);

  const subscriptionId = subscription.id;
  const priceId = subscription.items.data[0]?.price?.id;
  const currentPeriodEnd = new Date(subscription.current_period_end * 1000);
  const customerId = subscription.customer;

  // Buscar UID
  let uid = subscription.metadata?.uid;
  
  if (!uid) {
    try {
      const customer = await stripe.customers.retrieve(customerId);
      uid = customer.metadata?.uid;
    } catch (error) {
      console.error(`❌ [STRIPE][${timestamp}][CANCEL] Erro ao buscar customer: ${error.message}`);
    }
  }

  if (!uid) {
    console.error(`❌ [STRIPE][${timestamp}][CANCEL] UID não encontrado`);
    await markEventAsProcessed(eventId, {
      error: 'uid_not_found',
      subscriptionId,
    });
    return;
  }

  // Determinar plano
  let plan;
  if (priceId === process.env.STRIPE_PRICE_ID_PLUS) {
    plan = 'plus';
  } else if (priceId === process.env.STRIPE_PRICE_ID_PRO) {
    plan = 'pro';
  } else {
    console.error(`❌ [STRIPE][${timestamp}][CANCEL] Price ID não reconhecido: ${priceId}`);
    await markEventAsProcessed(eventId, {
      error: 'unknown_price_id',
      subscriptionId,
      priceId,
    });
    return;
  }

  console.log(`📋 [STRIPE][${timestamp}][CANCEL] UID=${uid} | Plan=${plan} | Sub=${subscriptionId} | PeriodEnd=${currentPeriodEnd.toISOString()}`);

  // Cancelar assinatura (marcar como cancelada mas aguardar fim do período)
  try {
    await cancelSubscription(uid, {
      subscriptionId,
      currentPeriodEnd,
    });

    console.log(`✅ [STRIPE][${timestamp}][CANCEL] Assinatura cancelada (ativa até ${currentPeriodEnd.toISOString()}): ${uid}`);
  } catch (error) {
    console.error(`❌ [STRIPE][${timestamp}][CANCEL] Erro ao cancelar assinatura: ${error.message}`);
    await markEventAsProcessed(eventId, {
      error: 'subscription_cancellation_failed',
      errorMessage: error.message,
      subscriptionId,
      uid,
      plan,
    });
    return;
  }

  // Registrar idempotência
  await markEventAsProcessed(eventId, {
    eventType: 'customer.subscription.deleted',
    subscriptionId,
    uid,
    plan,
    currentPeriodEnd: currentPeriodEnd.toISOString(),
    status: 'success',
  });
}

/**
 * GET /api/webhook/stripe/health
 * Health check do webhook Stripe
 */
router.get('/stripe/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'stripe-webhook',
    timestamp: new Date().toISOString(),
  });
});

export default router;
