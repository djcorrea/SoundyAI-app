// work/api/webhook/stripe.js
// Webhook Stripe seguro e idempotente - VERSÃO COMPLETA
// Trata todos os eventos críticos de assinatura

import express from 'express';
import stripe, { STRIPE_PRICE_IDS, getPlanFromPriceId } from '../../lib/stripe/config.js';
import { applySubscription, cancelSubscription, downgradeToFree } from '../../lib/user/userPlans.js';
import { isEventProcessed, markEventAsProcessed } from '../../lib/stripe/idempotency.js';

const router = express.Router();

/**
 * POST /api/webhook/stripe
 * Webhook principal para eventos do Stripe
 * 
 * EVENTOS TRATADOS:
 * - checkout.session.completed → Ativa plano após pagamento
 * - customer.subscription.created → Assinatura criada
 * - customer.subscription.updated → Status alterado (active, past_due, etc)
 * - customer.subscription.deleted → Assinatura cancelada
 * - invoice.payment_succeeded → Renovação confirmada
 * - invoice.payment_failed → Falha no pagamento
 */
router.post('/', async (req, res) => {
  const timestamp = new Date().toISOString();
  console.log(`\n📨 [STRIPE WEBHOOK] [${timestamp}] ════════════════════════════════════════`);

  try {
    // 1️⃣ VALIDAR ASSINATURA HMAC
    const sig = req.headers['stripe-signature'];
    
    if (!sig) {
      console.error(`❌ [STRIPE WEBHOOK] Assinatura HMAC ausente`);
      return res.status(400).json({ error: 'Missing stripe-signature header' });
    }

    let event;
    
    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.error(`❌ [STRIPE WEBHOOK] Assinatura inválida: ${err.message}`);
      return res.status(400).json({ error: `Webhook signature verification failed: ${err.message}` });
    }

    console.log(`🔐 [STRIPE WEBHOOK] Evento validado: ${event.type} (${event.id})`);

    // 2️⃣ VERIFICAR IDEMPOTÊNCIA
    const eventId = event.id;
    const alreadyProcessed = await isEventProcessed(eventId);
    
    if (alreadyProcessed) {
      console.log(`⏭️ [STRIPE WEBHOOK] Evento já processado (idempotência): ${eventId}`);
      return res.status(200).json({ received: true, status: 'already_processed' });
    }

    // 3️⃣ PROCESSAR EVENTO
    let result = { status: 'ignored', reason: 'unhandled_event_type' };

    switch (event.type) {
      // ═══════════════════════════════════════════════════════════════════
      // CHECKOUT: Usuário completou o pagamento inicial
      // ═══════════════════════════════════════════════════════════════════
      case 'checkout.session.completed':
        result = await handleCheckoutCompleted(event, eventId, timestamp);
        break;
      
      // ═══════════════════════════════════════════════════════════════════
      // SUBSCRIPTION CREATED: Nova assinatura criada
      // ═══════════════════════════════════════════════════════════════════
      case 'customer.subscription.created':
        result = await handleSubscriptionCreated(event, eventId, timestamp);
        break;
      
      // ═══════════════════════════════════════════════════════════════════
      // SUBSCRIPTION UPDATED: Status alterado (active, past_due, canceled, etc)
      // ═══════════════════════════════════════════════════════════════════
      case 'customer.subscription.updated':
        result = await handleSubscriptionUpdated(event, eventId, timestamp);
        break;
      
      // ═══════════════════════════════════════════════════════════════════
      // SUBSCRIPTION DELETED: Assinatura deletada/expirada
      // ═══════════════════════════════════════════════════════════════════
      case 'customer.subscription.deleted':
        result = await handleSubscriptionDeleted(event, eventId, timestamp);
        break;
      
      // ═══════════════════════════════════════════════════════════════════
      // INVOICE PAID: Renovação bem-sucedida
      // ═══════════════════════════════════════════════════════════════════
      case 'invoice.payment_succeeded':
        result = await handleInvoicePaymentSucceeded(event, eventId, timestamp);
        break;
      
      // ═══════════════════════════════════════════════════════════════════
      // INVOICE FAILED: Falha no pagamento
      // ═══════════════════════════════════════════════════════════════════
      case 'invoice.payment_failed':
        result = await handleInvoicePaymentFailed(event, eventId, timestamp);
        break;
      
      default:
        console.log(`⏭️ [STRIPE WEBHOOK] Evento ignorado (não tratado): ${event.type}`);
    }

    console.log(`✅ [STRIPE WEBHOOK] Evento processado: ${eventId} → ${result.status}`);
    console.log(`════════════════════════════════════════════════════════════════════════\n`);
    
    return res.status(200).json({ received: true, ...result });

  } catch (error) {
    console.error(`❌ [STRIPE WEBHOOK] Erro crítico: ${error.message}`);
    console.error(`   Stack: ${error.stack}`);
    
    // ⚠️ IMPORTANTE: Retornar 200 mesmo em erro para evitar retry infinito do Stripe
    return res.status(200).json({ received: true, error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// HANDLER: checkout.session.completed
// ═══════════════════════════════════════════════════════════════════════════════
async function handleCheckoutCompleted(event, eventId, timestamp) {
  const session = event.data.object;
  
  console.log(`📦 [STRIPE CHECKOUT] Session ID: ${session.id}`);
  console.log(`   Mode: ${session.mode}`);
  console.log(`   Payment Status: ${session.payment_status}`);
  
  // Apenas processar subscriptions
  if (session.mode !== 'subscription') {
    console.log(`⏭️ [STRIPE CHECKOUT] Ignorado (mode: ${session.mode})`);
    await markEventAsProcessed(eventId, {
      eventType: 'checkout.session.completed',
      sessionId: session.id,
      mode: session.mode,
      result: 'ignored_non_subscription',
    });
    return { status: 'ignored', reason: 'not_subscription_mode' };
  }

  // Verificar se pagamento foi confirmado
  if (session.payment_status !== 'paid') {
    console.log(`⏭️ [STRIPE CHECKOUT] Pagamento não confirmado: ${session.payment_status}`);
    await markEventAsProcessed(eventId, {
      eventType: 'checkout.session.completed',
      sessionId: session.id,
      paymentStatus: session.payment_status,
      result: 'payment_not_confirmed',
    });
    return { status: 'ignored', reason: 'payment_not_confirmed' };
  }

  // Buscar session completa com expansion
  let fullSession;
  try {
    fullSession = await stripe.checkout.sessions.retrieve(session.id, {
      expand: ['subscription', 'subscription.default_payment_method', 'customer']
    });
  } catch (error) {
    console.error(`❌ [STRIPE CHECKOUT] Erro ao buscar session: ${error.message}`);
    await markEventAsProcessed(eventId, {
      eventType: 'checkout.session.completed',
      error: 'session_retrieval_failed',
      errorMessage: error.message,
      sessionId: session.id,
    });
    return { status: 'error', error: 'session_retrieval_failed' };
  }

  // Extrair UID do usuário (tentar metadata, depois client_reference_id)
  const uid = fullSession.metadata?.uid || fullSession.client_reference_id;
  const plan = fullSession.metadata?.plan;

  if (!uid) {
    console.error(`❌ [STRIPE CHECKOUT] UID não encontrado na session`);
    console.log(`   Metadata: ${JSON.stringify(fullSession.metadata)}`);
    console.log(`   Client Ref ID: ${fullSession.client_reference_id}`);
    await markEventAsProcessed(eventId, {
      eventType: 'checkout.session.completed',
      error: 'uid_not_found',
      sessionId: session.id,
      metadata: fullSession.metadata,
      clientRefId: fullSession.client_reference_id,
    });
    return { status: 'error', error: 'uid_not_found' };
  }

  if (!plan || (plan !== 'plus' && plan !== 'pro')) {
    console.error(`❌ [STRIPE CHECKOUT] Plano inválido: ${plan}`);
    await markEventAsProcessed(eventId, {
      eventType: 'checkout.session.completed',
      error: 'invalid_plan',
      sessionId: session.id,
      uid,
      plan,
    });
    return { status: 'error', error: 'invalid_plan' };
  }

  // Extrair dados da subscription
  const subscription = fullSession.subscription;
  if (!subscription) {
    console.error(`❌ [STRIPE CHECKOUT] Subscription ausente`);
    await markEventAsProcessed(eventId, {
      eventType: 'checkout.session.completed',
      error: 'subscription_missing',
      sessionId: session.id,
      uid,
      plan,
    });
    return { status: 'error', error: 'subscription_missing' };
  }

  const subscriptionId = typeof subscription === 'string' ? subscription : subscription.id;
  const subscriptionObj = typeof subscription === 'string' 
    ? await stripe.subscriptions.retrieve(subscriptionId)
    : subscription;

  const priceId = subscriptionObj.items.data[0]?.price?.id;
  const currentPeriodEnd = new Date(subscriptionObj.current_period_end * 1000);
  const customerId = fullSession.customer?.id || fullSession.customer;

  console.log(`📋 [STRIPE CHECKOUT] Dados extraídos:`);
  console.log(`   UID: ${uid}`);
  console.log(`   Plan: ${plan}`);
  console.log(`   Subscription ID: ${subscriptionId}`);
  console.log(`   Customer ID: ${customerId}`);
  console.log(`   Price ID: ${priceId}`);
  console.log(`   Current Period End: ${currentPeriodEnd.toISOString()}`);

  // Aplicar assinatura no Firestore
  try {
    await applySubscription(uid, {
      plan,
      subscriptionId,
      customerId,
      status: 'active',
      currentPeriodEnd,
      priceId,
    });

    console.log(`✅ [STRIPE CHECKOUT] Assinatura ativada: ${uid} → ${plan.toUpperCase()}`);
  } catch (error) {
    console.error(`❌ [STRIPE CHECKOUT] Erro ao ativar assinatura: ${error.message}`);
    await markEventAsProcessed(eventId, {
      eventType: 'checkout.session.completed',
      error: 'subscription_activation_failed',
      errorMessage: error.message,
      sessionId: session.id,
      uid,
      plan,
      subscriptionId,
    });
    return { status: 'error', error: 'subscription_activation_failed' };
  }

  await markEventAsProcessed(eventId, {
    eventType: 'checkout.session.completed',
    sessionId: session.id,
    uid,
    plan,
    subscriptionId,
    customerId,
    priceId,
    currentPeriodEnd: currentPeriodEnd.toISOString(),
    status: 'success',
  });

  return { status: 'success', uid, plan };
}

// ═══════════════════════════════════════════════════════════════════════════════
// HANDLER: customer.subscription.created
// ═══════════════════════════════════════════════════════════════════════════════
async function handleSubscriptionCreated(event, eventId, timestamp) {
  const subscription = event.data.object;
  
  console.log(`🆕 [STRIPE SUB CREATED] Subscription ID: ${subscription.id}`);
  console.log(`   Status: ${subscription.status}`);
  
  // Extrair UID da metadata
  const uid = subscription.metadata?.uid;
  
  if (!uid) {
    // Tentar buscar do customer
    try {
      const customer = await stripe.customers.retrieve(subscription.customer);
      const customerUid = customer.metadata?.uid;
      
      if (!customerUid) {
        console.log(`⏭️ [STRIPE SUB CREATED] UID não encontrado, será processado no checkout.session.completed`);
        await markEventAsProcessed(eventId, {
          eventType: 'customer.subscription.created',
          subscriptionId: subscription.id,
          result: 'uid_not_found_delegated_to_checkout',
        });
        return { status: 'delegated', reason: 'will_process_in_checkout_completed' };
      }
    } catch (error) {
      console.log(`⏭️ [STRIPE SUB CREATED] Erro ao buscar customer, delegando: ${error.message}`);
      await markEventAsProcessed(eventId, {
        eventType: 'customer.subscription.created',
        subscriptionId: subscription.id,
        result: 'customer_fetch_failed_delegated',
      });
      return { status: 'delegated', reason: 'will_process_in_checkout_completed' };
    }
  }

  // Se chegou aqui com UID, processar
  const priceId = subscription.items.data[0]?.price?.id;
  const plan = getPlanFromPriceId(priceId) || subscription.metadata?.plan;
  
  if (!plan) {
    console.error(`❌ [STRIPE SUB CREATED] Plano não identificado para price: ${priceId}`);
    await markEventAsProcessed(eventId, {
      eventType: 'customer.subscription.created',
      error: 'plan_not_identified',
      subscriptionId: subscription.id,
      priceId,
    });
    return { status: 'error', error: 'plan_not_identified' };
  }

  await markEventAsProcessed(eventId, {
    eventType: 'customer.subscription.created',
    subscriptionId: subscription.id,
    uid,
    plan,
    status: subscription.status,
    result: 'logged',
  });

  return { status: 'logged', uid, plan };
}

// ═══════════════════════════════════════════════════════════════════════════════
// HANDLER: customer.subscription.updated
// ═══════════════════════════════════════════════════════════════════════════════
async function handleSubscriptionUpdated(event, eventId, timestamp) {
  const subscription = event.data.object;
  const previousAttributes = event.data.previous_attributes || {};
  
  console.log(`🔄 [STRIPE SUB UPDATED] Subscription ID: ${subscription.id}`);
  console.log(`   Status: ${subscription.status}`);
  console.log(`   Previous Status: ${previousAttributes.status || 'N/A'}`);

  // Verificar se o status mudou
  if (previousAttributes.status === subscription.status) {
    console.log(`⏭️ [STRIPE SUB UPDATED] Status não mudou, ignorando`);
    await markEventAsProcessed(eventId, {
      eventType: 'customer.subscription.updated',
      subscriptionId: subscription.id,
      status: subscription.status,
      result: 'status_unchanged',
    });
    return { status: 'ignored', reason: 'status_unchanged' };
  }

  // Extrair UID
  let uid = subscription.metadata?.uid;
  
  if (!uid) {
    try {
      const customer = await stripe.customers.retrieve(subscription.customer);
      uid = customer.metadata?.uid;
    } catch (error) {
      console.error(`❌ [STRIPE SUB UPDATED] Erro ao buscar customer: ${error.message}`);
    }
  }

  if (!uid) {
    console.error(`❌ [STRIPE SUB UPDATED] UID não encontrado`);
    await markEventAsProcessed(eventId, {
      eventType: 'customer.subscription.updated',
      error: 'uid_not_found',
      subscriptionId: subscription.id,
    });
    return { status: 'error', error: 'uid_not_found' };
  }

  const priceId = subscription.items.data[0]?.price?.id;
  const plan = getPlanFromPriceId(priceId) || subscription.metadata?.plan;
  const currentPeriodEnd = new Date(subscription.current_period_end * 1000);
  const subscriptionId = subscription.id;
  const customerId = subscription.customer;

  console.log(`📋 [STRIPE SUB UPDATED] UID: ${uid}, Plan: ${plan}, Status: ${subscription.status}`);

  // Processar baseado no novo status
  try {
    switch (subscription.status) {
      case 'active':
        // Assinatura ativa - garantir que plano está liberado
        await applySubscription(uid, {
          plan,
          subscriptionId,
          customerId,
          status: 'active',
          currentPeriodEnd,
          priceId,
        });
        console.log(`✅ [STRIPE SUB UPDATED] Plano reativado: ${uid} → ${plan}`);
        break;

      case 'past_due':
        // Pagamento atrasado - marcar status mas manter acesso (grace period)
        await applySubscription(uid, {
          plan,
          subscriptionId,
          customerId,
          status: 'past_due',
          currentPeriodEnd,
          priceId,
        });
        console.log(`⚠️ [STRIPE SUB UPDATED] Assinatura em atraso: ${uid}`);
        break;

      case 'unpaid':
        // Pagamento falhou múltiplas vezes - rebaixar para free
        await downgradeToFree(uid, {
          subscriptionId,
          reason: 'unpaid',
        });
        console.log(`🔻 [STRIPE SUB UPDATED] Rebaixado para FREE (unpaid): ${uid}`);
        break;

      case 'canceled':
        // Cancelada mas ainda ativa até fim do período
        await cancelSubscription(uid, {
          subscriptionId,
          currentPeriodEnd,
        });
        console.log(`🚫 [STRIPE SUB UPDATED] Cancelada (ativa até ${currentPeriodEnd.toISOString()}): ${uid}`);
        break;

      case 'incomplete':
      case 'incomplete_expired':
        // Pagamento inicial falhou
        await downgradeToFree(uid, {
          subscriptionId,
          reason: subscription.status,
        });
        console.log(`🔻 [STRIPE SUB UPDATED] Rebaixado para FREE (${subscription.status}): ${uid}`);
        break;

      default:
        console.log(`⏭️ [STRIPE SUB UPDATED] Status não tratado: ${subscription.status}`);
    }
  } catch (error) {
    console.error(`❌ [STRIPE SUB UPDATED] Erro ao processar: ${error.message}`);
    await markEventAsProcessed(eventId, {
      eventType: 'customer.subscription.updated',
      error: 'processing_failed',
      errorMessage: error.message,
      subscriptionId,
      uid,
      status: subscription.status,
    });
    return { status: 'error', error: error.message };
  }

  await markEventAsProcessed(eventId, {
    eventType: 'customer.subscription.updated',
    subscriptionId,
    uid,
    plan,
    previousStatus: previousAttributes.status,
    newStatus: subscription.status,
    currentPeriodEnd: currentPeriodEnd.toISOString(),
    status: 'success',
  });

  return { status: 'success', uid, plan, newStatus: subscription.status };
}

// ═══════════════════════════════════════════════════════════════════════════════
// HANDLER: customer.subscription.deleted
// ═══════════════════════════════════════════════════════════════════════════════
async function handleSubscriptionDeleted(event, eventId, timestamp) {
  const subscription = event.data.object;
  
  console.log(`🚫 [STRIPE SUB DELETED] Subscription ID: ${subscription.id}`);

  // Extrair UID
  let uid = subscription.metadata?.uid;
  
  if (!uid) {
    try {
      const customer = await stripe.customers.retrieve(subscription.customer);
      uid = customer.metadata?.uid;
    } catch (error) {
      console.error(`❌ [STRIPE SUB DELETED] Erro ao buscar customer: ${error.message}`);
    }
  }

  if (!uid) {
    console.error(`❌ [STRIPE SUB DELETED] UID não encontrado`);
    await markEventAsProcessed(eventId, {
      eventType: 'customer.subscription.deleted',
      error: 'uid_not_found',
      subscriptionId: subscription.id,
    });
    return { status: 'error', error: 'uid_not_found' };
  }

  const subscriptionId = subscription.id;
  const currentPeriodEnd = new Date(subscription.current_period_end * 1000);
  const priceId = subscription.items.data[0]?.price?.id;
  const plan = getPlanFromPriceId(priceId) || subscription.metadata?.plan;

  console.log(`📋 [STRIPE SUB DELETED] UID: ${uid}, Plan: ${plan}`);

  try {
    // Verificar se período já expirou
    const now = new Date();
    if (now >= currentPeriodEnd) {
      // Já expirou - rebaixar imediatamente
      await downgradeToFree(uid, {
        subscriptionId,
        reason: 'subscription_deleted_expired',
      });
      console.log(`🔻 [STRIPE SUB DELETED] Rebaixado para FREE imediatamente: ${uid}`);
    } else {
      // Ainda no período - marcar como cancelado
      await cancelSubscription(uid, {
        subscriptionId,
        currentPeriodEnd,
      });
      console.log(`✅ [STRIPE SUB DELETED] Cancelada (ativa até ${currentPeriodEnd.toISOString()}): ${uid}`);
    }
  } catch (error) {
    console.error(`❌ [STRIPE SUB DELETED] Erro ao processar: ${error.message}`);
    await markEventAsProcessed(eventId, {
      eventType: 'customer.subscription.deleted',
      error: 'processing_failed',
      errorMessage: error.message,
      subscriptionId,
      uid,
    });
    return { status: 'error', error: error.message };
  }

  await markEventAsProcessed(eventId, {
    eventType: 'customer.subscription.deleted',
    subscriptionId,
    uid,
    plan,
    currentPeriodEnd: currentPeriodEnd.toISOString(),
    status: 'success',
  });

  return { status: 'success', uid, plan };
}

// ═══════════════════════════════════════════════════════════════════════════════
// HANDLER: invoice.payment_succeeded
// ═══════════════════════════════════════════════════════════════════════════════
async function handleInvoicePaymentSucceeded(event, eventId, timestamp) {
  const invoice = event.data.object;
  
  console.log(`💳 [STRIPE INVOICE SUCCESS] Invoice ID: ${invoice.id}`);
  console.log(`   Billing Reason: ${invoice.billing_reason}`);

  // Ignorar invoices que não são de subscription
  if (!invoice.subscription) {
    console.log(`⏭️ [STRIPE INVOICE SUCCESS] Invoice sem subscription`);
    await markEventAsProcessed(eventId, {
      eventType: 'invoice.payment_succeeded',
      invoiceId: invoice.id,
      result: 'no_subscription',
    });
    return { status: 'ignored', reason: 'no_subscription' };
  }

  // Para invoices iniciais, deixar checkout.session.completed tratar
  if (invoice.billing_reason === 'subscription_create') {
    console.log(`⏭️ [STRIPE INVOICE SUCCESS] Invoice inicial, delegando para checkout.session.completed`);
    await markEventAsProcessed(eventId, {
      eventType: 'invoice.payment_succeeded',
      invoiceId: invoice.id,
      billingReason: invoice.billing_reason,
      result: 'delegated_to_checkout',
    });
    return { status: 'delegated', reason: 'initial_invoice_handled_by_checkout' };
  }

  // Buscar subscription para extrair dados
  let subscription;
  try {
    subscription = await stripe.subscriptions.retrieve(invoice.subscription);
  } catch (error) {
    console.error(`❌ [STRIPE INVOICE SUCCESS] Erro ao buscar subscription: ${error.message}`);
    await markEventAsProcessed(eventId, {
      eventType: 'invoice.payment_succeeded',
      error: 'subscription_retrieval_failed',
      invoiceId: invoice.id,
      subscriptionId: invoice.subscription,
    });
    return { status: 'error', error: 'subscription_retrieval_failed' };
  }

  // Extrair UID
  let uid = subscription.metadata?.uid;
  
  if (!uid) {
    try {
      const customer = await stripe.customers.retrieve(subscription.customer);
      uid = customer.metadata?.uid;
    } catch (error) {
      console.error(`❌ [STRIPE INVOICE SUCCESS] Erro ao buscar customer: ${error.message}`);
    }
  }

  if (!uid) {
    console.error(`❌ [STRIPE INVOICE SUCCESS] UID não encontrado`);
    await markEventAsProcessed(eventId, {
      eventType: 'invoice.payment_succeeded',
      error: 'uid_not_found',
      invoiceId: invoice.id,
      subscriptionId: invoice.subscription,
    });
    return { status: 'error', error: 'uid_not_found' };
  }

  const subscriptionId = subscription.id;
  const priceId = subscription.items.data[0]?.price?.id;
  const plan = getPlanFromPriceId(priceId) || subscription.metadata?.plan;
  const currentPeriodEnd = new Date(subscription.current_period_end * 1000);
  const customerId = subscription.customer;

  if (!plan) {
    console.error(`❌ [STRIPE INVOICE SUCCESS] Plano não identificado: ${priceId}`);
    await markEventAsProcessed(eventId, {
      eventType: 'invoice.payment_succeeded',
      error: 'plan_not_identified',
      invoiceId: invoice.id,
      subscriptionId,
      priceId,
    });
    return { status: 'error', error: 'plan_not_identified' };
  }

  console.log(`📋 [STRIPE INVOICE SUCCESS] UID: ${uid}, Plan: ${plan}, Reason: ${invoice.billing_reason}`);

  // Renovar/atualizar assinatura
  try {
    await applySubscription(uid, {
      plan,
      subscriptionId,
      customerId,
      status: 'active',
      currentPeriodEnd,
      priceId,
    });

    console.log(`✅ [STRIPE INVOICE SUCCESS] Assinatura renovada: ${uid} → ${plan}`);
  } catch (error) {
    console.error(`❌ [STRIPE INVOICE SUCCESS] Erro ao renovar: ${error.message}`);
    await markEventAsProcessed(eventId, {
      eventType: 'invoice.payment_succeeded',
      error: 'subscription_renewal_failed',
      errorMessage: error.message,
      invoiceId: invoice.id,
      uid,
      plan,
    });
    return { status: 'error', error: 'subscription_renewal_failed' };
  }

  await markEventAsProcessed(eventId, {
    eventType: 'invoice.payment_succeeded',
    invoiceId: invoice.id,
    subscriptionId,
    uid,
    plan,
    billingReason: invoice.billing_reason,
    currentPeriodEnd: currentPeriodEnd.toISOString(),
    status: 'success',
  });

  return { status: 'success', uid, plan };
}

// ═══════════════════════════════════════════════════════════════════════════════
// HANDLER: invoice.payment_failed
// ═══════════════════════════════════════════════════════════════════════════════
async function handleInvoicePaymentFailed(event, eventId, timestamp) {
  const invoice = event.data.object;
  
  console.log(`❌ [STRIPE INVOICE FAILED] Invoice ID: ${invoice.id}`);
  console.log(`   Attempt Count: ${invoice.attempt_count}`);
  console.log(`   Next Attempt: ${invoice.next_payment_attempt ? new Date(invoice.next_payment_attempt * 1000).toISOString() : 'N/A'}`);

  if (!invoice.subscription) {
    console.log(`⏭️ [STRIPE INVOICE FAILED] Invoice sem subscription`);
    await markEventAsProcessed(eventId, {
      eventType: 'invoice.payment_failed',
      invoiceId: invoice.id,
      result: 'no_subscription',
    });
    return { status: 'ignored', reason: 'no_subscription' };
  }

  // Buscar subscription
  let subscription;
  try {
    subscription = await stripe.subscriptions.retrieve(invoice.subscription);
  } catch (error) {
    console.error(`❌ [STRIPE INVOICE FAILED] Erro ao buscar subscription: ${error.message}`);
    await markEventAsProcessed(eventId, {
      eventType: 'invoice.payment_failed',
      error: 'subscription_retrieval_failed',
      invoiceId: invoice.id,
    });
    return { status: 'error', error: 'subscription_retrieval_failed' };
  }

  // Extrair UID
  let uid = subscription.metadata?.uid;
  
  if (!uid) {
    try {
      const customer = await stripe.customers.retrieve(subscription.customer);
      uid = customer.metadata?.uid;
    } catch (error) {
      console.error(`❌ [STRIPE INVOICE FAILED] Erro ao buscar customer: ${error.message}`);
    }
  }

  if (!uid) {
    console.error(`❌ [STRIPE INVOICE FAILED] UID não encontrado`);
    await markEventAsProcessed(eventId, {
      eventType: 'invoice.payment_failed',
      error: 'uid_not_found',
      invoiceId: invoice.id,
    });
    return { status: 'error', error: 'uid_not_found' };
  }

  const subscriptionId = subscription.id;
  const priceId = subscription.items.data[0]?.price?.id;
  const plan = getPlanFromPriceId(priceId) || subscription.metadata?.plan;

  console.log(`📋 [STRIPE INVOICE FAILED] UID: ${uid}, Plan: ${plan}, Attempts: ${invoice.attempt_count}`);

  // Decidir ação baseado no número de tentativas e status
  try {
    // Se subscription já está unpaid ou canceled, rebaixar
    if (subscription.status === 'unpaid' || subscription.status === 'canceled') {
      await downgradeToFree(uid, {
        subscriptionId,
        reason: `payment_failed_${subscription.status}`,
      });
      console.log(`🔻 [STRIPE INVOICE FAILED] Rebaixado para FREE: ${uid}`);
    } else if (subscription.status === 'past_due') {
      // Ainda em grace period - atualizar status mas manter acesso
      await applySubscription(uid, {
        plan,
        subscriptionId,
        customerId: subscription.customer,
        status: 'past_due',
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        priceId,
      });
      console.log(`⚠️ [STRIPE INVOICE FAILED] Marcado como past_due: ${uid}`);
    }
  } catch (error) {
    console.error(`❌ [STRIPE INVOICE FAILED] Erro ao processar: ${error.message}`);
    await markEventAsProcessed(eventId, {
      eventType: 'invoice.payment_failed',
      error: 'processing_failed',
      errorMessage: error.message,
      invoiceId: invoice.id,
      uid,
    });
    return { status: 'error', error: error.message };
  }

  await markEventAsProcessed(eventId, {
    eventType: 'invoice.payment_failed',
    invoiceId: invoice.id,
    subscriptionId,
    uid,
    plan,
    attemptCount: invoice.attempt_count,
    subscriptionStatus: subscription.status,
    status: 'success',
  });

  return { status: 'success', uid, plan, subscriptionStatus: subscription.status };
}

export default router;
